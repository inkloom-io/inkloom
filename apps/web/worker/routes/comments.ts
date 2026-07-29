import { and, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { branches, comments, commentThreads, pages, users } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import type { DataMutationEventPublisher } from "@/worker/events";
import { ApiError } from "@/worker/http";
import {
  accessRequest,
  type ProjectAccessResult,
  type ProjectAuthorizer,
} from "@/worker/routes/pages";

const threadStatusQuery = z.object({
  status: z.enum(["open", "resolved"]).optional(),
});
const createThreadInput = z.object({
  pageId: z.string().min(1),
  blockId: z.string().min(1),
  anchorType: z.enum(["block", "inline"]),
  inlineStart: z.number().int().nonnegative().optional(),
  inlineEnd: z.number().int().nonnegative().optional(),
  quotedText: z.string().optional(),
  content: z.string().trim().min(1),
  userId: z.string().min(1),
});
const addCommentInput = z.object({
  content: z.string().trim().min(1),
  userId: z.string().min(1),
});
const updateCommentInput = addCommentInput;
const deleteInput = z.object({
  userId: z.string().min(1),
  isAdmin: z.boolean().optional(),
});

async function projectForPage(context: Context<WorkerEnv>, pageId: string) {
  const db = createDatabase(context.env.DB);
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });
  if (!page) throw new ApiError("Page not found.", 404);
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, page.branchId),
  });
  if (!branch) throw new ApiError("Branch not found.", 404);
  return branch.projectId;
}

async function threadFor(context: Context<WorkerEnv>, threadId: string) {
  const db = createDatabase(context.env.DB);
  const thread = await db.query.commentThreads.findFirst({
    where: eq(commentThreads.id, threadId),
  });
  if (!thread) throw new ApiError("Comment thread not found.", 404);
  return thread;
}

async function authorizePage(
  context: Context<WorkerEnv>,
  pageId: string,
  authorize?: ProjectAuthorizer
) {
  return authorize?.(
    accessRequest(context),
    await projectForPage(context, pageId)
  );
}

async function authorizeThread(
  context: Context<WorkerEnv>,
  threadId: string,
  authorize?: ProjectAuthorizer
) {
  const thread = await threadFor(context, threadId);
  const access = await authorizePage(context, thread.pageId, authorize);
  return { thread, access };
}

async function hydratedThreads(
  context: Context<WorkerEnv>,
  pageId: string,
  status?: "open" | "resolved"
) {
  const db = createDatabase(context.env.DB);
  const threads = await db
    .select()
    .from(commentThreads)
    .where(
      status
        ? and(
            eq(commentThreads.pageId, pageId),
            eq(commentThreads.status, status)
          )
        : eq(commentThreads.pageId, pageId)
    )
    .orderBy(desc(commentThreads.updatedAt));
  if (threads.length === 0) return [];

  const threadIds = threads.map((thread) => thread.id);
  const commentRows = await db
    .select({ comment: comments, user: users })
    .from(comments)
    .leftJoin(users, eq(comments.createdBy, users.id))
    .where(inArray(comments.threadId, threadIds));
  const creatorIds = [...new Set(threads.map((thread) => thread.createdBy))];
  const creators = await db
    .select()
    .from(users)
    .where(inArray(users.id, creatorIds));
  const creatorById = new Map(creators.map((user) => [user.id, user]));

  return threads.map((thread) => {
    const threadComments = commentRows
      .filter(({ comment }) => comment.threadId === thread.id)
      .sort((left, right) => left.comment.createdAt - right.comment.createdAt)
      .map(({ comment, user }) => ({
        ...comment,
        user: user
          ? {
              id: user.id,
              name: user.name || user.email,
              avatarUrl: user.avatarUrl,
            }
          : null,
      }));
    const creator = creatorById.get(thread.createdBy);
    return {
      ...thread,
      creator: creator
        ? {
            id: creator.id,
            name: creator.name || creator.email,
            avatarUrl: creator.avatarUrl,
          }
        : null,
      comments: threadComments,
      commentCount: threadComments.length,
    };
  });
}

function effectiveUserId(
  access: ProjectAccessResult | void,
  requestedUserId: string
) {
  return access?.userId ?? requestedUserId;
}

function canAdmin(
  access: ProjectAccessResult | void,
  requestedAdmin: boolean | undefined,
  authorize: ProjectAuthorizer | undefined
) {
  return (
    access?.role === "owner" ||
    access?.role === "admin" ||
    (!authorize && requestedAdmin === true)
  );
}

export function createCommentsRoutes(
  authorize?: ProjectAuthorizer,
  publishEvent?: DataMutationEventPublisher,
) {
  return new Hono<WorkerEnv>()
    .get(
      "/page/:pageId",
      zValidator("query", threadStatusQuery),
      async (context) => {
        const pageId = context.req.param("pageId");
        await authorizePage(context, pageId, authorize);
        return context.json(
          await hydratedThreads(
            context,
            pageId,
            context.req.valid("query").status
          )
        );
      }
    )
    .get("/threads/:threadId", async (context) => {
      const { thread } = await authorizeThread(
        context,
        context.req.param("threadId"),
        authorize
      );
      const match = (await hydratedThreads(context, thread.pageId)).find(
        (candidate) => candidate.id === thread.id
      );
      return context.json(match ?? null);
    })
    .post(
      "/threads",
      zValidator("json", createThreadInput),
      async (context) => {
        const input = context.req.valid("json");
        const access = await authorizePage(context, input.pageId, authorize);
        const userId = effectiveUserId(access, input.userId);
        const id = crypto.randomUUID();
        const now = Date.now();
        await context.env.DB.batch([
          context.env.DB.prepare(
            `INSERT INTO comment_threads (
                id, page_id, block_id, anchor_type, inline_start, inline_end,
                quoted_text, status, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`
          ).bind(
            id,
            input.pageId,
            input.blockId,
            input.anchorType,
            input.inlineStart ?? null,
            input.inlineEnd ?? null,
            input.quotedText ?? null,
            userId,
            now,
            now
          ),
          context.env.DB.prepare(
            `INSERT INTO comments (
                id, thread_id, content, created_by, created_at, updated_at,
                is_edited
              ) VALUES (?, ?, ?, ?, ?, ?, 0)`
          ).bind(crypto.randomUUID(), id, input.content, userId, now, now),
        ]);
        return context.json({ id }, 201);
      }
    )
    .post(
      "/threads/:threadId/comments",
      zValidator("json", addCommentInput),
      async (context) => {
        const threadId = context.req.param("threadId");
        const { thread, access } = await authorizeThread(
          context,
          threadId,
          authorize,
        );
        const input = context.req.valid("json");
        const userId = effectiveUserId(access, input.userId);
        const id = crypto.randomUUID();
        const now = Date.now();
        await context.env.DB.batch([
          context.env.DB.prepare(
            `INSERT INTO comments (
                id, thread_id, content, created_by, created_at, updated_at,
                is_edited
              ) VALUES (?, ?, ?, ?, ?, ?, 0)`
          ).bind(id, threadId, input.content, userId, now, now),
          context.env.DB.prepare(
            "UPDATE comment_threads SET updated_at = ? WHERE id = ?"
          ).bind(now, threadId),
        ]);
        await publishEvent?.(context, {
          type: "comment.reply",
          threadId,
          commenterId: userId,
          commentContent: input.content,
          pageId: thread.pageId,
        });
        return context.json({ id }, 201);
      }
    )
    .patch(
      "/comments/:commentId",
      zValidator("json", updateCommentInput),
      async (context) => {
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        const comment = await db.query.comments.findFirst({
          where: eq(comments.id, context.req.param("commentId")),
        });
        if (!comment) throw new ApiError("Comment not found.", 404);
        const { access } = await authorizeThread(
          context,
          comment.threadId,
          authorize
        );
        if (comment.createdBy !== effectiveUserId(access, input.userId)) {
          throw new ApiError("You can only edit your own comments.", 403);
        }
        const now = Date.now();
        await context.env.DB.batch([
          context.env.DB.prepare(
            `UPDATE comments
               SET content = ?, updated_at = ?, is_edited = 1 WHERE id = ?`
          ).bind(input.content, now, comment.id),
          context.env.DB.prepare(
            "UPDATE comment_threads SET updated_at = ? WHERE id = ?"
          ).bind(now, comment.threadId),
        ]);
        return context.json({ id: comment.id });
      }
    )
    .delete(
      "/comments/:commentId",
      zValidator("json", deleteInput),
      async (context) => {
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        const comment = await db.query.comments.findFirst({
          where: eq(comments.id, context.req.param("commentId")),
        });
        if (!comment) throw new ApiError("Comment not found.", 404);
        const { access } = await authorizeThread(
          context,
          comment.threadId,
          authorize
        );
        if (
          comment.createdBy !== effectiveUserId(access, input.userId) &&
          !canAdmin(access, input.isAdmin, authorize)
        ) {
          throw new ApiError("You can only delete your own comments.", 403);
        }
        const threadComments = await db
          .select()
          .from(comments)
          .where(eq(comments.threadId, comment.threadId));
        if (threadComments.length <= 1) {
          await db
            .delete(commentThreads)
            .where(eq(commentThreads.id, comment.threadId));
          return context.json({ threadDeleted: true as boolean });
        }
        await db.delete(comments).where(eq(comments.id, comment.id));
        await db
          .update(commentThreads)
          .set({ updatedAt: Date.now() })
          .where(eq(commentThreads.id, comment.threadId));
        return context.json({ threadDeleted: false as boolean });
      }
    )
    .post("/:threadId/resolve", async (context) => {
      const threadId = context.req.param("threadId");
      await authorizeThread(context, threadId, authorize);
      const db = createDatabase(context.env.DB);
      await db
        .update(commentThreads)
        .set({ status: "resolved", updatedAt: Date.now() })
        .where(eq(commentThreads.id, threadId));
      return context.json({ id: threadId });
    })
    .post("/:threadId/reopen", async (context) => {
      const threadId = context.req.param("threadId");
      await authorizeThread(context, threadId, authorize);
      const db = createDatabase(context.env.DB);
      await db
        .update(commentThreads)
        .set({ status: "open", updatedAt: Date.now() })
        .where(eq(commentThreads.id, threadId));
      return context.json({ id: threadId });
    })
    .delete(
      "/threads/:threadId",
      zValidator("json", deleteInput),
      async (context) => {
        const threadId = context.req.param("threadId");
        const input = context.req.valid("json");
        const { thread, access } = await authorizeThread(
          context,
          threadId,
          authorize
        );
        if (
          thread.createdBy !== effectiveUserId(access, input.userId) &&
          !canAdmin(access, input.isAdmin, authorize)
        ) {
          throw new ApiError("You can only delete threads you created.", 403);
        }
        const db = createDatabase(context.env.DB);
        await db.delete(commentThreads).where(eq(commentThreads.id, threadId));
        return context.json({ id: threadId });
      }
    );
}

export const commentsRoutes = createCommentsRoutes();
