import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { handleAction, type GlobalOpts, getGlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { CliError, EXIT_NOT_FOUND, EXIT_GENERAL } from "../lib/errors.js";
import { printData, printSuccess, printError } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";
import { serializeFrontmatter, type PageFrontmatter } from "../lib/frontmatter.js";
import {
  walkMdxFiles,
  computeDiff,
  applyDiff,
  applyDiffConvex,
  formatDiffLines,
  formatDiffSummary,
  formatSummary,
  type RemotePage,
  type RemoteFolder as PushRemoteFolder,
  type ApplyDiffSummary,
} from "../lib/push.js";
import { createConvexClient } from "../lib/convex-client.js";
import {
  readDocsConfig,
  resolveNavTabs,
  resolvePagePositions,
  type DocsConfig,
} from "../lib/docs-config.js";
import fse from "fs-extra";

/**
 * Detect if we should use core (Convex direct) mode.
 * Core mode is active when --convex-url is set, or when Convex env vars exist
 * and no API token is configured.
 */
function isCoreMode(localOpts: { convexUrl?: string }, globalOpts: GlobalOpts): boolean {
  if (localOpts.convexUrl) return true;
  const hasConvexUrl = !!(process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL);
  const hasToken = !!(globalOpts.token || process.env.INKLOOM_TOKEN);
  return hasConvexUrl && !hasToken;
}

/**
 * Register pages commands: list, create, get, update, delete.
 */
export function registerPagesCommands(program: Command): void {
  const pages = program
    .command("pages")
    .description("Manage documentation pages within a project");

  // --- pages list ---
  pages
    .command("list")
    .description("List pages in a project")
    .argument("<projectId>", "Project ID")
    .option("--branch <branchId>", "Filter by branch")
    .option("--folder <folderId>", "Filter by folder")
    .option("--format <format>", "Content format: mdx or blocknote (default)")
    .option("--include-content", "Include page content in response")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            branch?: string;
            folder?: string;
            format?: string;
            includeContent?: boolean;
          }
        ) => {
          const params = new URLSearchParams();
          if (localOpts.branch) params.set("branchId", localOpts.branch);
          if (localOpts.folder) params.set("folderId", localOpts.folder);
          if (localOpts.includeContent) params.set("includeContent", "true");
          if (localOpts.format) params.set("format", localOpts.format);
          const qs = params.toString();
          const path = `/api/v1/projects/${projectId}/pages${qs ? `?${qs}` : ""}`;

          const response = await client.get<unknown[]>(path);

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as Record<string, unknown>[]).map(
            (p) => ({
              id: p._id,
              title: p.title,
              slug: p.slug,
              published: p.isPublished ? "yes" : "no",
              folder: p.folderId || "—",
              created: formatDate(p.createdAt),
            })
          );
          printData(rows, opts);
        }
      )
    );

  // --- pages create ---
  pages
    .command("create")
    .description("Create a new page from a local MDX file")
    .argument("<projectId>", "Project ID")
    .requiredOption("--title <title>", "Page title")
    .requiredOption("--file <path>", "Path to .mdx file for page content")
    .option("--slug <slug>", "URL slug (auto-derived from title if omitted)")
    .option("--folder <folderId>", "Parent folder ID")
    .option("--branch <branchId>", "Target branch")
    .option("--publish", "Publish the page immediately after creation")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            title: string;
            file: string;
            slug?: string;
            folder?: string;
            branch?: string;
            publish?: boolean;
          }
        ) => {
          const content = fs.readFileSync(localOpts.file, "utf-8");

          const body: Record<string, unknown> = {
            title: localOpts.title,
            content,
            contentFormat: "mdx",
          };
          if (localOpts.slug) body.slug = localOpts.slug;
          if (localOpts.folder) body.folderId = localOpts.folder;
          if (localOpts.branch) body.branchId = localOpts.branch;
          if (localOpts.publish) body.isPublished = true;

          const response = await client.post<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/pages`,
            body
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(
            `Page created: ${response.data.title} (${response.data._id})`
          );
        }
      )
    );

  // --- pages get ---
  pages
    .command("get")
    .description("Get a page's metadata and optionally its content")
    .argument("<projectId>", "Project ID")
    .argument("<pageId>", "Page ID")
    .option(
      "--format <format>",
      "Content format: mdx or blocknote (default). Implies --include-content"
    )
    .option("--include-content", "Include page content in response")
    .option("--output <path>", "Write content to file instead of stdout")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          pageId: string,
          localOpts: {
            format?: string;
            includeContent?: boolean;
            output?: string;
          }
        ) => {
          const includeContent =
            localOpts.includeContent || !!localOpts.format || !!localOpts.output;

          const params = new URLSearchParams();
          if (includeContent) params.set("includeContent", "true");
          if (localOpts.format) params.set("format", localOpts.format);
          const qs = params.toString();
          const path = `/api/v1/projects/${projectId}/pages/${pageId}${qs ? `?${qs}` : ""}`;

          const response = await client.get<Record<string, unknown>>(path);

          if (localOpts.output && response.data.content) {
            fs.writeFileSync(
              localOpts.output,
              String(response.data.content),
              "utf-8"
            );
            printSuccess(`Content written to ${localOpts.output}`);
            // Print metadata (without content) to stdout
            const { content: _content, ...metadata } = response.data;
            if (opts.json) {
              printData({ data: metadata }, opts);
            } else {
              printData(metadata, opts);
            }
            return;
          }

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- pages update ---
  pages
    .command("update")
    .description("Update a page's content from a local MDX file")
    .argument("<projectId>", "Project ID")
    .argument("<pageId>", "Page ID")
    .requiredOption("--file <path>", "Path to .mdx file with new content")
    .option("--title <title>", "Update the page title")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          pageId: string,
          localOpts: { file: string; title?: string }
        ) => {
          // If --title provided, PATCH metadata first
          if (localOpts.title) {
            await client.patch(
              `/api/v1/projects/${projectId}/pages/${pageId}`,
              { title: localOpts.title }
            );
          }

          // PUT content from file
          const content = fs.readFileSync(localOpts.file, "utf-8");
          const response = await client.put<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/pages/${pageId}/content`,
            { content, contentFormat: "mdx" }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Page ${pageId} updated.`);
        }
      )
    );

  // --- pages publish ---
  pages
    .command("publish")
    .description("Publish a page (make it visible in deployments)")
    .argument("<projectId>", "Project ID")
    .argument("<pageId>", "Page ID")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          pageId: string
        ) => {
          const response = await client.post<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/pages/${pageId}/publish`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Page ${pageId} published.`);
        }
      )
    );

  // --- pages unpublish ---
  pages
    .command("unpublish")
    .description("Unpublish a page (hide it from deployments)")
    .argument("<projectId>", "Project ID")
    .argument("<pageId>", "Page ID")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          pageId: string
        ) => {
          const response = await client.delete<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/pages/${pageId}/publish`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Page ${pageId} unpublished.`);
        }
      )
    );

  // --- pages delete ---
  pages
    .command("delete")
    .description("Delete a page")
    .argument("<projectId>", "Project ID")
    .argument("<pageId>", "Page ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          pageId: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Delete page ${pageId}? This cannot be undone.`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/pages/${pageId}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Page ${pageId} deleted.`);
        }
      )
    );

  // --- pages pull ---
  pages
    .command("pull")
    .description(
      "Export all pages from a project as .mdx files with frontmatter"
    )
    .argument("<projectId>", "Project ID")
    .requiredOption("--dir <path>", "Output directory (created if missing)")
    .option("--branch <branchId>", "Source branch")
    .option("--overwrite", "Overwrite existing files without prompting")
    .option("--published-only", "Only export published pages")
    .option(
      "--convex-url <url>",
      "Convex deployment URL for core mode (overrides NEXT_PUBLIC_CONVEX_URL)"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom pages pull proj_abc --dir ./docs                     Export all pages (platform)
  $ inkloom pages pull proj_abc --dir ./docs --overwrite         Overwrite existing files
  $ inkloom pages pull proj_abc --dir ./docs --published-only    Only published pages
  $ inkloom pages pull proj_abc --dir ./docs --convex-url <url>  Core mode (direct Convex)`
    )
    .action(async (...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const globalOpts = getGlobalOpts(cmd);
      const projectId = args[0] as string;
      const localOpts = args[args.length - 2] as {
        dir: string;
        branch?: string;
        overwrite?: boolean;
        publishedOnly?: boolean;
        convexUrl?: string;
      };

      try {
        if (isCoreMode(localOpts, globalOpts)) {
          await pullCoreMode(globalOpts, projectId, localOpts);
        } else {
          await pullPlatformMode(globalOpts, projectId, localOpts);
        }
      } catch (error) {
        if (error instanceof CliError) {
          printError(error, globalOpts);
          process.exit(error.exitCode);
        }
        const err = error instanceof Error ? error : new Error(String(error));
        printError(err, globalOpts);
        process.exit(EXIT_GENERAL);
      }
    });

  // --- pages push ---
  pages
    .command("push")
    .description(
      "Sync a local directory of .mdx files to an InkLoom project"
    )
    .argument("<projectId>", "Project ID")
    .requiredOption("--dir <path>", "Path to directory containing .mdx files")
    .option("--branch <branchId>", "Target branch")
    .option("--delete", "Delete remote pages/folders that don't exist locally")
    .option("--dry-run", "Preview changes without applying them")
    .option(
      "--publish",
      "Automatically publish all created/updated pages"
    )
    .option(
      "--convex-url <url>",
      "Convex deployment URL for core mode (overrides NEXT_PUBLIC_CONVEX_URL)"
    )
    .option("--no-config", "Skip docs.json processing")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom pages push proj_abc --dir ./docs --dry-run            Preview changes
  $ inkloom pages push proj_abc --dir ./docs --publish --delete   Full sync & publish
  $ INKLOOM_TOKEN=$TOKEN inkloom pages push $PROJECT --dir ./docs CI usage
  $ inkloom pages push proj_abc --dir ./docs --convex-url <url>   Core mode (direct Convex)
  $ inkloom pages push proj_abc --dir ./docs --no-config          Skip docs.json`
    )
    .action(async (...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const globalOpts = getGlobalOpts(cmd);
      const projectId = args[0] as string;
      const localOpts = args[args.length - 2] as {
        dir: string;
        branch?: string;
        delete?: boolean;
        dryRun?: boolean;
        publish?: boolean;
        convexUrl?: string;
        config?: boolean;
      };

      try {
        if (isCoreMode(localOpts, globalOpts)) {
          await pushCoreMode(globalOpts, projectId, localOpts);
        } else {
          await pushPlatformMode(globalOpts, projectId, localOpts);
        }
      } catch (error) {
        if (error instanceof CliError) {
          printError(error, globalOpts);
          process.exit(error.exitCode);
        }
        const err = error instanceof Error ? error : new Error(String(error));
        printError(err, globalOpts);
        process.exit(EXIT_GENERAL);
      }
    });
}

// ---------------------------------------------------------------------------
// Pull: Core mode (direct Convex)
// ---------------------------------------------------------------------------

async function pullCoreMode(
  opts: GlobalOpts,
  projectId: string,
  localOpts: {
    dir: string;
    branch?: string;
    overwrite?: boolean;
    publishedOnly?: boolean;
    convexUrl?: string;
  }
): Promise<void> {
  const client = createConvexClient({
    convexUrl: localOpts.convexUrl,
    verbose: opts.verbose,
  });

  try {
    const outDir = path.resolve(localOpts.dir);

    // Resolve branch ID
    const branchId = await resolveBranchId(client, projectId, localOpts.branch);

    // Fetch folders
    const convexFolders = await client.listFoldersByBranch(branchId);
    const folders: RemoteFolder[] = convexFolders.map((f) => ({
      _id: f._id,
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
    }));

    // Fetch pages with MDX content (BlockNote → MDX conversion handled by client)
    const convexPages = await client.listPagesWithMdxContent(branchId);
    let pages: RemotePullPage[] = convexPages.map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      folderId: p.folderId,
      position: p.position ?? 0,
      isPublished: p.isPublished ?? false,
      icon: p.icon,
      description: p.description,
      content: p.content,
    }));

    if (localOpts.publishedOnly) {
      pages = pages.filter((p) => p.isPublished);
    }

    if (pages.length === 0) {
      process.stderr.write("No pages to export.\n");
      return;
    }

    await writePullOutput(opts, pages, folders, outDir, localOpts);
  } finally {
    client.close();
  }
}

// ---------------------------------------------------------------------------
// Pull: Platform mode (REST API)
// ---------------------------------------------------------------------------

async function pullPlatformMode(
  opts: GlobalOpts,
  projectId: string,
  localOpts: {
    dir: string;
    branch?: string;
    overwrite?: boolean;
    publishedOnly?: boolean;
  }
): Promise<void> {
  const { createClient } = await import("../lib/client.js");
  const client = createClient(opts);
  const outDir = path.resolve(localOpts.dir);

  // Fetch folders
  const folderParams = new URLSearchParams();
  if (localOpts.branch) folderParams.set("branchId", localOpts.branch);
  const folderQs = folderParams.toString();
  const foldersResponse = await client.get<RemoteFolder[]>(
    `/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`
  );
  const folders = foldersResponse.data;

  // Fetch pages with MDX content
  const pageParams = new URLSearchParams();
  if (localOpts.branch) pageParams.set("branchId", localOpts.branch);
  pageParams.set("includeContent", "true");
  pageParams.set("format", "mdx");
  const pagesResponse = await client.get<RemotePullPage[]>(
    `/api/v1/projects/${projectId}/pages?${pageParams.toString()}`
  );
  let pages = pagesResponse.data;

  if (localOpts.publishedOnly) {
    pages = pages.filter((p) => p.isPublished);
  }

  if (pages.length === 0) {
    process.stderr.write("No pages to export.\n");
    return;
  }

  await writePullOutput(opts, pages, folders, outDir, localOpts);
}

// ---------------------------------------------------------------------------
// Pull: Shared output writer
// ---------------------------------------------------------------------------

async function writePullOutput(
  opts: GlobalOpts,
  pages: RemotePullPage[],
  folders: RemoteFolder[],
  outDir: string,
  localOpts: { dir: string; overwrite?: boolean }
): Promise<void> {
  const folderPathMap = buildFolderPathMap(folders);

  // Check if output dir exists and is non-empty
  if (
    fs.existsSync(outDir) &&
    fs.readdirSync(outDir).length > 0 &&
    !localOpts.overwrite
  ) {
    const ok = await confirm(
      `Output directory ${localOpts.dir} is not empty. Overwrite?`
    );
    if (!ok) {
      process.stderr.write("Aborted.\n");
      return;
    }
  }

  fse.ensureDirSync(outDir);

  const writtenPaths: string[] = [];
  for (const page of pages) {
    const folderPath = page.folderId
      ? folderPathMap.get(page.folderId) ?? ""
      : "";
    const fileDir = folderPath ? path.join(outDir, folderPath) : outDir;
    fse.ensureDirSync(fileDir);

    const frontmatter: PageFrontmatter = {
      title: page.title,
      slug: page.slug,
      position: page.position,
      isPublished: page.isPublished,
    };
    if (page.icon) frontmatter.icon = page.icon;
    if (page.description) frontmatter.description = page.description;

    const body = page.content ?? "";
    const fileContent = serializeFrontmatter(frontmatter, body);
    const filePath = path.join(fileDir, `${page.slug}.mdx`);

    fs.writeFileSync(filePath, fileContent, "utf-8");
    writtenPaths.push(path.relative(process.cwd(), filePath));
  }

  if (opts.json) {
    printData(
      {
        data: {
          exported: pages.length,
          directory: localOpts.dir,
          files: writtenPaths,
        },
      },
      opts
    );
    return;
  }

  printSuccess(
    `Exported ${pages.length} page${pages.length === 1 ? "" : "s"} to ${localOpts.dir}/`
  );
  for (const p of writtenPaths) {
    process.stderr.write(`  ./${p}\n`);
  }
}

// ---------------------------------------------------------------------------
// Push: Core mode (direct Convex)
// ---------------------------------------------------------------------------

async function pushCoreMode(
  opts: GlobalOpts,
  projectId: string,
  localOpts: {
    dir: string;
    branch?: string;
    delete?: boolean;
    dryRun?: boolean;
    publish?: boolean;
    convexUrl?: string;
    config?: boolean;
  }
): Promise<void> {
  const client = createConvexClient({
    convexUrl: localOpts.convexUrl,
    verbose: opts.verbose,
  });

  try {
    const dir = path.resolve(localOpts.dir);

    if (!fs.existsSync(dir)) {
      throw new CliError(`Directory not found: ${localOpts.dir}`, EXIT_NOT_FOUND);
    }
    const localPages = walkMdxFiles(dir);
    if (localPages.length === 0) {
      process.stderr.write(`No .mdx files found in ${localOpts.dir}\n`);
      return;
    }

    // Resolve branch ID
    const branchId = await resolveBranchId(client, projectId, localOpts.branch);

    // Fetch remote folders
    const convexFolders = await client.listFoldersByBranch(branchId);
    const remoteFolders: PushRemoteFolder[] = convexFolders.map((f) => ({
      id: f._id,
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
    }));

    // Fetch remote pages with content (convert BlockNote → MDX for diff comparison)
    const convexPages = await client.listPagesWithMdxContent(branchId);
    const remotePages: RemotePage[] = convexPages.map((p) => ({
      id: p._id,
      title: p.title,
      slug: p.slug,
      folderId: p.folderId,
      content: p.content,
      isPublished: p.isPublished,
    }));

    // Compute diff
    const diff = computeDiff(localPages, remotePages, remoteFolders, !!localOpts.delete);

    // Dry-run
    if (localOpts.dryRun) {
      printDryRun(opts, diff, remoteFolders);
      return;
    }

    // Check for changes
    const totalChanges =
      diff.foldersToCreate.length +
      diff.pagesToCreate.length +
      diff.pagesToUpdate.length +
      diff.pagesToDelete.length +
      diff.foldersToDelete.length;

    if (totalChanges === 0) {
      process.stderr.write("No changes to apply.\n");
      return;
    }

    // Apply via Convex mutations
    const summary = await applyDiffConvex(client, diff, remoteFolders, {
      branchId,
      publish: localOpts.publish,
    });

    printPushResult(opts, summary);

    // Apply docs.json config (navTabs, page positions, openapi)
    if (localOpts.config !== false) {
      const config = readDocsConfig(dir);
      if (config) {
        await applyDocsConfigConvex(client, config, projectId, branchId, dir);
      }
    }
  } finally {
    client.close();
  }
}

// ---------------------------------------------------------------------------
// Push: Platform mode (REST API)
// ---------------------------------------------------------------------------

async function pushPlatformMode(
  opts: GlobalOpts,
  projectId: string,
  localOpts: {
    dir: string;
    branch?: string;
    delete?: boolean;
    dryRun?: boolean;
    publish?: boolean;
    config?: boolean;
  }
): Promise<void> {
  const { createClient } = await import("../lib/client.js");
  const client = createClient(opts);
  const dir = path.resolve(localOpts.dir);

  if (!fs.existsSync(dir)) {
    throw new CliError(`Directory not found: ${localOpts.dir}`, EXIT_NOT_FOUND);
  }
  const localPages = walkMdxFiles(dir);
  if (localPages.length === 0) {
    process.stderr.write(`No .mdx files found in ${localOpts.dir}\n`);
    return;
  }

  // Fetch remote folders
  const folderParams = new URLSearchParams();
  if (localOpts.branch) folderParams.set("branchId", localOpts.branch);
  const folderQs = folderParams.toString();
  const foldersResponse = await client.get<
    Array<{ _id: string; name: string; slug: string; parentId?: string }>
  >(
    `/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`
  );
  const remoteFolders: PushRemoteFolder[] = foldersResponse.data.map((f) => ({
    id: f._id,
    name: f.name,
    slug: f.slug,
    parentId: f.parentId,
  }));

  // Fetch remote pages with content
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
  >(
    `/api/v1/projects/${projectId}/pages?${pageParams.toString()}`
  );
  const remotePages: RemotePage[] = pagesResponse.data.map((p) => ({
    id: p._id,
    title: p.title,
    slug: p.slug,
    folderId: p.folderId,
    content: p.content,
    isPublished: p.isPublished,
  }));

  // Compute diff
  const diff = computeDiff(localPages, remotePages, remoteFolders, !!localOpts.delete);

  // Dry-run
  if (localOpts.dryRun) {
    printDryRun(opts, diff, remoteFolders);
    return;
  }

  // Check for changes
  const totalChanges =
    diff.foldersToCreate.length +
    diff.pagesToCreate.length +
    diff.pagesToUpdate.length +
    diff.pagesToDelete.length +
    diff.foldersToDelete.length;

  if (totalChanges === 0) {
    process.stderr.write("No changes to apply.\n");
    return;
  }

  const summary = await applyDiff(client, diff, remoteFolders, {
    projectId,
    branchId: localOpts.branch,
    publish: localOpts.publish,
  });

  printPushResult(opts, summary);

  // Apply docs.json config (navTabs, page positions, openapi)
  if (localOpts.config !== false) {
    const config = readDocsConfig(dir);
    if (config) {
      await applyDocsConfigPlatform(client, config, projectId, localOpts.branch, dir);
    }
  }
}

// ---------------------------------------------------------------------------
// Push: docs.json config application
// ---------------------------------------------------------------------------

/**
 * Apply docs.json config via the REST API (platform mode).
 * After push, re-fetches folders/pages, resolves navTabs, updates settings,
 * patches page positions, and optionally uploads an OpenAPI spec.
 */
async function applyDocsConfigPlatform(
  client: Awaited<ReturnType<typeof import("../lib/client.js").createClient>>,
  config: DocsConfig,
  projectId: string,
  branchId: string | undefined,
  dir: string
): Promise<void> {
  try {
    // 1. Re-fetch remote folders and pages (they may have been created by applyDiff)
    const folderParams = new URLSearchParams();
    if (branchId) folderParams.set("branchId", branchId);
    const folderQs = folderParams.toString();
    const foldersResponse = await client.get<
      Array<{ _id: string; name: string; slug: string; parentId?: string }>
    >(
      `/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`
    );
    const remoteFolders = foldersResponse.data.map((f) => ({
      id: f._id,
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
    }));

    const pageParams = new URLSearchParams();
    if (branchId) pageParams.set("branchId", branchId);
    const pagesResponse = await client.get<
      Array<{
        _id: string;
        slug: string;
        folderId?: string;
        position?: number;
      }>
    >(
      `/api/v1/projects/${projectId}/pages?${pageParams.toString()}`
    );
    const remotePages = pagesResponse.data.map((p) => ({
      id: p._id,
      slug: p.slug,
      folderId: p.folderId,
      position: p.position,
    }));

    // 2. Resolve and apply navTabs
    const navTabs = resolveNavTabs(config, remoteFolders, remotePages);
    await client.patch(
      `/api/v1/projects/${projectId}/settings`,
      { navTabs }
    );

    // 3. Resolve and apply page positions
    const positionMap = resolvePagePositions(config);
    const folderSlugToId = new Map<string, string>();
    for (const folder of remoteFolders) {
      folderSlugToId.set(folder.slug, folder.id);
    }

    let positionsUpdated = 0;
    for (const [key, position] of positionMap) {
      const [folderSlug, pageSlug] = key.split("/");
      const folderId = folderSlugToId.get(folderSlug);
      if (!folderId) continue;

      const page = remotePages.find(
        (p) => p.slug === pageSlug && p.folderId === folderId
      );
      if (!page) continue;

      // Only update if position differs
      if (page.position !== position) {
        try {
          await client.patch(
            `/api/v1/projects/${projectId}/pages/${page.id}`,
            { position }
          );
          positionsUpdated++;
        } catch (err) {
          process.stderr.write(
            `Warning: failed to update position for ${key}: ${err instanceof Error ? err.message : String(err)}\n`
          );
        }
      }
    }

    process.stderr.write(
      `Applied docs.json: ${navTabs.length} navigation tab${navTabs.length === 1 ? "" : "s"}, ${positionsUpdated} page position${positionsUpdated === 1 ? "" : "s"}\n`
    );

    // 4. Upload OpenAPI spec if configured
    if (config.openapi) {
      await uploadOpenApiSpec(
        config.openapi,
        dir,
        async (content: string, format: "json" | "yaml") => {
          const response = await client.post<{
            assetId: string;
            summary: { title: string; version: string; endpointCount: number };
          }>(
            `/api/v1/projects/${projectId}/openapi`,
            { content, format }
          );
          return response.data.summary;
        }
      );
    }
  } catch (err) {
    process.stderr.write(
      `Warning: failed to apply docs.json config: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Apply docs.json config via Convex mutations (core mode).
 */
async function applyDocsConfigConvex(
  client: ReturnType<typeof createConvexClient>,
  config: DocsConfig,
  projectId: string,
  branchId: string,
  dir: string
): Promise<void> {
  try {
    // 1. Re-fetch remote folders and pages (they may have been created by applyDiffConvex)
    const convexFolders = await client.listFoldersByBranch(branchId);
    const remoteFolders = convexFolders.map((f) => ({
      id: f._id,
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
    }));

    const convexPages = await client.listPagesByBranch(branchId);
    const remotePages = convexPages.map((p) => ({
      id: p._id,
      slug: p.slug,
      folderId: p.folderId,
      position: p.position,
    }));

    // 2. Resolve and apply navTabs
    const navTabs = resolveNavTabs(config, remoteFolders, remotePages);
    await client.updateProjectSettings(projectId, { navTabs });

    // 3. Resolve and apply page positions
    const positionMap = resolvePagePositions(config);
    const folderSlugToId = new Map<string, string>();
    for (const folder of remoteFolders) {
      folderSlugToId.set(folder.slug, folder.id);
    }

    let positionsUpdated = 0;
    for (const [key, position] of positionMap) {
      const [folderSlug, pageSlug] = key.split("/");
      const folderId = folderSlugToId.get(folderSlug);
      if (!folderId) continue;

      const page = remotePages.find(
        (p) => p.slug === pageSlug && p.folderId === folderId
      );
      if (!page) continue;

      if (page.position !== position) {
        try {
          await client.updatePage(page.id, { position });
          positionsUpdated++;
        } catch (err) {
          process.stderr.write(
            `Warning: failed to update position for ${key}: ${err instanceof Error ? err.message : String(err)}\n`
          );
        }
      }
    }

    process.stderr.write(
      `Applied docs.json: ${navTabs.length} navigation tab${navTabs.length === 1 ? "" : "s"}, ${positionsUpdated} page position${positionsUpdated === 1 ? "" : "s"}\n`
    );

    // 4. Upload OpenAPI spec if configured
    if (config.openapi) {
      await uploadOpenApiSpec(
        config.openapi,
        dir,
        async (content: string, format: "json" | "yaml") => {
          // In core mode, store the spec directly in project settings
          await client.updateProjectSettings(projectId, {
            openapi: { content, format },
          });
          // Parse spec to extract summary for display
          try {
            const parsed = format === "json" ? JSON.parse(content) : null;
            if (parsed) {
              return {
                title: parsed.info?.title ?? "Unknown",
                version: parsed.info?.version ?? "0.0.0",
                endpointCount: countEndpoints(parsed),
              };
            }
          } catch {
            // ignore parse errors for summary
          }
          return { title: "OpenAPI spec", version: "unknown", endpointCount: 0 };
        }
      );
    }
  } catch (err) {
    process.stderr.write(
      `Warning: failed to apply docs.json config: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Upload an OpenAPI spec file. Reads the file, detects format, and calls the
 * provided upload function.
 */
async function uploadOpenApiSpec(
  specPath: string,
  baseDir: string,
  upload: (content: string, format: "json" | "yaml") => Promise<{
    title: string;
    version: string;
    endpointCount: number;
  }>
): Promise<void> {
  const fullPath = path.join(baseDir, specPath);

  let content: string;
  try {
    content = fs.readFileSync(fullPath, "utf-8");
  } catch {
    process.stderr.write(
      `Warning: OpenAPI spec file not found: ${specPath}\n`
    );
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  let format: "json" | "yaml";
  if (ext === ".json") {
    format = "json";
  } else if (ext === ".yaml" || ext === ".yml") {
    format = "yaml";
  } else {
    process.stderr.write(
      `Warning: cannot detect OpenAPI spec format from extension "${ext}", skipping\n`
    );
    return;
  }

  try {
    const summary = await upload(content, format);
    process.stderr.write(
      `Uploaded OpenAPI spec: ${summary.title} v${summary.version} (${summary.endpointCount} endpoint${summary.endpointCount === 1 ? "" : "s"})\n`
    );
  } catch (err) {
    process.stderr.write(
      `Warning: failed to upload OpenAPI spec: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Count the number of endpoints in a parsed OpenAPI spec object.
 */
function countEndpoints(spec: Record<string, unknown>): number {
  const paths = spec.paths;
  if (typeof paths !== "object" || paths === null) return 0;
  let count = 0;
  for (const pathObj of Object.values(paths as Record<string, unknown>)) {
    if (typeof pathObj !== "object" || pathObj === null) continue;
    for (const key of Object.keys(pathObj as Record<string, unknown>)) {
      if (
        ["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(
          key.toLowerCase()
        )
      ) {
        count++;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Push: Shared helpers
// ---------------------------------------------------------------------------

function printDryRun(
  opts: GlobalOpts,
  diff: ReturnType<typeof computeDiff>,
  remoteFolders: PushRemoteFolder[]
): void {
  if (opts.json) {
    printData(
      {
        data: {
          dryRun: true,
          foldersToCreate: diff.foldersToCreate,
          pagesToCreate: diff.pagesToCreate.map((p) => ({
            path: p.relativePath,
            title: p.title,
            slug: p.slug,
          })),
          pagesToUpdate: diff.pagesToUpdate.map(({ local }) => ({
            path: local.relativePath,
            title: local.title,
            slug: local.slug,
          })),
          pagesToDelete: diff.pagesToDelete.map((p) => ({
            id: p.id,
            slug: p.slug,
          })),
          foldersToDelete: diff.foldersToDelete.map((f) => ({
            id: f.id,
            name: f.name,
          })),
        },
      },
      opts
    );
    return;
  }

  const lines = formatDiffLines(diff, remoteFolders);
  if (lines.length === 0) {
    process.stderr.write("No changes detected.\n");
    return;
  }

  process.stderr.write("\nDry run — no changes will be applied\n\n");
  for (const line of lines) {
    process.stderr.write(line + "\n");
  }
  process.stderr.write(`\n${formatDiffSummary(diff)}\n`);
}

function printPushResult(
  opts: GlobalOpts,
  summary: ApplyDiffSummary
): void {
  if (opts.json) {
    printData({ data: summary }, opts);
    return;
  }

  if (summary.errors.length > 0) {
    for (const err of summary.errors) {
      process.stderr.write(`  Error: ${err}\n`);
    }
  }

  printSuccess(formatSummary(summary));
}

// ---------------------------------------------------------------------------
// Shared: Resolve branch ID from ConvexCliClient
// ---------------------------------------------------------------------------

async function resolveBranchId(
  client: ReturnType<typeof createConvexClient>,
  projectId: string,
  branchId?: string
): Promise<string> {
  if (branchId) return branchId;

  const defaultBranch = await client.getDefaultBranch(projectId);
  if (!defaultBranch) {
    throw new CliError(
      `No default branch found for project ${projectId}. Specify --branch.`,
      EXIT_NOT_FOUND
    );
  }
  return defaultBranch._id;
}

interface RemoteFolder {
  _id: string;
  name: string;
  slug: string;
  parentId?: string;
}

interface RemotePullPage {
  _id: string;
  title: string;
  slug: string;
  folderId?: string;
  position: number;
  isPublished: boolean;
  icon?: string;
  description?: string;
  content?: string | null;
}

/**
 * Build a map from folderId → full folder path (e.g. "getting-started/advanced").
 * Walks the parentId chain to compute nested paths.
 */
function buildFolderPathMap(folders: RemoteFolder[]): Map<string, string> {
  const folderById = new Map<string, RemoteFolder>();
  for (const f of folders) {
    folderById.set(f._id, f);
  }

  const pathCache = new Map<string, string>();
  const visiting = new Set<string>();

  function getPath(folderId: string): string {
    const cached = pathCache.get(folderId);
    if (cached !== undefined) return cached;

    if (visiting.has(folderId)) return "";
    visiting.add(folderId);

    const folder = folderById.get(folderId);
    if (!folder) {
      visiting.delete(folderId);
      return "";
    }

    let result: string;
    if (folder.parentId) {
      const parentPath = getPath(folder.parentId);
      result = parentPath ? `${parentPath}/${folder.slug}` : folder.slug;
    } else {
      result = folder.slug;
    }

    visiting.delete(folderId);
    pathCache.set(folderId, result);
    return result;
  }

  for (const f of folders) {
    getPath(f._id);
  }

  return pathCache;
}

function formatDate(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    return value.split("T")[0];
  }
  return "—";
}
