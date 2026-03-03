import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { CliError, EXIT_NOT_FOUND } from "../lib/errors.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";
import { serializeFrontmatter, type PageFrontmatter } from "../lib/frontmatter.js";
import {
  walkMdxFiles,
  computeDiff,
  applyDiff,
  formatDiffLines,
  formatDiffSummary,
  formatSummary,
  type RemotePage,
  type RemoteFolder as PushRemoteFolder,
} from "../lib/push.js";
import fse from "fs-extra";

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
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom pages pull proj_abc --dir ./docs                     Export all pages
  $ inkloom pages pull proj_abc --dir ./docs --overwrite         Overwrite existing files
  $ inkloom pages pull proj_abc --dir ./docs --published-only    Only published pages`
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            dir: string;
            branch?: string;
            overwrite?: boolean;
            publishedOnly?: boolean;
          }
        ) => {
          const outDir = path.resolve(localOpts.dir);

          // 1. Fetch folders
          const folderParams = new URLSearchParams();
          if (localOpts.branch) folderParams.set("branchId", localOpts.branch);
          const folderQs = folderParams.toString();
          const foldersResponse = await client.get<RemoteFolder[]>(
            `/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`
          );
          const folders = foldersResponse.data;

          // 2. Fetch pages with MDX content
          const pageParams = new URLSearchParams();
          if (localOpts.branch) pageParams.set("branchId", localOpts.branch);
          pageParams.set("includeContent", "true");
          pageParams.set("format", "mdx");
          const pagesResponse = await client.get<RemotePullPage[]>(
            `/api/v1/projects/${projectId}/pages?${pageParams.toString()}`
          );
          let pages = pagesResponse.data;

          // 3. Filter published-only if requested
          if (localOpts.publishedOnly) {
            pages = pages.filter((p) => p.isPublished);
          }

          if (pages.length === 0) {
            process.stderr.write("No pages to export.\n");
            return;
          }

          // 4. Build folder lookup: folderId → full folder path
          const folderPathMap = buildFolderPathMap(folders);

          // 5. Check if output dir exists and is non-empty
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

          // 6. Write each page as {slug}.mdx
          fse.ensureDirSync(outDir);

          const writtenPaths: string[] = [];
          for (const page of pages) {
            const folderPath = page.folderId
              ? folderPathMap.get(page.folderId) ?? ""
              : "";
            const fileDir = folderPath
              ? path.join(outDir, folderPath)
              : outDir;
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
            writtenPaths.push(
              path.relative(process.cwd(), filePath)
            );
          }

          // 7. Print summary
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
      )
    );

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
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom pages push proj_abc --dir ./docs --dry-run            Preview changes
  $ inkloom pages push proj_abc --dir ./docs --publish --delete   Full sync & publish
  $ INKLOOM_TOKEN=$TOKEN inkloom pages push $PROJECT --dir ./docs CI usage`
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            dir: string;
            branch?: string;
            delete?: boolean;
            dryRun?: boolean;
            publish?: boolean;
          }
        ) => {
          const dir = path.resolve(localOpts.dir);

          // 1. Walk local dir
          if (!fs.existsSync(dir)) {
            throw new CliError(`Directory not found: ${localOpts.dir}`, EXIT_NOT_FOUND);
          }
          const localPages = walkMdxFiles(dir);
          if (localPages.length === 0) {
            process.stderr.write(
              `No .mdx files found in ${localOpts.dir}\n`
            );
            return;
          }

          // 2. Fetch remote folders
          const folderParams = new URLSearchParams();
          if (localOpts.branch)
            folderParams.set("branchId", localOpts.branch);
          const folderQs = folderParams.toString();
          const foldersResponse = await client.get<
            Array<{ _id: string; name: string; slug: string; parentId?: string }>
          >(
            `/api/v1/projects/${projectId}/folders${folderQs ? `?${folderQs}` : ""}`
          );
          const remoteFolders: PushRemoteFolder[] = foldersResponse.data.map(
            (f) => ({
              id: f._id,
              name: f.name,
              slug: f.slug,
              parentId: f.parentId,
            })
          );

          // 3. Fetch remote pages with content
          const pageParams = new URLSearchParams();
          if (localOpts.branch)
            pageParams.set("branchId", localOpts.branch);
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

          // 4. Compute diff
          const diff = computeDiff(
            localPages,
            remotePages,
            remoteFolders,
            !!localOpts.delete
          );

          // 5. Dry-run: print diff and exit
          if (localOpts.dryRun) {
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

            process.stderr.write(
              "\nDry run — no changes will be applied\n\n"
            );
            for (const line of lines) {
              process.stderr.write(line + "\n");
            }
            process.stderr.write(
              `\n${formatDiffSummary(diff)}\n`
            );
            return;
          }

          // 6. Apply changes
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

          // 7. Print summary
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
      )
    );
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
