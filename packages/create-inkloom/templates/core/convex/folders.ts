import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * List all folders for a given branch, ordered by name.
 */
export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
    // Sort by name ascending
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Create a new folder.
 */
export const create = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = slugify(args.name);

    // Calculate path from parent
    let path = `/${slug}`;
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) {
        path = `${parent.path}/${slug}`;
      }
    }

    // Determine position: count siblings (folders + pages) under same parent
    const siblingFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
    const siblingPages = await ctx.db
      .query("pages")
      .withIndex("by_folder", (q) => q.eq("folderId", args.parentId))
      .collect();
    const position = siblingFolders.length + siblingPages.length;

    return await ctx.db.insert("folders", {
      branchId: args.branchId,
      parentId: args.parentId,
      name: args.name,
      slug,
      path,
      position,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Rename a folder, updating its slug and path.
 */
export const rename = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    const slug = slugify(args.name);

    // Recalculate path
    let path = `/${slug}`;
    if (folder.parentId) {
      const parent = await ctx.db.get(folder.parentId);
      if (parent) {
        path = `${parent.path}/${slug}`;
      }
    }

    const oldPath = folder.path;

    await ctx.db.patch(args.folderId, {
      name: args.name,
      slug,
      path,
      updatedAt: Date.now(),
    });

    // Update descendant folder paths
    if (path !== oldPath) {
      const allFolders = await ctx.db
        .query("folders")
        .withIndex("by_branch", (q) => q.eq("branchId", folder.branchId))
        .collect();

      for (const child of allFolders) {
        if (child._id !== args.folderId && child.path.startsWith(oldPath + "/")) {
          const newChildPath = path + child.path.slice(oldPath.length);
          await ctx.db.patch(child._id, {
            path: newChildPath,
            updatedAt: Date.now(),
          });
        }
      }

      // Update descendant page paths
      const allPages = await ctx.db
        .query("pages")
        .withIndex("by_branch", (q) => q.eq("branchId", folder.branchId))
        .collect();

      for (const page of allPages) {
        if (page.path.startsWith(oldPath + "/")) {
          const newPagePath = path + page.path.slice(oldPath.length);
          await ctx.db.patch(page._id, {
            path: newPagePath,
            updatedAt: Date.now(),
          });
        }
      }
    }
  },
});

/**
 * Remove a folder. Moves child pages to the parent folder (or root).
 */
export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    // Move child pages to parent folder (or root)
    const childPages = await ctx.db
      .query("pages")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    for (const page of childPages) {
      // Recalculate path under new parent
      let newPath = `/${page.slug}`;
      if (folder.parentId) {
        const parent = await ctx.db.get(folder.parentId);
        if (parent) {
          newPath = `${parent.path}/${page.slug}`;
        }
      }
      await ctx.db.patch(page._id, {
        folderId: folder.parentId,
        path: newPath,
        updatedAt: Date.now(),
      });
    }

    // Move child folders to parent folder (or root)
    const childFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.folderId))
      .collect();

    for (const child of childFolders) {
      let newPath = `/${child.slug}`;
      if (folder.parentId) {
        const parent = await ctx.db.get(folder.parentId);
        if (parent) {
          newPath = `${parent.path}/${child.slug}`;
        }
      }
      await ctx.db.patch(child._id, {
        parentId: folder.parentId,
        path: newPath,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.folderId);
  },
});

/**
 * Move (reparent) a folder.
 */
export const move = mutation({
  args: {
    folderId: v.id("folders"),
    parentId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    // Calculate new path
    let newPath = `/${folder.slug}`;
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) {
        newPath = `${parent.path}/${folder.slug}`;
      }
    }

    const oldPath = folder.path;

    await ctx.db.patch(args.folderId, {
      parentId: args.parentId,
      path: newPath,
      updatedAt: Date.now(),
    });

    // Update descendant paths if the path changed
    if (newPath !== oldPath) {
      const allFolders = await ctx.db
        .query("folders")
        .withIndex("by_branch", (q) => q.eq("branchId", folder.branchId))
        .collect();

      for (const child of allFolders) {
        if (child._id !== args.folderId && child.path.startsWith(oldPath + "/")) {
          const updatedPath = newPath + child.path.slice(oldPath.length);
          await ctx.db.patch(child._id, {
            path: updatedPath,
            updatedAt: Date.now(),
          });
        }
      }

      const allPages = await ctx.db
        .query("pages")
        .withIndex("by_branch", (q) => q.eq("branchId", folder.branchId))
        .collect();

      for (const page of allPages) {
        if (page.path.startsWith(oldPath + "/")) {
          const updatedPath = newPath + page.path.slice(oldPath.length);
          await ctx.db.patch(page._id, {
            path: updatedPath,
            updatedAt: Date.now(),
          });
        }
      }
    }
  },
});
