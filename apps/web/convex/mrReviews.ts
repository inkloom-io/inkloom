import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Narrow type for user documents returned by db.get(). */
type UserDoc = {
  _id: any;
  name?: string;
  email: string;
  avatarUrl?: string;
} | null;

// ── Thread Operations ─────────────────────────────────────────────────

/** Create a new review thread with an initial comment. */
export const createThread = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    pagePath: v.string(),
    blockId: v.string(),
    blockIndex: v.number(),
    quotedContent: v.optional(v.string()),
    threadType: v.union(v.literal("comment"), v.literal("suggestion")),
    suggestedContent: v.optional(v.string()),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");

    const now = Date.now();

    // For regular comments, content is required. For suggestions, content is optional.
    if (args.threadType === "comment" && !args.content.trim()) {
      throw new Error("Comment content is required");
    }

    const threadId = await ctx.db.insert("mrReviewThreads", {
      mergeRequestId: args.mergeRequestId,
      pagePath: args.pagePath,
      blockId: args.blockId,
      blockIndex: args.blockIndex,
      quotedContent: args.quotedContent,
      threadType: args.threadType,
      suggestedContent: args.suggestedContent,
      suggestionStatus:
        args.threadType === "suggestion" ? "pending" : undefined,
      status: "open",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    // Only insert a comment record if the user actually wrote something
    if (args.content.trim()) {
      await ctx.db.insert("mrReviewComments", {
        threadId,
        content: args.content,
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
        isEdited: false,
      });
    }

    return threadId;
  },
});

/** List all review threads for a merge request with their comments. */
export const listThreadsByMR = query({
  args: {
    mergeRequestId: v.id("mergeRequests"),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("mrReviewThreads")
      .withIndex("by_merge_request", (q: any) =>
        q.eq("mergeRequestId", args.mergeRequestId)
      )
      .collect();

    return await enrichThreads(ctx, threads);
  },
});

/** List review threads for a specific page within a merge request. */
export const listThreadsByPage = query({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    pagePath: v.string(),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("mrReviewThreads")
      .withIndex("by_merge_request_and_page", (q: any) =>
        q
          .eq("mergeRequestId", args.mergeRequestId)
          .eq("pagePath", args.pagePath)
      )
      .collect();

    return await enrichThreads(ctx, threads);
  },
});

/** Resolve a review thread. */
export const resolveThread = mutation({
  args: {
    threadId: v.id("mrReviewThreads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    await ctx.db.patch(args.threadId, {
      status: "resolved",
      resolvedBy: args.userId,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

/** Unresolve (reopen) a review thread. */
export const unresolveThread = mutation({
  args: {
    threadId: v.id("mrReviewThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    await ctx.db.patch(args.threadId, {
      status: "open",
      resolvedBy: undefined,
      resolvedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

// ── Comment Operations ────────────────────────────────────────────────

/** Add a reply comment to a review thread. */
export const addComment = mutation({
  args: {
    threadId: v.id("mrReviewThreads"),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    const now = Date.now();

    const commentId = await ctx.db.insert("mrReviewComments", {
      threadId: args.threadId,
      content: args.content,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    });

    await ctx.db.patch(args.threadId, { updatedAt: now });

    return commentId;
  },
});

/** Update a review comment's content. */
export const updateComment = mutation({
  args: {
    commentId: v.id("mrReviewComments"),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.createdBy !== args.userId) {
      throw new Error("You can only edit your own comments");
    }

    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: now,
      isEdited: true,
    });

    await ctx.db.patch(comment.threadId, { updatedAt: now });

    return args.commentId;
  },
});

/** Delete a review comment. Deletes the whole thread if it's the last comment. */
export const deleteComment = mutation({
  args: {
    commentId: v.id("mrReviewComments"),
    userId: v.id("users"),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.createdBy !== args.userId && !args.isAdmin) {
      throw new Error("You can only delete your own comments");
    }

    const thread = await ctx.db.get(comment.threadId);

    const remainingComments = await ctx.db
      .query("mrReviewComments")
      .withIndex("by_thread", (q: any) => q.eq("threadId", comment.threadId))
      .collect();

    if (remainingComments.length <= 1) {
      await ctx.db.delete(args.commentId);
      await ctx.db.delete(comment.threadId);
      return { threadDeleted: true };
    }

    await ctx.db.delete(args.commentId);

    if (thread) {
      await ctx.db.patch(comment.threadId, { updatedAt: Date.now() });
    }

    return { threadDeleted: false };
  },
});

// ── Suggestion Operations ─────────────────────────────────────────────

/** Accept a suggested change. */
export const acceptSuggestion = mutation({
  args: {
    threadId: v.id("mrReviewThreads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    if (thread.threadType !== "suggestion") {
      throw new Error("Thread is not a suggestion");
    }
    if (thread.suggestionStatus !== "pending") {
      throw new Error("Suggestion is not pending");
    }

    await ctx.db.patch(args.threadId, {
      suggestionStatus: "accepted",
      status: "resolved",
      resolvedBy: args.userId,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

/** Dismiss a suggested change. */
export const dismissSuggestion = mutation({
  args: {
    threadId: v.id("mrReviewThreads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    if (thread.threadType !== "suggestion") {
      throw new Error("Thread is not a suggestion");
    }
    if (thread.suggestionStatus !== "pending") {
      throw new Error("Suggestion is not pending");
    }

    await ctx.db.patch(args.threadId, {
      suggestionStatus: "dismissed",
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

// ── Review Operations ─────────────────────────────────────────────────

/** Submit a review (approve, request changes, or comment). */
export const submitReview = mutation({
  args: {
    mergeRequestId: v.id("mergeRequests"),
    reviewerId: v.id("users"),
    status: v.union(
      v.literal("approved"),
      v.literal("changes_requested"),
      v.literal("commented")
    ),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.db.get(args.mergeRequestId);
    if (!mr) throw new Error("Merge request not found");

    const now = Date.now();

    const reviewId = await ctx.db.insert("mrReviews", {
      mergeRequestId: args.mergeRequestId,
      reviewerId: args.reviewerId,
      status: args.status,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });

    // Update the MR's computed reviewStatus based on latest reviews
    if (args.status === "approved" || args.status === "changes_requested") {
      const allReviews = await ctx.db
        .query("mrReviews")
        .withIndex("by_merge_request", (q: any) =>
          q.eq("mergeRequestId", args.mergeRequestId)
        )
        .collect();

      // Build a map of the latest review per reviewer
      const latestByReviewer = new Map<string, string>();
      const sortedReviews = [...allReviews].sort(
        (a, b) => a.createdAt - b.createdAt
      );
      for (const review of sortedReviews) {
        if (
          review.status === "approved" ||
          review.status === "changes_requested"
        ) {
          latestByReviewer.set(review.reviewerId, review.status);
        }
      }

      // If any reviewer's latest status is changes_requested, MR is changes_requested
      const latestStatuses = Array.from(latestByReviewer.values());
      const mrReviewStatus = latestStatuses.includes("changes_requested")
        ? ("changes_requested" as const)
        : ("approved" as const);

      await ctx.db.patch(args.mergeRequestId, {
        reviewStatus: mrReviewStatus,
        updatedAt: now,
      });
    }

    return reviewId;
  },
});

/** List all reviews for a merge request. */
export const listReviews = query({
  args: {
    mergeRequestId: v.id("mergeRequests"),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("mrReviews")
      .withIndex("by_merge_request", (q: any) =>
        q.eq("mergeRequestId", args.mergeRequestId)
      )
      .collect();

    const results = await Promise.all(
      reviews.map(async (review) => {
        const reviewer = (await ctx.db.get(review.reviewerId)) as UserDoc;
        return {
          ...review,
          reviewer: reviewer
            ? {
                id: reviewer._id,
                name: reviewer.name || reviewer.email,
                avatarUrl: reviewer.avatarUrl,
              }
            : null,
        };
      })
    );

    return results.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ── Query Helpers ─────────────────────────────────────────────────────

/** Get a summary of review state for a merge request. */
export const getReviewSummary = query({
  args: {
    mergeRequestId: v.id("mergeRequests"),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("mrReviewThreads")
      .withIndex("by_merge_request", (q: any) =>
        q.eq("mergeRequestId", args.mergeRequestId)
      )
      .collect();

    const reviews = await ctx.db
      .query("mrReviews")
      .withIndex("by_merge_request", (q: any) =>
        q.eq("mergeRequestId", args.mergeRequestId)
      )
      .collect();

    const openThreads = threads.filter((t) => t.status === "open").length;
    const resolvedThreads = threads.filter(
      (t) => t.status === "resolved"
    ).length;
    const pendingSuggestions = threads.filter(
      (t) =>
        t.threadType === "suggestion" && t.suggestionStatus === "pending"
    ).length;
    const acceptedSuggestions = threads.filter(
      (t) =>
        t.threadType === "suggestion" && t.suggestionStatus === "accepted"
    ).length;
    const dismissedSuggestions = threads.filter(
      (t) =>
        t.threadType === "suggestion" && t.suggestionStatus === "dismissed"
    ).length;

    // Compute latest review status per reviewer
    const latestByReviewer = new Map<
      string,
      { status: string; createdAt: number }
    >();
    for (const review of reviews) {
      const existing = latestByReviewer.get(review.reviewerId);
      if (!existing || review.createdAt > existing.createdAt) {
        latestByReviewer.set(review.reviewerId, {
          status: review.status,
          createdAt: review.createdAt,
        });
      }
    }

    const latestStatuses = Array.from(latestByReviewer.values()).map(
      (r) => r.status
    );
    const hasChangesRequested = latestStatuses.includes("changes_requested");
    const hasApproved = latestStatuses.includes("approved");

    let reviewStatus: "approved" | "changes_requested" | null = null;
    if (hasChangesRequested) {
      reviewStatus = "changes_requested";
    } else if (hasApproved) {
      reviewStatus = "approved";
    }

    return {
      openThreads,
      resolvedThreads,
      totalThreads: threads.length,
      pendingSuggestions,
      acceptedSuggestions,
      dismissedSuggestions,
      totalReviews: reviews.length,
      reviewStatus,
    };
  },
});

// ── Helpers ───────────────────────────────────────────────────────────

/** Enrich thread documents with user info and comments. */
async function enrichThreads(ctx: any, threads: any[]) {
  const threadsWithComments = await Promise.all(
    threads.map(async (thread) => {
      const comments = await ctx.db
        .query("mrReviewComments")
        .withIndex("by_thread", (q: any) => q.eq("threadId", thread._id))
        .collect();

      const threadCreator = (await ctx.db.get(thread.createdBy)) as UserDoc;

      const commentsWithUsers = await Promise.all(
        comments.map(async (comment: any) => {
          const user = (await ctx.db.get(comment.createdBy)) as UserDoc;
          return {
            ...comment,
            user: user
              ? {
                  id: user._id,
                  name: user.name || user.email,
                  avatarUrl: user.avatarUrl,
                }
              : null,
          };
        })
      );

      return {
        ...thread,
        creator: threadCreator
          ? {
              id: threadCreator._id,
              name: threadCreator.name || threadCreator.email,
              avatarUrl: threadCreator.avatarUrl,
            }
          : null,
        comments: commentsWithUsers.sort(
          (a: any, b: any) => a.createdAt - b.createdAt
        ),
        commentCount: comments.length,
      };
    })
  );

  return threadsWithComments.sort((a, b) => b.updatedAt - a.updatedAt);
}
