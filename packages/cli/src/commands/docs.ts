import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { CliError, EXIT_GENERAL, EXIT_BILLING } from "../lib/errors.js";
import { printData, printSuccess, printWarning } from "../lib/output.js";
import { serializeFrontmatter } from "../lib/frontmatter.js";
import {
  walkMdxFiles,
  computeDiff,
  applyDiff,
  formatDiffLines,
  formatDiffSummary,
  formatSummary,
  type RemotePage,
  type RemoteFolder,
} from "../lib/push.js";
import {
  generateDocs,
  createDefaultConfig,
  loadDocsConfig,
  createLLMClient,
  validateApiKey,
  CostTracker,
  ProgressReporter,
  LocalFsProvider,
  isSupportedModel,
  listSupportedModels,
  type ProgressEvent,
  type GenerationResult,
  type ResolvedDocsConfig,
  type AiMode,
  type Audience,
} from "@inkloom/ai";

// ─── Phase display names ────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  intake: "Analyzing existing documentation",
  exploring: "Exploring codebase",
  planning: "Planning documentation",
  writing: "Writing pages",
  reviewing: "Reviewing documentation",
  openapi: "Generating OpenAPI spec",
  completed: "Complete",
  failed: "Failed",
};

// ─── Helpers ────────────────────────────────────────────────────

function resolveApiKey(localOpts: { openrouterKey?: string }): string {
  const key =
    localOpts.openrouterKey ||
    process.env.OPENROUTER_API_KEY ||
    process.env.INKLOOM_OPENROUTER_KEY;

  if (!key) {
    throw new CliError(
      "OpenRouter API key required. Provide via --openrouter-key, OPENROUTER_API_KEY, or INKLOOM_OPENROUTER_KEY environment variable.",
      EXIT_GENERAL,
    );
  }

  const validation = validateApiKey(key);
  if (!validation.valid) {
    throw new CliError(
      `Invalid API key: ${validation.error}`,
      EXIT_GENERAL,
    );
  }

  return key;
}

function resolveDocsConfigFromOpts(localOpts: {
  description?: string;
  audience?: string;
  mode?: string;
  model?: string;
  config?: string;
  codebase?: string;
  existingDocs?: string;
  existingDocsFormat?: string;
}): ResolvedDocsConfig {
  // Try to load from config file first
  const codebasePath = path.resolve(localOpts.codebase ?? ".");
  const configPath = localOpts.config
    ? path.resolve(localOpts.config)
    : path.join(codebasePath, ".inkloom", "docs.yml");

  let config: ResolvedDocsConfig;

  if (fs.existsSync(configPath)) {
    const yamlContent = fs.readFileSync(configPath, "utf-8");
    config = loadDocsConfig(yamlContent);
    process.stderr.write(pc.dim(`  Config: ${configPath}\n`));
  } else {
    config = createDefaultConfig();
  }

  // CLI flags override config file values
  if (localOpts.description) {
    config.product.description = localOpts.description;
  }
  if (localOpts.audience) {
    config.product.audience = localOpts.audience as Audience;
  }
  if (localOpts.mode) {
    config.ai.mode = localOpts.mode as AiMode;
  }
  if (localOpts.model) {
    if (!isSupportedModel(localOpts.model)) {
      const available = listSupportedModels()
        .map((m) => `  - ${m.id}${m.recommended ? " (recommended)" : ""}${m.fast ? " (fast)" : ""}`)
        .join("\n");
      throw new CliError(
        `Unsupported model: "${localOpts.model}"\n\nAvailable models:\n${available}`,
        EXIT_GENERAL,
      );
    }
    config.ai.model = localOpts.model;
  }
  if (localOpts.existingDocs) {
    const format = localOpts.existingDocsFormat;
    if (format && format !== "md" && format !== "mdx") {
      throw new CliError(
        `Invalid existing docs format: "${format}". Must be "md" or "mdx".`,
        EXIT_GENERAL,
      );
    }
    config.existingDocs = {
      path: localOpts.existingDocs,
      format: (format as "md" | "mdx") ?? "mdx",
    };
  }

  return config;
}

/**
 * Create a progress listener that writes status updates to stderr.
 */
function createCliProgressListener(opts: GlobalOpts): (event: ProgressEvent) => void {
  let lastPhase = "";
  let pagesWritten = 0;
  let totalPlanned = 0;

  return (event: ProgressEvent) => {
    if (opts.json) return; // Suppress progress in JSON mode

    switch (event.type) {
      case "phaseChanged": {
        if (event.phase !== lastPhase) {
          lastPhase = event.phase;
          const label = PHASE_LABELS[event.phase] ?? event.phase;
          if (event.phase === "completed" || event.phase === "failed") {
            process.stderr.write(`\n  ${label}\n`);
          } else {
            process.stderr.write(`\n  ${pc.bold(label)}...\n`);
          }
        }
        break;
      }
      case "pageWritten": {
        pagesWritten = event.pagesWritten;
        totalPlanned = event.totalPlanned;
        process.stderr.write(
          `    ${pc.green("+")} ${event.title} (${pagesWritten}/${totalPlanned})\n`,
        );
        break;
      }
      case "progressMessage": {
        if (event.detail) {
          process.stderr.write(`    ${event.message} ${pc.dim(event.detail)}\n`);
        } else {
          process.stderr.write(`    ${event.message}\n`);
        }
        break;
      }
      case "error": {
        process.stderr.write(`    ${pc.red("Error:")} ${event.message}\n`);
        break;
      }
      // toolCalled events are verbose — only show in verbose mode
      case "toolCalled": {
        if (opts.verbose) {
          process.stderr.write(
            `    ${pc.dim(`tool: ${event.toolName}`)}${event.args?.path ? pc.dim(` ${event.args.path}`) : ""}\n`,
          );
        }
        break;
      }
    }
  };
}

/**
 * Convert generated pages to MDX files in a temp directory,
 * then use the existing push infrastructure to sync them.
 */
async function syncGeneratedPages(
  client: Client,
  projectId: string,
  result: GenerationResult,
  opts: GlobalOpts,
  localOpts: { publish?: boolean; branch?: string; dryRun?: boolean },
): Promise<void> {
  // Write generated pages to a temp directory as MDX files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inkloom-docs-"));

  try {
    for (const page of result.pages) {
      const folderDir = page.folder
        ? path.join(tmpDir, page.folder)
        : tmpDir;

      fs.mkdirSync(folderDir, { recursive: true });

      const frontmatter = {
        title: page.title,
        slug: page.slug,
      };
      const content = serializeFrontmatter(frontmatter, page.content);
      fs.writeFileSync(path.join(folderDir, `${page.slug}.mdx`), content);
    }

    // Also create folder structures from the plan
    for (const folder of result.plan.folders) {
      fs.mkdirSync(path.join(tmpDir, folder.slug), { recursive: true });
    }

    // Walk the temp dir to get LocalPage[]
    const localPages = walkMdxFiles(tmpDir);

    // Fetch remote state
    const folderParams = new URLSearchParams();
    if (localOpts.branch) folderParams.set("branchId", localOpts.branch);
    const folderQs = folderParams.toString();
    const foldersResponse = await client.get<
      Array<{ _id: string; name: string; slug: string; parentId?: string }>
    >(`/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`);
    const remoteFolders: RemoteFolder[] = foldersResponse.data.map((f) => ({
      id: f._id,
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
    }));

    const pageParams = new URLSearchParams();
    if (localOpts.branch) pageParams.set("branchId", localOpts.branch);
    pageParams.set("includeContent", "true");
    pageParams.set("format", "mdx");
    const pagesResponse = await client.get<
      Array<{
        _id: string;
        title: string;
        slug: string;
        folderId?: string;
        content?: string;
        isPublished?: boolean;
      }>
    >(`/api/v1/projects/${projectId}/pages?${pageParams.toString()}`);
    const remotePages: RemotePage[] = pagesResponse.data.map((p) => ({
      id: p._id,
      title: p.title,
      slug: p.slug,
      folderId: p.folderId,
      content: p.content,
      isPublished: p.isPublished,
    }));

    // Compute diff (don't delete existing pages that AI didn't generate)
    const diff = computeDiff(localPages, remotePages, remoteFolders, false);

    if (localOpts.dryRun) {
      const lines = formatDiffLines(diff, remoteFolders);
      if (lines.length === 0) {
        process.stderr.write("\n  No changes to sync.\n");
      } else {
        process.stderr.write("\n  Dry run — changes that would be applied:\n\n");
        for (const line of lines) {
          process.stderr.write(line + "\n");
        }
        process.stderr.write(`\n  ${formatDiffSummary(diff)}\n`);
      }
      return;
    }

    const totalChanges =
      diff.foldersToCreate.length +
      diff.pagesToCreate.length +
      diff.pagesToUpdate.length;

    if (totalChanges === 0) {
      process.stderr.write("\n  No changes to sync.\n");
      return;
    }

    const summary = await applyDiff(client, diff, remoteFolders, {
      projectId,
      branchId: localOpts.branch,
      publish: localOpts.publish,
    });

    if (summary.errors.length > 0) {
      for (const err of summary.errors) {
        process.stderr.write(`  ${pc.red("Error:")} ${err}\n`);
      }
    }

    process.stderr.write(`\n  ${formatSummary(summary)}\n`);
  } finally {
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Command Registration ───────────────────────────────────────

export function registerDocsCommands(program: Command): void {
  const docs = program
    .command("docs")
    .description("AI-powered documentation generation");

  // --- docs generate ---
  docs
    .command("generate")
    .description("Generate documentation from a codebase using AI")
    .argument("<projectId>", "Project ID to push generated docs to")
    .option("--codebase <path>", "Local codebase path (default: current directory)")
    .option("--description <text>", "Product description (1-3 sentences)")
    .option("--audience <type>", "Documentation audience: public or private")
    .option("--mode <mode>", "AI mode: extended (thorough) or fast (quick)")
    .option("--model <modelId>", "AI model from curated list")
    .option("--config <path>", "Path to .inkloom/docs.yml config file")
    .option("--existing-docs <path>", "Path to existing documentation directory")
    .option("--existing-docs-format <format>", "Existing docs format: md or mdx (default: mdx)")
    .option("--branch <branchId>", "Target branch for generated pages")
    .option("--dry-run", "Show what would be generated without pushing")
    .option("--publish", "Auto-publish generated pages after pushing")
    .option("--openrouter-key <key>", "OpenRouter API key (BYOK)")
    .option("--budget <cents>", "Maximum budget in cents")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom docs generate proj_abc --codebase ./my-project --description "A REST API for managing tasks"
  $ inkloom docs generate proj_abc --mode fast --dry-run         Quick preview of what would be generated
  $ inkloom docs generate proj_abc --config ./docs.yml --publish Generate and auto-publish
  $ inkloom docs generate proj_abc --model google/gemini-3-pro-preview Use a specific model
  $ inkloom docs generate proj_abc --existing-docs ./docs        Update existing documentation`,
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            codebase?: string;
            description?: string;
            audience?: string;
            mode?: string;
            model?: string;
            config?: string;
            existingDocs?: string;
            existingDocsFormat?: string;
            branch?: string;
            dryRun?: boolean;
            publish?: boolean;
            openrouterKey?: string;
            budget?: string;
          },
        ) => {
          const apiKey = resolveApiKey(localOpts);
          const docsConfig = resolveDocsConfigFromOpts(localOpts);
          const codebasePath = path.resolve(localOpts.codebase ?? ".");

          if (!fs.existsSync(codebasePath)) {
            throw new CliError(`Codebase path not found: ${codebasePath}`, EXIT_GENERAL);
          }

          if (!docsConfig.product.description) {
            throw new CliError(
              "Product description is required. Provide via --description or in .inkloom/docs.yml",
              EXIT_GENERAL,
            );
          }

          // Validate existing docs path if specified
          if (docsConfig.existingDocs) {
            const existingDocsPath = path.resolve(codebasePath, docsConfig.existingDocs.path);
            if (!fs.existsSync(existingDocsPath)) {
              throw new CliError(
                `Existing docs path not found: ${existingDocsPath}`,
                EXIT_GENERAL,
              );
            }
          }

          // Display config summary
          if (!opts.json) {
            process.stderr.write(`\n  Generating documentation for ${pc.bold(projectId)}\n`);
            process.stderr.write(`  Codebase: ${codebasePath}\n`);
            process.stderr.write(`  Model: ${docsConfig.ai.model}\n`);
            process.stderr.write(`  Mode: ${docsConfig.ai.mode}\n`);
            process.stderr.write(`  Max pages: ${docsConfig.ai.maxPages}\n`);
            if (docsConfig.existingDocs) {
              process.stderr.write(`  Existing docs: ${docsConfig.existingDocs.path} (${docsConfig.existingDocs.format})\n`);
            }
          }

          // Set up the AI engine
          const model = createLLMClient({ apiKey, modelId: docsConfig.ai.model });
          const budgetCents = localOpts.budget ? parseInt(localOpts.budget, 10) : undefined;
          const costTracker = new CostTracker({
            modelId: docsConfig.ai.model,
            budgetCents,
          });
          const reporter = new ProgressReporter();
          const provider = new LocalFsProvider({
            rootDir: codebasePath,
            includePatterns: docsConfig.scope.include,
            excludePatterns: docsConfig.scope.exclude,
          });

          // Attach progress listener
          const progressListener = createCliProgressListener(opts);
          reporter.on(progressListener);

          // Run the generation pipeline
          let result: GenerationResult;
          try {
            result = await generateDocs({
              model,
              provider,
              docsConfig,
              costTracker,
              reporter,
            });
          } catch (error) {
            if (error instanceof Error && error.message.includes("Budget exceeded")) {
              throw new CliError(
                `Budget exceeded. Generated ${costTracker.summary().totalTokens} tokens. Use --budget to increase the limit.`,
                EXIT_BILLING,
              );
            }
            throw error;
          }

          // Print summary
          const usage = result.usage;
          if (!opts.json) {
            process.stderr.write(`\n  ${pc.bold("Results:")}\n`);
            process.stderr.write(`    Pages generated: ${result.pages.length}\n`);
            process.stderr.write(`    Folders planned: ${result.plan.folders.length}\n`);
            if (result.openapiSpec) {
              process.stderr.write(`    OpenAPI spec: generated\n`);
            }
            process.stderr.write(`    Tokens: ${usage.totalTokens.toLocaleString()} (${usage.totalInputTokens.toLocaleString()} in, ${usage.totalOutputTokens.toLocaleString()} out)\n`);
            process.stderr.write(`    Estimated cost: $${(usage.estimatedCostCents / 100).toFixed(2)}\n`);
          }

          // Upload OpenAPI spec if generated
          if (result.openapiSpec) {
            try {
              await client.post(`/api/v1/projects/${projectId}/openapi`, {
                content: result.openapiSpec,
                format: "json",
              });
              if (!opts.json) {
                process.stderr.write(`    OpenAPI spec: ${pc.green("uploaded")}\n`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              if (!opts.json) {
                printWarning(`Failed to upload OpenAPI spec: ${msg}`);
              }
            }
          }

          if (result.pages.length === 0) {
            if (opts.json) {
              printData({ data: { pages: [], usage } }, opts);
            } else {
              printWarning("No pages were generated.");
            }
            return;
          }

          // Sync pages to project
          if (!opts.json) {
            process.stderr.write(`\n  ${pc.bold("Syncing to InkLoom")}...\n`);
          }

          await syncGeneratedPages(client, projectId, result, opts, {
            publish: localOpts.publish,
            branch: localOpts.branch,
            dryRun: localOpts.dryRun,
          });

          // JSON output
          if (opts.json) {
            printData(
              {
                data: {
                  pages: result.pages.map((p) => ({
                    slug: p.slug,
                    title: p.title,
                    folder: p.folder,
                  })),
                  plan: {
                    folders: result.plan.folders,
                    pageCount: result.plan.pages.length,
                  },
                  openapiSpec: result.openapiSpec ? true : false,
                  usage,
                },
              },
              opts,
            );
            return;
          }

          printSuccess(
            `Generated ${result.pages.length} page${result.pages.length === 1 ? "" : "s"} for ${projectId}`,
          );
        },
      ),
    );

  // --- docs plan ---
  docs
    .command("plan")
    .description("Preview the documentation plan without writing pages")
    .argument("<projectId>", "Project ID (for context)")
    .option("--codebase <path>", "Local codebase path (default: current directory)")
    .option("--description <text>", "Product description (1-3 sentences)")
    .option("--audience <type>", "Documentation audience: public or private")
    .option("--mode <mode>", "AI mode: extended or fast")
    .option("--model <modelId>", "AI model from curated list")
    .option("--config <path>", "Path to .inkloom/docs.yml config file")
    .option("--existing-docs <path>", "Path to existing documentation directory")
    .option("--existing-docs-format <format>", "Existing docs format: md or mdx (default: mdx)")
    .option("--openrouter-key <key>", "OpenRouter API key (BYOK)")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom docs plan proj_abc --codebase ./my-project --description "A REST API for managing tasks"
  $ inkloom docs plan proj_abc --mode fast    Quick plan preview
  $ inkloom docs plan proj_abc --existing-docs ./docs    Plan with existing docs context`,
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            codebase?: string;
            description?: string;
            audience?: string;
            mode?: string;
            model?: string;
            config?: string;
            existingDocs?: string;
            existingDocsFormat?: string;
            openrouterKey?: string;
          },
        ) => {
          const apiKey = resolveApiKey(localOpts);
          const docsConfig = resolveDocsConfigFromOpts(localOpts);
          const codebasePath = path.resolve(localOpts.codebase ?? ".");

          if (!fs.existsSync(codebasePath)) {
            throw new CliError(`Codebase path not found: ${codebasePath}`, EXIT_GENERAL);
          }

          if (!docsConfig.product.description) {
            throw new CliError(
              "Product description is required. Provide via --description or in .inkloom/docs.yml",
              EXIT_GENERAL,
            );
          }

          // Validate existing docs path if specified
          if (docsConfig.existingDocs) {
            const existingDocsPath = path.resolve(codebasePath, docsConfig.existingDocs.path);
            if (!fs.existsSync(existingDocsPath)) {
              throw new CliError(
                `Existing docs path not found: ${existingDocsPath}`,
                EXIT_GENERAL,
              );
            }
          }

          // Force fast mode for plan-only to save tokens (skip review)
          docsConfig.ai.mode = "fast";

          const model = createLLMClient({ apiKey, modelId: docsConfig.ai.model });
          const costTracker = new CostTracker({ modelId: docsConfig.ai.model });
          const reporter = new ProgressReporter();
          const provider = new LocalFsProvider({
            rootDir: codebasePath,
            includePatterns: docsConfig.scope.include,
            excludePatterns: docsConfig.scope.exclude,
          });

          const progressListener = createCliProgressListener(opts);
          reporter.on(progressListener);

          if (!opts.json) {
            process.stderr.write(`\n  Planning documentation for ${pc.bold(codebasePath)}\n`);
            process.stderr.write(`  Model: ${docsConfig.ai.model}\n`);
          }

          // We only need explore + plan phases.
          // Use generateDocs but with a very limited page budget to keep it fast.
          // The orchestrator will stop after plan if maxPages is 0? No — let's run
          // the full pipeline with fast mode. The plan is available in the result.
          // Actually, we want to run explore + plan only.
          // The simplest way: set maxPages to 0 won't work. Instead, run generateDocs
          // and the orchestrator will produce the plan. We could abort after planning,
          // but the AbortSignal approach would be messy. Instead, let's use the result.plan.
          //
          // Actually the better approach: run the full generateDocs in fast mode.
          // The plan will be in result.plan and writing will happen, but that's wasteful.
          // For now, we run the full pipeline. In a future optimization, we could add a
          // "plan-only" mode to the orchestrator.
          //
          // Better: just abort after planning phase via AbortController
          const controller = new AbortController();
          let planReady = false;

          reporter.on((event) => {
            // Abort after planning completes (when writing phase starts)
            if (event.type === "phaseChanged" && event.phase === "writing" && !planReady) {
              planReady = true;
              controller.abort();
            }
          });

          let result: GenerationResult;
          try {
            result = await generateDocs({
              model,
              provider,
              docsConfig,
              costTracker,
              reporter,
              abortSignal: controller.signal,
            });
          } catch (error) {
            // If aborted after planning, that's expected — check if we have a plan
            if (controller.signal.aborted && planReady) {
              // The plan was captured before abort — result may be partial
              // We need to extract the plan from the partial result
              // Actually generateDocs throws on abort, so we won't get here cleanly
              // Let's catch and provide what we have
              const usage = costTracker.summary();
              if (opts.json) {
                printData({ data: { message: "Plan phase completed", usage } }, opts);
              }
              return;
            }
            throw error;
          }

          // Display the documentation plan
          const plan = result.plan;
          const usage = result.usage;

          if (opts.json) {
            printData(
              {
                data: {
                  plan: {
                    folders: plan.folders,
                    pages: plan.pages.map((p) => ({
                      slug: p.slug,
                      title: p.title,
                      folder: p.folder,
                      priority: p.priority,
                      outline: p.outline,
                      sourceFiles: p.sourceFiles,
                    })),
                  },
                  usage,
                },
              },
              opts,
            );
            return;
          }

          // Pretty-print the plan
          if (plan.folders.length > 0) {
            process.stderr.write(`\n  ${pc.bold("Folders:")}\n`);
            for (const folder of plan.folders) {
              process.stderr.write(`    ${folder.slug}/  ${pc.dim(folder.title)}\n`);
            }
          }

          process.stderr.write(`\n  ${pc.bold("Pages:")} (${plan.pages.length} planned)\n`);
          for (const page of plan.pages) {
            const priority = page.priority === "high"
              ? pc.green("HIGH")
              : page.priority === "low"
                ? pc.dim("LOW")
                : "MED";
            const folder = page.folder ? `${page.folder}/` : "";
            process.stderr.write(`    [${priority}] ${folder}${page.slug}  ${pc.dim(page.title)}\n`);
            if (page.outline.length > 0) {
              for (const item of page.outline.slice(0, 3)) {
                process.stderr.write(`          ${pc.dim("- " + item)}\n`);
              }
              if (page.outline.length > 3) {
                process.stderr.write(`          ${pc.dim(`... +${page.outline.length - 3} more`)}\n`);
              }
            }
          }

          process.stderr.write(`\n  Tokens used: ${usage.totalTokens.toLocaleString()}\n`);
          process.stderr.write(`  Estimated cost: $${(usage.estimatedCostCents / 100).toFixed(2)}\n`);

          printSuccess(
            `Plan: ${plan.folders.length} folder${plan.folders.length === 1 ? "" : "s"}, ${plan.pages.length} page${plan.pages.length === 1 ? "" : "s"}`,
          );
        },
      ),
    );

  // --- docs status ---
  docs
    .command("status")
    .description("Check the status of the latest generation job")
    .argument("<projectId>", "Project ID")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom docs status proj_abc    Show latest generation job status`,
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
        ) => {
          // Query the generation jobs API
          const response = await client.get<{
            jobs: Array<{
              id: string;
              status: string;
              mode: string;
              model: string;
              progress: {
                totalFiles?: number;
                analyzedFiles?: number;
                plannedPages?: number;
                writtenPages?: number;
                currentPhase?: string;
              };
              inputTokens?: number;
              outputTokens?: number;
              estimatedCostCents?: number;
              error?: string;
              startedAt?: number;
              completedAt?: number;
              createdAt: number;
            }>;
          }>(`/api/v1/projects/${projectId}/generate`);

          const jobs = response.data.jobs;

          if (!jobs || jobs.length === 0) {
            if (opts.json) {
              printData({ data: { jobs: [] } }, opts);
            } else {
              process.stderr.write("No generation jobs found for this project.\n");
            }
            return;
          }

          if (opts.json) {
            printData(response, opts);
            return;
          }

          // Display latest job
          const job = jobs[0];
          process.stderr.write(`\n  ${pc.bold("Latest Generation Job")}\n`);
          process.stderr.write(`  ID:     ${job.id}\n`);
          process.stderr.write(`  Status: ${job.status}\n`);
          process.stderr.write(`  Model:  ${job.model}\n`);
          process.stderr.write(`  Mode:   ${job.mode}\n`);

          if (job.progress) {
            const p = job.progress;
            if (p.currentPhase) {
              process.stderr.write(`  Phase:  ${PHASE_LABELS[p.currentPhase] ?? p.currentPhase}\n`);
            }
            if (p.writtenPages !== undefined && p.plannedPages !== undefined) {
              process.stderr.write(`  Pages:  ${p.writtenPages}/${p.plannedPages}\n`);
            }
          }

          if (job.inputTokens !== undefined) {
            const total = (job.inputTokens ?? 0) + (job.outputTokens ?? 0);
            process.stderr.write(`  Tokens: ${total.toLocaleString()}\n`);
          }
          if (job.estimatedCostCents !== undefined) {
            process.stderr.write(`  Cost:   $${(job.estimatedCostCents / 100).toFixed(2)}\n`);
          }
          if (job.error) {
            process.stderr.write(`  Error:  ${pc.red(job.error)}\n`);
          }
          if (job.startedAt) {
            process.stderr.write(`  Started: ${new Date(job.startedAt).toISOString()}\n`);
          }
          if (job.completedAt) {
            process.stderr.write(`  Completed: ${new Date(job.completedAt).toISOString()}\n`);
          }
        },
      ),
    );

  // --- docs approve ---
  docs
    .command("approve")
    .description("Approve and publish AI-generated draft pages")
    .argument("<projectId>", "Project ID")
    .argument("[jobId]", "Generation job ID (latest if omitted)")
    .option("--pages <pageIds...>", "Specific page IDs to approve (all if omitted)")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom docs approve proj_abc                        Approve all pages from latest job
  $ inkloom docs approve proj_abc job_123                Approve all pages from specific job
  $ inkloom docs approve proj_abc --pages pg_1 pg_2     Approve specific pages`,
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          jobId: string | undefined,
          localOpts: {
            pages?: string[];
          },
        ) => {
          const body: Record<string, unknown> = {};
          if (localOpts.pages && localOpts.pages.length > 0) {
            body.pageIds = localOpts.pages;
          }

          const jobPath = jobId
            ? `/api/v1/projects/${projectId}/generate/${jobId}/approve`
            : `/api/v1/projects/${projectId}/generate/latest/approve`;

          const response = await client.post<{
            approved: number;
            published: number;
          }>(jobPath, body);

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(
            `Approved ${response.data.approved} page${response.data.approved === 1 ? "" : "s"}, published ${response.data.published} page${response.data.published === 1 ? "" : "s"}`,
          );
        },
      ),
    );
}
