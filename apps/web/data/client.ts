import { hc } from "hono/client";

import type {
  Asset,
  Branch,
  Comment,
  CommentThread,
  Deployment,
  DeploymentConfig,
  Folder,
  JsonObject,
  MergeRequest,
  MrReview,
  MrReviewComment,
  MrReviewThread,
  Page,
  PageContent,
  PageVersion,
  Project,
  User,
} from "@/db/schema";
import type { CoreDataApi } from "@/worker";
import type { BranchDiff, PageDiff } from "@/lib/diff-engine";

export interface DataClientOptions {
  baseUrl: string;
  token?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

export class DataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "DataApiError";
  }
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  templateId?: "blank" | "product-docs" | "sdk-api-docs";
  skipFolderPaths?: string[];
  workosOrgId?: string;
}

export interface CreateAssetInput {
  projectId: string;
  r2Key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface CreatePageInput {
  projectId?: string;
  branchId: string;
  folderId?: string | null;
  title: string;
  slug?: string;
  position?: number;
  isPublished?: boolean;
  content?: string;
  description?: string | null;
  icon?: string | null;
  subtitle?: string | null;
  aiGenerated?: boolean;
  aiGenerationJobId?: string;
}

export interface UpdatePageInput {
  title?: string;
  slug?: string;
  isPublished?: boolean;
  position?: number;
  folderId?: string | null;
  icon?: string | null;
  description?: string | null;
  subtitle?: string | null;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageAssetId?: string | null;
  noindex?: boolean;
  skipBranchLock?: boolean;
}

export interface CreateFolderInput {
  branchId: string;
  parentId?: string | null;
  name: string;
  slug?: string;
  position?: number;
  icon?: string | null;
  skipBranchLock?: boolean;
}

export interface UpdateFolderInput {
  name?: string;
  position?: number;
  parentId?: string | null;
  icon?: string | null;
  skipBranchLock?: boolean;
}

export interface PageVersionSummary {
  id: string;
  version: number;
  message: string | null;
  createdAt: number;
  creator: { name: string; avatarUrl: string | null } | null;
}

export interface CommentUserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface HydratedComment extends Comment {
  user: CommentUserSummary | null;
}

export interface HydratedCommentThread extends CommentThread {
  creator: CommentUserSummary | null;
  comments: HydratedComment[];
  commentCount: number;
}

export interface SearchResult {
  id: string;
  pageId: string;
  title: string;
  path: string;
  excerpt: string;
  score: number;
}

export interface FeedbackStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
}

export interface FeedbackTimeBucket {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface DashboardStats {
  totalProjects: number;
  totalPages: number;
  recentDeployments: number;
  unpublishedCount: number;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    plan: string;
    updatedAt: number;
    settings?: { customDomain?: string };
    deploymentStatus: "ready" | "error" | "building" | "never_deployed";
    hasUnpublishedChanges: boolean;
    pageCount: number;
  }>;
}

export interface DataUserSummary {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
}

export interface HydratedMergeRequest extends MergeRequest {
  creator: DataUserSummary | null;
  sourceBranchName: string;
  targetBranchName: string;
  mergedByUser: DataUserSummary | null;
  closedByUser: DataUserSummary | null;
}

export interface HydratedMrReviewComment extends MrReviewComment {
  user: DataUserSummary | null;
}

export interface HydratedMrReviewThread extends MrReviewThread {
  creator: DataUserSummary | null;
  comments: HydratedMrReviewComment[];
  commentCount: number;
}

export interface HydratedMrReview extends MrReview {
  reviewer: DataUserSummary | null;
}

export interface DataClient {
  /**
   * Call an extension endpoint exposed by the active data service.
   *
   * Core features should prefer the typed domain methods below. Platform-only
   * features use this escape hatch so the OSS client never imports SaaS code.
   */
  request<T>(
    path: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T>;
  users: {
    current(): Promise<User | null>;
    ensureLocal(): Promise<{ id: string }>;
  };
  projects: {
    list(): Promise<Project[]>;
    listByOrg(workosOrgId: string): Promise<Project[]>;
    get(projectId: string): Promise<Project | null>;
    create(input: CreateProjectInput): Promise<{ id: string }>;
    update(
      projectId: string,
      input: { name?: string; description?: string | null; isPublic?: boolean }
    ): Promise<{ updated: boolean }>;
    updateSettings(
      projectId: string,
      settings: JsonObject
    ): Promise<{ updated: boolean }>;
    remove(projectId: string): Promise<{ deleted: boolean }>;
    checkCfSlugAvailable(
      slug: string,
      excludeProjectId?: string
    ): Promise<{ available: boolean }>;
    updateCfSlug(
      projectId: string,
      cfSlug: string | null
    ): Promise<{ updated: boolean }>;
  };
  assets: {
    listByProject(projectId: string): Promise<Asset[]>;
    get(assetId: string): Promise<Asset | null>;
    create(input: CreateAssetInput): Promise<{ assetId: string; url: string }>;
    remove(assetId: string): Promise<{ r2Key: string | null }>;
  };
  pages: {
    listByProject(projectId: string): Promise<Page[]>;
    listByBranch(branchId: string): Promise<Page[]>;
    get(pageId: string): Promise<Page | null>;
    getContent(pageId: string): Promise<PageContent | null>;
    create(input: CreatePageInput): Promise<{ id: string }>;
    update(pageId: string, input: UpdatePageInput): Promise<{ id: string }>;
    updateContent(
      pageId: string,
      input: {
        content: string;
        updatedBy?: string;
        skipBranchLock?: boolean;
      }
    ): Promise<{ id: string }>;
    remove(pageId: string): Promise<{ deleted: boolean }>;
    reorder(
      pageId: string,
      input: { newPosition: number; newFolderId?: string | null }
    ): Promise<{ id: string }>;
    createVersion(
      pageId: string,
      input: { createdBy?: string; message?: string }
    ): Promise<{ id: string }>;
    listVersions(pageId: string): Promise<PageVersionSummary[]>;
    getVersion(pageId: string, version: number): Promise<PageVersion | null>;
    restoreVersion(
      pageId: string,
      version: number,
      restoredBy?: string
    ): Promise<{ content: string }>;
  };
  folders: {
    listByProject(projectId: string): Promise<Folder[]>;
    listByBranch(branchId: string): Promise<Folder[]>;
    get(folderId: string): Promise<Folder | null>;
    create(input: CreateFolderInput): Promise<{ id: string }>;
    update(folderId: string, input: UpdateFolderInput): Promise<{ id: string }>;
    reorder(
      folderId: string,
      input: { newPosition: number; newParentId?: string | null }
    ): Promise<{ id: string }>;
    remove(folderId: string): Promise<{ deleted: boolean }>;
  };
  branches: {
    list(projectId: string): Promise<Branch[]>;
    get(branchId: string): Promise<Branch | null>;
    getByName(projectId: string, name: string): Promise<Branch | null>;
    hasChanges(
      branchId: string,
      compareToBranchId: string
    ): Promise<{ hasChanges: boolean }>;
    create(input: {
      projectId: string;
      name: string;
      sourceBranchId: string;
    }): Promise<{ id: string }>;
    rename(branchId: string, name: string): Promise<{ id: string }>;
    toggleLock(branchId: string): Promise<{ id: string; isLocked: boolean }>;
    remove(branchId: string): Promise<{ deleted: boolean }>;
  };
  comments: {
    listByPage(
      pageId: string,
      status?: "open" | "resolved"
    ): Promise<HydratedCommentThread[]>;
    getThread(threadId: string): Promise<HydratedCommentThread | null>;
    createThread(input: {
      pageId: string;
      blockId: string;
      anchorType: "block" | "inline";
      inlineStart?: number;
      inlineEnd?: number;
      quotedText?: string;
      content: string;
      userId: string;
    }): Promise<{ id: string }>;
    addComment(
      threadId: string,
      input: { content: string; userId: string }
    ): Promise<{ id: string }>;
    updateComment(
      commentId: string,
      input: { content: string; userId: string }
    ): Promise<{ id: string }>;
    deleteComment(
      commentId: string,
      input: { userId: string; isAdmin?: boolean }
    ): Promise<{ threadDeleted: boolean }>;
    resolveThread(threadId: string): Promise<{ id: string }>;
    reopenThread(threadId: string): Promise<{ id: string }>;
    deleteThread(
      threadId: string,
      input: { userId: string; isAdmin?: boolean }
    ): Promise<{ id: string }>;
  };
  search: {
    project(
      projectId: string,
      query: string,
      limit?: number
    ): Promise<SearchResult[]>;
    rebuild(projectId: string): Promise<{ indexed: number }>;
  };
  deployments: {
    list(
      projectId: string,
      target?: "preview" | "production"
    ): Promise<Deployment[]>;
    get(deploymentId: string): Promise<Deployment>;
    getByExternalId(externalDeploymentId: string): Promise<Deployment | null>;
    getInProgress(projectId: string): Promise<Deployment | null>;
    unpublishedChanges(
      projectId: string,
      branchId?: string
    ): Promise<{ preview: boolean; production: boolean }>;
    create(input: {
      projectId: string;
      branchId: string;
      externalDeploymentId?: string;
      cfProjectName?: string;
      target?: "preview" | "production";
      contentHashes?: Record<string, string>;
      buildPhase?: "generating" | "uploading" | "propagating";
    }): Promise<{ id: string }>;
    updateStatus(
      deploymentId: string,
      input: {
        status: "queued" | "building" | "ready" | "error" | "canceled";
        url?: string;
        error?: string;
        warnings?: string[];
      }
    ): Promise<{ id: string }>;
    updateBuildPhase(
      deploymentId: string,
      input: {
        buildPhase: "generating" | "uploading" | "propagating";
        externalDeploymentId?: string;
        cfProjectName?: string;
        contentHashes?: Record<string, string>;
        url?: string;
      }
    ): Promise<{ id: string }>;
    getConfig(projectId: string): Promise<DeploymentConfig | null>;
    upsertConfig(input: {
      projectId: string;
      cfProjectName?: string | null;
      liveDeploymentId?: string | null;
      accessAppId?: string | null;
      productionUrl?: string | null;
      branchId?: string | null;
    }): Promise<{ id: string }>;
    setLive(
      projectId: string,
      deploymentId: string
    ): Promise<{ updated: boolean }>;
  };
  pageFeedback: {
    submit(input: {
      projectId: string;
      pageSlug: string;
      reaction: "positive" | "neutral" | "negative";
      sessionId?: string;
    }): Promise<{ id: string }>;
    stats(
      projectId: string,
      pageSlug: string,
      since?: number
    ): Promise<FeedbackStats>;
    timeSeries(
      projectId: string,
      pageSlug: string,
      since?: number,
      bucketSize?: "daily" | "weekly"
    ): Promise<FeedbackTimeBucket[]>;
  };
  dashboard: {
    stats(workosOrgId?: string): Promise<DashboardStats>;
  };
  mergeRequests: {
    list(
      projectId: string,
      status?: "open" | "merged" | "closed"
    ): Promise<HydratedMergeRequest[]>;
    get(mergeRequestId: string): Promise<HydratedMergeRequest>;
    counts(
      projectId: string
    ): Promise<{ open: number; merged: number; closed: number }>;
    openCount(projectId: string): Promise<number>;
    getOpenForBranch(sourceBranchId: string): Promise<MergeRequest | null>;
    create(input: {
      projectId: string;
      sourceBranchId: string;
      targetBranchId: string;
      title: string;
      description?: string;
      createdBy: string;
    }): Promise<{ id: string }>;
    update(
      mergeRequestId: string,
      input: { title?: string; description?: string | null }
    ): Promise<{ id: string }>;
    close(mergeRequestId: string, closedBy: string): Promise<{ id: string }>;
    reopen(mergeRequestId: string): Promise<{ id: string }>;
    merge(
      mergeRequestId: string,
      input: {
        mergedBy: string;
        deleteSourceBranch?: boolean;
        resolutions?: string;
      }
    ): Promise<{ id: string }>;
    listComments(mergeRequestId: string): Promise<
      Array<{
        id: string;
        content: string;
        pagePath: string | null;
        blockIndex: number | null;
        createdBy: string;
        createdAt: number;
        updatedAt: number;
        creator: Omit<DataUserSummary, "id"> | null;
      }>
    >;
    addComment(
      mergeRequestId: string,
      input: {
        pagePath?: string;
        blockIndex?: number;
        content: string;
        createdBy: string;
      }
    ): Promise<{ id: string }>;
  };
  mergeRequestDiff: {
    compute(mergeRequestId: string): Promise<BranchDiff>;
    computePage(input: {
      sourceBranchId: string;
      targetBranchId: string;
      pagePath: string;
      mergeRequestId?: string;
    }): Promise<PageDiff>;
  };
  mrReviews: {
    listThreads(
      mergeRequestId: string,
      pagePath?: string
    ): Promise<HydratedMrReviewThread[]>;
    createThread(input: {
      mergeRequestId: string;
      pagePath: string;
      blockId: string;
      blockIndex: number;
      quotedContent?: string;
      threadType: "comment" | "suggestion";
      suggestedContent?: string;
      content: string;
      userId: string;
    }): Promise<{ id: string }>;
    addComment(
      threadId: string,
      content: string,
      userId: string
    ): Promise<{ id: string }>;
    resolve(threadId: string, userId: string): Promise<{ id: string }>;
    unresolve(threadId: string): Promise<{ id: string }>;
    accept(threadId: string, userId: string): Promise<{ id: string }>;
    dismiss(threadId: string, userId: string): Promise<{ id: string }>;
    submitReview(input: {
      mergeRequestId: string;
      reviewerId: string;
      status: "approved" | "changes_requested" | "commented";
      body?: string;
    }): Promise<{ id: string }>;
    listReviews(mergeRequestId: string): Promise<HydratedMrReview[]>;
    summary(mergeRequestId: string): Promise<{
      openThreads: number;
      resolvedThreads: number;
      totalThreads: number;
      pendingSuggestions: number;
      acceptedSuggestions: number;
      dismissedSuggestions: number;
      totalReviews: number;
      reviewStatus: "approved" | "changes_requested" | null;
    }>;
  };
}

type JsonResponse<T> = Response & { json(): Promise<T> };

async function unwrap<T>(response: Promise<JsonResponse<T>>): Promise<T> {
  const resolved = await response;
  const body = (await resolved.json()) as
    | T
    | { error: { code: string; message: string } };

  if (!resolved.ok) {
    const failure = body as { error?: { code?: string; message?: string } };
    throw new DataApiError(
      failure.error?.message ?? `Data request failed (${resolved.status}).`,
      resolved.status,
      failure.error?.code ?? "request_failed"
    );
  }

  return body as T;
}

export function createDataClient(options: DataClientOptions): DataClient {
  const headers = {
    ...options.headers,
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
  const normalizedBaseUrl = options.baseUrl.endsWith("/")
    ? options.baseUrl
    : `${options.baseUrl}/`;
  const rpc = hc<CoreDataApi>(options.baseUrl, {
    headers,
    fetch: options.fetch,
  });

  const request = async <T>(
    path: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> => {
    const origin =
      typeof globalThis.location?.origin === "string"
        ? globalThis.location.origin
        : undefined;
    const baseUrl = new URL(normalizedBaseUrl, origin);
    const url = new URL(path.replace(/^\/+/, ""), baseUrl);
    for (const [key, value] of Object.entries(init?.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return unwrap(
      (options.fetch ?? globalThis.fetch)(url, {
        method: init?.method ?? "GET",
        headers: {
          ...headers,
          ...(init?.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      }) as Promise<JsonResponse<T>>
    );
  };

  const client = {
    request,
    users: {
      current: async () => unwrap(rpc.v1.users.current.$get()),
      ensureLocal: async () => unwrap(rpc.v1.users["ensure-local"].$post()),
    },
    projects: {
      list: async () => unwrap(rpc.v1.projects.$get()),
      listByOrg: async (workosOrgId: string) =>
        unwrap(
          rpc.v1.projects["by-org"][":workosOrgId"].$get({
            param: { workosOrgId },
          })
        ),
      get: async (projectId: string) =>
        unwrap(rpc.v1.projects[":projectId"].$get({ param: { projectId } })),
      create: async (input: CreateProjectInput) =>
        unwrap(rpc.v1.projects.$post({ json: input })),
      update: async (
        projectId: string,
        input: {
          name?: string;
          description?: string | null;
          isPublic?: boolean;
        }
      ) =>
        unwrap(
          rpc.v1.projects[":projectId"].$patch({
            param: { projectId },
            json: input,
          })
        ),
      updateSettings: async (projectId: string, settings: JsonObject) =>
        unwrap(
          rpc.v1.projects[":projectId"].settings.$patch({
            param: { projectId },
            json: settings,
          })
        ),
      remove: async (projectId: string) =>
        unwrap(rpc.v1.projects[":projectId"].$delete({ param: { projectId } })),
      checkCfSlugAvailable: async (slug: string, excludeProjectId?: string) =>
        unwrap(
          rpc.v1.projects["cf-slug"][":slug"].available.$get({
            param: { slug },
            query: excludeProjectId ? { excludeProjectId } : {},
          })
        ),
      updateCfSlug: async (projectId: string, cfSlug: string | null) =>
        unwrap(
          rpc.v1.projects[":projectId"]["cf-slug"].$patch({
            param: { projectId },
            json: { cfSlug },
          })
        ),
    },
    assets: {
      listByProject: async (projectId: string) =>
        unwrap(
          rpc.v1.assets.project[":projectId"].$get({
            param: { projectId },
          })
        ),
      get: async (assetId: string) =>
        unwrap(rpc.v1.assets[":assetId"].$get({ param: { assetId } })),
      create: async (input: CreateAssetInput) =>
        unwrap(rpc.v1.assets.$post({ json: input })),
      remove: async (assetId: string) =>
        unwrap(rpc.v1.assets[":assetId"].$delete({ param: { assetId } })),
    },
    pages: {
      listByProject: async (projectId: string) =>
        unwrap(
          rpc.v1.pages.project[":projectId"].$get({ param: { projectId } })
        ),
      listByBranch: async (branchId: string) =>
        unwrap(rpc.v1.pages.branch[":branchId"].$get({ param: { branchId } })),
      get: async (pageId: string) =>
        unwrap(rpc.v1.pages[":pageId"].$get({ param: { pageId } })),
      getContent: async (pageId: string) =>
        unwrap(rpc.v1.pages[":pageId"].content.$get({ param: { pageId } })),
      create: async (input: CreatePageInput) =>
        unwrap(rpc.v1.pages.$post({ json: input })),
      update: async (pageId: string, input: UpdatePageInput) =>
        unwrap(
          rpc.v1.pages[":pageId"].$patch({
            param: { pageId },
            json: input,
          })
        ),
      updateContent: async (
        pageId: string,
        input: {
          content: string;
          updatedBy?: string;
          skipBranchLock?: boolean;
        }
      ) =>
        unwrap(
          rpc.v1.pages[":pageId"].content.$put({
            param: { pageId },
            json: input,
          })
        ),
      remove: async (pageId: string) =>
        unwrap(rpc.v1.pages[":pageId"].$delete({ param: { pageId } })),
      reorder: async (
        pageId: string,
        input: { newPosition: number; newFolderId?: string | null }
      ) =>
        unwrap(
          rpc.v1.pages[":pageId"].reorder.$patch({
            param: { pageId },
            json: input,
          })
        ),
      createVersion: async (
        pageId: string,
        input: { createdBy?: string; message?: string }
      ) =>
        unwrap(
          rpc.v1.pages[":pageId"].versions.$post({
            param: { pageId },
            json: input,
          })
        ),
      listVersions: async (pageId: string) =>
        unwrap(rpc.v1.pages[":pageId"].versions.$get({ param: { pageId } })),
      getVersion: async (pageId: string, version: number) =>
        unwrap(
          rpc.v1.pages[":pageId"].versions[":version"].$get({
            param: { pageId, version: String(version) },
          })
        ),
      restoreVersion: async (
        pageId: string,
        version: number,
        restoredBy?: string
      ) =>
        unwrap(
          rpc.v1.pages[":pageId"].versions[":version"].restore.$post({
            param: { pageId, version: String(version) },
            json: restoredBy ? { restoredBy } : {},
          })
        ),
    },
    folders: {
      listByProject: async (projectId: string) =>
        unwrap(
          rpc.v1.folders.project[":projectId"].$get({
            param: { projectId },
          })
        ),
      listByBranch: async (branchId: string) =>
        unwrap(
          rpc.v1.folders.branch[":branchId"].$get({
            param: { branchId },
          })
        ),
      get: async (folderId: string) =>
        unwrap(
          rpc.v1.folders[":folderId"].$get({
            param: { folderId },
          })
        ),
      create: async (input: CreateFolderInput) =>
        unwrap(rpc.v1.folders.$post({ json: input })),
      update: async (folderId: string, input: UpdateFolderInput) =>
        unwrap(
          rpc.v1.folders[":folderId"].$patch({
            param: { folderId },
            json: input,
          })
        ),
      reorder: async (
        folderId: string,
        input: { newPosition: number; newParentId?: string | null }
      ) =>
        unwrap(
          rpc.v1.folders[":folderId"].reorder.$patch({
            param: { folderId },
            json: input,
          })
        ),
      remove: async (folderId: string) =>
        unwrap(
          rpc.v1.folders[":folderId"].$delete({
            param: { folderId },
          })
        ),
    },
    branches: {
      list: async (projectId: string) =>
        unwrap(
          rpc.v1.branches.project[":projectId"].$get({
            param: { projectId },
          })
        ),
      get: async (branchId: string) =>
        unwrap(
          rpc.v1.branches[":branchId"].$get({
            param: { branchId },
          })
        ),
      getByName: async (projectId: string, name: string) =>
        unwrap(
          rpc.v1.branches.project[":projectId"].name[":name"].$get({
            param: { projectId, name },
          })
        ),
      hasChanges: async (branchId: string, compareToBranchId: string) =>
        unwrap(
          rpc.v1.branches[":branchId"].changes.$get({
            param: { branchId },
            query: { compareToBranchId },
          })
        ),
      create: async (input: {
        projectId: string;
        name: string;
        sourceBranchId: string;
      }) => unwrap(rpc.v1.branches.$post({ json: input })),
      rename: async (branchId: string, name: string) =>
        unwrap(
          rpc.v1.branches[":branchId"].$patch({
            param: { branchId },
            json: { name },
          })
        ),
      toggleLock: async (branchId: string) =>
        unwrap(
          rpc.v1.branches[":branchId"]["toggle-lock"].$post({
            param: { branchId },
          })
        ),
      remove: async (branchId: string) =>
        unwrap(
          rpc.v1.branches[":branchId"].$delete({
            param: { branchId },
          })
        ),
    },
    comments: {
      listByPage: async (pageId: string, status?: "open" | "resolved") =>
        unwrap(
          rpc.v1.comments.page[":pageId"].$get({
            param: { pageId },
            query: status ? { status } : {},
          })
        ),
      getThread: async (threadId: string) =>
        unwrap(
          rpc.v1.comments.threads[":threadId"].$get({
            param: { threadId },
          })
        ),
      createThread: async (input: {
        pageId: string;
        blockId: string;
        anchorType: "block" | "inline";
        inlineStart?: number;
        inlineEnd?: number;
        quotedText?: string;
        content: string;
        userId: string;
      }) => unwrap(rpc.v1.comments.threads.$post({ json: input })),
      addComment: async (
        threadId: string,
        input: { content: string; userId: string }
      ) =>
        unwrap(
          rpc.v1.comments.threads[":threadId"].comments.$post({
            param: { threadId },
            json: input,
          })
        ),
      updateComment: async (
        commentId: string,
        input: { content: string; userId: string }
      ) =>
        unwrap(
          rpc.v1.comments.comments[":commentId"].$patch({
            param: { commentId },
            json: input,
          })
        ),
      deleteComment: async (
        commentId: string,
        input: { userId: string; isAdmin?: boolean }
      ) =>
        unwrap(
          rpc.v1.comments.comments[":commentId"].$delete({
            param: { commentId },
            json: input,
          })
        ),
      resolveThread: async (threadId: string) =>
        unwrap(
          rpc.v1.comments[":threadId"].resolve.$post({
            param: { threadId },
          })
        ),
      reopenThread: async (threadId: string) =>
        unwrap(
          rpc.v1.comments[":threadId"].reopen.$post({
            param: { threadId },
          })
        ),
      deleteThread: async (
        threadId: string,
        input: { userId: string; isAdmin?: boolean }
      ) =>
        unwrap(
          rpc.v1.comments.threads[":threadId"].$delete({
            param: { threadId },
            json: input,
          })
        ),
    },
    search: {
      project: async (projectId: string, query: string, limit = 10) =>
        unwrap(
          rpc.v1.search.$get({
            query: { projectId, query, limit },
          })
        ),
      rebuild: async (projectId: string) =>
        unwrap(
          rpc.v1.search.rebuild.$post({
            json: { projectId },
          })
        ),
    },
    deployments: {
      list: async (projectId: string, target?: "preview" | "production") =>
        unwrap(
          rpc.v1.deployments.project[":projectId"].list.$get({
            param: { projectId },
            query: target ? { target } : {},
          })
        ),
      get: async (deploymentId: string) =>
        unwrap(
          rpc.v1.deployments[":deploymentId"].$get({
            param: { deploymentId },
          })
        ),
      getByExternalId: async (externalDeploymentId: string) =>
        unwrap(
          rpc.v1.deployments.external[":externalDeploymentId"].$get({
            param: { externalDeploymentId },
          })
        ),
      getInProgress: async (projectId: string) =>
        unwrap(
          rpc.v1.deployments.project[":projectId"]["in-progress"].$get({
            param: { projectId },
          })
        ),
      unpublishedChanges: async (projectId: string, branchId?: string) =>
        unwrap(
          rpc.v1.deployments.project[":projectId"].unpublished.$get({
            param: { projectId },
            query: branchId ? { branchId } : {},
          })
        ),
      create: async (input: {
        projectId: string;
        branchId: string;
        externalDeploymentId?: string;
        cfProjectName?: string;
        target?: "preview" | "production";
        contentHashes?: Record<string, string>;
        buildPhase?: "generating" | "uploading" | "propagating";
      }) => unwrap(rpc.v1.deployments.$post({ json: input })),
      updateStatus: async (
        deploymentId: string,
        input: {
          status: "queued" | "building" | "ready" | "error" | "canceled";
          url?: string;
          error?: string;
          warnings?: string[];
        }
      ) =>
        unwrap(
          rpc.v1.deployments[":deploymentId"].status.$patch({
            param: { deploymentId },
            json: input,
          })
        ),
      updateBuildPhase: async (
        deploymentId: string,
        input: {
          buildPhase: "generating" | "uploading" | "propagating";
          externalDeploymentId?: string;
          cfProjectName?: string;
          contentHashes?: Record<string, string>;
          url?: string;
        }
      ) =>
        unwrap(
          rpc.v1.deployments[":deploymentId"].phase.$patch({
            param: { deploymentId },
            json: input,
          })
        ),
      getConfig: async (projectId: string) =>
        unwrap(
          rpc.v1.deployments.config[":projectId"].$get({
            param: { projectId },
          })
        ),
      upsertConfig: async (input: {
        projectId: string;
        cfProjectName?: string | null;
        liveDeploymentId?: string | null;
        accessAppId?: string | null;
        productionUrl?: string | null;
        branchId?: string | null;
      }) => unwrap(rpc.v1.deployments.config.$put({ json: input })),
      setLive: async (projectId: string, deploymentId: string) =>
        unwrap(
          rpc.v1.deployments.config[":projectId"].live.$post({
            param: { projectId },
            json: { deploymentId },
          })
        ),
    },
    pageFeedback: {
      submit: async (input: {
        projectId: string;
        pageSlug: string;
        reaction: "positive" | "neutral" | "negative";
        sessionId?: string;
      }) => unwrap(rpc.v1["page-feedback"].submit.$post({ json: input })),
      stats: async (projectId: string, pageSlug: string, since?: number) =>
        unwrap(
          rpc.v1["page-feedback"].stats.$get({
            query: {
              projectId,
              pageSlug,
              ...(since !== undefined ? { since } : {}),
            },
          })
        ),
      timeSeries: async (
        projectId: string,
        pageSlug: string,
        since?: number,
        bucketSize: "daily" | "weekly" = "daily"
      ) =>
        unwrap(
          rpc.v1["page-feedback"]["time-series"].$get({
            query: {
              projectId,
              pageSlug,
              bucketSize,
              ...(since !== undefined ? { since } : {}),
            },
          })
        ),
    },
    dashboard: {
      stats: async (workosOrgId = "local") =>
        unwrap(
          rpc.v1.dashboard.stats.$get({
            query: { workosOrgId },
          })
        ),
    },
    mergeRequests: {
      list: async (projectId: string, status?: "open" | "merged" | "closed") =>
        unwrap(
          rpc.v1["merge-requests"].project[":projectId"].$get({
            param: { projectId },
            query: status ? { status } : {},
          })
        ),
      get: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].$get({
            param: { mergeRequestId },
          })
        ),
      counts: async (projectId: string) =>
        unwrap(
          rpc.v1["merge-requests"].project[":projectId"].counts.$get({
            param: { projectId },
          })
        ),
      openCount: async (projectId: string) =>
        unwrap(
          rpc.v1["merge-requests"].project[":projectId"]["open-count"].$get({
            param: { projectId },
          })
        ),
      getOpenForBranch: async (sourceBranchId: string) =>
        unwrap(
          rpc.v1["merge-requests"].source[":sourceBranchId"].open.$get({
            param: { sourceBranchId },
          })
        ),
      create: async (input: {
        projectId: string;
        sourceBranchId: string;
        targetBranchId: string;
        title: string;
        description?: string;
        createdBy: string;
      }) => unwrap(rpc.v1["merge-requests"].$post({ json: input })),
      update: async (
        mergeRequestId: string,
        input: { title?: string; description?: string | null }
      ) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].$patch({
            param: { mergeRequestId },
            json: input,
          })
        ),
      close: async (mergeRequestId: string, closedBy: string) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].close.$post({
            param: { mergeRequestId },
            json: { closedBy },
          })
        ),
      reopen: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].reopen.$post({
            param: { mergeRequestId },
          })
        ),
      merge: async (
        mergeRequestId: string,
        input: {
          mergedBy: string;
          deleteSourceBranch?: boolean;
          resolutions?: string;
        }
      ) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].merge.$post({
            param: { mergeRequestId },
            json: input,
          })
        ),
      listComments: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].comments.$get({
            param: { mergeRequestId },
          })
        ),
      addComment: async (
        mergeRequestId: string,
        input: {
          pagePath?: string;
          blockIndex?: number;
          content: string;
          createdBy: string;
        }
      ) =>
        unwrap(
          rpc.v1["merge-requests"][":mergeRequestId"].comments.$post({
            param: { mergeRequestId },
            json: input,
          })
        ),
    },
    mergeRequestDiff: {
      compute: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["merge-request-diff"][":mergeRequestId"].$get({
            param: { mergeRequestId },
          })
        ).then((result) => result as BranchDiff),
      computePage: async (input: {
        sourceBranchId: string;
        targetBranchId: string;
        pagePath: string;
        mergeRequestId?: string;
      }) =>
        unwrap(
          rpc.v1["merge-request-diff"].page.compute.$get({
            query: input,
          })
        ).then((result) => result as PageDiff),
    },
    mrReviews: {
      listThreads: async (mergeRequestId: string, pagePath?: string) =>
        unwrap(
          rpc.v1["mr-reviews"][":mergeRequestId"].threads.$get({
            param: { mergeRequestId },
            query: pagePath ? { pagePath } : {},
          })
        ),
      createThread: async (input: {
        mergeRequestId: string;
        pagePath: string;
        blockId: string;
        blockIndex: number;
        quotedContent?: string;
        threadType: "comment" | "suggestion";
        suggestedContent?: string;
        content: string;
        userId: string;
      }) => unwrap(rpc.v1["mr-reviews"].threads.$post({ json: input })),
      addComment: async (threadId: string, content: string, userId: string) =>
        unwrap(
          rpc.v1["mr-reviews"].threads[":threadId"].comments.$post({
            param: { threadId },
            json: { content, userId },
          })
        ),
      resolve: async (threadId: string, userId: string) =>
        unwrap(
          rpc.v1["mr-reviews"].threads[":threadId"].resolve.$post({
            param: { threadId },
            json: { userId },
          })
        ),
      unresolve: async (threadId: string) =>
        unwrap(
          rpc.v1["mr-reviews"].threads[":threadId"].unresolve.$post({
            param: { threadId },
          })
        ),
      accept: async (threadId: string, userId: string) =>
        unwrap(
          rpc.v1["mr-reviews"].threads[":threadId"].accept.$post({
            param: { threadId },
            json: { userId },
          })
        ),
      dismiss: async (threadId: string, userId: string) =>
        unwrap(
          rpc.v1["mr-reviews"].threads[":threadId"].dismiss.$post({
            param: { threadId },
            json: { userId },
          })
        ),
      submitReview: async (input: {
        mergeRequestId: string;
        reviewerId: string;
        status: "approved" | "changes_requested" | "commented";
        body?: string;
      }) => unwrap(rpc.v1["mr-reviews"].reviews.$post({ json: input })),
      listReviews: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["mr-reviews"][":mergeRequestId"].reviews.$get({
            param: { mergeRequestId },
          })
        ),
      summary: async (mergeRequestId: string) =>
        unwrap(
          rpc.v1["mr-reviews"][":mergeRequestId"].summary.$get({
            param: { mergeRequestId },
          })
        ),
    },
  };

  // Hono's full route type is intentionally collapsed at this boundary. The
  // concrete client above is still checked against the Worker during edits,
  // while consumers see the smaller schema-derived DataClient contract.
  return client as DataClient;
}

export type CurrentUserResult = Awaited<
  ReturnType<DataClient["users"]["current"]>
>;
