import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, type PageFrontmatter } from "./frontmatter.js";
import type { Client } from "./client.js";
import type { ConvexCliClient } from "./convex-client.js";
import { mdxToBlockNote } from "@inkloom/mdx-parser";

/**
 * A local .mdx page found by walking the directory tree.
 */
export interface LocalPage {
  /** Relative path from the walk root, e.g. "getting-started/quickstart.mdx" */
  relativePath: string;
  /** Folder portion of the path, e.g. "getting-started" (empty string for root) */
  folderPath: string;
  /** Filename including extension, e.g. "quickstart.mdx" */
  filename: string;
  /** Slug derived from frontmatter or filename */
  slug: string;
  /** Title derived from frontmatter or filename */
  title: string;
  /** Parsed frontmatter */
  frontmatter: PageFrontmatter;
  /** MDX body content without frontmatter */
  content: string;
  /** Full file content (frontmatter + body) */
  fullContent: string;
}

/**
 * A page from the remote API.
 */
export interface RemotePage {
  id: string;
  title: string;
  slug: string;
  folderId?: string;
  content?: string;
  isPublished?: boolean;
}

/**
 * A folder from the remote API.
 */
export interface RemoteFolder {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface FolderToCreate {
  path: string;
  name: string;
  parentPath: string;
}

export interface PageToUpdate {
  local: LocalPage;
  remote: RemotePage;
}

export interface DiffResult {
  foldersToCreate: FolderToCreate[];
  pagesToCreate: LocalPage[];
  pagesToUpdate: PageToUpdate[];
  pagesToDelete: RemotePage[];
  foldersToDelete: RemoteFolder[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".turbo"]);

/**
 * Recursively walk a directory collecting all .mdx files.
 * Skips dot-prefixed directories and node_modules.
 * Returns LocalPage objects with parsed frontmatter.
 */
export function walkMdxFiles(dir: string): LocalPage[] {
  const resolvedDir = path.resolve(dir);
  const results: LocalPage[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        const fullContent = fs.readFileSync(fullPath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(fullContent);

        const relativePath = path.relative(resolvedDir, fullPath);
        const folderPath = path.dirname(relativePath);
        const filename = path.basename(relativePath);
        const filenameWithoutExt = filename.replace(/\.mdx$/, "");

        const slug = frontmatter.slug ?? filenameWithoutExt;
        const title = frontmatter.title ?? titleCase(filenameWithoutExt);

        results.push({
          relativePath: normalizePath(relativePath),
          folderPath: normalizePath(folderPath === "." ? "" : folderPath),
          filename,
          slug,
          title,
          frontmatter,
          content: body,
          fullContent,
        });
      }
    }
  }

  walk(resolvedDir);
  return results;
}

/**
 * Compute the diff between local .mdx files and remote pages/folders.
 *
 * Matching: a local page matches a remote page when their computed
 * "folder path + slug" keys are identical.
 *
 * When deleteRemoved is true, remote pages/folders not matched by any
 * local page are included in pagesToDelete/foldersToDelete.
 */
export function computeDiff(
  localPages: LocalPage[],
  remotePages: RemotePage[],
  remoteFolders: RemoteFolder[],
  deleteRemoved: boolean
): DiffResult {
  // 1. Build remote folder path map: folderId → full path
  const remoteFolderPathMap = buildRemoteFolderPathMap(remoteFolders);

  // Build reverse map: path → folderId
  const pathToFolderId = new Map<string, string>();
  for (const [folderId, folderPath] of remoteFolderPathMap) {
    pathToFolderId.set(folderPath, folderId);
  }

  // 2. Build remote page lookup: "folderPath/slug" → remote page
  const remotePageByKey = new Map<string, RemotePage>();
  for (const rp of remotePages) {
    const folderPath = rp.folderId
      ? remoteFolderPathMap.get(rp.folderId) ?? ""
      : "";
    const key = folderPath ? `${folderPath}/${rp.slug}` : rp.slug;
    remotePageByKey.set(key, rp);
  }

  // Track matched remote pages/folders
  const matchedRemotePageKeys = new Set<string>();
  const referencedFolderPaths = new Set<string>();

  const pagesToCreate: LocalPage[] = [];
  const pagesToUpdate: PageToUpdate[] = [];

  // 3. For each local page, check if there's a matching remote page
  for (const local of localPages) {
    const key = local.folderPath
      ? `${local.folderPath}/${local.slug}`
      : local.slug;

    // Track all folder paths referenced by local pages
    if (local.folderPath) {
      referencedFolderPaths.add(local.folderPath);
      // Also track ancestor folder paths
      const parts = local.folderPath.split("/");
      for (let i = 1; i < parts.length; i++) {
        referencedFolderPaths.add(parts.slice(0, i).join("/"));
      }
    }

    const remote = remotePageByKey.get(key);
    if (!remote) {
      pagesToCreate.push(local);
    } else {
      matchedRemotePageKeys.add(key);
      // Compare content (trimmed) to decide if update is needed
      const localContent = local.content.trim();
      const remoteContent = (remote.content ?? "").trim();
      if (localContent !== remoteContent) {
        pagesToUpdate.push({ local, remote });
      }
    }
  }

  // 4. Folders to create: local folder paths that don't exist remotely, ordered parents-first
  const existingFolderPaths = new Set(pathToFolderId.keys());
  const foldersToCreate: FolderToCreate[] = [];

  // Collect all unique folder paths from local pages
  const allLocalFolderPaths = new Set<string>();
  for (const local of localPages) {
    if (local.folderPath) {
      // Add the folder path and all ancestor paths
      const parts = local.folderPath.split("/");
      for (let i = 1; i <= parts.length; i++) {
        allLocalFolderPaths.add(parts.slice(0, i).join("/"));
      }
    }
  }

  // Sort by depth (parents first) then alphabetically
  const sortedFolderPaths = [...allLocalFolderPaths].sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });

  for (const folderPath of sortedFolderPaths) {
    if (!existingFolderPaths.has(folderPath)) {
      const parts = folderPath.split("/");
      const name = parts[parts.length - 1];
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      foldersToCreate.push({ path: folderPath, name, parentPath });
    }
  }

  // 5. Pages and folders to delete (only when deleteRemoved is true)
  const pagesToDelete: RemotePage[] = [];
  const foldersToDelete: RemoteFolder[] = [];

  if (deleteRemoved) {
    // Remote pages not matched by any local page → delete
    for (const rp of remotePages) {
      const folderPath = rp.folderId
        ? remoteFolderPathMap.get(rp.folderId) ?? ""
        : "";
      const key = folderPath ? `${folderPath}/${rp.slug}` : rp.slug;
      if (!matchedRemotePageKeys.has(key)) {
        pagesToDelete.push(rp);
      }
    }

    // Remote folders whose paths are not referenced by any local page → delete
    // Order children-first (deepest paths first) for safe deletion
    const usedFolderPaths = new Set<string>();
    for (const local of localPages) {
      if (local.folderPath) {
        const parts = local.folderPath.split("/");
        for (let i = 1; i <= parts.length; i++) {
          usedFolderPaths.add(parts.slice(0, i).join("/"));
        }
      }
    }

    const unusedFolders = remoteFolders.filter((rf) => {
      const rfPath = remoteFolderPathMap.get(rf.id);
      return rfPath !== undefined && !usedFolderPaths.has(rfPath);
    });

    // Sort deepest-first for safe bottom-up deletion
    unusedFolders.sort((a, b) => {
      const pathA = remoteFolderPathMap.get(a.id) ?? "";
      const pathB = remoteFolderPathMap.get(b.id) ?? "";
      const depthA = pathA.split("/").length;
      const depthB = pathB.split("/").length;
      if (depthA !== depthB) return depthB - depthA;
      return pathA.localeCompare(pathB);
    });

    foldersToDelete.push(...unusedFolders);
  }

  return {
    foldersToCreate,
    pagesToCreate,
    pagesToUpdate,
    pagesToDelete,
    foldersToDelete,
  };
}

/**
 * Build a map from folder id → full folder path (e.g. "getting-started/advanced").
 * Walks the parentId chain to compute nested paths.
 */
function buildRemoteFolderPathMap(
  folders: RemoteFolder[]
): Map<string, string> {
  const folderById = new Map<string, RemoteFolder>();
  for (const f of folders) {
    folderById.set(f.id, f);
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
    getPath(f.id);
  }

  return pathCache;
}

/**
 * Convert a filename (without extension) to title case.
 * e.g. "getting-started" → "Getting Started"
 *      "api_reference" → "Api Reference"
 */
export function titleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize path separators to forward slashes (for Windows compat).
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Apply diff — create folders, bulk create/update/delete pages, delete folders
// ---------------------------------------------------------------------------

interface BulkOperation {
  action: "create" | "update" | "delete";
  title?: string;
  slug?: string;
  folderId?: string;
  position?: number;
  isPublished?: boolean;
  content?: string;
  contentFormat?: "mdx";
  description?: string;
  icon?: string;
  pageId?: string;
}

interface BulkResult {
  index: number;
  action: string;
  status: "success" | "error";
  pageId?: string;
  error?: string;
}

export interface ApplyDiffOptions {
  projectId: string;
  branchId?: string;
  publish?: boolean;
}

export interface ApplyDiffSummary {
  foldersCreated: number;
  pagesCreated: number;
  pagesUpdated: number;
  pagesDeleted: number;
  foldersDeleted: number;
  errors: string[];
}

const MAX_BULK_OPERATIONS = 50;

/**
 * Apply a computed diff against the remote API.
 *
 * Steps:
 * 1. Create folders top-down (parents first), tracking returned IDs
 * 2. Build bulk operations for page creates/updates/deletes
 * 3. Send bulk operations in batches of 50
 * 4. Delete folders bottom-up (children first)
 */
export async function applyDiff(
  client: Client,
  diff: DiffResult,
  remoteFolders: RemoteFolder[],
  opts: ApplyDiffOptions
): Promise<ApplyDiffSummary> {
  const summary: ApplyDiffSummary = {
    foldersCreated: 0,
    pagesCreated: 0,
    pagesUpdated: 0,
    pagesDeleted: 0,
    foldersDeleted: 0,
    errors: [],
  };

  const branchQs = opts.branchId ? `?branchId=${opts.branchId}` : "";

  // Build a map: folder path → folderId (from existing remote folders)
  const remoteFolderPathMap = buildRemoteFolderPathMap(remoteFolders);
  const pathToFolderId = new Map<string, string>();
  for (const [folderId, folderPath] of remoteFolderPathMap) {
    pathToFolderId.set(folderPath, folderId);
  }

  // 1. Create folders top-down (parents first)
  for (const folder of diff.foldersToCreate) {
    const parentFolderId = folder.parentPath
      ? pathToFolderId.get(folder.parentPath)
      : undefined;

    try {
      const body: Record<string, unknown> = { name: folder.name };
      if (parentFolderId) body.parentId = parentFolderId;
      if (opts.branchId) body.branchId = opts.branchId;

      const response = await client.post<{ _id: string }>(
        `/api/v1/projects/${opts.projectId}/folders`,
        body
      );

      // Track the new folder ID so child folders/pages can reference it
      pathToFolderId.set(folder.path, response.data._id);
      summary.foldersCreated++;
    } catch (err) {
      summary.errors.push(
        `Failed to create folder "${folder.path}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 2. Build bulk operations
  const operations: BulkOperation[] = [];

  // Creates
  for (const local of diff.pagesToCreate) {
    const folderId = local.folderPath
      ? pathToFolderId.get(local.folderPath)
      : undefined;

    const op: BulkOperation = {
      action: "create",
      title: local.title,
      slug: local.slug,
      content: local.content,
      contentFormat: "mdx",
    };
    if (folderId) op.folderId = folderId;
    if (local.frontmatter.position !== undefined)
      op.position = local.frontmatter.position;
    if (local.frontmatter.icon) op.icon = local.frontmatter.icon;
    if (local.frontmatter.description)
      op.description = local.frontmatter.description;

    // Publish: from frontmatter or --publish flag
    if (local.frontmatter.isPublished !== undefined) {
      op.isPublished = local.frontmatter.isPublished;
    } else if (opts.publish) {
      op.isPublished = true;
    }

    operations.push(op);
  }

  // Updates
  for (const { local, remote } of diff.pagesToUpdate) {
    const op: BulkOperation = {
      action: "update",
      pageId: remote.id,
      content: local.content,
      contentFormat: "mdx",
    };
    // Update title if it changed
    if (local.title !== remote.title) {
      op.title = local.title;
    }
    // Update published state if --publish flag is set
    if (opts.publish) {
      op.isPublished = true;
    }
    operations.push(op);
  }

  // Deletes
  for (const remote of diff.pagesToDelete) {
    operations.push({
      action: "delete",
      pageId: remote.id,
    });
  }

  // 3. Send bulk operations in batches of MAX_BULK_OPERATIONS
  for (let i = 0; i < operations.length; i += MAX_BULK_OPERATIONS) {
    const batch = operations.slice(i, i + MAX_BULK_OPERATIONS);
    try {
      const body: Record<string, unknown> = { operations: batch };
      if (opts.branchId) body.branchId = opts.branchId;

      const response = await client.post<{
        results: BulkResult[];
        summary: { succeeded: number; failed: number };
      }>(`/api/v1/projects/${opts.projectId}/pages/bulk`, body);

      // Tally results by action
      for (const result of response.data.results) {
        if (result.status === "success") {
          if (result.action === "create") summary.pagesCreated++;
          else if (result.action === "update") summary.pagesUpdated++;
          else if (result.action === "delete") summary.pagesDeleted++;
        } else {
          summary.errors.push(
            `Bulk op #${result.index} (${result.action}) failed: ${result.error}`
          );
        }
      }
    } catch (err) {
      summary.errors.push(
        `Bulk request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 4. Delete folders bottom-up (children first)
  for (const folder of diff.foldersToDelete) {
    try {
      await client.delete(
        `/api/v1/projects/${opts.projectId}/folders/${folder.id}`
      );
      summary.foldersDeleted++;
    } catch (err) {
      summary.errors.push(
        `Failed to delete folder "${folder.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return summary;
}

/**
 * Format the diff as human-readable lines for dry-run output.
 * When remoteFolders is provided, deleted pages show their actual folder path
 * instead of a "..." placeholder.
 */
export function formatDiffLines(diff: DiffResult, remoteFolders?: RemoteFolder[]): string[] {
  const lines: string[] = [];

  // Build folder path map for resolving deleted page paths
  const folderPathMap = remoteFolders
    ? buildRemoteFolderPathMap(remoteFolders)
    : undefined;

  for (const folder of diff.foldersToCreate) {
    lines.push(`  CREATE  folder  ${folder.path}/`);
  }
  for (const page of diff.pagesToCreate) {
    lines.push(`  CREATE  page    ${page.relativePath}`);
  }
  for (const { local } of diff.pagesToUpdate) {
    lines.push(
      `  UPDATE  page    ${local.relativePath}  (content changed)`
    );
  }
  for (const page of diff.pagesToDelete) {
    let folderPath = "";
    if (page.folderId) {
      folderPath = folderPathMap?.get(page.folderId) ?? "...";
    }
    lines.push(
      `  DELETE  page    ${folderPath ? folderPath + "/" : ""}${page.slug}.mdx`
    );
  }
  for (const folder of diff.foldersToDelete) {
    lines.push(`  DELETE  folder  ${folder.name}/`);
  }

  return lines;
}

/**
 * Format a push summary as a human-readable string.
 */
export function formatSummary(summary: ApplyDiffSummary): string {
  const parts: string[] = [];
  if (summary.foldersCreated > 0)
    parts.push(`${summary.foldersCreated} folder${summary.foldersCreated === 1 ? "" : "s"} created`);
  if (summary.pagesCreated > 0)
    parts.push(`${summary.pagesCreated} page${summary.pagesCreated === 1 ? "" : "s"} created`);
  if (summary.pagesUpdated > 0)
    parts.push(`${summary.pagesUpdated} page${summary.pagesUpdated === 1 ? "" : "s"} updated`);
  if (summary.pagesDeleted > 0)
    parts.push(`${summary.pagesDeleted} page${summary.pagesDeleted === 1 ? "" : "s"} deleted`);
  if (summary.foldersDeleted > 0)
    parts.push(`${summary.foldersDeleted} folder${summary.foldersDeleted === 1 ? "" : "s"} deleted`);
  if (parts.length === 0) parts.push("no changes");
  return `Summary: ${parts.join(", ")}`;
}

/**
 * Format a dry-run diff summary as a human-readable string.
 */
export function formatDiffSummary(diff: DiffResult): string {
  const parts: string[] = [];
  if (diff.foldersToCreate.length > 0)
    parts.push(`${diff.foldersToCreate.length} folder${diff.foldersToCreate.length === 1 ? "" : "s"} created`);
  if (diff.pagesToCreate.length > 0)
    parts.push(`${diff.pagesToCreate.length} page${diff.pagesToCreate.length === 1 ? "" : "s"} created`);
  if (diff.pagesToUpdate.length > 0)
    parts.push(`${diff.pagesToUpdate.length} page${diff.pagesToUpdate.length === 1 ? "" : "s"} updated`);
  if (diff.pagesToDelete.length > 0)
    parts.push(`${diff.pagesToDelete.length} page${diff.pagesToDelete.length === 1 ? "" : "s"} deleted`);
  if (diff.foldersToDelete.length > 0)
    parts.push(`${diff.foldersToDelete.length} folder${diff.foldersToDelete.length === 1 ? "" : "s"} deleted`);
  if (parts.length === 0) parts.push("no changes");
  return `Summary: ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Apply diff via Convex (core / OSS mode) — uses ConvexCliClient directly
// ---------------------------------------------------------------------------

export interface ApplyDiffConvexOptions {
  branchId: string;
  publish?: boolean;
}

/**
 * Apply a computed diff directly via Convex mutations (core / OSS mode).
 *
 * Unlike `applyDiff()` which uses the REST API bulk endpoint, this function
 * calls ConvexCliClient methods (create/update/remove) one at a time.
 * MDX content is converted to BlockNote JSON before storing.
 *
 * Steps:
 * 1. Create folders top-down (parents first), tracking returned IDs
 * 2. Create pages (MDX → BlockNote conversion)
 * 3. Update pages (MDX → BlockNote conversion)
 * 4. Delete pages
 * 5. Delete folders bottom-up (children first)
 */
export async function applyDiffConvex(
  client: ConvexCliClient,
  diff: DiffResult,
  remoteFolders: RemoteFolder[],
  opts: ApplyDiffConvexOptions
): Promise<ApplyDiffSummary> {
  const summary: ApplyDiffSummary = {
    foldersCreated: 0,
    pagesCreated: 0,
    pagesUpdated: 0,
    pagesDeleted: 0,
    foldersDeleted: 0,
    errors: [],
  };

  // Build a map: folder path → folderId (from existing remote folders)
  const remoteFolderPathMap = buildRemoteFolderPathMap(remoteFolders);
  const pathToFolderId = new Map<string, string>();
  for (const [folderId, folderPath] of remoteFolderPathMap) {
    pathToFolderId.set(folderPath, folderId);
  }

  // 1. Create folders top-down (parents first)
  for (const folder of diff.foldersToCreate) {
    const parentFolderId = folder.parentPath
      ? pathToFolderId.get(folder.parentPath)
      : undefined;

    try {
      const folderId = await client.createFolder({
        branchId: opts.branchId,
        name: folder.name,
        parentId: parentFolderId,
      });

      // Track the new folder ID so child folders/pages can reference it
      pathToFolderId.set(folder.path, folderId);
      summary.foldersCreated++;
    } catch (err) {
      summary.errors.push(
        `Failed to create folder "${folder.path}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 2. Create pages
  for (const local of diff.pagesToCreate) {
    const folderId = local.folderPath
      ? pathToFolderId.get(local.folderPath)
      : undefined;

    try {
      // Create the page
      const pageId = await client.createPage({
        branchId: opts.branchId,
        title: local.title,
        folderId,
        position: local.frontmatter.position,
      });

      // Convert MDX to BlockNote and update content
      const blocks = mdxToBlockNote(local.content);
      await client.updatePageContent(pageId, JSON.stringify(blocks));

      // Set metadata (icon, description, isPublished)
      const updates: Record<string, unknown> = {};
      if (local.frontmatter.icon) updates.icon = local.frontmatter.icon;
      if (local.frontmatter.description)
        updates.description = local.frontmatter.description;

      if (local.frontmatter.isPublished !== undefined) {
        updates.isPublished = local.frontmatter.isPublished;
      } else if (opts.publish) {
        updates.isPublished = true;
      }

      if (Object.keys(updates).length > 0) {
        await client.updatePage(pageId, updates);
      }

      summary.pagesCreated++;
    } catch (err) {
      summary.errors.push(
        `Failed to create page "${local.relativePath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 3. Update pages
  for (const { local, remote } of diff.pagesToUpdate) {
    try {
      // Convert MDX to BlockNote and update content
      const blocks = mdxToBlockNote(local.content);
      await client.updatePageContent(remote.id, JSON.stringify(blocks));

      // Update title if changed
      const updates: Record<string, unknown> = {};
      if (local.title !== remote.title) {
        updates.title = local.title;
      }
      if (opts.publish) {
        updates.isPublished = true;
      }

      if (Object.keys(updates).length > 0) {
        await client.updatePage(remote.id, updates);
      }

      summary.pagesUpdated++;
    } catch (err) {
      summary.errors.push(
        `Failed to update page "${local.relativePath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 4. Delete pages
  for (const remote of diff.pagesToDelete) {
    try {
      await client.removePage(remote.id);
      summary.pagesDeleted++;
    } catch (err) {
      summary.errors.push(
        `Failed to delete page "${remote.slug}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 5. Delete folders bottom-up (children first)
  for (const folder of diff.foldersToDelete) {
    try {
      await client.removeFolder(folder.id);
      summary.foldersDeleted++;
    } catch (err) {
      summary.errors.push(
        `Failed to delete folder "${folder.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return summary;
}
