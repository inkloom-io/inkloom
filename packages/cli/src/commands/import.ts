import { Command } from "commander";
import { existsSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import pc from "picocolors";
import { handleAction } from "../lib/handler.js";
import { printData, printSuccess, printWarning } from "../lib/output.js";
import { CliError, EXIT_GENERAL } from "../lib/errors.js";
import { trackEvent } from "../lib/telemetry.js";
import {
  migrate,
  MigrationSource,
  type MigrationStage,
  type MigrationAsset,
  type EnrichedMigrationResult,
} from "@inkloom/migration";

// ── Spinner helper ──────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface Spinner {
  update(text: string): void;
  stop(finalText?: string): void;
}

function createSpinner(initialText: string): Spinner {
  let frameIndex = 0;
  let currentText = initialText;
  const isTTY = process.stderr.isTTY;

  const interval = isTTY
    ? setInterval(() => {
        const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
        process.stderr.write(`\r${pc.cyan(frame)} ${currentText}`);
        frameIndex++;
      }, 80)
    : null;

  if (!isTTY) {
    process.stderr.write(`  ${currentText}\n`);
  }

  return {
    update(text: string) {
      currentText = text;
      if (!isTTY) {
        process.stderr.write(`  ${text}\n`);
      }
    },
    stop(finalText?: string) {
      if (interval) clearInterval(interval);
      if (isTTY) {
        process.stderr.write(`\r${pc.green("✓")} ${finalText ?? currentText}\n`);
      } else if (finalText) {
        process.stderr.write(`  ${finalText}\n`);
      }
    },
  };
}

// ── Stage labels ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<MigrationStage, string> = {
  parsing: "Parsing source files",
  assets: "Discovering assets",
  converting: "Converting pages to BlockNote",
  redirects: "Generating redirects",
};

// ── Asset upload ────────────────────────────────────────────────────────────

interface PresignResponse {
  presignedUrl: string;
  r2Key: string;
}

interface ConfirmResponse {
  id: string;
  url: string;
}

/**
 * Upload a single MigrationAsset to R2 via presign-upload-confirm.
 * Returns the confirmed asset ID, or undefined if it fails.
 */
async function uploadAsset(
  client: import("../lib/client.js").Client,
  projectId: string,
  asset: MigrationAsset,
): Promise<{ id: string; url: string } | undefined> {
  if (!asset.buffer) return undefined;

  const presign = await client.post<PresignResponse>(
    `/api/v1/projects/${projectId}/assets`,
    { filename: asset.filename, mimeType: asset.mimeType },
  );

  const uploadResponse = await fetch(presign.data.presignedUrl, {
    method: "PUT",
    body: asset.buffer,
    headers: { "Content-Type": asset.mimeType },
  });

  if (!uploadResponse.ok) {
    return undefined;
  }

  const confirmed = await client.post<ConfirmResponse>(
    `/api/v1/projects/${projectId}/assets/confirm`,
    {
      r2Key: presign.data.r2Key,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.buffer.length,
    },
  );

  return { id: confirmed.data.id, url: confirmed.data.url };
}

// ── Branding asset resolution ───────────────────────────────────────────────

/**
 * Upload logo/favicon assets referenced in branding and apply settings to project.
 */
async function applyBranding(
  client: import("../lib/client.js").Client,
  projectId: string,
  result: EnrichedMigrationResult,
): Promise<void> {
  if (!result.branding) return;

  const settings: Record<string, unknown> = {};

  if (result.branding.primaryColor) {
    settings.primaryColor = result.branding.primaryColor;
  }

  if (result.branding.socialLinks && result.branding.socialLinks.length > 0) {
    settings.socialLinks = result.branding.socialLinks;
  }

  // Upload logo if referenced
  if (result.branding.logoAssetPath) {
    const logoAsset = result.assets.find(
      (a) => a.originalUrl === result.branding?.logoAssetPath || a.filename === basename(result.branding?.logoAssetPath ?? ""),
    );
    if (logoAsset) {
      const uploaded = await uploadAsset(client, projectId, logoAsset);
      if (uploaded) {
        settings.logoAssetId = uploaded.id;
      }
    }
  }

  // Upload dark logo if referenced
  if (result.branding.logoDarkAssetPath) {
    const darkLogoAsset = result.assets.find(
      (a) => a.originalUrl === result.branding?.logoDarkAssetPath || a.filename === basename(result.branding?.logoDarkAssetPath ?? ""),
    );
    if (darkLogoAsset) {
      const uploaded = await uploadAsset(client, projectId, darkLogoAsset);
      if (uploaded) {
        settings.logoDarkAssetId = uploaded.id;
      }
    }
  }

  // Upload favicon if referenced
  if (result.branding.faviconAssetPath) {
    const faviconAsset = result.assets.find(
      (a) => a.originalUrl === result.branding?.faviconAssetPath || a.filename === basename(result.branding?.faviconAssetPath ?? ""),
    );
    if (faviconAsset) {
      const uploaded = await uploadAsset(client, projectId, faviconAsset);
      if (uploaded) {
        settings.faviconAssetId = uploaded.id;
      }
    }
  }

  if (Object.keys(settings).length > 0) {
    await client.patch(`/api/v1/projects/${projectId}`, settings);
  }
}

// ── Subpath guidance output ─────────────────────────────────────────────────

function printSubpathGuidance(
  subpathInfo: NonNullable<EnrichedMigrationResult["subpathGuidance"]>,
): void {
  process.stderr.write("\n");
  process.stderr.write(
    pc.yellow(pc.bold("⚠ Subpath hosting detected\n")),
  );
  process.stderr.write(
    `  Your docs are currently served at a subpath: ${pc.bold(subpathInfo.subpath)}\n`,
  );
  process.stderr.write(
    `  InkLoom serves docs at the domain root. We recommend switching to a subdomain:\n`,
  );
  process.stderr.write(
    `  ${pc.green(subpathInfo.recommendedSubdomain)}\n\n`,
  );
  process.stderr.write(
    `  Then add redirects from ${pc.dim(subpathInfo.originalHost + subpathInfo.subpath)} → ${pc.dim(subpathInfo.recommendedSubdomain)}\n`,
  );

  // Print copy-pasteable snippets
  if (subpathInfo.snippets && Object.keys(subpathInfo.snippets).length > 0) {
    process.stderr.write("\n");
    process.stderr.write(pc.bold("  Redirect configuration snippets:\n\n"));

    for (const [platform, snippet] of Object.entries(subpathInfo.snippets)) {
      process.stderr.write(`  ${pc.bold(platform)}:\n`);
      for (const line of snippet.split("\n")) {
        process.stderr.write(`    ${pc.dim(line)}\n`);
      }
      process.stderr.write("\n");
    }
  }
}

// ── Main command registration ───────────────────────────────────────────────

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .description(
      "Import documentation from Mintlify or Gitbook into InkLoom",
    )
    .requiredOption(
      "--from <source>",
      "Source platform (mintlify or gitbook)",
    )
    .requiredOption("--path <dir>", "Path to the source documentation directory")
    .requiredOption("--project <name>", "Name for the InkLoom project")
    .option(
      "--source-url <url>",
      "Current docs URL for subpath detection and redirect generation",
    )
    .option("--dry-run", "Preview migration without creating a project")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom import --from mintlify --path ./docs --project "My API Docs"
  $ inkloom import --from gitbook --path ./docs --project "Developer Guide" --dry-run
  $ inkloom import --from mintlify --path ./docs --project "Acme Docs" --source-url https://acme.com/docs
  $ inkloom import --from mintlify --path ./docs --project "Docs" --json

Prerequisites:
  1. Authenticate:   inkloom auth login
  2. Set org:        inkloom auth login --org <orgId>

Environment:
  INKLOOM_TOKEN     API key for InkLoom Cloud
  INKLOOM_API_URL   API base URL (default: https://inkloom.io)`,
    )
    .action(
      handleAction(async (client, opts, localOpts) => {
        const { from, path: dirPath, project, sourceUrl, dryRun } = localOpts as {
          from: string;
          path: string;
          project: string;
          sourceUrl?: string;
          dryRun?: boolean;
        };

        // ── Validate source ───────────────────────────────────────────
        const validSources: Record<string, MigrationSource> = {
          mintlify: MigrationSource.Mintlify,
          gitbook: MigrationSource.Gitbook,
        };

        const source = validSources[from.toLowerCase()];
        if (!source) {
          throw new CliError(
            `Unsupported source: "${from}". Supported sources: mintlify, gitbook`,
            EXIT_GENERAL,
          );
        }

        // ── Validate directory ────────────────────────────────────────
        const resolvedPath = resolve(dirPath);

        if (!existsSync(resolvedPath)) {
          throw new CliError(
            `Directory not found: ${resolvedPath}`,
            EXIT_GENERAL,
          );
        }

        const dirStat = statSync(resolvedPath);
        if (!dirStat.isDirectory()) {
          throw new CliError(
            `Not a directory: ${resolvedPath}`,
            EXIT_GENERAL,
          );
        }

        // Check for config files
        const configFiles =
          source === MigrationSource.Mintlify
            ? ["docs.json", "mint.json"]
            : [".gitbook.yaml", "SUMMARY.md"];

        const hasConfig = configFiles.some((f) =>
          existsSync(resolve(resolvedPath, f)),
        );

        if (!hasConfig) {
          throw new CliError(
            `No ${source} configuration found in ${resolvedPath}.\n` +
              `Expected one of: ${configFiles.join(", ")}`,
            EXIT_GENERAL,
          );
        }

        // ── Run migration ─────────────────────────────────────────────
        let spinner: Spinner | undefined;
        if (!opts.json) {
          spinner = createSpinner("Starting migration...");
        }

        let lastStage = "";
        let pageCount = 0;

        const result = await migrate({
          source,
          dirPath: resolvedPath,
          projectName: project,
          sourceUrl,
          dryRun,
          onProgress: (stage, current, total) => {
            if (stage === "converting") {
              pageCount = total;
            }
            if (spinner) {
              const label = STAGE_LABELS[stage] ?? stage;
              if (stage !== lastStage) {
                lastStage = stage;
              }
              spinner.update(
                `${label}${total > 1 ? ` (${current}/${total})` : ""}`,
              );
            }
          },
        });

        if (spinner) {
          spinner.stop(
            `Migration complete — ${result.pages.length} pages, ${result.folders.length} folders`,
          );
        }

        // ── Print warnings ────────────────────────────────────────────
        if (!opts.json && result.warnings.length > 0) {
          process.stderr.write("\n");
          for (const warning of result.warnings) {
            printWarning(warning);
          }
        }

        // ── Dry run output ────────────────────────────────────────────
        if (dryRun) {
          const summary = {
            projectName: result.projectName,
            pages: result.pages.length,
            folders: result.folders.length,
            assets: result.assets.length,
            redirects: result.redirects.length,
            navTabs: result.navTabs?.length ?? 0,
            warnings: result.warnings.length,
            hasBranding: !!result.branding,
            hasSubpathGuidance: !!result.subpathGuidance,
          };

          if (opts.json) {
            const jsonOutput = {
              data: {
                dryRun: true,
                summary,
                pages: result.pages.map((p) => ({
                  title: p.title,
                  slug: p.slug,
                  path: p.path,
                  folderPath: p.folderPath,
                })),
                folders: result.folders.map((f) => ({
                  name: f.name,
                  slug: f.slug,
                  path: f.path,
                })),
                redirects: result.redirects.map((r) => ({
                  from: r.from,
                  to: r.to,
                  status: r.status,
                })),
                urlMap: Object.fromEntries(result.urlMap),
                warnings: result.warnings,
              },
            };
            printData(jsonOutput, opts);
          } else {
            process.stderr.write("\n");
            process.stderr.write(pc.bold("Dry run summary:\n"));
            process.stderr.write(`  Project:    ${summary.projectName}\n`);
            process.stderr.write(`  Pages:      ${summary.pages}\n`);
            process.stderr.write(`  Folders:    ${summary.folders}\n`);
            process.stderr.write(`  Assets:     ${summary.assets}\n`);
            process.stderr.write(`  Redirects:  ${summary.redirects}\n`);
            process.stderr.write(`  Nav tabs:   ${summary.navTabs}\n`);
            if (summary.hasBranding) {
              process.stderr.write(`  Branding:   detected\n`);
            }
            process.stderr.write("\n");

            // URL map table
            if (result.urlMap.size > 0) {
              process.stderr.write(pc.bold("URL mapping:\n"));
              for (const [source, target] of result.urlMap) {
                process.stderr.write(
                  `  ${pc.dim(source)} → ${target}\n`,
                );
              }
              process.stderr.write("\n");
            }

            // Redirect summary
            if (result.redirects.length > 0) {
              process.stderr.write(pc.bold("Redirects:\n"));
              for (const r of result.redirects.slice(0, 20)) {
                process.stderr.write(
                  `  ${pc.dim(String(r.status))} ${r.from} → ${r.to}\n`,
                );
              }
              if (result.redirects.length > 20) {
                process.stderr.write(
                  pc.dim(
                    `  ... and ${result.redirects.length - 20} more\n`,
                  ),
                );
              }
              process.stderr.write("\n");
            }

            // Subpath guidance
            if (result.subpathGuidance) {
              printSubpathGuidance(result.subpathGuidance);
            }

            printSuccess(
              "Dry run complete. Remove --dry-run to create the project.",
            );
          }

          trackEvent(
            "import_dry_run",
            {
              source: from,
              pages: summary.pages,
              folders: summary.folders,
            },
            opts.noTelemetry,
          ).catch(() => {});

          return;
        }

        // ── Create project via REST API ───────────────────────────────
        if (!opts.json) {
          process.stderr.write("\nCreating project...\n");
        }

        const createPayload: Record<string, unknown> = {
          name: result.projectName,
          pages: result.pages,
          folders: result.folders,
        };

        if (result.navTabs && result.navTabs.length > 0) {
          createPayload.navTabs = result.navTabs;
        }

        if (result.redirects.length > 0) {
          createPayload.redirects = result.redirects;
        }

        const createResponse = await client.post<{
          projectId: string;
          slug: string;
          url: string;
        }>("/api/v1/projects/import", createPayload);

        const projectId = createResponse.data.projectId;
        const projectSlug = createResponse.data.slug;
        const projectUrl = createResponse.data.url;

        // ── Upload assets ─────────────────────────────────────────────
        const assetsWithData = result.assets.filter((a) => a.buffer);
        if (assetsWithData.length > 0 && !opts.json) {
          process.stderr.write(
            `Uploading ${assetsWithData.length} asset${assetsWithData.length === 1 ? "" : "s"}...\n`,
          );
        }

        let assetsUploaded = 0;
        let assetsFailed = 0;

        for (const asset of assetsWithData) {
          try {
            await uploadAsset(client, projectId, asset);
            assetsUploaded++;
          } catch {
            assetsFailed++;
          }
        }

        // ── Apply branding ────────────────────────────────────────────
        try {
          await applyBranding(client, projectId, result);
        } catch {
          if (!opts.json) {
            printWarning("Failed to apply some branding settings");
          }
        }

        // ── Output ────────────────────────────────────────────────────
        if (opts.json) {
          const jsonOutput = {
            data: {
              projectId,
              slug: projectSlug,
              url: projectUrl,
              pages: result.pages.length,
              folders: result.folders.length,
              assetsUploaded,
              assetsFailed,
              redirects: result.redirects.length,
              urlMap: Object.fromEntries(result.urlMap),
              warnings: result.warnings,
              subpathGuidance: result.subpathGuidance
                ? {
                    subpath: result.subpathGuidance.subpath,
                    originalHost: result.subpathGuidance.originalHost,
                    recommendedSubdomain:
                      result.subpathGuidance.recommendedSubdomain,
                  }
                : null,
            },
          };
          printData(jsonOutput, opts);
        } else {
          process.stderr.write("\n");
          process.stderr.write(pc.bold("Import complete:\n"));
          process.stderr.write(`  Project:    ${result.projectName}\n`);
          process.stderr.write(`  ID:         ${projectId}\n`);
          process.stderr.write(`  Pages:      ${result.pages.length}\n`);
          process.stderr.write(`  Folders:    ${result.folders.length}\n`);
          process.stderr.write(
            `  Assets:     ${assetsUploaded} uploaded${assetsFailed > 0 ? `, ${assetsFailed} failed` : ""}\n`,
          );
          process.stderr.write(
            `  Redirects:  ${result.redirects.length}\n`,
          );
          process.stderr.write(`  URL:        ${projectUrl}\n`);
          process.stderr.write("\n");

          // URL map table
          if (result.urlMap.size > 0) {
            process.stderr.write(pc.bold("URL mapping:\n"));
            for (const [sourcePath, targetPath] of result.urlMap) {
              process.stderr.write(
                `  ${pc.dim(sourcePath)} → ${targetPath}\n`,
              );
            }
            process.stderr.write("\n");
          }

          // Redirect summary
          if (result.redirects.length > 0) {
            process.stderr.write(pc.bold("Redirects:\n"));
            for (const r of result.redirects.slice(0, 20)) {
              process.stderr.write(
                `  ${pc.dim(String(r.status))} ${r.from} → ${r.to}\n`,
              );
            }
            if (result.redirects.length > 20) {
              process.stderr.write(
                pc.dim(
                  `  ... and ${result.redirects.length - 20} more\n`,
                ),
              );
            }
            process.stderr.write("\n");
          }

          // Subpath guidance
          if (result.subpathGuidance) {
            printSubpathGuidance(result.subpathGuidance);
          }

          printSuccess(
            `Import complete! Visit ${projectUrl} to access your project.`,
          );
        }

        // Fire-and-forget telemetry
        trackEvent(
          "import_completed",
          {
            source: from,
            pages: result.pages.length,
            folders: result.folders.length,
            assets: assetsUploaded,
            redirects: result.redirects.length,
          },
          opts.noTelemetry,
        ).catch(() => {});
      }),
    );
}
