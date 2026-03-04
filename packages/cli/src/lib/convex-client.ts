/**
 * ConvexCliClient — Direct Convex client for core (OSS) CLI mode.
 *
 * In core mode there's no REST API. The CLI talks directly to Convex
 * via `ConvexHttpClient`, calling query/mutation functions by name.
 *
 * This client provides semantic methods that CLI commands consume,
 * mapping them to Convex function calls against the core schema.
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import {
  blockNoteToMDX,
  parseBlockNoteContent,
} from "@inkloom/mdx-parser";

// ---------------------------------------------------------------------------
// Types — mirrors of Convex document shapes returned by queries
// ---------------------------------------------------------------------------

export interface ConvexProject {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  description?: string;
  workosOrgId: string;
  defaultBranchId?: string;
  isPublic?: boolean;
  // Branding / settings
  primaryColor?: string;
  theme?: string;
  logoAssetId?: string;
  faviconAssetId?: string;
  customFonts?: unknown;
  socialLinks?: unknown;
  showBranding?: boolean;
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  ogImageAssetId?: string;
  // OpenAPI
  openApiSpec?: string;
  // Deployment
  deploymentUrl?: string;
  // Navigation
  navTabs?: unknown[];
  // Timestamps
  createdAt?: number;
  updatedAt?: number;
}

export interface ConvexBranch {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  isDefault: boolean;
  isLocked: boolean;
  deletedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ConvexPage {
  _id: string;
  _creationTime: number;
  branchId: string;
  folderId?: string;
  title: string;
  slug: string;
  path?: string;
  position?: number;
  isPublished?: boolean;
  icon?: string;
  description?: string;
  subtitle?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ConvexPageContent {
  _id: string;
  pageId: string;
  content: string;
  updatedAt?: number;
}

export interface ConvexFolder {
  _id: string;
  _creationTime: number;
  branchId: string;
  parentId?: string;
  name: string;
  slug: string;
  path?: string;
  position?: number;
  icon?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ConvexAsset {
  _id: string;
  _creationTime: number;
  projectId: string;
  filename: string;
  mimeType?: string;
  size?: number;
  storageId?: string;
  r2Key?: string;
  url?: string;
  createdAt?: number;
}

export interface ConvexDeployment {
  _id: string;
  _creationTime: number;
  projectId: string;
  status: string;
  target?: string;
  url?: string;
  createdAt?: number;
  completedAt?: number;
}

export interface ConvexCommentThread {
  _id: string;
  _creationTime: number;
  pageId: string;
  blockId?: string;
  resolved?: boolean;
  createdAt?: number;
}

export interface ConvexComment {
  _id: string;
  _creationTime: number;
  threadId: string;
  userId?: string;
  body: string;
  createdAt?: number;
}

export interface ConvexMergeRequest {
  _id: string;
  _creationTime: number;
  projectId: string;
  sourceBranchId: string;
  targetBranchId: string;
  title: string;
  description?: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
}

// ---------------------------------------------------------------------------
// Export format (for `inkloom export`)
// ---------------------------------------------------------------------------

export interface ExportData {
  version: 1;
  exportedAt: string;
  projects: ConvexProject[];
  branches: ConvexBranch[];
  pages: Array<ConvexPage & { content?: string }>;
  folders: ConvexFolder[];
  assets: ConvexAsset[];
  deployments: ConvexDeployment[];
  mergeRequests: ConvexMergeRequest[];
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ConvexCliClientOptions {
  /** The NEXT_PUBLIC_CONVEX_URL value pointing to the Convex deployment. */
  convexUrl: string;
  /** Enable verbose debug logging to stderr. */
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// ConvexCliClient
// ---------------------------------------------------------------------------

export class ConvexCliClient {
  private client: ConvexHttpClient;
  private verbose: boolean;

  constructor(opts: ConvexCliClientOptions) {
    this.client = new ConvexHttpClient(opts.convexUrl);
    this.verbose = opts.verbose ?? false;
  }

  // -- Helpers --------------------------------------------------------------

  private log(msg: string): void {
    if (this.verbose) {
      process.stderr.write(`[convex] ${msg}\n`);
    }
  }

  private async query<T>(fnPath: string, args: Record<string, unknown> = {}): Promise<T> {
    const parts = fnPath.split(".");
    if (parts.length !== 2) {
      throw new Error(`Invalid function path: ${fnPath} (expected "module.function")`);
    }
    const [mod, fn] = parts;
    const ref = (anyApi as Record<string, Record<string, unknown>>)[mod][fn];
    this.log(`query ${fnPath}(${JSON.stringify(args)})`);
    const start = Date.now();
    const result = await this.client.query(ref as never, args as never) as T;
    this.log(`query ${fnPath} → ${Date.now() - start}ms`);
    return result;
  }

  private async mutate<T>(fnPath: string, args: Record<string, unknown> = {}): Promise<T> {
    const parts = fnPath.split(".");
    if (parts.length !== 2) {
      throw new Error(`Invalid function path: ${fnPath} (expected "module.function")`);
    }
    const [mod, fn] = parts;
    const ref = (anyApi as Record<string, Record<string, unknown>>)[mod][fn];
    this.log(`mutation ${fnPath}(${JSON.stringify(args)})`);
    const start = Date.now();
    const result = await this.client.mutation(ref as never, args as never) as T;
    this.log(`mutation ${fnPath} → ${Date.now() - start}ms`);
    return result;
  }

  // -- User -----------------------------------------------------------------

  /**
   * Ensure the local user exists (idempotent).
   * Must be called before other operations in a fresh Convex deployment.
   */
  async ensureLocalUser(): Promise<string> {
    return await this.mutate<string>("users.ensureLocalUser");
  }

  // -- Projects -------------------------------------------------------------

  async listProjects(): Promise<ConvexProject[]> {
    return await this.query<ConvexProject[]>("projects.list");
  }

  async getProject(projectId: string): Promise<ConvexProject | null> {
    return await this.query<ConvexProject | null>("projects.get", { projectId });
  }

  async createProject(args: {
    name: string;
    description?: string;
    templateId?: string;
  }): Promise<string> {
    return await this.mutate<string>("projects.create", args);
  }

  // -- Branches -------------------------------------------------------------

  async listBranches(projectId: string): Promise<ConvexBranch[]> {
    return await this.query<ConvexBranch[]>("branches.list", { projectId });
  }

  async getBranch(branchId: string): Promise<ConvexBranch | null> {
    return await this.query<ConvexBranch | null>("branches.get", { branchId });
  }

  async getDefaultBranch(projectId: string): Promise<ConvexBranch | null> {
    const project = await this.getProject(projectId);
    if (!project?.defaultBranchId) return null;
    return await this.getBranch(project.defaultBranchId);
  }

  // -- Pages ----------------------------------------------------------------

  async listPagesByBranch(branchId: string): Promise<ConvexPage[]> {
    return await this.query<ConvexPage[]>("pages.listByBranch", { branchId });
  }

  async listPagesByProject(projectId: string): Promise<ConvexPage[]> {
    return await this.query<ConvexPage[]>("pages.listByProject", { projectId });
  }

  async getPage(pageId: string): Promise<ConvexPage | null> {
    return await this.query<ConvexPage | null>("pages.get", { pageId });
  }

  async getPageContent(pageId: string): Promise<ConvexPageContent | null> {
    return await this.query<ConvexPageContent | null>("pages.getContent", { pageId });
  }

  async createPage(args: {
    branchId: string;
    title: string;
    folderId?: string;
    position?: number;
  }): Promise<string> {
    return await this.mutate<string>("pages.create", args);
  }

  async updatePage(
    pageId: string,
    updates: {
      title?: string;
      isPublished?: boolean;
      position?: number;
      folderId?: string | null;
      icon?: string | null;
      description?: string | null;
    }
  ): Promise<void> {
    await this.mutate("pages.update", { pageId, ...updates });
  }

  async updatePageContent(
    pageId: string,
    content: string
  ): Promise<string> {
    return await this.mutate<string>("pages.updateContent", { pageId, content });
  }

  async removePage(pageId: string): Promise<void> {
    await this.mutate("pages.remove", { pageId });
  }

  /**
   * Fetch all pages for a branch with content converted from BlockNote JSON to MDX.
   * Used by `pages pull` in core mode.
   */
  async listPagesWithMdxContent(
    branchId: string
  ): Promise<Array<ConvexPage & { content?: string }>> {
    const pages = await this.listPagesByBranch(branchId);
    const result: Array<ConvexPage & { content?: string }> = [];

    for (const page of pages) {
      const contentDoc = await this.getPageContent(page._id);
      let mdxContent: string | undefined;

      if (contentDoc?.content) {
        try {
          const blocks = parseBlockNoteContent(contentDoc.content);
          if (blocks && blocks.length > 0) {
            mdxContent = blockNoteToMDX(blocks);
          }
        } catch {
          // If parsing fails, use raw content
          mdxContent = contentDoc.content;
        }
      }

      result.push({ ...page, content: mdxContent });
    }

    return result;
  }

  // -- Folders --------------------------------------------------------------

  async listFoldersByBranch(branchId: string): Promise<ConvexFolder[]> {
    return await this.query<ConvexFolder[]>("folders.listByBranch", { branchId });
  }

  async listFoldersByProject(projectId: string): Promise<ConvexFolder[]> {
    return await this.query<ConvexFolder[]>("folders.listByProject", { projectId });
  }

  async getFolder(folderId: string): Promise<ConvexFolder | null> {
    return await this.query<ConvexFolder | null>("folders.get", { folderId });
  }

  async createFolder(args: {
    branchId: string;
    name: string;
    parentId?: string;
    position?: number;
    icon?: string;
  }): Promise<string> {
    return await this.mutate<string>("folders.create", args);
  }

  async removeFolder(folderId: string): Promise<void> {
    await this.mutate("folders.remove", { folderId });
  }

  // -- Assets ---------------------------------------------------------------

  async listAssets(projectId: string): Promise<ConvexAsset[]> {
    return await this.query<ConvexAsset[]>("assets.listByProject", { projectId });
  }

  // -- Deployments ----------------------------------------------------------

  async listDeployments(projectId: string): Promise<ConvexDeployment[]> {
    return await this.query<ConvexDeployment[]>("deployments.listByProject", { projectId });
  }

  // -- Merge Requests -------------------------------------------------------

  async listMergeRequests(projectId: string): Promise<ConvexMergeRequest[]> {
    return await this.query<ConvexMergeRequest[]>("mergeRequests.list", { projectId });
  }

  // -- Export ---------------------------------------------------------------

  /**
   * Export all data for a project in the portable format.
   * Used by `inkloom export` to dump Convex data to JSON.
   */
  async exportProject(projectId: string): Promise<ExportData> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const branches = await this.listBranches(projectId);
    const assets = await this.listAssets(projectId);
    const deployments = await this.listDeployments(projectId);

    // Collect pages and folders across all branches
    const allPages: Array<ConvexPage & { content?: string }> = [];
    const allFolders: ConvexFolder[] = [];
    const seenPageIds = new Set<string>();
    const seenFolderIds = new Set<string>();

    for (const branch of branches) {
      const pages = await this.listPagesByBranch(branch._id);
      const folders = await this.listFoldersByBranch(branch._id);

      for (const page of pages) {
        if (seenPageIds.has(page._id)) continue;
        seenPageIds.add(page._id);

        // Fetch content for each page
        const contentDoc = await this.getPageContent(page._id);
        allPages.push({
          ...page,
          content: contentDoc?.content,
        });
      }

      for (const folder of folders) {
        if (seenFolderIds.has(folder._id)) continue;
        seenFolderIds.add(folder._id);
        allFolders.push(folder);
      }
    }

    // Merge requests
    let mergeRequests: ConvexMergeRequest[] = [];
    try {
      mergeRequests = await this.listMergeRequests(projectId);
    } catch {
      // mergeRequests may not exist in older schemas
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: [project],
      branches,
      pages: allPages,
      folders: allFolders,
      assets,
      deployments,
      mergeRequests,
    };
  }

  /**
   * Export all projects (for full `inkloom export` without --project flag).
   */
  async exportAll(): Promise<ExportData> {
    const projects = await this.listProjects();

    const allBranches: ConvexBranch[] = [];
    const allPages: Array<ConvexPage & { content?: string }> = [];
    const allFolders: ConvexFolder[] = [];
    const allAssets: ConvexAsset[] = [];
    const allDeployments: ConvexDeployment[] = [];
    const allMergeRequests: ConvexMergeRequest[] = [];

    for (const project of projects) {
      const exportData = await this.exportProject(project._id);
      allBranches.push(...exportData.branches);
      allPages.push(...exportData.pages);
      allFolders.push(...exportData.folders);
      allAssets.push(...exportData.assets);
      allDeployments.push(...exportData.deployments);
      allMergeRequests.push(...exportData.mergeRequests);
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      branches: allBranches,
      pages: allPages,
      folders: allFolders,
      assets: allAssets,
      deployments: allDeployments,
      mergeRequests: allMergeRequests,
    };
  }

  /**
   * Close the underlying HTTP client connection.
   */
  close(): void {
    // ConvexHttpClient doesn't have an explicit close,
    // but we clear the reference for GC
    (this as unknown as Record<string, unknown>).client = null;
  }
}

/**
 * Create a ConvexCliClient from environment or explicit URL.
 *
 * Resolution order:
 * 1. Explicit `convexUrl` option
 * 2. `NEXT_PUBLIC_CONVEX_URL` env var
 * 3. `CONVEX_URL` env var
 *
 * Throws if no URL is available.
 */
export function createConvexClient(opts?: {
  convexUrl?: string;
  verbose?: boolean;
}): ConvexCliClient {
  const url =
    opts?.convexUrl ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_URL;

  if (!url) {
    throw new Error(
      "No Convex URL found. Set NEXT_PUBLIC_CONVEX_URL or pass --convex-url."
    );
  }

  return new ConvexCliClient({
    convexUrl: url,
    verbose: opts?.verbose ?? false,
  });
}
