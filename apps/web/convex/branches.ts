import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

// DJB2 hash for content fingerprinting
function hashContent(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Generate a random block ID for cloned content to avoid ID collisions
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

// Regenerate all block IDs in content JSON to avoid collisions with source blocks
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
    // If parsing fails, return original content unchanged
    return contentJson;
  }
}

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .collect();
    return branches.filter((b: any) => !b.deletedAt);
  },
});

export const get = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.branchId);
  },
});

export const getByName = query({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, args) => {
    const branch = await ctx.db
      .query("branches")
      .withIndex("by_project_and_name", (q: any) =>
        q.eq("projectId", args.projectId).eq("name", args.name)
      )
      .first();
    // Skip soft-deleted branches
    if (branch?.deletedAt) return null;
    return branch;
  },
});

// Deep-normalize content JSON for comparison: recursively strip all `id`
// fields and sort object keys so that cloned content (with regenerated IDs
// and potentially reordered properties from editor re-serialization)
// produces the same hash as the original when semantically identical.
function normalizeForHash(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(normalizeForHash);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(obj as Record<string, unknown>)
      .filter(([key]) => key !== "id")
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of entries) {
      result[key] = normalizeForHash(value);
    }
    return result;
  }
  return obj;
}

function hashContentNormalized(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    return hashContent(JSON.stringify(normalizeForHash(parsed)));
  } catch {
    return hashContent(contentJson);
  }
}

export const hasChanges = query({
  args: {
    branchId: v.id("branches"),
    compareToBranchId: v.id("branches"),
  },
  handler: async (ctx, args) => {
    const sourcePages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
    const targetPages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.compareToBranchId))
      .collect();

    const targetPageMap = new Map<string, any>(targetPages.map((p: any) => [p.path, p]));
    const sourcePageMap = new Map<string, any>(sourcePages.map((p: any) => [p.path, p]));

    // Check for added or removed pages
    for (const sp of sourcePages) {
      if (!targetPageMap.has(sp.path)) return true;
    }
    for (const tp of targetPages) {
      if (!sourcePageMap.has(tp.path)) return true;
    }

    // Check for content changes on matching pages
    for (const sp of sourcePages) {
      const tp = targetPageMap.get(sp.path);
      if (!tp) continue;

      // Title or description change
      if (sp.title !== tp.title || sp.description !== tp.description) return true;

      const sourceContent = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", sp._id))
        .unique();
      const targetContent = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", tp._id))
        .unique();

      const sourceHash = sourceContent ? hashContentNormalized(sourceContent.content) : "";
      const targetHash = targetContent ? hashContentNormalized(targetContent.content) : "";
      if (sourceHash !== targetHash) return true;
    }

    return false;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    sourceBranchId: v.id("branches"),
  },
  handler: async (ctx, args) => {
    // Validate name format: lowercase, alphanumeric, hyphens
    const nameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    const normalizedName = args.name.toLowerCase().trim();
    if (!nameRegex.test(normalizedName)) {
      throw new Error(
        "Branch name must be lowercase alphanumeric with hyphens, cannot start or end with a hyphen"
      );
    }

    // Validate name uniqueness (skip soft-deleted branches)
    const existing = await ctx.db
      .query("branches")
      .withIndex("by_project_and_name", (q: any) =>
        q.eq("projectId", args.projectId).eq("name", normalizedName)
      )
      .first();

    if (existing && !existing.deletedAt) {
      throw new Error(`A branch named "${normalizedName}" already exists`);
    }

    // Insert new branch with source reference
    const branchId = await ctx.db.insert("branches", {
      projectId: args.projectId,
      name: normalizedName,
      isDefault: false,
      isLocked: false,
      sourceBranchId: args.sourceBranchId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Deep-clone folders from source branch
    const sourceFolders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.sourceBranchId))
      .collect();

    const folderIdMap = new Map<Id<"folders">, Id<"folders">>();

    // First pass: insert all folders (without parentId remapping)
    for (const folder of sourceFolders) {
      const newFolderId = await ctx.db.insert("folders", {
        branchId,
        name: folder.name,
        slug: folder.slug,
        path: folder.path,
        position: folder.position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      folderIdMap.set(folder._id, newFolderId);
    }

    // Second pass: patch parentId references
    for (const folder of sourceFolders) {
      if (folder.parentId) {
        const newFolderId = folderIdMap.get(folder._id);
        const newParentId = folderIdMap.get(folder.parentId);
        if (newFolderId && newParentId) {
          await ctx.db.patch(newFolderId, { parentId: newParentId });
        }
      }
    }

    // Deep-clone pages from source branch
    const sourcePages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.sourceBranchId))
      .collect();

    for (const page of sourcePages) {
      const newFolderId = page.folderId
        ? folderIdMap.get(page.folderId)
        : undefined;

      const newPageId = await ctx.db.insert("pages", {
        branchId,
        folderId: newFolderId,
        title: page.title,
        slug: page.slug,
        path: page.path,
        position: page.position,
        isPublished: page.isPublished,
        description: page.description,
        icon: page.icon,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Clone page content
      const content = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .unique();

      if (content) {
        await ctx.db.insert("pageContents", {
          pageId: newPageId,
          content: regenerateBlockIds(content.content),
          updatedAt: Date.now(),
        });
      }
    }

    // Create fork-point snapshot for future three-way merge
    const pageHashes: Record<string, string> = {};
    for (const page of sourcePages) {
      const content = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .unique();
      if (content) {
        pageHashes[page.path] = hashContent(content.content);
      }
    }

    const folderPaths = sourceFolders.map((f: any) => f.path);

    await ctx.db.insert("branchSnapshots", {
      branchId,
      sourceBranchId: args.sourceBranchId,
      pageHashes: JSON.stringify(pageHashes),
      folderPaths: JSON.stringify(folderPaths),
      createdAt: Date.now(),
    });

    return branchId;
  },
});

export const rename = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");
    if (branch.isDefault) throw new Error("Cannot rename the default branch");

    const nameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    const normalizedName = args.name.toLowerCase().trim();
    if (!nameRegex.test(normalizedName)) {
      throw new Error(
        "Branch name must be lowercase alphanumeric with hyphens"
      );
    }

    // Check uniqueness (skip soft-deleted branches)
    const existing = await ctx.db
      .query("branches")
      .withIndex("by_project_and_name", (q: any) =>
        q.eq("projectId", branch.projectId).eq("name", normalizedName)
      )
      .first();

    if (existing && existing._id !== args.branchId && !existing.deletedAt) {
      throw new Error(`A branch named "${normalizedName}" already exists`);
    }

    await ctx.db.patch(args.branchId, {
      name: normalizedName,
      updatedAt: Date.now(),
    });

    return args.branchId;
  },
});

/**
 * Rename the default branch. Unlike `rename`, this does NOT check `isDefault`
 * so it can be used during GitHub connection setup to align the branch name
 * with the repository's default branch.
 */
export const renameDefault = internalMutation({
  args: {
    branchId: v.id("branches"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");

    const nameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    const normalizedName = args.name.toLowerCase().trim();
    if (!nameRegex.test(normalizedName)) {
      throw new Error(
        "Branch name must be lowercase alphanumeric with hyphens"
      );
    }

    // Check uniqueness (skip soft-deleted branches)
    const existing = await ctx.db
      .query("branches")
      .withIndex("by_project_and_name", (q: any) =>
        q.eq("projectId", branch.projectId).eq("name", normalizedName)
      )
      .first();

    if (existing && existing._id !== args.branchId && !existing.deletedAt) {
      throw new Error(`A branch named "${normalizedName}" already exists`);
    }

    await ctx.db.patch(args.branchId, {
      name: normalizedName,
      updatedAt: Date.now(),
    });

    return args.branchId;
  },
});

export const remove = mutation({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");
    if (branch.isDefault) throw new Error("Cannot delete the default branch");

    // Cascade delete pages and their related data
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();

    for (const page of pages) {
      // Delete page contents
      const contents = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .collect();
      for (const content of contents) {
        await ctx.db.delete(content._id);
      }

      // Delete page versions
      const versions = await ctx.db
        .query("pageVersions")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }

      // Delete search index entries
      const searchEntries = await ctx.db
        .query("searchIndex")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .collect();
      for (const entry of searchEntries) {
        await ctx.db.delete(entry._id);
      }

      // Delete comment threads and comments
      const threads = await ctx.db
        .query("commentThreads")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .collect();
      for (const thread of threads) {
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_thread", (q: any) => q.eq("threadId", thread._id))
          .collect();
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
        await ctx.db.delete(thread._id);
      }

      await ctx.db.delete(page._id);
    }

    // Delete folders
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
    for (const folder of folders) {
      await ctx.db.delete(folder._id);
    }

    // Delete branch
    await ctx.db.delete(args.branchId);
  },
});
