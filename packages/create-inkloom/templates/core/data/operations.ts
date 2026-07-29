import type { DataClient } from "./client";
import type { CreateAssetInput } from "./client";
import type { CreatePageInput, UpdatePageInput } from "./client";
import type { CreateFolderInput, UpdateFolderInput } from "./client";
import type { JsonObject } from "@/db/schema";

export type OperationKind = "query" | "mutation" | "action";

export interface DataOperation<TKind extends OperationKind, TInput, TOutput> {
  readonly kind: TKind;
  readonly key: string;
  readonly execute: (client: DataClient, input: TInput) => Promise<TOutput>;
}

export type OperationInput<TOperation> =
  TOperation extends DataOperation<OperationKind, infer TInput, unknown>
    ? TInput
    : never;

export type OperationOutput<TOperation> =
  TOperation extends DataOperation<OperationKind, unknown, infer TOutput>
    ? TOutput
    : never;

function defineOperation<
  const TKind extends OperationKind,
  const TKey extends string,
  TInput,
  TOutput,
>(
  kind: TKind,
  key: TKey,
  execute: (client: DataClient, input: TInput) => Promise<TOutput>
): DataOperation<TKind, TInput, TOutput> & { readonly key: TKey } {
  return { kind, key, execute };
}

export const defineQuery = <const TKey extends string, TInput, TOutput>(
  key: TKey,
  execute: (client: DataClient, input: TInput) => Promise<TOutput>
) => defineOperation("query", key, execute);

export const defineMutation = <const TKey extends string, TInput, TOutput>(
  key: TKey,
  execute: (client: DataClient, input: TInput) => Promise<TOutput>
) => defineOperation("mutation", key, execute);

export const defineAction = <const TKey extends string, TInput, TOutput>(
  key: TKey,
  execute: (client: DataClient, input: TInput) => Promise<TOutput>
) => defineOperation("action", key, execute);

export const api = {
  users: {
    current: defineQuery("users.current", (_client, _input: undefined) =>
      _client.users.current()
    ),
    ensureLocalUser: defineMutation(
      "users.ensureLocalUser",
      (_client, _input: undefined) => _client.users.ensureLocal()
    ),
  },
  projects: {
    list: defineQuery("projects.list", async (_client, _input: undefined) =>
      (await _client.projects.list()).map((project) => ({
        ...(project.settings ?? {}),
        ...project,
      }))
    ),
    listByOrg: defineQuery(
      "projects.listByOrg",
      (_client, input: { workosOrgId: string }) =>
        _client.projects.listByOrg(input.workosOrgId)
    ),
    get: defineQuery(
      "projects.get",
      async (
        _client,
        input: { projectId?: string; id?: string },
      ) => {
        const project = await _client.projects.get(
          input.projectId ?? input.id ?? "",
        );
        return project
          ? { ...(project.settings ?? {}), ...project }
          : null;
      },
    ),
    create: defineMutation(
      "projects.create",
      (
        _client,
        input: {
          name: string;
          description?: string;
          templateId?: "blank" | "product-docs" | "sdk-api-docs";
          skipFolderPaths?: string[];
          workosOrgId?: string;
        }
      ) => _client.projects.create(input)
    ),
    update: defineMutation(
      "projects.update",
      (
        client,
        input: {
          projectId: string;
          name?: string;
          description?: string | null;
          isPublic?: boolean;
        }
      ) => {
        const { projectId, ...updates } = input;
        return client.projects.update(projectId, updates);
      }
    ),
    updateSettings: defineMutation(
      "projects.updateSettings",
      (
        client,
        input: { projectId: string; settings: Record<string, unknown> }
      ) =>
        client.projects.updateSettings(
          input.projectId,
          input.settings as JsonObject
        )
    ),
    remove: defineMutation(
      "projects.remove",
      (client, input: { projectId?: string; id?: string }) =>
        client.projects.remove(input.projectId ?? input.id ?? "")
    ),
    checkCfSlugAvailable: defineQuery(
      "projects.checkCfSlugAvailable",
      (client, input: { slug: string; excludeProjectId?: string }) =>
        client.projects.checkCfSlugAvailable(input.slug, input.excludeProjectId)
    ),
    updateCfSlug: defineMutation(
      "projects.updateCfSlug",
      (client, input: { projectId: string; cfSlug: string | null }) =>
        client.projects.updateCfSlug(input.projectId, input.cfSlug)
    ),
  },
  assets: {
    listByProject: defineQuery(
      "assets.listByProject",
      (client, input: { projectId: string }) =>
        client.assets.listByProject(input.projectId)
    ),
    getAsset: defineQuery(
      "assets.getAsset",
      (client, input: { assetId: string }) => client.assets.get(input.assetId)
    ),
    getAssetUrl: defineQuery(
      "assets.getAssetUrl",
      async (client, input: { assetId: string }) =>
        (await client.assets.get(input.assetId))?.url ?? null
    ),
    createAsset: defineMutation(
      "assets.createAsset",
      (client, input: CreateAssetInput) => client.assets.create(input)
    ),
    deleteAsset: defineMutation(
      "assets.deleteAsset",
      (client, input: { assetId: string }) =>
        client.assets.remove(input.assetId)
    ),
  },
  pages: {
    countByBranch: defineQuery(
      "pages.countByBranch",
      async (client, input: { branchId: string }) =>
        (await client.pages.listByBranch(input.branchId)).length,
    ),
    listByProject: defineQuery(
      "pages.listByProject",
      (client, input: { projectId: string }) =>
        client.pages.listByProject(input.projectId)
    ),
    listByBranch: defineQuery(
      "pages.listByBranch",
      (client, input: { branchId: string }) =>
        client.pages.listByBranch(input.branchId)
    ),
    get: defineQuery("pages.get", (client, input: { pageId: string }) =>
      client.pages.get(input.pageId)
    ),
    getContent: defineQuery(
      "pages.getContent",
      (client, input: { pageId: string }) =>
        client.pages.getContent(input.pageId)
    ),
    create: defineMutation(
      "pages.create",
      async (client, input: CreatePageInput) =>
        (await client.pages.create(input)).id
    ),
    createPage: defineMutation(
      "pages.createPage",
      async (client, input: CreatePageInput) =>
        (await client.pages.create(input)).id
    ),
    update: defineMutation(
      "pages.update",
      (client, input: UpdatePageInput & { pageId: string }) => {
        const { pageId, ...updates } = input;
        return client.pages.update(pageId, updates);
      }
    ),
    updateMeta: defineMutation(
      "pages.updateMeta",
      (client, input: UpdatePageInput & { pageId: string }) => {
        const { pageId, ...updates } = input;
        return client.pages.update(pageId, updates);
      },
    ),
    move: defineMutation(
      "pages.move",
      (
        client,
        input: {
          pageId: string;
          position: number;
          folderId?: string | null;
        },
      ) =>
        client.pages.reorder(input.pageId, {
          newPosition: input.position,
          newFolderId: input.folderId,
        }),
    ),
    updateContent: defineMutation(
      "pages.updateContent",
      (
        client,
        input: {
          pageId: string;
          content: string;
          updatedBy?: string;
          skipBranchLock?: boolean;
        }
      ) => {
        const { pageId, ...updates } = input;
        return client.pages.updateContent(pageId, updates);
      }
    ),
    remove: defineMutation(
      "pages.remove",
      (client, input: { pageId: string }) => client.pages.remove(input.pageId)
    ),
    deletePage: defineMutation(
      "pages.deletePage",
      (client, input: { pageId: string }) => client.pages.remove(input.pageId)
    ),
    reorder: defineMutation(
      "pages.reorder",
      (
        client,
        input: {
          pageId: string;
          newPosition: number;
          newFolderId?: string | null;
        }
      ) => {
        const { pageId, ...updates } = input;
        return client.pages.reorder(pageId, updates);
      }
    ),
    createVersion: defineMutation(
      "pages.createVersion",
      (
        client,
        input: { pageId: string; createdBy?: string; message?: string }
      ) => {
        const { pageId, ...version } = input;
        return client.pages.createVersion(pageId, version);
      }
    ),
    listVersions: defineQuery(
      "pages.listVersions",
      (client, input: { pageId: string }) =>
        client.pages.listVersions(input.pageId)
    ),
    getVersion: defineQuery(
      "pages.getVersion",
      (client, input: { pageId: string; version: number }) =>
        client.pages.getVersion(input.pageId, input.version)
    ),
    restoreVersion: defineMutation(
      "pages.restoreVersion",
      async (
        client,
        input: { pageId: string; version: number; restoredBy?: string }
      ) =>
        (
          await client.pages.restoreVersion(
            input.pageId,
            input.version,
            input.restoredBy
          )
        ).content
    ),
  },
  folders: {
    listByProject: defineQuery(
      "folders.listByProject",
      (client, input: { projectId: string }) =>
        client.folders.listByProject(input.projectId)
    ),
    listByBranch: defineQuery(
      "folders.listByBranch",
      (client, input: { branchId: string }) =>
        client.folders.listByBranch(input.branchId)
    ),
    get: defineQuery("folders.get", (client, input: { folderId: string }) =>
      client.folders.get(input.folderId)
    ),
    create: defineMutation(
      "folders.create",
      async (client, input: CreateFolderInput) =>
        (await client.folders.create(input)).id
    ),
    update: defineMutation(
      "folders.update",
      async (client, input: UpdateFolderInput & { folderId: string }) => {
        const { folderId, ...updates } = input;
        return (await client.folders.update(folderId, updates)).id;
      }
    ),
    rename: defineMutation(
      "folders.rename",
      async (client, input: { folderId: string; name: string }) =>
        (await client.folders.update(input.folderId, { name: input.name })).id,
    ),
    move: defineMutation(
      "folders.move",
      async (
        client,
        input: {
          folderId: string;
          position: number;
          parentId?: string | null;
        },
      ) =>
        (
          await client.folders.update(input.folderId, {
            position: input.position,
            parentId: input.parentId,
          })
        ).id,
    ),
    reorder: defineMutation(
      "folders.reorder",
      async (
        client,
        input: {
          folderId: string;
          newPosition: number;
          newParentId?: string | null;
        }
      ) => {
        const { folderId, ...updates } = input;
        return (await client.folders.reorder(folderId, updates)).id;
      }
    ),
    remove: defineMutation(
      "folders.remove",
      (client, input: { folderId: string }) =>
        client.folders.remove(input.folderId)
    ),
    deleteRecursive: defineMutation(
      "folders.deleteRecursive",
      (client, input: { folderId: string }) =>
        client.folders.remove(input.folderId)
    ),
  },
  branches: {
    list: defineQuery("branches.list", (client, input: { projectId: string }) =>
      client.branches.list(input.projectId)
    ),
    get: defineQuery("branches.get", (client, input: { branchId: string }) =>
      client.branches.get(input.branchId)
    ),
    getByName: defineQuery(
      "branches.getByName",
      (client, input: { projectId: string; name: string }) =>
        client.branches.getByName(input.projectId, input.name)
    ),
    hasChanges: defineQuery(
      "branches.hasChanges",
      async (client, input: { branchId: string; compareToBranchId: string }) =>
        (
          await client.branches.hasChanges(
            input.branchId,
            input.compareToBranchId
          )
        ).hasChanges
    ),
    create: defineMutation(
      "branches.create",
      async (
        client,
        input: { projectId: string; name: string; sourceBranchId: string }
      ) => (await client.branches.create(input)).id
    ),
    rename: defineMutation(
      "branches.rename",
      async (client, input: { branchId: string; name: string }) =>
        (await client.branches.rename(input.branchId, input.name)).id
    ),
    toggleLock: defineMutation(
      "branches.toggleLock",
      async (client, input: { branchId: string; userId?: string }) =>
        (await client.branches.toggleLock(input.branchId)).id
    ),
    remove: defineMutation(
      "branches.remove",
      (client, input: { branchId: string }) =>
        client.branches.remove(input.branchId)
    ),
  },
  comments: {
    listByPage: defineQuery(
      "comments.listByPage",
      (client, input: { pageId: string; status?: "open" | "resolved" }) =>
        client.comments.listByPage(input.pageId, input.status)
    ),
    getThread: defineQuery(
      "comments.getThread",
      (client, input: { threadId: string }) =>
        client.comments.getThread(input.threadId)
    ),
    createThread: defineMutation(
      "comments.createThread",
      async (
        client,
        input: {
          pageId: string;
          blockId: string;
          anchorType: "block" | "inline";
          inlineStart?: number;
          inlineEnd?: number;
          quotedText?: string;
          content: string;
          userId: string;
        }
      ) => (await client.comments.createThread(input)).id
    ),
    addComment: defineMutation(
      "comments.addComment",
      async (
        client,
        input: { threadId: string; content: string; userId: string }
      ) =>
        (
          await client.comments.addComment(input.threadId, {
            content: input.content,
            userId: input.userId,
          })
        ).id
    ),
    updateComment: defineMutation(
      "comments.updateComment",
      async (
        client,
        input: { commentId: string; content: string; userId: string }
      ) =>
        (
          await client.comments.updateComment(input.commentId, {
            content: input.content,
            userId: input.userId,
          })
        ).id
    ),
    deleteComment: defineMutation(
      "comments.deleteComment",
      (
        client,
        input: { commentId: string; userId: string; isAdmin?: boolean }
      ) =>
        client.comments.deleteComment(input.commentId, {
          userId: input.userId,
          isAdmin: input.isAdmin,
        })
    ),
    resolveThread: defineMutation(
      "comments.resolveThread",
      async (client, input: { threadId: string }) =>
        (await client.comments.resolveThread(input.threadId)).id
    ),
    reopenThread: defineMutation(
      "comments.reopenThread",
      async (client, input: { threadId: string }) =>
        (await client.comments.reopenThread(input.threadId)).id
    ),
    deleteThread: defineMutation(
      "comments.deleteThread",
      async (
        client,
        input: { threadId: string; userId: string; isAdmin?: boolean }
      ) =>
        (
          await client.comments.deleteThread(input.threadId, {
            userId: input.userId,
            isAdmin: input.isAdmin,
          })
        ).id
    ),
  },
  search: {
    searchProject: defineQuery(
      "search.searchProject",
      (client, input: { projectId: string; query: string; limit?: number }) =>
        client.search.project(input.projectId, input.query, input.limit)
    ),
    rebuildProjectIndex: defineMutation(
      "search.rebuildProjectIndex",
      (client, input: { projectId: string }) =>
        client.search.rebuild(input.projectId)
    ),
  },
  deployments: {
    listByProject: defineQuery(
      "deployments.listByProject",
      (client, input: { projectId: string }) =>
        client.deployments.list(input.projectId)
    ),
    listProductionByProject: defineQuery(
      "deployments.listProductionByProject",
      (client, input: { projectId: string }) =>
        client.deployments.list(input.projectId, "production")
    ),
    get: defineQuery(
      "deployments.get",
      (client, input: { deploymentId: string }) =>
        client.deployments.get(input.deploymentId)
    ),
    getInProgressDeployment: defineQuery(
      "deployments.getInProgressDeployment",
      (client, input: { projectId: string }) =>
        client.deployments.getInProgress(input.projectId)
    ),
    hasUnpublishedChanges: defineQuery(
      "deployments.hasUnpublishedChanges",
      (client, input: { projectId: string; branchId?: string }) =>
        client.deployments.unpublishedChanges(input.projectId, input.branchId)
    ),
    getConfig: defineQuery(
      "deployments.getConfig",
      (client, input: { projectId: string }) =>
        client.deployments.getConfig(input.projectId)
    ),
    create: defineMutation(
      "deployments.create",
      async (
        client,
        input: Parameters<DataClient["deployments"]["create"]>[0]
      ) => (await client.deployments.create(input)).id
    ),
    updateStatus: defineMutation(
      "deployments.updateStatus",
      (
        client,
        input: Parameters<DataClient["deployments"]["updateStatus"]>[1] & {
          deploymentId: string;
        }
      ) => {
        const { deploymentId, ...updates } = input;
        return client.deployments.updateStatus(deploymentId, updates);
      }
    ),
    updateBuildPhase: defineMutation(
      "deployments.updateBuildPhase",
      (
        client,
        input: Parameters<DataClient["deployments"]["updateBuildPhase"]>[1] & {
          deploymentId: string;
        }
      ) => {
        const { deploymentId, ...updates } = input;
        return client.deployments.updateBuildPhase(deploymentId, updates);
      }
    ),
    upsertConfig: defineMutation(
      "deployments.upsertConfig",
      (
        client,
        input: Parameters<DataClient["deployments"]["upsertConfig"]>[0]
      ) => client.deployments.upsertConfig(input)
    ),
    setLiveDeployment: defineMutation(
      "deployments.setLiveDeployment",
      (client, input: { projectId: string; deploymentId: string }) =>
        client.deployments.setLive(input.projectId, input.deploymentId)
    ),
  },
  pageFeedback: {
    submit: defineMutation(
      "pageFeedback.submit",
      (client, input: Parameters<DataClient["pageFeedback"]["submit"]>[0]) =>
        client.pageFeedback.submit(input)
    ),
    getStats: defineQuery(
      "pageFeedback.getStats",
      (
        client,
        input: { projectId: string; pageSlug: string; since?: number }
      ) =>
        client.pageFeedback.stats(input.projectId, input.pageSlug, input.since)
    ),
    getTimeSeries: defineQuery(
      "pageFeedback.getTimeSeries",
      (
        client,
        input: {
          projectId: string;
          pageSlug: string;
          since?: number;
          bucketSize?: "daily" | "weekly";
        }
      ) =>
        client.pageFeedback.timeSeries(
          input.projectId,
          input.pageSlug,
          input.since,
          input.bucketSize
        )
    ),
  },
  dashboard: {
    stats: defineQuery(
      "dashboard.stats",
      (client, input: { workosOrgId?: string }) =>
        client.dashboard.stats(input.workosOrgId)
    ),
  },
  mergeRequests: {
    list: defineQuery(
      "mergeRequests.list",
      (
        client,
        input: {
          projectId: string;
          status?: "open" | "merged" | "closed";
        }
      ) => client.mergeRequests.list(input.projectId, input.status)
    ),
    get: defineQuery(
      "mergeRequests.get",
      (client, input: { mergeRequestId: string }) =>
        client.mergeRequests.get(input.mergeRequestId)
    ),
    countByStatus: defineQuery(
      "mergeRequests.countByStatus",
      (client, input: { projectId: string }) =>
        client.mergeRequests.counts(input.projectId)
    ),
    getOpenCountForProject: defineQuery(
      "mergeRequests.getOpenCountForProject",
      (client, input: { projectId: string }) =>
        client.mergeRequests.openCount(input.projectId)
    ),
    getOpenForBranch: defineQuery(
      "mergeRequests.getOpenForBranch",
      (client, input: { sourceBranchId: string }) =>
        client.mergeRequests.getOpenForBranch(input.sourceBranchId)
    ),
    create: defineMutation(
      "mergeRequests.create",
      async (
        client,
        input: Parameters<DataClient["mergeRequests"]["create"]>[0]
      ) => (await client.mergeRequests.create(input)).id
    ),
    update: defineMutation(
      "mergeRequests.update",
      (
        client,
        input: {
          mergeRequestId: string;
          title?: string;
          description?: string | null;
        }
      ) => {
        const { mergeRequestId, ...updates } = input;
        return client.mergeRequests.update(mergeRequestId, updates);
      }
    ),
    close: defineMutation(
      "mergeRequests.close",
      (client, input: { mergeRequestId: string; closedBy: string }) =>
        client.mergeRequests.close(input.mergeRequestId, input.closedBy)
    ),
    reopen: defineMutation(
      "mergeRequests.reopen",
      (client, input: { mergeRequestId: string }) =>
        client.mergeRequests.reopen(input.mergeRequestId)
    ),
    merge: defineMutation(
      "mergeRequests.merge",
      (
        client,
        input: {
          mergeRequestId: string;
          mergedBy: string;
          deleteSourceBranch?: boolean;
          resolutions?: string;
        }
      ) => {
        const { mergeRequestId, ...merge } = input;
        return client.mergeRequests.merge(mergeRequestId, merge);
      }
    ),
    listComments: defineQuery(
      "mergeRequests.listComments",
      (client, input: { mergeRequestId: string }) =>
        client.mergeRequests.listComments(input.mergeRequestId)
    ),
    addComment: defineMutation(
      "mergeRequests.addComment",
      (
        client,
        input: {
          mergeRequestId: string;
          pagePath?: string;
          blockIndex?: number;
          content: string;
          createdBy: string;
        }
      ) => {
        const { mergeRequestId, ...comment } = input;
        return client.mergeRequests.addComment(mergeRequestId, comment);
      }
    ),
  },
  mergeRequestDiff: {
    computeDiff: defineAction(
      "mergeRequestDiff.computeDiff",
      (client, input: { mergeRequestId: string }) =>
        client.mergeRequestDiff.compute(input.mergeRequestId)
    ),
    computePageDiffAction: defineAction(
      "mergeRequestDiff.computePageDiffAction",
      (
        client,
        input: {
          sourceBranchId: string;
          targetBranchId: string;
          pagePath: string;
          mergeRequestId?: string;
        }
      ) => client.mergeRequestDiff.computePage(input)
    ),
  },
  mrReviews: {
    listThreadsByMR: defineQuery(
      "mrReviews.listThreadsByMR",
      (client, input: { mergeRequestId: string }) =>
        client.mrReviews.listThreads(input.mergeRequestId)
    ),
    listThreadsByPage: defineQuery(
      "mrReviews.listThreadsByPage",
      (client, input: { mergeRequestId: string; pagePath: string }) =>
        client.mrReviews.listThreads(input.mergeRequestId, input.pagePath)
    ),
    createThread: defineMutation(
      "mrReviews.createThread",
      async (
        client,
        input: Parameters<DataClient["mrReviews"]["createThread"]>[0]
      ) => (await client.mrReviews.createThread(input)).id
    ),
    addComment: defineMutation(
      "mrReviews.addComment",
      async (
        client,
        input: { threadId: string; content: string; userId: string }
      ) =>
        (
          await client.mrReviews.addComment(
            input.threadId,
            input.content,
            input.userId
          )
        ).id
    ),
    resolveThread: defineMutation(
      "mrReviews.resolveThread",
      (client, input: { threadId: string; userId: string }) =>
        client.mrReviews.resolve(input.threadId, input.userId)
    ),
    unresolveThread: defineMutation(
      "mrReviews.unresolveThread",
      (client, input: { threadId: string; userId?: string }) =>
        client.mrReviews.unresolve(input.threadId)
    ),
    acceptSuggestion: defineMutation(
      "mrReviews.acceptSuggestion",
      (client, input: { threadId: string; userId: string }) =>
        client.mrReviews.accept(input.threadId, input.userId)
    ),
    dismissSuggestion: defineMutation(
      "mrReviews.dismissSuggestion",
      (client, input: { threadId: string; userId: string }) =>
        client.mrReviews.dismiss(input.threadId, input.userId)
    ),
    submitReview: defineMutation(
      "mrReviews.submitReview",
      async (
        client,
        input: Parameters<DataClient["mrReviews"]["submitReview"]>[0]
      ) => (await client.mrReviews.submitReview(input)).id
    ),
    listReviews: defineQuery(
      "mrReviews.listReviews",
      (client, input: { mergeRequestId: string }) =>
        client.mrReviews.listReviews(input.mergeRequestId)
    ),
    getReviewSummary: defineQuery(
      "mrReviews.getReviewSummary",
      (client, input: { mergeRequestId: string }) =>
        client.mrReviews.summary(input.mergeRequestId)
    ),
  },
} as const;
