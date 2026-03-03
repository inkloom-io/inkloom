import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Queries ──────────────────────────────────────────────────────────────

export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(
      v.union(v.literal("open"), v.literal("merged"), v.literal("closed"))
    ),
  },
  handler: async (ctx, args) => {
    let mrs;
    if (args.status) {
      mrs = await ctx.db
        .query("mergeRequests")
        .withIndex("by_project_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", args.status!)
        )
        .collect();
    } else {
      mrs = await ctx.db
        .query("mergeRequests")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    }

    // Join creator info and branch names
    const results = await Promise.all(
      mrs.map(async (mr) => {
        const creator = await ctx.db.get(mr.createdBy);
        const sourceBranch = await ctx.db.get(mr.sourceBranchId);
        const targetBranch = await ctx.db.get(mr.targetBranchId);

        return {
          ...mr,
          creator: creator
            ? { name: creator.name, avatarUrl: creator.avatarUrl }
            : null,
          sourceBranchName: sourceBranch?.name ?? "deleted",
          targetBranchName: targetBranch?.name ?? "deleted",
        };
      })
    );

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  },
});

export const get = query({
  args: { mergeRequestId: v.id("mergeRequests") },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) return null;

    const creator = await ctx.db.get(mr.createdBy);
    const sourceBranch = await ctx.db.get(mr.sourceBranchId);
    const targetBranch = await ctx.db.get(mr.targetBranchId);
    const mergedByUser = mr.mergedBy ? await ctx.db.get(mr.mergedBy) : null;
    const closedByUser = mr.closedBy ? await ctx.db.get(mr.closedBy) : null;

    return {
      ...mr,
      creator: creator
        ? { name: creator.name, avatarUrl: creator.avatarUrl }
        : null,
      sourceBranchName: sourceBranch?.name ?? "deleted",
      targetBranchName: targetBranch?.name ?? "deleted",
      mergedByUser: mergedByUser
        ? { name: mergedByUser.name, avatarUrl: mergedByUser.avatarUrl }
        : null,
      closedByUser: closedByUser
        ? { name: closedByUser.name, avatarUrl: closedByUser.avatarUrl }
        : null,
    };
  },
});

// Internal version of get for use in actions (avoids circular type reference)
export const getInternal = internalQuery({
  args: { mergeRequestId: v.id("mergeRequests") },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) return null;
    return mr;
  },
});

export const countByStatus = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("mergeRequests")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      open: all.filter((mr) => mr.status === "open").length,
      merged: all.filter((mr) => mr.status === "merged").length,
      closed: all.filter((mr) => mr.status === "closed").length,
    };
  },
});

export const getOpenCountForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const openMrs = await ctx.db
      .query("mergeRequests")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "open")
      )
      .collect();
    return openMrs.length;
  },
});

export const getOpenForBranch = query({
  args: { sourceBranchId: v.id("branches") },
  handler: async (ctx, args) => {
    const mrs = await ctx.db
      .query("mergeRequests")
      .withIndex("by_source_branch", (q) =>
        q.eq("sourceBranchId", args.sourceBranchId)
      )
      .collect();
    return mrs.find((mr) => mr.status === "open") ?? null;
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    sourceBranchId: v.id("branches"),
    targetBranchId: v.id("branches"),
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate branches are different
    if (args.sourceBranchId === args.targetBranchId) {
      throw new Error("Source and target branches must be different");
    }

    // Validate both branches belong to the project
    const sourceBranch = await ctx.db.get(args.sourceBranchId);
    const targetBranch = await ctx.db.get(args.targetBranchId);

    if (!sourceBranch || sourceBranch.projectId !== args.projectId) {
      throw new Error("Source branch not found or does not belong to project");
    }
    if (!targetBranch || targetBranch.projectId !== args.projectId) {
      throw new Error("Target branch not found or does not belong to project");
    }

    // Check no duplicate open MR for same source → target
    const existing = await ctx.db
      .query("mergeRequests")
      .withIndex("by_source_branch", (q) =>
        q.eq("sourceBranchId", args.sourceBranchId)
      )
      .collect();

    const duplicate = existing.find(
      (mr) =>
        mr.targetBranchId === args.targetBranchId && mr.status === "open"
    );

    if (duplicate) {
      throw new Error(
        "An open merge request already exists for this source and target branch combination"
      );
    }

    return await ctx.db.insert("mergeRequests", {
      projectId: args.projectId,
      sourceBranchId: args.sourceBranchId,
      targetBranchId: args.targetBranchId,
      title: args.title,
      description: args.description,
      status: "open",
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.mergeRequestId, updates);
    return args.mergeRequestId;
  },
});

export const close = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    closedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");
    if (mr.status !== "open") throw new Error("Can only close an open merge request");

    await ctx.db.patch(args.mergeRequestId, {
      status: "closed",
      closedBy: args.closedBy,
      closedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.mergeRequestId;
  },
});

export const reopen = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");
    if (mr.status !== "closed") throw new Error("Can only reopen a closed merge request");

    await ctx.db.patch(args.mergeRequestId, {
      status: "open",
      closedBy: undefined,
      closedAt: undefined,
      updatedAt: Date.now(),
    });
    return args.mergeRequestId;
  },
});

export const updateResolutions = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    resolutions: v.string(), // JSON string
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");
    if (mr.status !== "open") throw new Error("Can only update resolutions on an open merge request");

    await ctx.db.patch(args.mergeRequestId, {
      resolutions: args.resolutions,
      updatedAt: Date.now(),
    });
    return args.mergeRequestId;
  },
});

export const updateDiffSummary = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    diffSummary: v.object({
      pagesAdded: v.number(),
      pagesRemoved: v.number(),
      pagesModified: v.number(),
      foldersAdded: v.number(),
      foldersRemoved: v.number(),
    }),
    diffSnapshot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      diffSummary: args.diffSummary,
      updatedAt: Date.now(),
    };
    if (args.diffSnapshot !== undefined) {
      updates.diffSnapshot = args.diffSnapshot;
    }
    await ctx.db.patch(args.mergeRequestId, updates);
  },
});

export const updateGithubPr = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    githubPrNumber: v.number(),
    githubPrUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mergeRequestId, {
      githubPrNumber: args.githubPrNumber,
      githubPrUrl: args.githubPrUrl,
      updatedAt: Date.now(),
    });
  },
});

export const getByGithubPr = query({
  args: { githubPrNumber: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mergeRequests")
      .withIndex("by_github_pr", (q) =>
        q.eq("githubPrNumber", args.githubPrNumber)
      )
      .first();
  },
});

// ── Merge Execution ──────────────────────────────────────────────────────

// DJB2 hash for content fingerprinting
function hashContent(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Generate a random block ID
function generateBlockId(): string {
  const chars = "0123456789abcdef";
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      return s;
    })
    .join("-");
}

// Regenerate all block IDs in content JSON
function regenerateBlockIds(contentJson: string): string {
  try {
    const blocks = JSON.parse(contentJson);
    const regenerate = (items: unknown[]): unknown[] =>
      items.map((block: unknown) => {
        if (!block || typeof block !== "object") return block;
        const b = block as Record<string, unknown>;
        const result: Record<string, unknown> = { ...b, id: generateBlockId() };
        if (Array.isArray(b.children) && b.children.length > 0) {
          result.children = regenerate(b.children as unknown[]);
        }
        return result;
      });
    return JSON.stringify(regenerate(blocks));
  } catch {
    return contentJson;
  }
}

export const merge = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    mergedBy: v.id("users"),
    deleteSourceBranch: v.optional(v.boolean()),
    resolutions: v.optional(v.string()), // JSON Record<pagePath, Record<blockIndex, "source"|"target">>
  },
  handler: async (ctx, args) => {
    // 1. Validate
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");
    if (mr.status !== "open") throw new Error("Can only merge an open merge request");

    const sourceBranch = await ctx.db.get(mr.sourceBranchId);
    const targetBranch = await ctx.db.get(mr.targetBranchId);
    if (!sourceBranch) throw new Error("Source branch not found");
    if (!targetBranch) throw new Error("Target branch not found");

    // Parse resolutions
    let resolutionMap: Record<string, Record<number, "source" | "target">> = {};
    const resolutionsStr = args.resolutions ?? mr.resolutions;
    if (resolutionsStr) {
      try {
        resolutionMap = JSON.parse(resolutionsStr);
      } catch {
        // ignore parse errors
      }
    }

    // 2. Load data for both branches
    const sourcePages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", mr.sourceBranchId))
      .collect();
    const targetPages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", mr.targetBranchId))
      .collect();
    const sourceFolders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q) => q.eq("branchId", mr.sourceBranchId))
      .collect();
    const targetFolders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q) => q.eq("branchId", mr.targetBranchId))
      .collect();

    const targetPageMap = new Map(targetPages.map((p) => [p.path, p]));
    const targetFolderMap = new Map(targetFolders.map((f) => [f.path, f]));

    // 3. Create missing folders on target
    const folderIdMap = new Map<Id<"folders">, Id<"folders">>();
    // First, map existing matching folders
    for (const sf of sourceFolders) {
      const tf = targetFolderMap.get(sf.path);
      if (tf) {
        folderIdMap.set(sf._id, tf._id);
      }
    }
    // Create missing folders
    for (const sf of sourceFolders) {
      if (!targetFolderMap.has(sf.path)) {
        const newParentId = sf.parentId ? folderIdMap.get(sf.parentId) : undefined;
        const newFolderId = await ctx.db.insert("folders", {
          branchId: mr.targetBranchId,
          parentId: newParentId,
          name: sf.name,
          slug: sf.slug,
          path: sf.path,
          position: sf.position,
          icon: sf.icon,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        folderIdMap.set(sf._id, newFolderId);
      }
    }

    // 4. Process pages
    for (const sourcePage of sourcePages) {
      const targetPage = targetPageMap.get(sourcePage.path);

      if (!targetPage) {
        // Added page: create on target
        const newFolderId = sourcePage.folderId
          ? folderIdMap.get(sourcePage.folderId)
          : undefined;

        const sourceContent = await ctx.db
          .query("pageContents")
          .withIndex("by_page", (q) => q.eq("pageId", sourcePage._id))
          .unique();

        const newPageId = await ctx.db.insert("pages", {
          branchId: mr.targetBranchId,
          folderId: newFolderId,
          title: sourcePage.title,
          slug: sourcePage.slug,
          path: sourcePage.path,
          position: sourcePage.position,
          isPublished: sourcePage.isPublished,
          description: sourcePage.description,
          icon: sourcePage.icon,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        if (sourceContent) {
          await ctx.db.insert("pageContents", {
            pageId: newPageId,
            content: regenerateBlockIds(sourceContent.content),
            updatedAt: Date.now(),
          });
        }
      } else {
        // Modified page: apply merge
        const sourceContent = await ctx.db
          .query("pageContents")
          .withIndex("by_page", (q) => q.eq("pageId", sourcePage._id))
          .unique();
        const targetContent = await ctx.db
          .query("pageContents")
          .withIndex("by_page", (q) => q.eq("pageId", targetPage._id))
          .unique();

        if (!sourceContent || !targetContent) continue;

        // Check if content actually differs
        const sourceHash = hashContent(sourceContent.content);
        const targetHash = hashContent(targetContent.content);

        if (sourceHash === targetHash && sourcePage.title === targetPage.title) {
          continue; // No changes
        }

        // Save version snapshot of target before overwriting
        const existingVersions = await ctx.db
          .query("pageVersions")
          .withIndex("by_page", (q) => q.eq("pageId", targetPage._id))
          .collect();
        const maxVersion = existingVersions.reduce(
          (max, v) => Math.max(max, v.version),
          0
        );

        await ctx.db.insert("pageVersions", {
          pageId: targetPage._id,
          version: maxVersion + 1,
          content: targetContent.content,
          contentHash: targetHash,
          createdBy: args.mergedBy,
          message: `Auto-saved before merge from ${sourceBranch.name}`,
          createdAt: Date.now(),
        });

        // Apply merge with resolutions
        const pageResolutions = resolutionMap[sourcePage.path] ?? {};

        // For pages with resolutions, apply block-level merge
        // For simple cases, just use source content
        let mergedContent: string;

        if (Object.keys(pageResolutions).length > 0) {
          // Import diff engine logic inline (can't import from lib in convex)
          // Use resolution map to pick blocks
          try {
            const sourceBlocks = JSON.parse(sourceContent.content) as Array<Record<string, unknown>>;
            const targetBlocks = JSON.parse(targetContent.content) as Array<Record<string, unknown>>;

            // Simple resolution: for each block index with a resolution, pick accordingly
            // Default behavior: use source content for unresolved
            const maxLen = Math.max(sourceBlocks.length, targetBlocks.length);
            const merged: Array<Record<string, unknown>> = [];

            for (let i = 0; i < maxLen; i++) {
              const resolution = pageResolutions[i];
              if (resolution === "target" && targetBlocks[i]) {
                merged.push({ ...targetBlocks[i], id: generateBlockId() });
              } else if (sourceBlocks[i]) {
                merged.push({ ...sourceBlocks[i], id: generateBlockId() });
              } else if (targetBlocks[i]) {
                merged.push({ ...targetBlocks[i], id: generateBlockId() });
              }
            }

            mergedContent = JSON.stringify(merged);
          } catch {
            mergedContent = regenerateBlockIds(sourceContent.content);
          }
        } else {
          mergedContent = regenerateBlockIds(sourceContent.content);
        }

        await ctx.db.patch(targetContent._id, {
          content: mergedContent,
          updatedAt: Date.now(),
        });

        // Update page metadata if changed
        const metaUpdates: Record<string, unknown> = { updatedAt: Date.now() };
        if (sourcePage.title !== targetPage.title) {
          metaUpdates.title = sourcePage.title;
          metaUpdates.slug = sourcePage.slug;
          metaUpdates.path = sourcePage.path;
        }
        if (sourcePage.description !== targetPage.description) {
          metaUpdates.description = sourcePage.description;
        }
        await ctx.db.patch(targetPage._id, metaUpdates);
      }
    }

    // 5. Mark MR as merged
    await ctx.db.patch(args.mergeRequestId, {
      status: "merged",
      mergedBy: args.mergedBy,
      mergedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 6. Optionally soft-delete source branch (preserves data for MR history)
    if (args.deleteSourceBranch && !sourceBranch.isDefault) {
      await ctx.db.patch(mr.sourceBranchId, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return args.mergeRequestId;
  },
});

// ── Comment Management ───────────────────────────────────────────────────

export const listComments = query({
  args: { mergeRequestId: v.id("mergeRequests") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("mergeRequestComments")
      .withIndex("by_merge_request", (q) =>
        q.eq("mergeRequestId", args.mergeRequestId)
      )
      .collect();

    const results = await Promise.all(
      comments.map(async (comment) => {
        const creator = await ctx.db.get(comment.createdBy);
        return {
          ...comment,
          creator: creator
            ? { name: creator.name, avatarUrl: creator.avatarUrl }
            : null,
        };
      })
    );

    // Sort by createdAt ascending
    results.sort((a, b) => a.createdAt - b.createdAt);
    return results;
  },
});

export const addComment = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    content: v.string(),
    pagePath: v.optional(v.string()),
    blockIndex: v.optional(v.number()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");

    const commentId = await ctx.db.insert("mergeRequestComments", {
      mergeRequestId: args.mergeRequestId,
      content: args.content,
      pagePath: args.pagePath,
      blockIndex: args.blockIndex,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update MR timestamp
    await ctx.db.patch(args.mergeRequestId, { updatedAt: Date.now() });

    return commentId;
  },
});

export const updateComment = mutation({
  args: {
    commentId: v.id("mergeRequestComments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: Date.now(),
    });
    return args.commentId;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("mergeRequestComments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    await ctx.db.delete(args.commentId);
  },
});
