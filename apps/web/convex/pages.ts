import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Re-normalizes positions for all items (pages and folders) at a given level
 * to contiguous 0, 1, 2, ... values. Prevents position drift from edge cases.
 */
async function normalizePagePositions(
  ctx: MutationCtx,
  parentFolderId: Id<"folders"> | undefined,
) {
  const siblingPages = await ctx.db
    .query("pages")
    .withIndex("by_folder", (q: any) => q.eq("folderId", parentFolderId))
    .collect();
  const siblingFolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentId", parentFolderId))
    .collect();

  const allItems: Array<{ type: "folder" | "page"; id: Id<"folders"> | Id<"pages">; position: number }> = [
    ...siblingFolders.map((f) => ({ type: "folder" as const, id: f._id, position: f.position })),
    ...siblingPages.map((p) => ({ type: "page" as const, id: p._id, position: p.position })),
  ];
  allItems.sort((a, b) => a.position - b.position);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item && item.position !== i) {
      if (item.type === "folder") {
        await ctx.db.patch(item.id as Id<"folders">, { position: i });
      } else {
        await ctx.db.patch(item.id as Id<"pages">, { position: i });
      }
    }
  }
}

// DJB2 hash — must match the implementation in lib/deploy.ts
function hashContent(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];
    if (!project.defaultBranchId) return [];

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", project.defaultBranchId))
      .collect();
    return pages.filter((p: any) => !p.aiPendingReview);
  },
});

export const listByGenerationJob = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_generation_job", (q: any) =>
        q.eq("aiGenerationJobId", args.jobId)
      )
      .collect();
  },
});

/** Internal variant for use by Convex actions. */
export const listByGenerationJobInternal = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_generation_job", (q: any) =>
        q.eq("aiGenerationJobId", args.jobId)
      )
      .collect();
  },
});

export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
    return pages.filter((p: any) => !p.aiPendingReview);
  },
});

export const get = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.pageId);
  },
});

export const getContent = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const content = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    return content;
  },
});

export const create = mutation({
  args: {
    branchId: v.id("branches"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Lock guard: prevent changes on locked branches
    const branch = await ctx.db.get(args.branchId);
    if (branch?.isLocked) {
      throw new ConvexError("This branch is locked. Create a feature branch to make changes.");
    }

    const slug = slugify(args.title);

    // Calculate path
    let path = `/${slug}`;
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (folder) {
        path = `${folder.path}/${slug}`;
      }
    }

    // Get max position if not specified — count ALL siblings (pages + folders) to avoid collisions
    let position = args.position;
    if (position === undefined) {
      const siblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .collect();
      const siblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", args.folderId))
        .collect();
      position = siblingPages.length + siblingFolders.length;
    }

    const pageId = await ctx.db.insert("pages", {
      branchId: args.branchId,
      folderId: args.folderId,
      title: args.title,
      slug,
      path,
      position,
      isPublished: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create empty content (title is rendered by TitleSection from metadata)
    await ctx.db.insert("pageContents", {
      pageId,
      content: JSON.stringify([
        {
          type: "paragraph",
          content: [],
        },
      ]),
      updatedAt: Date.now(),
    });

    return pageId;
  },
});

export const update = mutation({
  args: {
    pageId: v.id("pages"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    position: v.optional(v.number()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    subtitle: v.optional(v.union(v.string(), v.null())),
    titleSectionHidden: v.optional(v.boolean()),
    titleIconHidden: v.optional(v.boolean()),
    // Per-page SEO
    seoTitle: v.optional(v.union(v.string(), v.null())),
    seoDescription: v.optional(v.union(v.string(), v.null())),
    ogImageAssetId: v.optional(v.union(v.id("assets"), v.null())),
    noindex: v.optional(v.boolean()),
    // Allow server-side sync operations (e.g. GitHub pull) to bypass branch lock
    skipBranchLock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { pageId, skipBranchLock, ...updates } = args;

    const page = await ctx.db.get(pageId);
    if (!page) throw new Error("Page not found");

    // Lock guard: prevent changes on locked branches
    const branch = await ctx.db.get(page.branchId);
    if (branch?.isLocked && !skipBranchLock) {
      throw new ConvexError("This branch is locked. Create a feature branch to make changes.");
    }

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (updates.title !== undefined) {
      updateData.title = updates.title;
      const slug = updates.slug || slugify(updates.title);
      updateData.slug = slug;

      // Recalculate path
      let path = `/${slug}`;
      const folderId = updates.folderId !== undefined ? updates.folderId : page.folderId;
      if (folderId) {
        const folder = await ctx.db.get(folderId);
        if (folder) {
          path = `${folder.path}/${slug}`;
        }
      }
      updateData.path = path;
    }

    if (updates.isPublished !== undefined) {
      updateData.isPublished = updates.isPublished;
    }

    if (updates.position !== undefined) {
      updateData.position = updates.position;
    }

    if (updates.folderId !== undefined) {
      updateData.folderId = updates.folderId ?? undefined;
    }

    if (updates.icon !== undefined) {
      updateData.icon = updates.icon ?? undefined;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description ?? undefined;
    }

    if (updates.subtitle !== undefined) {
      updateData.subtitle = updates.subtitle ?? undefined;
    }

    if (updates.titleSectionHidden !== undefined) {
      updateData.titleSectionHidden = updates.titleSectionHidden;
    }

    if (updates.titleIconHidden !== undefined) {
      updateData.titleIconHidden = updates.titleIconHidden;
    }

    if (updates.seoTitle !== undefined) {
      updateData.seoTitle = updates.seoTitle ?? undefined;
    }

    if (updates.seoDescription !== undefined) {
      updateData.seoDescription = updates.seoDescription ?? undefined;
    }

    if (updates.ogImageAssetId !== undefined) {
      updateData.ogImageAssetId = updates.ogImageAssetId ?? undefined;
    }

    if (updates.noindex !== undefined) {
      updateData.noindex = updates.noindex;
    }

    await ctx.db.patch(pageId, updateData);
    return pageId;
  },
});

export const updateContent = mutation({
  args: {
    pageId: v.id("pages"),
    content: v.string(),
    updatedBy: v.optional(v.id("users")),
    // Allow server-side sync operations (e.g. GitHub pull) to bypass branch lock
    skipBranchLock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Lock guard: prevent changes on locked branches
    const page = await ctx.db.get(args.pageId);
    if (page) {
      const branch = await ctx.db.get(page.branchId);
      if (branch?.isLocked && !args.skipBranchLock) {
        throw new ConvexError("This branch is locked. Create a feature branch to make changes.");
      }
    }

    const existing = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    let contentId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedAt: Date.now(),
        ...(args.updatedBy ? { updatedBy: args.updatedBy } : {}),
      });
      contentId = existing._id;
    } else {
      contentId = await ctx.db.insert("pageContents", {
        pageId: args.pageId,
        content: args.content,
        updatedAt: Date.now(),
        ...(args.updatedBy ? { updatedBy: args.updatedBy } : {}),
      });
    }

    // Update search index
    if (page) {
      const branch = await ctx.db.get(page.branchId);
      if (branch) {
        await ctx.scheduler.runAfter(0, internal.search.upsertSearchIndex, {
          pageId: args.pageId,
          projectId: branch.projectId,
          title: page.title,
          path: page.path,
          content: args.content,
        });
      }
    }

    return contentId;
  },
});

export const remove = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    // Lock guard: prevent changes on locked branches
    const page = await ctx.db.get(args.pageId);
    if (page) {
      const branch = await ctx.db.get(page.branchId);
      if (branch?.isLocked) {
        throw new ConvexError("This branch is locked. Create a feature branch to make changes.");
      }
    }

    // Delete search index
    await ctx.scheduler.runAfter(0, internal.search.deleteSearchIndex, {
      pageId: args.pageId,
    });

    // Delete content
    const contents = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();
    for (const content of contents) {
      await ctx.db.delete(content._id);
    }

    // Delete versions
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    await ctx.db.delete(args.pageId);
  },
});

export const reorder = mutation({
  args: {
    pageId: v.id("pages"),
    newPosition: v.number(),
    newFolderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) throw new Error("Page not found");

    // Lock guard: prevent changes on locked branches
    const branch = await ctx.db.get(page.branchId);
    if (branch?.isLocked) {
      throw new ConvexError("This branch is locked. Create a feature branch to make changes.");
    }

    const oldFolderId = page.folderId;
    const oldPosition = page.position;
    const targetFolderId = args.newFolderId !== undefined
      ? args.newFolderId
      : page.folderId;

    const movingToNewFolder = args.newFolderId !== undefined &&
      (args.newFolderId ?? undefined) !== (oldFolderId ?? undefined);

    if (movingToNewFolder) {
      // Moving to a different folder
      // 1. Decrement positions in old location for ALL items (pages AND folders) after old position
      const oldSiblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", oldFolderId ?? undefined))
        .collect();
      const oldSiblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", oldFolderId ?? undefined))
        .collect();

      for (const sibling of oldSiblingPages) {
        if (sibling._id === args.pageId) continue;
        if (sibling.position > oldPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position - 1,
            updatedAt: Date.now(),
          });
        }
      }
      for (const sibling of oldSiblingFolders) {
        if (sibling.position > oldPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position - 1,
            updatedAt: Date.now(),
          });
        }
      }

      // 2. Increment positions in new location for ALL items (pages AND folders) at or after new position
      const newSiblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", targetFolderId ?? undefined))
        .collect();
      const newSiblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", targetFolderId ?? undefined))
        .collect();

      for (const sibling of newSiblingPages) {
        if (sibling.position >= args.newPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position + 1,
            updatedAt: Date.now(),
          });
        }
      }
      for (const sibling of newSiblingFolders) {
        if (sibling.position >= args.newPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position + 1,
            updatedAt: Date.now(),
          });
        }
      }
    } else {
      // Moving within the same folder - shift ALL items (pages AND folders)
      const siblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", targetFolderId ?? undefined))
        .collect();
      const siblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", targetFolderId ?? undefined))
        .collect();

      if (args.newPosition > oldPosition) {
        // Moving down: decrement positions of items between old and new (exclusive of old, inclusive of new)
        for (const sibling of siblingPages) {
          if (sibling._id === args.pageId) continue;
          if (sibling.position > oldPosition && sibling.position <= args.newPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position - 1,
              updatedAt: Date.now(),
            });
          }
        }
        for (const sibling of siblingFolders) {
          if (sibling.position > oldPosition && sibling.position <= args.newPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position - 1,
              updatedAt: Date.now(),
            });
          }
        }
      } else if (args.newPosition < oldPosition) {
        // Moving up: increment positions of items between new and old (inclusive of new, exclusive of old)
        for (const sibling of siblingPages) {
          if (sibling._id === args.pageId) continue;
          if (sibling.position >= args.newPosition && sibling.position < oldPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position + 1,
              updatedAt: Date.now(),
            });
          }
        }
        for (const sibling of siblingFolders) {
          if (sibling.position >= args.newPosition && sibling.position < oldPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position + 1,
              updatedAt: Date.now(),
            });
          }
        }
      }
      // else: newPosition === oldPosition — no-op, nothing to shift
    }

    // Update the moved page
    const updateData: Record<string, unknown> = {
      position: args.newPosition,
      updatedAt: Date.now(),
    };

    if (args.newFolderId !== undefined) {
      updateData.folderId = args.newFolderId ?? undefined;

      // Recalculate path
      let path = `/${page.slug}`;
      if (args.newFolderId) {
        const folder = await ctx.db.get(args.newFolderId);
        if (folder) {
          path = `${folder.path}/${page.slug}`;
        }
      }
      updateData.path = path;
    }

    await ctx.db.patch(args.pageId, updateData);

    // Normalize positions for all siblings at the target level to prevent drift
    await normalizePagePositions(ctx, targetFolderId ?? undefined);
    // Also normalize old folder if moved to a new folder
    if (movingToNewFolder) {
      await normalizePagePositions(ctx, oldFolderId ?? undefined);
    }
  },
});

// --- Version History ---

export const createVersion = mutation({
  args: {
    pageId: v.id("pages"),
    createdBy: v.optional(v.id("users")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current content
    const content = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    if (!content) throw new Error("Page has no content");

    // Get max version number
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();

    const maxVersion = versions.reduce((max: any, v: any) => Math.max(max, v.version), 0);

    return await ctx.db.insert("pageVersions", {
      pageId: args.pageId,
      version: maxVersion + 1,
      content: content.content,
      contentHash: hashContent(content.content),
      createdBy: args.createdBy,
      message: args.message,
      createdAt: Date.now(),
    });
  },
});

export const listVersions = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();

    // Sort by version descending, limit to 50
    versions.sort((a: any, b: any) => b.version - a.version);
    const limited = versions.slice(0, 50);

    // Join creator info
    const results = await Promise.all(
      limited.map(async (ver: any) => {
        let creator: { name?: string; avatarUrl?: string } | null = null;
        if (ver.createdBy) {
          const user = await ctx.db.get(ver.createdBy) as { _id: any; name: string; avatarUrl?: string } | null;
          if (user) {
            creator = { name: user.name, avatarUrl: user.avatarUrl };
          }
        }
        return {
          _id: ver._id,
          version: ver.version,
          message: ver.message,
          createdAt: ver.createdAt,
          creator,
        };
      })
    );

    return results;
  },
});

export const getVersion = query({
  args: {
    pageId: v.id("pages"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const ver = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_and_version", (q: any) =>
        q.eq("pageId", args.pageId).eq("version", args.version)
      )
      .unique();

    return ver;
  },
});

// --- API Content Queries/Mutations ---

export const getByBranchAndSlug = query({
  args: {
    branchId: v.id("branches"),
    slug: v.string(),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_branch_folder_slug", (q: any) =>
        q.eq("branchId", args.branchId)
         .eq("folderId", args.folderId)
         .eq("slug", args.slug)
      )
      .first();
  },
});

export const createPage = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    title: v.string(),
    slug: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    position: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
    content: v.optional(v.string()), // JSON string (BlockNote blocks)
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    aiGenerated: v.optional(v.boolean()),
    // Uses v.string() instead of v.id("generationJobs") — generationJobs is a
    // platform-only table. Convex IDs are strings at runtime, so this is safe.
    aiGenerationJobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = args.slug || slugify(args.title);

    // Calculate path
    let path = `/${slug}`;
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (folder) {
        path = `${folder.path}/${slug}`;
      }
    }

    // Get max position if not specified — count ALL siblings (pages + folders) to avoid collisions
    let position = args.position;
    if (position === undefined) {
      const siblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .collect();
      const siblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", args.folderId))
        .collect();
      position = siblingPages.length + siblingFolders.length;
    }

    const pageId = await ctx.db.insert("pages", {
      branchId: args.branchId,
      folderId: args.folderId,
      title: args.title,
      slug,
      path,
      position,
      isPublished: args.isPublished ?? false,
      description: args.description,
      icon: args.icon,
      aiGenerated: args.aiGenerated,
      aiGenerationJobId: args.aiGenerationJobId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create content (use provided content or default empty — title rendered by TitleSection)
    const contentStr = args.content || JSON.stringify([
      {
        type: "paragraph",
        content: [],
      },
    ]);

    await ctx.db.insert("pageContents", {
      pageId,
      content: contentStr,
      updatedAt: Date.now(),
    });

    // Update search index
    const branch = await ctx.db.get(args.branchId);
    if (branch) {
      await ctx.scheduler.runAfter(0, internal.search.upsertSearchIndex, {
        pageId,
        projectId: args.projectId,
        title: args.title,
        path,
        content: contentStr,
      });
    }

    return pageId;
  },
});

export const deletePage = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    // Delete search index
    await ctx.scheduler.runAfter(0, internal.search.deleteSearchIndex, {
      pageId: args.pageId,
    });

    // Delete content
    const contents = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();
    for (const content of contents) {
      await ctx.db.delete(content._id);
    }

    // Delete versions
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    await ctx.db.delete(args.pageId);
  },
});

export const restoreVersion = mutation({
  args: {
    pageId: v.id("pages"),
    version: v.number(),
    restoredBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Get the version to restore
    const ver = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_and_version", (q: any) =>
        q.eq("pageId", args.pageId).eq("version", args.version)
      )
      .unique();

    if (!ver) throw new Error("Version not found");

    // Snapshot current content before restoring
    const currentContent = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    if (currentContent) {
      // Only auto-save if no existing version already has the same content.
      // This prevents duplicates when restoring back and forth between versions
      // without making edits in between (e.g. restore v1 → restore v3 shouldn't
      // auto-save a copy of v1 since v1 already exists).
      const existingVersions = await ctx.db
        .query("pageVersions")
        .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
        .collect();
      const maxVersion = existingVersions.reduce((max: any, v: any) => Math.max(max, v.version), 0);

      const currentHash = hashContent(currentContent.content);
      const contentAlreadySaved = existingVersions.some(
        (v: any) => (v.contentHash ?? hashContent(v.content)) === currentHash
      );

      if (!contentAlreadySaved) {
        await ctx.db.insert("pageVersions", {
          pageId: args.pageId,
          version: maxVersion + 1,
          content: currentContent.content,
          contentHash: currentHash,
          createdBy: args.restoredBy,
          message: "Auto-saved before restore",
          createdAt: Date.now(),
        });
      }

      // Overwrite content with the restored version
      await ctx.db.patch(currentContent._id, {
        content: ver.content,
        updatedAt: Date.now(),
        ...(args.restoredBy ? { updatedBy: args.restoredBy } : {}),
      });
    }

    // Update search index
    const page = await ctx.db.get(args.pageId);
    if (page) {
      const branch = await ctx.db.get(page.branchId);
      if (branch) {
        await ctx.scheduler.runAfter(0, internal.search.upsertSearchIndex, {
          pageId: args.pageId,
          projectId: branch.projectId,
          title: page.title,
          path: page.path,
          content: ver.content,
        });
      }
    }

    return ver.content;
  },
});

// ─── Internal variants for Convex actions ─────────────────────

/** Internal variant of getContent for use by Convex actions. */
export const getContentInternal = internalQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();
  },
});

/** Internal variant of createPage for use by Convex actions. */
export const createPageInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    title: v.string(),
    slug: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    content: v.optional(v.string()),
    aiGenerated: v.optional(v.boolean()),
    // Uses v.string() instead of v.id("generationJobs") — generationJobs is a
    // platform-only table. Convex IDs are strings at runtime, so this is safe.
    aiGenerationJobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = args.slug || slugify(args.title);

    let path = `/${slug}`;
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (folder) {
        path = `${folder.path}/${slug}`;
      }
    }

    const siblings = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
    const position = siblings.length;

    const pageId = await ctx.db.insert("pages", {
      branchId: args.branchId,
      folderId: args.folderId,
      title: args.title,
      slug,
      path,
      position,
      isPublished: false,
      aiGenerated: args.aiGenerated,
      aiGenerationJobId: args.aiGenerationJobId,
      aiPendingReview: args.aiGenerated ? true : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const contentStr = args.content || JSON.stringify([
      {
        type: "paragraph",
        content: [],
      },
    ]);

    await ctx.db.insert("pageContents", {
      pageId,
      content: contentStr,
      updatedAt: Date.now(),
    });

    // Skip search index for AI pending review pages — indexed on approval
    if (!args.aiGenerated) {
      await ctx.scheduler.runAfter(0, internal.search.upsertSearchIndex, {
        pageId,
        projectId: args.projectId,
        title: args.title,
        path,
        content: contentStr,
      });
    }

    return pageId;
  },
});

/** Internal variant of update for use by Convex actions. */
export const updateInternal = internalMutation({
  args: {
    pageId: v.id("pages"),
    title: v.optional(v.string()),
    subtitle: v.optional(v.union(v.string(), v.null())),
    titleSectionHidden: v.optional(v.boolean()),
    titleIconHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) throw new Error("Page not found");

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      updateData.title = args.title;
      const slug = slugify(args.title);
      updateData.slug = slug;

      let path = `/${slug}`;
      if (page.folderId) {
        const folder = await ctx.db.get(page.folderId);
        if (folder) {
          path = `${folder.path}/${slug}`;
        }
      }
      updateData.path = path;
    }

    if (args.subtitle !== undefined) {
      updateData.subtitle = args.subtitle ?? undefined;
    }

    if (args.titleSectionHidden !== undefined) {
      updateData.titleSectionHidden = args.titleSectionHidden;
    }

    if (args.titleIconHidden !== undefined) {
      updateData.titleIconHidden = args.titleIconHidden;
    }

    await ctx.db.patch(args.pageId, updateData);
  },
});

/** Internal variant of updateContent for use by Convex actions. */
export const updateContentInternal = internalMutation({
  args: {
    pageId: v.id("pages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("pageContents", {
        pageId: args.pageId,
        content: args.content,
        updatedAt: Date.now(),
      });
    }
  },
});
