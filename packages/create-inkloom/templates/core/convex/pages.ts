import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Count pages for a given branch.
 */
export const countByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
    return pages.length;
  },
});

/**
 * List all pages for a given branch.
 */
export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
  },
});

/**
 * Get the content for a page.
 */
export const getContent = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pageContents")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .first();
  },
});

/**
 * Update the content of a page.
 */
export const updateContent = mutation({
  args: {
    pageId: v.id("pages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .first();

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

/**
 * List published pages for a branch.
 */
export const listPublishedByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
    return pages.filter((p) => p.isPublished === true);
  },
});

/**
 * Update page metadata. Recalculates path if slug changes.
 */
export const updateMeta = mutation({
  args: {
    pageId: v.id("pages"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) throw new Error("Page not found");

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.title !== undefined) updateData.title = args.title;
    if (args.icon !== undefined) updateData.icon = args.icon;
    if (args.isPublished !== undefined) updateData.isPublished = args.isPublished;
    if (args.seoTitle !== undefined) updateData.seoTitle = args.seoTitle;
    if (args.seoDescription !== undefined)
      updateData.seoDescription = args.seoDescription;

    if (args.slug !== undefined) {
      const newSlug = args.slug;
      updateData.slug = newSlug;

      // Recalculate path from slug
      let path = `/${newSlug}`;
      if (page.folderId) {
        const folder = await ctx.db.get(page.folderId);
        if (folder) {
          path = `${folder.path}/${newSlug}`;
        }
      }
      updateData.path = path;
    }

    await ctx.db.patch(args.pageId, updateData);
  },
});

/**
 * Move a page to a new position and/or folder.
 */
export const move = mutation({
  args: {
    pageId: v.id("pages"),
    position: v.optional(v.number()),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) throw new Error("Page not found");

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.position !== undefined) {
      updateData.position = args.position;
    }

    if (args.folderId !== undefined) {
      updateData.folderId = args.folderId;

      // Recalculate path
      let path = `/${page.slug}`;
      const folder = await ctx.db.get(args.folderId);
      if (folder) {
        path = `${folder.path}/${page.slug}`;
      }
      updateData.path = path;
    }

    await ctx.db.patch(args.pageId, updateData);
  },
});

/**
 * Delete a page and its pageContents record.
 */
export const remove = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    // Delete page contents
    const contents = await ctx.db
      .query("pageContents")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    for (const content of contents) {
      await ctx.db.delete(content._id);
    }

    await ctx.db.delete(args.pageId);
  },
});

/**
 * Create a new page in a branch.
 */
export const create = mutation({
  args: {
    branchId: v.id("branches"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = slugify(args.title);

    // Determine next position
    const existingPages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
    const position = existingPages.length;

    const pageId = await ctx.db.insert("pages", {
      branchId: args.branchId,
      title: args.title,
      slug,
      path: `/${slug}`,
      position,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create empty content
    await ctx.db.insert("pageContents", {
      pageId,
      content: JSON.stringify([
        {
          id: `${slug}-1`,
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "",
              styles: {},
            },
          ],
          children: [],
        },
      ]),
      updatedAt: now,
    });

    return pageId;
  },
});
