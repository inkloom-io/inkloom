import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Narrow type for user documents returned by db.get() with a user Id. */
type UserDoc = { _id: any; name: string; email: string; avatarUrl?: string } | null;

// List all comment threads for a page with their comments
export const listByPage = query({
  args: {
    pageId: v.id("pages"),
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
  },
  handler: async (ctx, args) => {
    // Get threads for this page, optionally filtered by status
    let threadsQuery = ctx.db
      .query("commentThreads")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId));

    const threads = await threadsQuery.collect();

    // Filter by status if specified
    const filteredThreads = args.status
      ? threads.filter((t: any) => t.status === args.status)
      : threads;

    // Get comments and user info for each thread
    const threadsWithComments = await Promise.all(
      filteredThreads.map(async (thread: any) => {
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_thread", (q: any) => q.eq("threadId", thread._id))
          .collect();

        // Get user info for thread creator
        const threadCreator = await ctx.db.get(thread.createdBy) as UserDoc;

        // Get user info for each comment
        const commentsWithUsers = await Promise.all(
          comments.map(async (comment: any) => {
            const user = await ctx.db.get(comment.createdBy) as UserDoc;
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
          comments: commentsWithUsers.sort((a, b) => a.createdAt - b.createdAt),
          commentCount: comments.length,
        };
      })
    );

    // Sort by most recent activity
    return threadsWithComments.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Get a single thread with all comments
export const getThread = query({
  args: { threadId: v.id("commentThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_thread", (q: any) => q.eq("threadId", thread._id))
      .collect();

    const threadCreator = await ctx.db.get(thread.createdBy) as UserDoc;

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment: any) => {
        const user = await ctx.db.get(comment.createdBy) as UserDoc;
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
      comments: commentsWithUsers.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// Create a new comment thread with an initial comment
export const createThread = mutation({
  args: {
    pageId: v.id("pages"),
    blockId: v.string(),
    anchorType: v.union(v.literal("block"), v.literal("inline")),
    inlineStart: v.optional(v.number()),
    inlineEnd: v.optional(v.number()),
    quotedText: v.optional(v.string()),
    content: v.string(), // Initial comment content
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the thread
    const threadId = await ctx.db.insert("commentThreads", {
      pageId: args.pageId,
      blockId: args.blockId,
      anchorType: args.anchorType,
      inlineStart: args.inlineStart,
      inlineEnd: args.inlineEnd,
      quotedText: args.quotedText,
      status: "open",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    // Create the initial comment
    await ctx.db.insert("comments", {
      threadId,
      content: args.content,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    });

    return threadId;
  },
});

// Add a comment (reply) to an existing thread
export const addComment = mutation({
  args: {
    threadId: v.id("commentThreads"),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const now = Date.now();

    // Create the comment
    const commentId = await ctx.db.insert("comments", {
      threadId: args.threadId,
      content: args.content,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, { updatedAt: now });

    return commentId;
  },
});

// Update a comment's content
export const updateComment = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Only the creator can edit their comment
    if (comment.createdBy !== args.userId) {
      throw new Error("You can only edit your own comments");
    }

    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: now,
      isEdited: true,
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(comment.threadId, { updatedAt: now });

    return args.commentId;
  },
});

// Delete a comment
export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
    userId: v.id("users"),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Admins can delete any comment, creators can delete their own
    if (comment.createdBy !== args.userId && !args.isAdmin) {
      throw new Error("You can only delete your own comments");
    }

    const thread = await ctx.db.get(comment.threadId);

    // Count remaining comments in thread
    const remainingComments = await ctx.db
      .query("comments")
      .withIndex("by_thread", (q: any) => q.eq("threadId", comment.threadId))
      .collect();

    // If this is the only comment, delete the whole thread
    if (remainingComments.length <= 1) {
      await ctx.db.delete(args.commentId);
      await ctx.db.delete(comment.threadId);
      return { threadDeleted: true };
    }

    // Otherwise just delete the comment
    await ctx.db.delete(args.commentId);

    // Update thread's updatedAt timestamp
    if (thread) {
      await ctx.db.patch(comment.threadId, { updatedAt: Date.now() });
    }

    return { threadDeleted: false };
  },
});

// Resolve a thread
export const resolveThread = mutation({
  args: {
    threadId: v.id("commentThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(args.threadId, {
      status: "resolved",
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

// Reopen a resolved thread
export const reopenThread = mutation({
  args: {
    threadId: v.id("commentThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(args.threadId, {
      status: "open",
      updatedAt: Date.now(),
    });

    return args.threadId;
  },
});

// Delete a thread and all its comments
export const deleteThread = mutation({
  args: {
    threadId: v.id("commentThreads"),
    userId: v.id("users"),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Admins can delete any thread, creators can delete their own
    if (thread.createdBy !== args.userId && !args.isAdmin) {
      throw new Error("You can only delete threads you created");
    }

    // Delete all comments in the thread
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_thread", (q: any) => q.eq("threadId", args.threadId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);

    return args.threadId;
  },
});
