import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type {
  DeploymentStatus,
  DeploymentTarget,
  JsonValue,
  MergeRequestStatus,
  Plan,
  ProjectSettings,
  ProjectRole,
} from "./shared";

const newId = () => crypto.randomUUID();

/**
 * Core D1 schema.
 *
 * These tables are the complete data model used by the standalone open-source
 * application. The platform schema imports and extends this module; core never
 * imports from platform.
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    workosUserId: text("workos_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    authProvider: text("auth_provider", {
      enum: ["email", "google", "github"],
    }).notNull(),
    onboardingCompletedAt: integer("onboarding_completed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("users_workos_user_id_uidx").on(table.workosUserId),
    index("users_email_idx").on(table.email),
  ]
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    legacyOrgId: text("legacy_org_id"),
    workosOrgId: text("workos_org_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull(),
    // Kept as a scalar to avoid a schema-definition cycle with branches.
    defaultBranchId: text("default_branch_id"),
    settings: text("settings", { mode: "json" }).$type<ProjectSettings>(),
    plan: text("plan").$type<Plan>(),
    hadTrial: integer("had_trial", { mode: "boolean" }),
    trialEndsAt: integer("trial_ends_at"),
    hadRetentionOffer: integer("had_retention_offer", { mode: "boolean" }),
    stripeTrialSubscriptionId: text("stripe_trial_subscription_id"),
    cfSlug: text("cf_slug"),
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("projects_legacy_org_idx").on(table.legacyOrgId),
    uniqueIndex("projects_legacy_org_slug_uidx").on(
      table.legacyOrgId,
      table.slug
    ),
    index("projects_workos_org_idx").on(table.workosOrgId),
    uniqueIndex("projects_workos_org_slug_uidx").on(
      table.workosOrgId,
      table.slug
    ),
    index("projects_workos_org_updated_at_idx").on(
      table.workosOrgId,
      table.updatedAt
    ),
    index("projects_cf_slug_idx").on(table.cfSlug),
    index("projects_created_by_idx").on(table.createdBy),
    index("projects_updated_at_idx").on(table.updatedAt),
  ]
);

export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull(),
    isLocked: integer("is_locked", { mode: "boolean" }).notNull(),
    sourceBranchId: text("source_branch_id"),
    deletedAt: integer("deleted_at"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("branches_project_idx").on(table.projectId),
    uniqueIndex("branches_project_name_uidx").on(table.projectId, table.name),
  ]
);

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull(),
    path: text("path").notNull(),
    icon: text("icon"),
    aiGenerationJobId: text("ai_generation_job_id"),
    aiPendingReview: integer("ai_pending_review", { mode: "boolean" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("folders_branch_idx").on(table.branchId),
    index("folders_parent_idx").on(table.parentId),
    uniqueIndex("folders_branch_path_uidx").on(table.branchId, table.path),
    index("folders_generation_job_idx").on(table.aiGenerationJobId),
  ]
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    path: text("path").notNull(),
    position: integer("position").notNull(),
    isPublished: integer("is_published", { mode: "boolean" }).notNull(),
    description: text("description"),
    icon: text("icon"),
    subtitle: text("subtitle"),
    titleSectionHidden: integer("title_section_hidden", { mode: "boolean" }),
    titleIconHidden: integer("title_icon_hidden", { mode: "boolean" }),
    aiGenerated: integer("ai_generated", { mode: "boolean" }),
    aiGenerationJobId: text("ai_generation_job_id"),
    aiPendingReview: integer("ai_pending_review", { mode: "boolean" }),
    aiFolderSlug: text("ai_folder_slug"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageAssetId: text("og_image_asset_id"),
    noindex: integer("noindex", { mode: "boolean" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("pages_branch_idx").on(table.branchId),
    index("pages_folder_idx").on(table.folderId),
    uniqueIndex("pages_branch_path_uidx").on(table.branchId, table.path),
    uniqueIndex("pages_branch_folder_slug_uidx").on(
      table.branchId,
      table.folderId,
      table.slug
    ),
    index("pages_branch_updated_at_idx").on(table.branchId, table.updatedAt),
    index("pages_generation_job_idx").on(table.aiGenerationJobId),
  ]
);

export const pageContents = sqliteTable(
  "page_contents",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mdxCache: text("mdx_cache"),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("page_contents_page_uidx").on(table.pageId)]
);

export const pageVersions = sqliteTable(
  "page_versions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    message: text("message"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("page_versions_page_idx").on(table.pageId),
    uniqueIndex("page_versions_page_version_uidx").on(
      table.pageId,
      table.version
    ),
  ]
);

export const deployments = sqliteTable(
  "deployments",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    externalDeploymentId: text("external_deployment_id"),
    cfProjectName: text("cf_project_name"),
    vercelDeploymentId: text("vercel_deployment_id"),
    url: text("url"),
    status: text("status").notNull().$type<DeploymentStatus>(),
    target: text("target").notNull().$type<DeploymentTarget>(),
    error: text("error"),
    contentHashes: text("content_hashes", { mode: "json" }).$type<
      Record<string, string>
    >(),
    buildPhase: text("build_phase", {
      enum: ["generating", "uploading", "propagating"],
    }),
    warnings: text("warnings", { mode: "json" }).$type<string[]>(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("deployments_project_idx").on(table.projectId),
    index("deployments_project_created_at_idx").on(
      table.projectId,
      table.createdAt
    ),
    index("deployments_branch_idx").on(table.branchId),
    index("deployments_vercel_id_idx").on(table.vercelDeploymentId),
    index("deployments_external_id_idx").on(table.externalDeploymentId),
  ]
);

export const deploymentConfigs = sqliteTable(
  "deployment_configs",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cfProjectName: text("cf_project_name"),
    vercelProjectId: text("vercel_project_id"),
    vercelTeamId: text("vercel_team_id"),
    vercelToken: text("vercel_token"),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    liveDeploymentId: text("live_deployment_id").references(
      () => deployments.id,
      { onDelete: "set null" }
    ),
    accessAppId: text("access_app_id"),
    productionUrl: text("production_url"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("deployment_configs_project_uidx").on(table.projectId),
  ]
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("assets_project_idx").on(table.projectId),
    uniqueIndex("assets_r2_key_uidx").on(table.r2Key),
  ]
);

export const searchIndex = sqliteTable(
  "search_index",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    headings: text("headings").notNull(),
    content: text("content").notNull(),
    codeBlocks: text("code_blocks").notNull(),
    path: text("path").notNull(),
    excerpt: text("excerpt").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("search_index_project_idx").on(table.projectId),
    uniqueIndex("search_index_page_uidx").on(table.pageId),
  ]
);

export const commentThreads = sqliteTable(
  "comment_threads",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    blockId: text("block_id").notNull(),
    anchorType: text("anchor_type", { enum: ["block", "inline"] }).notNull(),
    inlineStart: integer("inline_start"),
    inlineEnd: integer("inline_end"),
    quotedText: text("quoted_text"),
    status: text("status", { enum: ["open", "resolved"] }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("comment_threads_page_idx").on(table.pageId),
    index("comment_threads_page_status_idx").on(table.pageId, table.status),
  ]
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    threadId: text("thread_id")
      .notNull()
      .references(() => commentThreads.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    isEdited: integer("is_edited", { mode: "boolean" }).notNull(),
  },
  (table) => [index("comments_thread_idx").on(table.threadId)]
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<ProjectRole>(),
    addedBy: text("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("project_members_project_idx").on(table.projectId),
    index("project_members_user_idx").on(table.userId),
    uniqueIndex("project_members_project_user_uidx").on(
      table.projectId,
      table.userId
    ),
  ]
);

export const mergeRequests = sqliteTable(
  "merge_requests",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceBranchId: text("source_branch_id")
      .notNull()
      .references(() => branches.id),
    targetBranchId: text("target_branch_id")
      .notNull()
      .references(() => branches.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().$type<MergeRequestStatus>(),
    diffSummary: text("diff_summary", { mode: "json" }).$type<{
      pagesAdded: number;
      pagesRemoved: number;
      pagesModified: number;
      foldersAdded: number;
      foldersRemoved: number;
    }>(),
    diffSnapshot: text("diff_snapshot"),
    resolutions: text("resolutions"),
    githubPrNumber: integer("github_pr_number"),
    githubPrUrl: text("github_pr_url"),
    githubRepoFullName: text("github_repo_full_name"),
    reviewStatus: text("review_status", {
      enum: ["approved", "changes_requested"],
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    mergedBy: text("merged_by").references(() => users.id, {
      onDelete: "set null",
    }),
    mergedAt: integer("merged_at"),
    closedBy: text("closed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    closedAt: integer("closed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("merge_requests_project_idx").on(table.projectId),
    index("merge_requests_project_status_idx").on(
      table.projectId,
      table.status
    ),
    index("merge_requests_source_branch_idx").on(table.sourceBranchId),
    index("merge_requests_target_branch_idx").on(table.targetBranchId),
    index("merge_requests_github_pr_idx").on(
      table.githubRepoFullName,
      table.githubPrNumber
    ),
  ]
);

export const mergeRequestComments = sqliteTable(
  "merge_request_comments",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    mergeRequestId: text("merge_request_id")
      .notNull()
      .references(() => mergeRequests.id, { onDelete: "cascade" }),
    pagePath: text("page_path"),
    blockIndex: integer("block_index"),
    content: text("content").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("merge_request_comments_request_idx").on(table.mergeRequestId),
  ]
);

export const branchSnapshots = sqliteTable(
  "branch_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    sourceBranchId: text("source_branch_id")
      .notNull()
      .references(() => branches.id),
    pageHashes: text("page_hashes").notNull(),
    folderPaths: text("folder_paths").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("branch_snapshots_branch_idx").on(table.branchId)]
);

export const pageFeedback = sqliteTable(
  "page_feedback",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageSlug: text("page_slug").notNull(),
    reaction: text("reaction", {
      enum: ["positive", "neutral", "negative"],
    }).notNull(),
    sessionId: text("session_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("page_feedback_project_page_idx").on(table.projectId, table.pageSlug),
    index("page_feedback_session_page_idx").on(table.sessionId, table.pageSlug),
  ]
);

export const mrReviewThreads = sqliteTable(
  "mr_review_threads",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    mergeRequestId: text("merge_request_id")
      .notNull()
      .references(() => mergeRequests.id, { onDelete: "cascade" }),
    pagePath: text("page_path").notNull(),
    blockId: text("block_id").notNull(),
    blockIndex: integer("block_index").notNull(),
    quotedContent: text("quoted_content"),
    threadType: text("thread_type", {
      enum: ["comment", "suggestion"],
    }).notNull(),
    suggestedContent: text("suggested_content"),
    suggestionStatus: text("suggestion_status", {
      enum: ["pending", "accepted", "dismissed"],
    }),
    status: text("status", { enum: ["open", "resolved"] }).notNull(),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: integer("resolved_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("mr_review_threads_request_idx").on(table.mergeRequestId),
    index("mr_review_threads_request_page_idx").on(
      table.mergeRequestId,
      table.pagePath
    ),
  ]
);

export const mrReviewComments = sqliteTable(
  "mr_review_comments",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    threadId: text("thread_id")
      .notNull()
      .references(() => mrReviewThreads.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    isEdited: integer("is_edited", { mode: "boolean" }).notNull(),
  },
  (table) => [index("mr_review_comments_thread_idx").on(table.threadId)]
);

export const mrReviews = sqliteTable(
  "mr_reviews",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    mergeRequestId: text("merge_request_id")
      .notNull()
      .references(() => mergeRequests.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["approved", "changes_requested", "commented"],
    }).notNull(),
    body: text("body"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("mr_reviews_request_idx").on(table.mergeRequestId),
    uniqueIndex("mr_reviews_request_reviewer_uidx").on(
      table.mergeRequestId,
      table.reviewerId
    ),
  ]
);

/**
 * Tracks imported identifiers during the cutover. It lets migration jobs stay
 * idempotent and keeps legacy IDs out of application tables.
 */
export const legacyIdMap = sqliteTable(
  "legacy_id_map",
  {
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    importedAt: integer("imported_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceTable, table.sourceId] }),
    uniqueIndex("legacy_id_map_target_uidx").on(
      table.sourceTable,
      table.targetId
    ),
  ]
);

export const coreSchema = {
  users,
  projects,
  branches,
  folders,
  pages,
  pageContents,
  pageVersions,
  deploymentConfigs,
  deployments,
  assets,
  searchIndex,
  commentThreads,
  comments,
  projectMembers,
  mergeRequests,
  mergeRequestComments,
  branchSnapshots,
  pageFeedback,
  mrReviewThreads,
  mrReviewComments,
  mrReviews,
  legacyIdMap,
} as const;

export type CoreSchema = typeof coreSchema;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageContent = typeof pageContents.$inferSelect;
export type NewPageContent = typeof pageContents.$inferInsert;
export type PageVersion = typeof pageVersions.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type DeploymentConfig = typeof deploymentConfigs.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type CommentThread = typeof commentThreads.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type MergeRequest = typeof mergeRequests.$inferSelect;
export type MrReviewThread = typeof mrReviewThreads.$inferSelect;
export type MrReviewComment = typeof mrReviewComments.$inferSelect;
export type MrReview = typeof mrReviews.$inferSelect;
export type StoredJson = JsonValue;
