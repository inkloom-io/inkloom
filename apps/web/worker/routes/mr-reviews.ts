import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
  mergeRequests,
  mrReviewComments,
  mrReviews,
  mrReviewThreads,
  pageContents,
  pages,
  users,
} from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import type { DataMutationEventPublisher } from "@/worker/events";
import { ApiError } from "@/worker/http";
import {
  accessRequest,
  type ProjectAccessResult,
  type ProjectAuthorizer,
} from "@/worker/routes/pages";
import { syncPageSearchIndex } from "@/worker/services/search-index";

const threadQuery = z.object({ pagePath: z.string().optional() });
const createThreadInput = z.object({
  mergeRequestId: z.string().min(1),
  pagePath: z.string().min(1),
  blockId: z.string().min(1),
  blockIndex: z.number().int().nonnegative(),
  quotedContent: z.string().optional(),
  threadType: z.enum(["comment", "suggestion"]),
  suggestedContent: z.string().optional(),
  content: z.string(),
  userId: z.string().min(1),
});
const userInput = z.object({ userId: z.string().min(1) });
const commentInput = z.object({
  content: z.string().trim().min(1),
  userId: z.string().min(1),
});
const reviewInput = z.object({
  mergeRequestId: z.string().min(1),
  reviewerId: z.string().min(1),
  status: z.enum(["approved", "changes_requested", "commented"]),
  body: z.string().optional(),
});

function effectiveUser(access: ProjectAccessResult | void, requested: string) {
  return access?.userId ?? requested;
}

async function authorizeRequest(
  context: Context<WorkerEnv>,
  mergeRequestId: string,
  authorize?: ProjectAuthorizer
) {
  const db = createDatabase(context.env.DB);
  const mergeRequest = await db.query.mergeRequests.findFirst({
    where: eq(mergeRequests.id, mergeRequestId),
  });
  if (!mergeRequest) throw new ApiError("Merge request not found.", 404);
  const access = await authorize?.(
    accessRequest(context),
    mergeRequest.projectId
  );
  return { mergeRequest, access };
}

async function authorizeThread(
  context: Context<WorkerEnv>,
  threadId: string,
  authorize?: ProjectAuthorizer
) {
  const db = createDatabase(context.env.DB);
  const thread = await db.query.mrReviewThreads.findFirst({
    where: eq(mrReviewThreads.id, threadId),
  });
  if (!thread) throw new ApiError("Review thread not found.", 404);
  const request = await authorizeRequest(
    context,
    thread.mergeRequestId,
    authorize
  );
  return { thread, ...request };
}

async function enrichedThreads(
  context: Context<WorkerEnv>,
  mergeRequestId: string,
  pagePath?: string
) {
  const db = createDatabase(context.env.DB);
  const threads = await db
    .select()
    .from(mrReviewThreads)
    .where(
      pagePath
        ? and(
            eq(mrReviewThreads.mergeRequestId, mergeRequestId),
            eq(mrReviewThreads.pagePath, pagePath)
          )
        : eq(mrReviewThreads.mergeRequestId, mergeRequestId)
    )
    .orderBy(desc(mrReviewThreads.updatedAt));
  if (!threads.length) return [];

  const threadIds = threads.map((thread) => thread.id);
  const commentRows = await db
    .select({ comment: mrReviewComments, user: users })
    .from(mrReviewComments)
    .leftJoin(users, eq(mrReviewComments.createdBy, users.id))
    .where(inArray(mrReviewComments.threadId, threadIds))
    .orderBy(asc(mrReviewComments.createdAt));
  const creatorIds = [...new Set(threads.map((thread) => thread.createdBy))];
  const creators = await db
    .select()
    .from(users)
    .where(inArray(users.id, creatorIds));
  const creatorById = new Map(creators.map((user) => [user.id, user]));
  const summary = (user: typeof users.$inferSelect | null | undefined) =>
    user
      ? {
          id: user.id,
          name: user.name || user.email,
          avatarUrl: user.avatarUrl,
        }
      : null;
  return threads.map((thread) => {
    const comments = commentRows
      .filter(({ comment }) => comment.threadId === thread.id)
      .map(({ comment, user }) => ({ ...comment, user: summary(user) }));
    return {
      ...thread,
      creator: summary(creatorById.get(thread.createdBy)),
      comments,
      commentCount: comments.length,
    };
  });
}

async function applySuggestion(
  context: Context<WorkerEnv>,
  thread: typeof mrReviewThreads.$inferSelect
) {
  if (!thread.suggestedContent) return;
  const db = createDatabase(context.env.DB);
  const mergeRequest = await db.query.mergeRequests.findFirst({
    where: eq(mergeRequests.id, thread.mergeRequestId),
  });
  if (!mergeRequest) return;
  const page = await db.query.pages.findFirst({
    where: and(
      eq(pages.branchId, mergeRequest.sourceBranchId),
      eq(pages.path, thread.pagePath)
    ),
  });
  if (!page) return;
  const content = await db.query.pageContents.findFirst({
    where: eq(pageContents.pageId, page.id),
  });
  if (!content) return;
  try {
    const blocks = JSON.parse(content.content) as Array<
      Record<string, unknown>
    >;
    let blockIndex = blocks.findIndex((block) => block.id === thread.blockId);
    if (blockIndex < 0 && thread.blockIndex < blocks.length) {
      blockIndex = thread.blockIndex;
    }
    if (blockIndex < 0) return;
    blocks[blockIndex] = {
      ...blocks[blockIndex],
      content: [{ type: "text", text: thread.suggestedContent }],
    };
    await db
      .update(pageContents)
      .set({ content: JSON.stringify(blocks), updatedAt: Date.now() })
      .where(eq(pageContents.id, content.id));
    await syncPageSearchIndex(context.env.DB, page.id);
  } catch {
    // The review decision remains valid even if stale block JSON cannot apply.
  }
}

export function createMrReviewRoutes(
  authorize?: ProjectAuthorizer,
  publishEvent?: DataMutationEventPublisher,
) {
  return new Hono<WorkerEnv>()
    .get(
      "/:mergeRequestId/threads",
      zValidator("query", threadQuery),
      async (context) => {
        const mergeRequestId = context.req.param("mergeRequestId");
        await authorizeRequest(context, mergeRequestId, authorize);
        return context.json(
          await enrichedThreads(
            context,
            mergeRequestId,
            context.req.valid("query").pagePath
          )
        );
      }
    )
    .get("/:mergeRequestId/reviews", async (context) => {
      const mergeRequestId = context.req.param("mergeRequestId");
      await authorizeRequest(context, mergeRequestId, authorize);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({ review: mrReviews, reviewer: users })
        .from(mrReviews)
        .leftJoin(users, eq(mrReviews.reviewerId, users.id))
        .where(eq(mrReviews.mergeRequestId, mergeRequestId))
        .orderBy(asc(mrReviews.createdAt));
      return context.json(
        rows.map(({ review, reviewer }) => ({
          ...review,
          reviewer: reviewer
            ? {
                id: reviewer.id,
                name: reviewer.name || reviewer.email,
                avatarUrl: reviewer.avatarUrl,
              }
            : null,
        }))
      );
    })
    .get("/:mergeRequestId/summary", async (context) => {
      const mergeRequestId = context.req.param("mergeRequestId");
      await authorizeRequest(context, mergeRequestId, authorize);
      const db = createDatabase(context.env.DB);
      const [threads, reviews] = await Promise.all([
        db
          .select()
          .from(mrReviewThreads)
          .where(eq(mrReviewThreads.mergeRequestId, mergeRequestId)),
        db
          .select()
          .from(mrReviews)
          .where(eq(mrReviews.mergeRequestId, mergeRequestId)),
      ]);
      const latestByReviewer = new Map<
        string,
        { status: string; createdAt: number }
      >();
      for (const review of reviews) {
        const current = latestByReviewer.get(review.reviewerId);
        if (!current || review.createdAt > current.createdAt) {
          latestByReviewer.set(review.reviewerId, review);
        }
      }
      const statuses = [...latestByReviewer.values()].map(
        (review) => review.status
      );
      return context.json({
        openThreads: threads.filter((thread) => thread.status === "open")
          .length,
        resolvedThreads: threads.filter(
          (thread) => thread.status === "resolved"
        ).length,
        totalThreads: threads.length,
        pendingSuggestions: threads.filter(
          (thread) =>
            thread.threadType === "suggestion" &&
            thread.suggestionStatus === "pending"
        ).length,
        acceptedSuggestions: threads.filter(
          (thread) =>
            thread.threadType === "suggestion" &&
            thread.suggestionStatus === "accepted"
        ).length,
        dismissedSuggestions: threads.filter(
          (thread) =>
            thread.threadType === "suggestion" &&
            thread.suggestionStatus === "dismissed"
        ).length,
        totalReviews: reviews.length,
        reviewStatus: statuses.includes("changes_requested")
          ? ("changes_requested" as const)
          : statuses.includes("approved")
            ? ("approved" as const)
            : null,
      });
    })
    .post(
      "/threads",
      zValidator("json", createThreadInput),
      async (context) => {
        const input = context.req.valid("json");
        const { access } = await authorizeRequest(
          context,
          input.mergeRequestId,
          authorize
        );
        if (input.threadType === "comment" && !input.content.trim()) {
          throw new ApiError("Comment content is required.", 422);
        }
        const threadId = crypto.randomUUID();
        const userId = effectiveUser(access, input.userId);
        const now = Date.now();
        const db = createDatabase(context.env.DB);
        await db.insert(mrReviewThreads).values({
          id: threadId,
          mergeRequestId: input.mergeRequestId,
          pagePath: input.pagePath,
          blockId: input.blockId,
          blockIndex: input.blockIndex,
          quotedContent: input.quotedContent,
          threadType: input.threadType,
          suggestedContent: input.suggestedContent,
          suggestionStatus:
            input.threadType === "suggestion" ? "pending" : null,
          status: "open",
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        });
        if (input.content.trim()) {
          await db.insert(mrReviewComments).values({
            id: crypto.randomUUID(),
            threadId,
            content: input.content,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
            isEdited: false,
          });
          await publishEvent?.(context, {
            type: "merge_request.review_comment",
            threadId,
            mergeRequestId: input.mergeRequestId,
            commenterId: userId,
            commentContent: input.content,
            isReply: false,
          });
        }
        return context.json({ id: threadId }, 201);
      }
    )
    .post(
      "/threads/:threadId/comments",
      zValidator("json", commentInput),
      async (context) => {
        const { thread, access } = await authorizeThread(
          context,
          context.req.param("threadId"),
          authorize
        );
        const input = context.req.valid("json");
        const id = crypto.randomUUID();
        const now = Date.now();
        const db = createDatabase(context.env.DB);
        const commenterId = effectiveUser(access, input.userId);
        await db.insert(mrReviewComments).values({
          id,
          threadId: thread.id,
          content: input.content,
          createdBy: commenterId,
          createdAt: now,
          updatedAt: now,
          isEdited: false,
        });
        await db
          .update(mrReviewThreads)
          .set({ updatedAt: now })
          .where(eq(mrReviewThreads.id, thread.id));
        await publishEvent?.(context, {
          type: "merge_request.review_comment",
          threadId: thread.id,
          mergeRequestId: thread.mergeRequestId,
          commenterId,
          commentContent: input.content,
          isReply: true,
        });
        return context.json({ id }, 201);
      }
    )
    .post(
      "/threads/:threadId/resolve",
      zValidator("json", userInput),
      async (context) => {
        const { thread, access } = await authorizeThread(
          context,
          context.req.param("threadId"),
          authorize
        );
        const db = createDatabase(context.env.DB);
        const now = Date.now();
        const resolvedById = effectiveUser(
          access,
          context.req.valid("json").userId,
        );
        await db
          .update(mrReviewThreads)
          .set({
            status: "resolved",
            resolvedBy: resolvedById,
            resolvedAt: now,
            updatedAt: now,
          })
          .where(eq(mrReviewThreads.id, thread.id));
        await publishEvent?.(context, {
          type: "merge_request.thread_resolved",
          threadId: thread.id,
          mergeRequestId: thread.mergeRequestId,
          resolvedById,
        });
        return context.json({ id: thread.id });
      }
    )
    .post("/threads/:threadId/unresolve", async (context) => {
      const { thread } = await authorizeThread(
        context,
        context.req.param("threadId"),
        authorize
      );
      const db = createDatabase(context.env.DB);
      await db
        .update(mrReviewThreads)
        .set({
          status: "open",
          resolvedBy: null,
          resolvedAt: null,
          updatedAt: Date.now(),
        })
        .where(eq(mrReviewThreads.id, thread.id));
      return context.json({ id: thread.id });
    })
    .post(
      "/threads/:threadId/accept",
      zValidator("json", userInput),
      async (context) => {
        const { thread, access } = await authorizeThread(
          context,
          context.req.param("threadId"),
          authorize
        );
        if (
          thread.threadType !== "suggestion" ||
          thread.suggestionStatus !== "pending"
        ) {
          throw new ApiError("Suggestion is not pending.", 409);
        }
        const now = Date.now();
        const db = createDatabase(context.env.DB);
        const acceptedById = effectiveUser(
          access,
          context.req.valid("json").userId,
        );
        await db
          .update(mrReviewThreads)
          .set({
            suggestionStatus: "accepted",
            status: "resolved",
            resolvedBy: acceptedById,
            resolvedAt: now,
            updatedAt: now,
          })
          .where(eq(mrReviewThreads.id, thread.id));
        await applySuggestion(context, thread);
        await publishEvent?.(context, {
          type: "merge_request.suggestion_accepted",
          threadId: thread.id,
          mergeRequestId: thread.mergeRequestId,
          acceptedById,
        });
        return context.json({ id: thread.id });
      }
    )
    .post(
      "/threads/:threadId/dismiss",
      zValidator("json", userInput),
      async (context) => {
        const { thread } = await authorizeThread(
          context,
          context.req.param("threadId"),
          authorize
        );
        if (
          thread.threadType !== "suggestion" ||
          thread.suggestionStatus !== "pending"
        ) {
          throw new ApiError("Suggestion is not pending.", 409);
        }
        const db = createDatabase(context.env.DB);
        await db
          .update(mrReviewThreads)
          .set({ suggestionStatus: "dismissed", updatedAt: Date.now() })
          .where(eq(mrReviewThreads.id, thread.id));
        return context.json({ id: thread.id });
      }
    )
    .post("/reviews", zValidator("json", reviewInput), async (context) => {
      const input = context.req.valid("json");
      const { access } = await authorizeRequest(
        context,
        input.mergeRequestId,
        authorize
      );
      const reviewerId = effectiveUser(access, input.reviewerId);
      const db = createDatabase(context.env.DB);
      const existing = await db.query.mrReviews.findFirst({
        where: and(
          eq(mrReviews.mergeRequestId, input.mergeRequestId),
          eq(mrReviews.reviewerId, reviewerId)
        ),
      });
      const id = existing?.id ?? crypto.randomUUID();
      const now = Date.now();
      if (existing) {
        await db
          .update(mrReviews)
          .set({ status: input.status, body: input.body, updatedAt: now })
          .where(eq(mrReviews.id, existing.id));
      } else {
        await db.insert(mrReviews).values({
          id,
          mergeRequestId: input.mergeRequestId,
          reviewerId,
          status: input.status,
          body: input.body,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (input.status !== "commented") {
        const reviews = await db
          .select()
          .from(mrReviews)
          .where(eq(mrReviews.mergeRequestId, input.mergeRequestId));
        const reviewStatus = reviews.some(
          (review) => review.status === "changes_requested"
        )
          ? "changes_requested"
          : "approved";
        await db
          .update(mergeRequests)
          .set({ reviewStatus, updatedAt: now })
          .where(eq(mergeRequests.id, input.mergeRequestId));
        await publishEvent?.(context, {
          type: "merge_request.review_status",
          mergeRequestId: input.mergeRequestId,
          reviewerId,
          status: input.status,
          body: input.body,
        });
      }
      return context.json({ id }, existing ? 200 : 201);
    });
}

export const mrReviewRoutes = createMrReviewRoutes();
