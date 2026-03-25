import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
