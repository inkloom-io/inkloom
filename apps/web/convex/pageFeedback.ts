import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Submit a page feedback reaction.
 *
 * If a sessionId is provided and that session already has feedback for the
 * same project + page, the existing record is updated (upsert). Otherwise a
 * new record is inserted.
 */
export const submit = mutation({
  args: {
    projectId: v.id("projects"),
    pageSlug: v.string(),
    reaction: v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative")
    ),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // If we have a sessionId, check for an existing vote to upsert
    if (args.sessionId) {
      const existing = await ctx.db
        .query("pageFeedback")
        .withIndex("by_session_and_page", (q: any) =>
          q.eq("sessionId", args.sessionId).eq("pageSlug", args.pageSlug)
        )
        .first();

      if (existing && existing.projectId === args.projectId) {
        await ctx.db.patch(existing._id, {
          reaction: args.reaction,
          createdAt: now,
        });
        return existing._id;
      }
    }

    return await ctx.db.insert("pageFeedback", {
      projectId: args.projectId,
      pageSlug: args.pageSlug,
      reaction: args.reaction,
      sessionId: args.sessionId,
      createdAt: now,
    });
  },
});

/**
 * Get aggregated feedback counts for a specific page.
 */
export const getByPage = query({
  args: {
    projectId: v.id("projects"),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("pageFeedback")
      .withIndex("by_project_and_page", (q: any) =>
        q.eq("projectId", args.projectId).eq("pageSlug", args.pageSlug)
      )
      .collect();

    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const entry of feedback) {
      counts[entry.reaction] += 1;
    }

    return {
      total: feedback.length,
      ...counts,
    };
  },
});
