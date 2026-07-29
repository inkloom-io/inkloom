/**
 * HTTP client for the standalone InkLoom data Worker.
 *
 * The OSS CLI uses the same versioned D1 API as the web application. Local
 * development defaults to Wrangler on 127.0.0.1:8787; a deployed Worker URL
 * and optional service token can be supplied for remote environments.
 */
import {
  blockNoteToMDX,
  parseBlockNoteContent,
} from "@inkloom/mdx-parser";

interface DataRecord {
  id: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface DataProject extends DataRecord {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  description?: string;
  workosOrgId?: string;
  defaultBranchId?: string;
  isPublic?: boolean;
  settings?: Record<string, unknown>;
  primaryColor?: string;
  theme?: string;
  logoAssetId?: string;
  faviconAssetId?: string;
  customFonts?: unknown;
  socialLinks?: unknown;
  showBranding?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  ogImageAssetId?: string;
  openApiSpec?: string;
  deploymentUrl?: string;
  navTabs?: unknown[];
}

export interface DataBranch extends DataRecord {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  isDefault: boolean;
  isLocked: boolean;
  deletedAt?: number;
}

export interface DataPage extends DataRecord {
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
}

export interface DataPageContent extends DataRecord {
  _id: string;
  pageId: string;
  content: string;
}

export interface DataFolder extends DataRecord {
  _id: string;
  _creationTime: number;
  branchId: string;
  parentId?: string;
  name: string;
  slug: string;
  path?: string;
  position?: number;
  icon?: string;
}

export interface DataAsset extends DataRecord {
  _id: string;
  _creationTime: number;
  projectId: string;
  filename: string;
  mimeType?: string;
  size?: number;
  r2Key?: string;
  url?: string;
}

export interface DataDeployment extends DataRecord {
  _id: string;
  _creationTime: number;
  projectId: string;
  status: string;
  target?: string;
  url?: string;
  completedAt?: number;
}

export interface DataMergeRequest extends DataRecord {
  _id: string;
  _creationTime: number;
  projectId: string;
  sourceBranchId: string;
  targetBranchId: string;
  title: string;
  description?: string;
  status: string;
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  projects: DataProject[];
  branches: DataBranch[];
  pages: Array<DataPage & { content?: string }>;
  folders: DataFolder[];
  assets: DataAsset[];
  deployments: DataDeployment[];
  mergeRequests: DataMergeRequest[];
}

export interface CoreDataClientOptions {
  dataApiUrl: string;
  token?: string;
  verbose?: boolean;
}

function compatible<T extends DataRecord>(
  row: T,
): T & { _id: string; _creationTime: number } {
  return {
    ...row,
    _id: row.id,
    _creationTime: row.createdAt ?? 0,
  };
}

function compatibleProject(row: DataRecord & Record<string, unknown>): DataProject {
  const settings =
    row.settings && typeof row.settings === "object"
      ? (row.settings as Record<string, unknown>)
      : {};
  return compatible({
    ...settings,
    ...row,
    settings,
  } as unknown as DataProject);
}

export class CoreDataClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly verbose: boolean;

  constructor(options: CoreDataClientOptions) {
    this.baseUrl = options.dataApiUrl.replace(/\/$/, "");
    this.token = options.token;
    this.verbose = options.verbose ?? false;
  }

  private log(message: string) {
    if (this.verbose) process.stderr.write(`[data] ${message}\n`);
  }

  private async request<T>(
    path: string,
    init: Omit<RequestInit, "body"> & { body?: unknown } = {},
  ): Promise<T> {
    const startedAt = Date.now();
    this.log(`${init.method ?? "GET"} ${path}`);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init.headers,
      },
      body:
        init.body === undefined
          ? undefined
          : typeof init.body === "string"
            ? init.body
            : JSON.stringify(init.body),
    });
    this.log(
      `${init.method ?? "GET"} ${path} → ${response.status} (${Date.now() - startedAt}ms)`,
    );
    if (!response.ok) {
      let message = await response.text();
      try {
        const parsed = JSON.parse(message) as {
          error?: { message?: string };
        };
        message = parsed.error?.message ?? message;
      } catch {
        // Preserve a non-JSON response body.
      }
      throw new Error(message || `Data API request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  async ensureLocalUser(): Promise<string> {
    return (
      await this.request<{ id: string }>("/v1/users/ensure-local", {
        method: "POST",
      })
    ).id;
  }

  async listProjects(): Promise<DataProject[]> {
    return (await this.request<Array<DataRecord & Record<string, unknown>>>(
      "/v1/projects",
    )).map(compatibleProject);
  }

  async getProject(projectId: string): Promise<DataProject | null> {
    const row = await this.request<
      (DataRecord & Record<string, unknown>) | null
    >(`/v1/projects/${encodeURIComponent(projectId)}`);
    return row ? compatibleProject(row) : null;
  }

  async createProject(args: {
    name: string;
    description?: string;
    templateId?: string;
  }): Promise<string> {
    return (
      await this.request<{ id: string }>("/v1/projects", {
        method: "POST",
        body: args,
      })
    ).id;
  }

  async listBranches(projectId: string): Promise<DataBranch[]> {
    return (
      await this.request<DataBranch[]>(
        `/v1/branches/project/${encodeURIComponent(projectId)}`,
      )
    ).map(compatible);
  }

  async getBranch(branchId: string): Promise<DataBranch | null> {
    const row = await this.request<DataBranch | null>(
      `/v1/branches/${encodeURIComponent(branchId)}`,
    );
    return row ? compatible(row) : null;
  }

  async getDefaultBranch(projectId: string): Promise<DataBranch | null> {
    const project = await this.getProject(projectId);
    return project?.defaultBranchId
      ? this.getBranch(project.defaultBranchId)
      : null;
  }

  async listPagesByBranch(branchId: string): Promise<DataPage[]> {
    return (
      await this.request<DataPage[]>(
        `/v1/pages/branch/${encodeURIComponent(branchId)}`,
      )
    ).map(compatible);
  }

  async listPagesByProject(projectId: string): Promise<DataPage[]> {
    return (
      await this.request<DataPage[]>(
        `/v1/pages/project/${encodeURIComponent(projectId)}`,
      )
    ).map(compatible);
  }

  async getPage(pageId: string): Promise<DataPage | null> {
    const row = await this.request<DataPage | null>(
      `/v1/pages/${encodeURIComponent(pageId)}`,
    );
    return row ? compatible(row) : null;
  }

  async getPageContent(pageId: string): Promise<DataPageContent | null> {
    const row = await this.request<DataPageContent | null>(
      `/v1/pages/${encodeURIComponent(pageId)}/content`,
    );
    return row ? compatible(row) : null;
  }

  async createPage(args: {
    branchId: string;
    title: string;
    folderId?: string;
    position?: number;
  }): Promise<string> {
    return (
      await this.request<{ id: string }>("/v1/pages", {
        method: "POST",
        body: args,
      })
    ).id;
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
    },
  ): Promise<void> {
    await this.request(`/v1/pages/${encodeURIComponent(pageId)}`, {
      method: "PATCH",
      body: updates,
    });
  }

  async updatePageContent(pageId: string, content: string): Promise<string> {
    return (
      await this.request<{ id: string }>(
        `/v1/pages/${encodeURIComponent(pageId)}/content`,
        { method: "PUT", body: { content } },
      )
    ).id;
  }

  async removePage(pageId: string): Promise<void> {
    await this.request(`/v1/pages/${encodeURIComponent(pageId)}`, {
      method: "DELETE",
    });
  }

  async listPagesWithMdxContent(
    branchId: string,
  ): Promise<Array<DataPage & { content?: string }>> {
    const pages = await this.listPagesByBranch(branchId);
    return Promise.all(
      pages.map(async (page) => {
        const contentDocument = await this.getPageContent(page.id);
        let content = contentDocument?.content;
        if (content) {
          try {
            const blocks = parseBlockNoteContent(content);
            if (blocks?.length) content = blockNoteToMDX(blocks);
          } catch {
            // A legacy raw document can be exported without conversion.
          }
        }
        return { ...page, content };
      }),
    );
  }

  async listFoldersByBranch(branchId: string): Promise<DataFolder[]> {
    return (
      await this.request<DataFolder[]>(
        `/v1/folders/branch/${encodeURIComponent(branchId)}`,
      )
    ).map(compatible);
  }

  async listFoldersByProject(projectId: string): Promise<DataFolder[]> {
    return (
      await this.request<DataFolder[]>(
        `/v1/folders/project/${encodeURIComponent(projectId)}`,
      )
    ).map(compatible);
  }

  async getFolder(folderId: string): Promise<DataFolder | null> {
    const row = await this.request<DataFolder | null>(
      `/v1/folders/${encodeURIComponent(folderId)}`,
    );
    return row ? compatible(row) : null;
  }

  async createFolder(args: {
    branchId: string;
    name: string;
    parentId?: string;
    position?: number;
    icon?: string;
  }): Promise<string> {
    return (
      await this.request<{ id: string }>("/v1/folders", {
        method: "POST",
        body: args,
      })
    ).id;
  }

  async removeFolder(folderId: string): Promise<void> {
    await this.request(`/v1/folders/${encodeURIComponent(folderId)}`, {
      method: "DELETE",
    });
  }

  async updateProjectSettings(
    projectId: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    await this.request(
      `/v1/projects/${encodeURIComponent(projectId)}/settings`,
      { method: "PATCH", body: settings },
    );
  }

  async listAssets(projectId: string): Promise<DataAsset[]> {
    return (
      await this.request<DataAsset[]>(
        `/v1/assets/project/${encodeURIComponent(projectId)}`,
      )
    ).map(compatible);
  }

  async listDeployments(projectId: string): Promise<DataDeployment[]> {
    return (
      await this.request<DataDeployment[]>(
        `/v1/deployments/project/${encodeURIComponent(projectId)}/list`,
      )
    ).map(compatible);
  }

  async listMergeRequests(projectId: string): Promise<DataMergeRequest[]> {
    return (
      await this.request<DataMergeRequest[]>(
        `/v1/merge-requests/project/${encodeURIComponent(projectId)}`,
      )
    ).map(compatible);
  }

  async exportProject(projectId: string): Promise<ExportData> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const [branches, assets, deployments, mergeRequests] = await Promise.all([
      this.listBranches(projectId),
      this.listAssets(projectId),
      this.listDeployments(projectId),
      this.listMergeRequests(projectId).catch(() => []),
    ]);
    const pages: Array<DataPage & { content?: string }> = [];
    const folders: DataFolder[] = [];
    const seenPages = new Set<string>();
    const seenFolders = new Set<string>();
    for (const branch of branches) {
      const [branchPages, branchFolders] = await Promise.all([
        this.listPagesByBranch(branch.id),
        this.listFoldersByBranch(branch.id),
      ]);
      for (const page of branchPages) {
        if (seenPages.has(page.id)) continue;
        seenPages.add(page.id);
        pages.push({
          ...page,
          content: (await this.getPageContent(page.id))?.content,
        });
      }
      for (const folder of branchFolders) {
        if (seenFolders.has(folder.id)) continue;
        seenFolders.add(folder.id);
        folders.push(folder);
      }
    }
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: [project],
      branches,
      pages,
      folders,
      assets,
      deployments,
      mergeRequests,
    };
  }

  async exportAll(): Promise<ExportData> {
    const projects = await this.listProjects();
    const exports = await Promise.all(
      projects.map((project) => this.exportProject(project.id)),
    );
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      branches: exports.flatMap((value) => value.branches),
      pages: exports.flatMap((value) => value.pages),
      folders: exports.flatMap((value) => value.folders),
      assets: exports.flatMap((value) => value.assets),
      deployments: exports.flatMap((value) => value.deployments),
      mergeRequests: exports.flatMap((value) => value.mergeRequests),
    };
  }

  close(): void {
    // Stateless fetch client; retained for command symmetry.
  }
}

export function createCoreDataClient(options?: {
  dataApiUrl?: string;
  token?: string;
  verbose?: boolean;
}): CoreDataClient {
  return new CoreDataClient({
    dataApiUrl:
      options?.dataApiUrl ??
      process.env.INKLOOM_DATA_API_URL ??
      process.env.DATA_API_URL ??
      "http://127.0.0.1:8787",
    token:
      options?.token ??
      process.env.INKLOOM_DATA_API_TOKEN ??
      process.env.DATA_API_TOKEN,
    verbose: options?.verbose,
  });
}
