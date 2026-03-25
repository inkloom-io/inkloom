import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new deployment record.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    target: v.optional(v.union(v.literal("production"), v.literal("preview"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("deployments", {
      projectId: args.projectId,
      branchId: args.branchId,
      status: "building",
      target: args.target ?? "production",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update deployment status, url, and error message.
 */
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

    await ctx.db.patch(deploymentId, updateData);
  },
});

/**
 * Update the build phase of a deployment.
 */
export const updateBuildPhase = mutation({
  args: {
    deploymentId: v.id("deployments"),
    buildPhase: v.union(
      v.literal("generating"),
      v.literal("uploading"),
      v.literal("propagating")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, {
      buildPhase: args.buildPhase,
      updatedAt: Date.now(),
    });
  },
});

/**
 * List deployments for a project, newest first (limit 10).
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return deployments.slice(0, 10);
  },
});
