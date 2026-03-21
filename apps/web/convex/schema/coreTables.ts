import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Core tables — shipped in both the OSS core and the SaaS platform.
 *
 * IMPORTANT: These table definitions must NOT contain v.id() references to
 * platform-only tables (organizations, generationJobs, etc.) because the
 * core standalone schema does not include those tables.
 *
 * For fields that reference platform-only tables (e.g. aiGenerationJobId),
 * use v.optional(v.string()) instead of v.optional(v.id("tableName")).
 * Convex IDs are strings at runtime, so data portability is preserved.
 */
export const coreTables = {
  // Authentication & Users
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.union(
      v.literal("email"),
      v.literal("google"),
      v.literal("github")
    ),
    onboardingCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email", ["email"]),

  // Projects
  projects: defineTable({
    // NOTE: orgId is deprecated — kept for migration compatibility.
    // Uses v.string() instead of v.id("organizations") because the
    // organizations table only exists in the platform schema.
    orgId: v.optional(v.string()),
    workosOrgId: v.optional(v.string()),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    defaultBranchId: v.optional(v.id("branches")),
    settings: v.optional(
      v.object({
        theme: v.optional(
          v.union(
            v.literal("default"),
            v.literal("ocean"),
            v.literal("forest"),
            v.literal("ember"),
            v.literal("midnight"),
            v.literal("dune"),
            v.literal("fossil"),
            v.literal("vapor"),
            v.literal("aubergine"),
            v.literal("custom")
          )
        ),
        primaryColor: v.optional(v.string()),
        backgroundColorLight: v.optional(v.string()),
        backgroundColorDark: v.optional(v.string()),
        backgroundSubtleColorLight: v.optional(v.string()),
        backgroundSubtleColorDark: v.optional(v.string()),
        logoAssetId: v.optional(v.id("assets")),
        logoLightAssetId: v.optional(v.id("assets")),
        logoDarkAssetId: v.optional(v.id("assets")),
        favicon: v.optional(v.string()),
        faviconAssetId: v.optional(v.id("assets")),
        fonts: v.optional(v.object({
          heading: v.optional(v.string()),
          body: v.optional(v.string()),
          code: v.optional(v.string()),
        })),
        accentColor: v.optional(v.string()),
        sidebarBackgroundColor: v.optional(v.string()),
        headerBackgroundColor: v.optional(v.string()),
        linkColor: v.optional(v.string()),
        codeAccentColor: v.optional(v.string()),
        customCss: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        navTabs: v.optional(
          v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              slug: v.string(),
              icon: v.optional(v.string()),
              folderId: v.optional(v.id("folders")),
              items: v.optional(
                v.array(
                  v.union(
                    v.object({
                      type: v.literal("folder"),
                      folderId: v.id("folders"),
                    }),
                    v.object({
                      type: v.literal("page"),
                      pageId: v.id("pages"),
                    })
                  )
                )
              ),
            })
          )
        ),
        openapi: v.optional(
          v.object({
            assetId: v.id("assets"),
            specUrl: v.optional(v.string()),
            specFormat: v.union(v.literal("json"), v.literal("yaml")),
            title: v.string(),
            version: v.string(),
            endpointCount: v.number(),
            tagGroups: v.array(
              v.object({
                tag: v.string(),
                endpointCount: v.number(),
              })
            ),
            basePath: v.optional(v.string()),
            tabId: v.optional(v.string()),
            updatedAt: v.number(),
          })
        ),
        ai: v.optional(
          v.object({
            defaultDescription: v.optional(v.string()),
            defaultAudience: v.optional(
              v.union(v.literal("public"), v.literal("private"))
            ),
            defaultMode: v.optional(
              v.union(v.literal("extended"), v.literal("fast"))
            ),
            // Legacy/shared defaults (kept for backward compat)
            defaultModel: v.optional(v.string()),
            byokOpenRouterKey: v.optional(v.string()),
            // Per-feature overrides
            docGeneration: v.optional(
              v.object({
                model: v.optional(v.string()),
                byokOpenRouterKey: v.optional(v.string()),
              })
            ),
            evergreenDocs: v.optional(
              v.object({
                model: v.optional(v.string()),
                byokOpenRouterKey: v.optional(v.string()),
              })
            ),
            chatWithDocs: v.optional(
              v.object({
                model: v.optional(v.string()),
                byokOpenRouterKey: v.optional(v.string()),
              })
            ),
            openApiEnabled: v.optional(v.boolean()),
          })
        ),
        seo: v.optional(v.object({
          ogTitle: v.optional(v.string()),
          ogDescription: v.optional(v.string()),
          ogImageAssetId: v.optional(v.id("assets")),
          twitterCard: v.optional(v.union(v.literal("summary"), v.literal("summary_large_image"))),
          robotsTxtCustom: v.optional(v.string()),
          jsonLdOrg: v.optional(v.string()),
        })),
        analytics: v.optional(v.object({
          ga4MeasurementId: v.optional(v.string()),
          posthogApiKey: v.optional(v.string()),
          posthogHost: v.optional(v.string()),
        })),
        headScripts: v.optional(v.string()),
        bodyScripts: v.optional(v.string()),
        llmsTxt: v.optional(v.string()),
        docsChat: v.optional(
          v.object({
            enabled: v.optional(v.boolean()),
            model: v.optional(v.string()),
          })
        ),
        socialLinks: v.optional(
          v.array(
            v.object({
              platform: v.union(
                v.literal("github"),
                v.literal("x"),
                v.literal("discord"),
                v.literal("linkedin"),
                v.literal("youtube")
              ),
              url: v.string(),
            })
          )
        ),
        defaultThemeMode: v.optional(
          v.union(
            v.literal("light"),
            v.literal("dark"),
            v.literal("system")
          )
        ),
        ctaButton: v.optional(
          v.object({
            label: v.string(),
            url: v.string(),
          })
        ),
        migrationRedirects: v.optional(
          v.array(
            v.object({
              from: v.string(),
              to: v.string(),
            })
          )
        ),
        accessControl: v.optional(v.object({
          mode: v.union(
            v.literal("public"),
            v.literal("login_required"),
            v.literal("domain_restricted"),
            v.literal("allowlist"),
            v.literal("sso_required")
          ),
          allowedDomains: v.optional(v.array(v.string())),
          allowedEmails: v.optional(v.array(v.string())),
          sessionTtlDays: v.optional(v.number()),
        })),
      })
    ),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("ultimate"))
    ),
    hadTrial: v.optional(v.boolean()),
    trialEndsAt: v.optional(v.number()),
    hadRetentionOffer: v.optional(v.boolean()),
    stripeTrialSubscriptionId: v.optional(v.string()),
    cfSlug: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_slug", ["orgId", "slug"])
    .index("by_workos_org", ["workosOrgId"])
    .index("by_workos_org_and_slug", ["workosOrgId", "slug"])
    .index("by_cf_slug", ["cfSlug"])
    .index("by_created_by", ["createdBy"])
    .index("by_updated_at", ["updatedAt"]),

  // Branches
  branches: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    isDefault: v.boolean(),
    isLocked: v.boolean(),
    sourceBranchId: v.optional(v.id("branches")),
    deletedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_name", ["projectId", "name"]),

  // Folders
  folders: defineTable({
    branchId: v.id("branches"),
    parentId: v.optional(v.id("folders")),
    name: v.string(),
    slug: v.string(),
    position: v.number(),
    path: v.string(),
    icon: v.optional(v.string()),
    // Uses v.string() instead of v.id("generationJobs") — platform-only table
    aiGenerationJobId: v.optional(v.string()),
    aiPendingReview: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_branch", ["branchId"])
    .index("by_parent", ["parentId"])
    .index("by_branch_and_path", ["branchId", "path"])
    .index("by_generation_job", ["aiGenerationJobId"]),

  // Pages
  pages: defineTable({
    branchId: v.id("branches"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    slug: v.string(),
    path: v.string(),
    position: v.number(),
    isPublished: v.boolean(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    titleSectionHidden: v.optional(v.boolean()),
    titleIconHidden: v.optional(v.boolean()),
    aiGenerated: v.optional(v.boolean()),
    // Uses v.string() instead of v.id("generationJobs") — platform-only table
    aiGenerationJobId: v.optional(v.string()),
    aiPendingReview: v.optional(v.boolean()),
    aiFolderSlug: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    ogImageAssetId: v.optional(v.id("assets")),
    noindex: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_branch", ["branchId"])
    .index("by_folder", ["folderId"])
    .index("by_branch_and_path", ["branchId", "path"])
    .index("by_branch_folder_slug", ["branchId", "folderId", "slug"])
    .index("by_branch_and_updated_at", ["branchId", "updatedAt"])
    .index("by_generation_job", ["aiGenerationJobId"]),

  // Page Contents (BlockNote JSON)
  pageContents: defineTable({
    pageId: v.id("pages"),
    content: v.string(),
    mdxCache: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_page", ["pageId"]),

  // Page Versions (History)
  pageVersions: defineTable({
    pageId: v.id("pages"),
    version: v.number(),
    content: v.string(),
    contentHash: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_page", ["pageId"])
    .index("by_page_and_version", ["pageId", "version"]),

  // Deployment Configs
  deploymentConfigs: defineTable({
    projectId: v.id("projects"),
    cfProjectName: v.optional(v.string()),
    vercelProjectId: v.optional(v.string()),
    vercelTeamId: v.optional(v.string()),
    vercelToken: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    liveDeploymentId: v.optional(v.id("deployments")),
    accessAppId: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // Deployments
  deployments: defineTable({
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    externalDeploymentId: v.optional(v.string()),
    cfProjectName: v.optional(v.string()),
    vercelDeploymentId: v.optional(v.string()),
    url: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("building"),
      v.literal("ready"),
      v.literal("error"),
      v.literal("canceled")
    ),
    target: v.union(v.literal("production"), v.literal("preview")),
    error: v.optional(v.string()),
    contentHashes: v.optional(v.record(v.string(), v.string())),
    buildPhase: v.optional(
      v.union(
        v.literal("generating"),
        v.literal("uploading"),
        v.literal("propagating"),
      )
    ),
    warnings: v.optional(v.array(v.string())),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_created_at", ["projectId", "createdAt"])
    .index("by_branch", ["branchId"])
    .index("by_vercel_deployment_id", ["vercelDeploymentId"])
    .index("by_external_deployment_id", ["externalDeploymentId"]),

  // Assets
  assets: defineTable({
    projectId: v.id("projects"),
    r2Key: v.string(),
    url: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),

  // Search Index
  searchIndex: defineTable({
    pageId: v.id("pages"),
    projectId: v.id("projects"),
    title: v.string(),
    headings: v.string(),
    content: v.string(),
    codeBlocks: v.string(),
    path: v.string(),
    excerpt: v.string(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_page", ["pageId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["projectId"],
    })
    .searchIndex("search_titles", {
      searchField: "title",
      filterFields: ["projectId"],
    })
    .searchIndex("search_headings", {
      searchField: "headings",
      filterFields: ["projectId"],
    }),

  // Comment Threads (anchored to blocks or inline text)
  commentThreads: defineTable({
    pageId: v.id("pages"),
    blockId: v.string(),
    anchorType: v.union(v.literal("block"), v.literal("inline")),
    inlineStart: v.optional(v.number()),
    inlineEnd: v.optional(v.number()),
    quotedText: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("resolved")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_page", ["pageId"])
    .index("by_page_and_status", ["pageId", "status"]),

  // Comments within threads
  comments: defineTable({
    threadId: v.id("commentThreads"),
    content: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    isEdited: v.boolean(),
  }).index("by_thread", ["threadId"]),

  // Project-level RBAC memberships
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    addedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_and_user", ["projectId", "userId"]),

  // Merge Requests
  mergeRequests: defineTable({
    projectId: v.id("projects"),
    sourceBranchId: v.id("branches"),
    targetBranchId: v.id("branches"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("merged"),
      v.literal("closed")
    ),
    diffSummary: v.optional(
      v.object({
        pagesAdded: v.number(),
        pagesRemoved: v.number(),
        pagesModified: v.number(),
        foldersAdded: v.number(),
        foldersRemoved: v.number(),
      })
    ),
    diffSnapshot: v.optional(v.string()),
    resolutions: v.optional(v.string()),
    githubPrNumber: v.optional(v.number()),
    githubPrUrl: v.optional(v.string()),
    githubRepoFullName: v.optional(v.string()),
    createdBy: v.id("users"),
    mergedBy: v.optional(v.id("users")),
    mergedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_status", ["projectId", "status"])
    .index("by_source_branch", ["sourceBranchId"])
    .index("by_target_branch", ["targetBranchId"])
    .index("by_github_pr", ["githubRepoFullName", "githubPrNumber"]),

  // Merge Request Comments
  mergeRequestComments: defineTable({
    mergeRequestId: v.id("mergeRequests"),
    pagePath: v.optional(v.string()),
    blockIndex: v.optional(v.number()),
    content: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_merge_request", ["mergeRequestId"]),

  // Branch Snapshots (fork-point tracking for three-way merge)
  branchSnapshots: defineTable({
    branchId: v.id("branches"),
    sourceBranchId: v.id("branches"),
    pageHashes: v.string(),
    folderPaths: v.string(),
    createdAt: v.number(),
  }).index("by_branch", ["branchId"]),

  // Page Feedback ("Was this helpful?" reactions on published docs)
  pageFeedback: defineTable({
    projectId: v.id("projects"),
    pageSlug: v.string(),
    reaction: v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative")
    ),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project_and_page", ["projectId", "pageSlug"])
    .index("by_session_and_page", ["sessionId", "pageSlug"]),
};
