/**
 * Core-mode project members functions for OSS single-tenant operation.
 *
 * In core mode, there's a single local user with full access to all
 * projects. The membership system is simplified:
 * - `hasAccess` always returns true for the local user
 * - `getRole` always returns "admin" for the local user
 * - `listAccessibleProjects` returns all projects (no org filter)
 *
 * After the core/platform restructure, these will become the main
 * implementations in `core/apps/web/convex/projectMembers.ts`.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Check if a user has access to a project (core mode).
 *
 * In single-tenant mode, the local user always has access.
 */
export const hasAccess = query({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // In core mode, check if a membership exists.
    // If the user is the local user, they always have access.
    const user = await ctx.db.get(args.userId);
    if (user?.workosUserId === "local") {
      return true;
    }

    // Fall back to checking explicit membership
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q: any) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .unique();

    return membership !== null;
  },
});

/**
 * Get the user's role in a project (core mode).
 *
 * The local user is always "admin". Other users fall back to their
 * explicit membership role.
 */
export const getRole = query({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Local user is always admin
    const user = await ctx.db.get(args.userId);
    if (user?.workosUserId === "local") {
      return "admin" as const;
    }

    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q: any) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .unique();

    return membership?.role ?? null;
  },
});

/**
 * List all projects accessible to the user (core mode).
 *
 * In single-tenant mode, all projects are accessible — no org filter needed.
 */
export const listAccessibleProjects = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .order("desc")
      .collect();
  },
});
