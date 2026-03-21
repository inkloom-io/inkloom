import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployments")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deploymentId);
  },
});

export const getByExternalId = query({
  args: { externalDeploymentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployments")
      .withIndex("by_external_deployment_id", (q: any) =>
        q.eq("externalDeploymentId", args.externalDeploymentId)
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    externalDeploymentId: v.optional(v.string()),
    cfProjectName: v.optional(v.string()),
    target: v.optional(v.union(v.literal("production"), v.literal("preview"))),
    contentHashes: v.optional(v.record(v.string(), v.string())),
    buildPhase: v.optional(
      v.union(
        v.literal("generating"),
        v.literal("uploading"),
        v.literal("propagating"),
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("deployments", {
      projectId: args.projectId,
      branchId: args.branchId,
      externalDeploymentId: args.externalDeploymentId,
      cfProjectName: args.cfProjectName,
      status: "building",
      target: args.target ?? "preview",
      contentHashes: args.contentHashes,
      buildPhase: args.buildPhase,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.union(
      v.literal("queued"),
      v.literal("building"),
      v.literal("ready"),
      v.literal("error"),
      v.literal("canceled")
    ),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
    warnings: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { deploymentId, ...updates } = args;

    const updateData: Record<string, unknown> = {
      status: updates.status,
      updatedAt: Date.now(),
    };

    if (updates.url !== undefined) {
      updateData.url = updates.url;
    }

    if (updates.error !== undefined) {
      updateData.error = updates.error;
    }

    if (updates.warnings !== undefined) {
      updateData.warnings = updates.warnings;
    }

    await ctx.db.patch(deploymentId, updateData);
  },
});

export const updateBuildPhase = mutation({
  args: {
    deploymentId: v.id("deployments"),
    buildPhase: v.union(
      v.literal("generating"),
      v.literal("uploading"),
      v.literal("propagating"),
    ),
    externalDeploymentId: v.optional(v.string()),
    cfProjectName: v.optional(v.string()),
    contentHashes: v.optional(v.record(v.string(), v.string())),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deploymentId, ...fields } = args;
    const patch: Record<string, unknown> = {
      buildPhase: fields.buildPhase,
      updatedAt: Date.now(),
    };
    if (fields.externalDeploymentId !== undefined) {
      patch.externalDeploymentId = fields.externalDeploymentId;
    }
    if (fields.cfProjectName !== undefined) {
      patch.cfProjectName = fields.cfProjectName;
    }
    if (fields.contentHashes !== undefined) {
      patch.contentHashes = fields.contentHashes;
    }
    if (fields.url !== undefined) {
      patch.url = fields.url;
    }
    await ctx.db.patch(deploymentId, patch);
  },
});

export const listProductionByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("deployments")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return all.filter((d: any) => d.target === "production");
  },
});

export const setLiveDeployment = mutation({
  args: {
    projectId: v.id("projects"),
    deploymentId: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("deploymentConfigs")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .unique();
    if (!config) {
      throw new Error("No deployment config found for project");
    }
    await ctx.db.patch(config._id, {
      liveDeploymentId: args.deploymentId,
      updatedAt: Date.now(),
    });
  },
});

export const getConfig = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deploymentConfigs")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .unique();
  },
});

// Simple hash function for content comparison (djb2 algorithm)
function hashContent(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Compare current content hashes against a deployed set
function hashesMatch(
  currentHashes: Record<string, string>,
  deployedHashes: Record<string, string>
): boolean {
  const deployedPaths = new Set(Object.keys(deployedHashes));
  const currentPaths = new Set(Object.keys(currentHashes));

  for (const path of currentPaths) {
    if (!deployedPaths.has(path)) return false;
  }
  for (const path of deployedPaths) {
    if (!currentPaths.has(path)) return false;
  }
  for (const [path, hash] of Object.entries(currentHashes)) {
    if (deployedHashes[path] !== hash) return false;
  }
  return true;
}

export const hasUnpublishedChanges = query({
  args: {
    projectId: v.id("projects"),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    // Get the project and resolve branch
    const project = await ctx.db.get(args.projectId);
    if (!project?.defaultBranchId) {
      return { preview: true, production: true };
    }

    const resolvedBranchId = args.branchId || project.defaultBranchId;

    // Get deployments for this branch, find latest deployed per target.
    // We look for deployments that have contentHashes (set at "propagating"
    // phase when CF upload succeeds), not just status "ready". This closes
    // the race window where the client sees success at "propagating" but the
    // query can't see the new hashes because the deployment hasn't reached
    // "ready" yet (status update is fire-and-forget from the deploy route).
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_branch", (q: any) => q.eq("branchId", resolvedBranchId))
      .order("desc")
      .collect();

    const latestReadyPreview = deployments.find(
      (d: any) =>
        d.contentHashes &&
        d.target === "preview" &&
        d.status !== "error" &&
        d.status !== "canceled"
    );
    const latestReadyProduction = deployments.find(
      (d: any) =>
        d.contentHashes &&
        d.target === "production" &&
        d.status !== "error" &&
        d.status !== "canceled"
    );

    // If neither target has a deployment, skip expensive hash computation
    if (!latestReadyPreview?.contentHashes && !latestReadyProduction?.contentHashes) {
      return { preview: true, production: true };
    }

    // Compute current content hashes (expensive part, done once)
    const projectSettingsHash = hashContent(JSON.stringify(project.settings || {}));

    // Get current folders and recompute paths from parent chain
    // (mirrors the publish route's computePath logic)
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", resolvedBranchId))
      .collect();
    // Filter out aiPendingReview folders to match what deploy hashes
    // (see folders.ts listByBranch which excludes aiPendingReview)
    const rawFolders = allFolders.filter((f: any) => !f.aiPendingReview);

    const folderMap = new Map(rawFolders.map((f: any) => [f._id, f]));
    function computePath(folder: typeof rawFolders[number]): string {
      if (!folder.parentId) {
        return `/${folder.slug}`;
      }
      const parent = folderMap.get(folder.parentId);
      if (!parent) {
        return `/${folder.slug}`;
      }
      return `${computePath(parent)}/${folder.slug}`;
    }
    const folders = rawFolders.map((f: any) => ({ ...f, path: computePath(f) }));

    // Get current pages and recompute paths from folder paths
    const allPages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", resolvedBranchId))
      .collect();
    // Filter out aiPendingReview pages to match what deploy hashes
    // (see pages.ts listByBranch which excludes aiPendingReview)
    const rawPages = allPages.filter((p: any) => !p.aiPendingReview);

    const pagesWithFixedPaths = rawPages.map((page: any) => {
      if (!page.folderId) {
        return { ...page, path: `/${page.slug}` };
      }
      const folder = folders.find((f: any) => f._id === page.folderId);
      if (!folder) {
        return page;
      }
      return { ...page, path: `${folder.path}/${page.slug}` };
    });

    const publishedPages = pagesWithFixedPaths.filter((p: any) => p.isPublished);

    // Build current content hashes
    const currentHashes: Record<string, string> = {
      "__project_settings__": projectSettingsHash,
    };

    // Hash page data including icons
    for (const page of publishedPages) {
      const content = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .unique();

      const pageData = {
        path: page.path,
        title: page.title,
        content: content?.content || "[]",
        icon: page.icon,
        subtitle: page.subtitle,
        titleSectionHidden: page.titleSectionHidden,
        titleIconHidden: page.titleIconHidden,
      };
      currentHashes[page.path] = hashContent(JSON.stringify(pageData));
    }

    // Hash folder data (names and icons affect navigation)
    for (const folder of folders) {
      const folderData = {
        path: folder.path,
        name: folder.name,
        icon: folder.icon,
      };
      currentHashes[`__folder__${folder.path}`] = hashContent(JSON.stringify(folderData));
    }

    // Compare against each target independently
    const result = {
      preview: latestReadyPreview?.contentHashes
        ? !hashesMatch(currentHashes, latestReadyPreview.contentHashes)
        : true,
      production: latestReadyProduction?.contentHashes
        ? !hashesMatch(currentHashes, latestReadyProduction.contentHashes)
        : true,
    };

    return result;
  },
});

export const getInProgressDeployment = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Get the most recent deployment that's still in progress
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    // A deployment stuck in "queued" or "building" for more than 5 minutes
    // is considered abandoned (e.g. the CF polling IIFE was killed) and
    // should not be resumed by the publish dialog.
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    return deployments.find((d: any) =>
      (d.status === "queued" || d.status === "building") &&
      (now - (d.updatedAt || d.createdAt)) < STALE_THRESHOLD
    ) ?? null;
  },
});

export const upsertConfig = mutation({
  args: {
    projectId: v.id("projects"),
    cfProjectName: v.optional(v.string()),
    liveDeploymentId: v.optional(v.id("deployments")),
    accessAppId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deploymentConfigs")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .unique();

    const { projectId, ...config } = args;

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...config,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("deploymentConfigs", {
      projectId,
      ...config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
