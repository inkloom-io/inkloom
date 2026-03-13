import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Re-normalizes positions for all items (folders and pages) at a given level
 * to contiguous 0, 1, 2, ... values. Prevents position drift from edge cases.
 */
async function normalizePositions(
  ctx: MutationCtx,
  parentFolderId: Id<"folders"> | undefined,
) {
  const siblingFolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentId", parentFolderId))
    .collect();
  const siblingPages = await ctx.db
    .query("pages")
    .withIndex("by_folder", (q: any) => q.eq("folderId", parentFolderId))
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

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project?.defaultBranchId) return [];

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", project.defaultBranchId!))
      .collect();
    return folders.filter((f: any) => !f.aiPendingReview);
  },
});

export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
    return folders.filter((f: any) => !f.aiPendingReview);
  },
});

/** Internal variant for use by Convex actions. */
export const listByBranchInternal = internalQuery({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folders")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();
  },
});

export const get = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.folderId);
  },
});

export const create = mutation({
  args: {
    branchId: v.id("branches"),
    parentId: v.optional(v.id("folders")),
    name: v.string(),
    position: v.optional(v.number()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);

    // Calculate path
    let path = `/${slug}`;
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) {
        path = `${parent.path}/${slug}`;
      }
    }

    // Get max position if not specified — count ALL siblings (pages + folders) to avoid collisions
    let position = args.position;
    if (position === undefined) {
      const siblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", args.parentId))
        .collect();
      const siblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.parentId))
        .collect();
      position = siblingFolders.length + siblingPages.length;
    }

    return await ctx.db.insert("folders", {
      branchId: args.branchId,
      parentId: args.parentId,
      name: args.name,
      slug,
      path,
      position,
      icon: args.icon,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Internal variant for use by Convex actions. */
export const createInternal = internalMutation({
  args: {
    branchId: v.id("branches"),
    name: v.string(),
    // Uses v.string() instead of v.id("generationJobs") — generationJobs is a
    // platform-only table. Convex IDs are strings at runtime, so this is safe.
    aiGenerationJobId: v.optional(v.string()),
    aiPendingReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);
    const path = `/${slug}`;
    const siblings = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q: any) => q.eq("parentId", undefined))
      .collect();
    const position = siblings.length;

    return await ctx.db.insert("folders", {
      branchId: args.branchId,
      name: args.name,
      slug,
      path,
      position,
      aiGenerationJobId: args.aiGenerationJobId,
      aiPendingReview: args.aiPendingReview,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    position: v.optional(v.number()),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { folderId, ...updates } = args;

    const folder = await ctx.db.get(folderId);
    if (!folder) throw new Error("Folder not found");

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    // Determine the slug (use updated name if provided, otherwise existing)
    const slug = updates.name !== undefined ? slugify(updates.name) : folder.slug;

    if (updates.name !== undefined) {
      updateData.name = updates.name;
      updateData.slug = slug;
    }

    // Recalculate path if name OR parentId changes
    if (updates.name !== undefined || updates.parentId !== undefined) {
      let path = `/${slug}`;
      const parentId =
        updates.parentId !== undefined ? updates.parentId : folder.parentId;
      if (parentId) {
        const parent = await ctx.db.get(parentId);
        if (parent) {
          path = `${parent.path}/${slug}`;
        }
      }
      updateData.path = path;

      // Also update paths of all descendant folders and pages
      if (updateData.path !== folder.path) {
        const oldPath = folder.path;
        const newPath = updateData.path as string;

        // Update child folders recursively
        const allFolders = await ctx.db
          .query("folders")
          .withIndex("by_branch", (q: any) => q.eq("branchId", folder.branchId))
          .collect();

        for (const childFolder of allFolders) {
          if (childFolder._id !== folderId && childFolder.path.startsWith(oldPath + "/")) {
            const newChildPath = newPath + childFolder.path.slice(oldPath.length);
            await ctx.db.patch(childFolder._id, {
              path: newChildPath,
              updatedAt: Date.now(),
            });
          }
        }

        // Update pages that start with the old path
        const allPages = await ctx.db
          .query("pages")
          .withIndex("by_branch", (q: any) => q.eq("branchId", folder.branchId))
          .collect();

        for (const page of allPages) {
          if (page.path.startsWith(oldPath + "/")) {
            const newPagePath = newPath + page.path.slice(oldPath.length);
            await ctx.db.patch(page._id, {
              path: newPagePath,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    if (updates.position !== undefined) {
      updateData.position = updates.position;
    }

    if (updates.parentId !== undefined) {
      updateData.parentId = updates.parentId ?? undefined;
    }

    if (updates.icon !== undefined) {
      updateData.icon = updates.icon ?? undefined;
    }

    await ctx.db.patch(folderId, updateData);
    return folderId;
  },
});

async function deleteFolderRecursive(
  ctx: MutationCtx,
  folderId: Id<"folders">
) {
  // Get all child folders
  const childFolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentId", folderId))
    .collect();

  // Recursively delete child folders
  for (const child of childFolders) {
    await deleteFolderRecursive(ctx, child._id);
  }

  // Delete pages in this folder
  const pages = await ctx.db
    .query("pages")
    .withIndex("by_folder", (q: any) => q.eq("folderId", folderId))
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

    await ctx.db.delete(page._id);
  }

  await ctx.db.delete(folderId);
}

export const getByBranchParentAndSlug = query({
  args: {
    branchId: v.id("branches"),
    parentId: v.optional(v.id("folders")),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q: any) => q.eq("parentId", args.parentId))
      .collect();

    return folders.find(
      (f: any) => f.branchId === args.branchId && f.slug === args.slug
    ) ?? null;
  },
});

export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    await deleteFolderRecursive(ctx, args.folderId);
  },
});

// Alias for plan compatibility — `deleteRecursive` is the same as `remove`
export const deleteRecursive = remove;

// Helper to check if a folder is a descendant of another folder
async function isDescendantOf(
  ctx: MutationCtx,
  folderId: Id<"folders">,
  potentialAncestorId: Id<"folders">
): Promise<boolean> {
  const folder = await ctx.db.get(folderId);
  if (!folder) return false;
  if (!folder.parentId) return false;
  if (folder.parentId === potentialAncestorId) return true;
  return isDescendantOf(ctx, folder.parentId, potentialAncestorId);
}

// Helper to recursively update paths when a folder is moved
async function updateDescendantPaths(
  ctx: MutationCtx,
  folderId: Id<"folders">,
  newParentPath: string
): Promise<void> {
  const folder = await ctx.db.get(folderId);
  if (!folder) return;

  const newPath = `${newParentPath}/${folder.slug}`;
  await ctx.db.patch(folderId, { path: newPath, updatedAt: Date.now() });

  // Update child folders
  const childFolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentId", folderId))
    .collect();

  for (const child of childFolders) {
    await updateDescendantPaths(ctx, child._id, newPath);
  }

  // Update pages in this folder
  const pages = await ctx.db
    .query("pages")
    .withIndex("by_folder", (q: any) => q.eq("folderId", folderId))
    .collect();

  for (const page of pages) {
    await ctx.db.patch(page._id, {
      path: `${newPath}/${page.slug}`,
      updatedAt: Date.now(),
    });
  }
}

export const reorder = mutation({
  args: {
    folderId: v.id("folders"),
    newPosition: v.number(),
    newParentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    const oldParentId = folder.parentId;
    const oldPosition = folder.position;
    const targetParentId = args.newParentId !== undefined
      ? args.newParentId
      : folder.parentId;

    // Prevent circular references: cannot move folder into itself or its descendants
    if (targetParentId) {
      if (targetParentId === args.folderId) {
        throw new Error("Cannot move a folder into itself");
      }
      if (await isDescendantOf(ctx, targetParentId, args.folderId)) {
        throw new Error("Cannot move a folder into one of its descendants");
      }
    }

    const movingToNewParent = args.newParentId !== undefined &&
      (args.newParentId ?? undefined) !== (oldParentId ?? undefined);

    if (movingToNewParent) {
      // Moving to a different parent
      // 1. Decrement positions in old location for ALL items (folders AND pages) after old position
      const oldSiblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", oldParentId ?? undefined))
        .collect();
      const oldSiblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", oldParentId ?? undefined))
        .collect();

      for (const sibling of oldSiblingFolders) {
        if (sibling._id === args.folderId) continue;
        if (sibling.position > oldPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position - 1,
            updatedAt: Date.now(),
          });
        }
      }
      for (const sibling of oldSiblingPages) {
        if (sibling.position > oldPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position - 1,
            updatedAt: Date.now(),
          });
        }
      }

      // 2. Increment positions in new location for ALL items (folders AND pages) at or after new position
      const newSiblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", targetParentId ?? undefined))
        .collect();
      const newSiblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", targetParentId ?? undefined))
        .collect();

      for (const sibling of newSiblingFolders) {
        if (sibling.position >= args.newPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position + 1,
            updatedAt: Date.now(),
          });
        }
      }
      for (const sibling of newSiblingPages) {
        if (sibling.position >= args.newPosition) {
          await ctx.db.patch(sibling._id, {
            position: sibling.position + 1,
            updatedAt: Date.now(),
          });
        }
      }
    } else {
      // Moving within the same parent - shift ALL items (folders AND pages)
      const siblingFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", targetParentId ?? undefined))
        .collect();
      const siblingPages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", targetParentId ?? undefined))
        .collect();

      if (args.newPosition > oldPosition) {
        // Moving down: decrement positions of items between old and new
        for (const sibling of siblingFolders) {
          if (sibling._id === args.folderId) continue;
          if (sibling.position > oldPosition && sibling.position <= args.newPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position - 1,
              updatedAt: Date.now(),
            });
          }
        }
        for (const sibling of siblingPages) {
          if (sibling.position > oldPosition && sibling.position <= args.newPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position - 1,
              updatedAt: Date.now(),
            });
          }
        }
      } else if (args.newPosition < oldPosition) {
        // Moving up: increment positions of items between new and old
        for (const sibling of siblingFolders) {
          if (sibling._id === args.folderId) continue;
          if (sibling.position >= args.newPosition && sibling.position < oldPosition) {
            await ctx.db.patch(sibling._id, {
              position: sibling.position + 1,
              updatedAt: Date.now(),
            });
          }
        }
        for (const sibling of siblingPages) {
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

    // Calculate new path
    let newPath = `/${folder.slug}`;
    if (targetParentId) {
      const parent = await ctx.db.get(targetParentId);
      if (parent) {
        newPath = `${parent.path}/${folder.slug}`;
      }
    }

    // Update the moved folder
    await ctx.db.patch(args.folderId, {
      position: args.newPosition,
      parentId: targetParentId ?? undefined,
      path: newPath,
      updatedAt: Date.now(),
    });

    // Update paths of all descendants if parent changed
    if (args.newParentId !== undefined) {
      // Update child folders
      const childFolders = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q: any) => q.eq("parentId", args.folderId))
        .collect();

      for (const child of childFolders) {
        await updateDescendantPaths(ctx, child._id, newPath);
      }

      // Update pages in this folder
      const pages = await ctx.db
        .query("pages")
        .withIndex("by_folder", (q: any) => q.eq("folderId", args.folderId))
        .collect();

      for (const page of pages) {
        await ctx.db.patch(page._id, {
          path: `${newPath}/${page.slug}`,
          updatedAt: Date.now(),
        });
      }
    }

    // Normalize positions for all siblings at the target level to prevent drift
    await normalizePositions(ctx, targetParentId ?? undefined);
    // Also normalize old parent if moved to a new parent
    if (movingToNewParent) {
      await normalizePositions(ctx, oldParentId ?? undefined);
    }
  },
});
