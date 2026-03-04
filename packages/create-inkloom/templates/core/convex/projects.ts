import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const LOCAL_ORG_ID = "local";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * List all projects.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("projects").order("desc").collect();
  },
});

/**
 * Get a single project.
 */
export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

/**
 * Create a new project with a default "main" branch.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = slugify(args.name);

    const projectId = await ctx.db.insert("projects", {
      workosOrgId: LOCAL_ORG_ID,
      name: args.name,
      slug,
      description: args.description,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create default branch
    const branchId = await ctx.db.insert("branches", {
      projectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(projectId, { defaultBranchId: branchId });

    // Assign local user as admin
    const localUser = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", "local"))
      .first();

    if (localUser) {
      await ctx.db.insert("projectMembers", {
        projectId,
        userId: localUser._id,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create a welcome page
    const pageId = await ctx.db.insert("pages", {
      branchId,
      title: "Welcome",
      slug: "welcome",
      path: "/welcome",
      position: 0,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("pageContents", {
      pageId,
      content: JSON.stringify([
        {
          id: "welcome-1",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "Welcome to your new documentation project! Start editing this page to get started.",
              styles: {},
            },
          ],
          children: [],
        },
      ]),
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Update a project.
 */
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a project and all associated data.
 */
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Delete branches, pages, contents, folders, members
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const branch of branches) {
      const pages = await ctx.db
        .query("pages")
        .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
        .collect();
      for (const page of pages) {
        const contents = await ctx.db
          .query("pageContents")
          .withIndex("by_page", (q) => q.eq("pageId", page._id))
          .collect();
        for (const content of contents) await ctx.db.delete(content._id);
        await ctx.db.delete(page._id);
      }

      const folders = await ctx.db
        .query("folders")
        .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
        .collect();
      for (const folder of folders) await ctx.db.delete(folder._id);

      await ctx.db.delete(branch._id);
    }

    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const member of members) await ctx.db.delete(member._id);

    await ctx.db.delete(args.id);
  },
});
