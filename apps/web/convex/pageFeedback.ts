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

/**
 * Get aggregated feedback stats for a page, including percentages.
 */
export const getStats = query({
  args: {
    projectId: v.id("projects"),
    pageSlug: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allFeedback = await ctx.db
      .query("pageFeedback")
      .withIndex("by_project_and_page", (q: any) =>
        q.eq("projectId", args.projectId).eq("pageSlug", args.pageSlug)
      )
      .collect();

    const since = args.since;
    const feedback = since
      ? allFeedback.filter((f) => f.createdAt >= since)
      : allFeedback;

    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const entry of feedback) {
      counts[entry.reaction] += 1;
    }

    const total = feedback.length;

    return {
      total,
      positive: counts.positive,
      neutral: counts.neutral,
      negative: counts.negative,
      positivePercent: total > 0 ? Math.round((counts.positive / total) * 100) : 0,
      neutralPercent: total > 0 ? Math.round((counts.neutral / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((counts.negative / total) * 100) : 0,
    };
  },
});

/**
 * Get time-series feedback data for charting. Returns daily reaction counts.
 */
export const getTimeSeries = query({
  args: {
    projectId: v.id("projects"),
    pageSlug: v.string(),
    since: v.optional(v.number()),
    bucketSize: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
  },
  handler: async (ctx, args) => {
    const allFeedback = await ctx.db
      .query("pageFeedback")
      .withIndex("by_project_and_page", (q: any) =>
        q.eq("projectId", args.projectId).eq("pageSlug", args.pageSlug)
      )
      .collect();

    const since = args.since;
    const feedback = since
      ? allFeedback.filter((f) => f.createdAt >= since)
      : allFeedback;

    const bucket = args.bucketSize ?? "daily";
    const msPerDay = 86_400_000;
    const msPerBucket = bucket === "weekly" ? msPerDay * 7 : msPerDay;

    // Group by bucket
    const buckets = new Map<
      string,
      { positive: number; neutral: number; negative: number }
    >();

    for (const entry of feedback) {
      const bucketStart =
        Math.floor(entry.createdAt / msPerBucket) * msPerBucket;
      const isoDate = new Date(bucketStart).toISOString();
      const key = isoDate.slice(0, isoDate.indexOf("T"));

      if (!buckets.has(key)) {
        buckets.set(key, { positive: 0, neutral: 0, negative: 0 });
      }
      const b = buckets.get(key);
      if (b) {
        b[entry.reaction] += 1;
      }
    }

    // Sort by date and return
    const sorted = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts,
        total: counts.positive + counts.neutral + counts.negative,
      }));

    return sorted;
  },
});
