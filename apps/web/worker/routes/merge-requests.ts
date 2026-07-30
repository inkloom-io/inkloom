import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
  branches,
  folders,
  mergeRequestComments,
  mergeRequests,
  pageContents,
  pages,
  users,
} from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { D1PreparedStatementBinding, WorkerEnv } from "@/worker/env";
import type { DataMutationEventPublisher } from "@/worker/events";
import { ApiError } from "@/worker/http";
import {
  accessRequest,
  type ProjectAccessResult,
  type ProjectAuthorizer,
} from "@/worker/routes/pages";
import { rebuildProjectSearchIndex } from "@/worker/services/search-index";

const statusQuery = z.object({
  status: z.enum(["open", "merged", "closed"]).optional(),
});
const createInput = z.object({
  projectId: z.string().min(1),
  sourceBranchId: z.string().min(1),
  targetBranchId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().optional(),
  createdBy: z.string().min(1),
});
const updateInput = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
});
const closeInput = z.object({ closedBy: z.string().min(1) });
const mergeInput = z.object({
  mergedBy: z.string().min(1),
  deleteSourceBranch: z.boolean().optional(),
  resolutions: z.string().optional(),
});
const commentInput = z.object({
  pagePath: z.string().optional(),
  blockIndex: z.number().int().nonnegative().optional(),
  content: z.string().trim().min(1),
  createdBy: z.string().min(1),
});

async function requestFor(
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

function effectiveUser(access: ProjectAccessResult | void, requested: string) {
  return access?.userId ?? requested;
}

async function hydrate(
  context: Context<WorkerEnv>,
  requests: Array<typeof mergeRequests.$inferSelect>
) {
  const db = createDatabase(context.env.DB);
  return Promise.all(
    requests.map(async (mergeRequest) => {
      const [creator, sourceBranch, targetBranch, mergedByUser, closedByUser] =
        await Promise.all([
          db.query.users.findFirst({
            where: eq(users.id, mergeRequest.createdBy),
          }),
          db.query.branches.findFirst({
            where: eq(branches.id, mergeRequest.sourceBranchId),
          }),
          db.query.branches.findFirst({
            where: eq(branches.id, mergeRequest.targetBranchId),
          }),
          mergeRequest.mergedBy
            ? db.query.users.findFirst({
                where: eq(users.id, mergeRequest.mergedBy),
              })
            : null,
          mergeRequest.closedBy
            ? db.query.users.findFirst({
                where: eq(users.id, mergeRequest.closedBy),
              })
            : null,
        ]);
      const userSummary = (
        user: typeof users.$inferSelect | null | undefined
      ) =>
        user
          ? {
              id: user.id,
              name: user.name || user.email,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }
          : null;
      return {
        ...mergeRequest,
        creator: userSummary(creator),
        sourceBranchName: sourceBranch?.name ?? "deleted",
        targetBranchName: targetBranch?.name ?? "deleted",
        mergedByUser: userSummary(mergedByUser),
        closedByUser: userSummary(closedByUser),
      };
    })
  );
}

async function mergeBranches(
  context: Context<WorkerEnv>,
  mergeRequest: typeof mergeRequests.$inferSelect
) {
  const db = createDatabase(context.env.DB);
  const [
    sourceFolders,
    sourcePages,
    sourceContents,
    targetFolders,
    targetPages,
    targetContents,
  ] = await Promise.all([
    db
      .select()
      .from(folders)
      .where(eq(folders.branchId, mergeRequest.sourceBranchId)),
    db
      .select()
      .from(pages)
      .where(eq(pages.branchId, mergeRequest.sourceBranchId)),
    db
      .select()
      .from(pageContents)
      .innerJoin(pages, eq(pages.id, pageContents.pageId))
      .where(eq(pages.branchId, mergeRequest.sourceBranchId)),
    db
      .select()
      .from(folders)
      .where(eq(folders.branchId, mergeRequest.targetBranchId)),
    db
      .select()
      .from(pages)
      .where(eq(pages.branchId, mergeRequest.targetBranchId)),
    db
      .select()
      .from(pageContents)
      .innerJoin(pages, eq(pages.id, pageContents.pageId))
      .where(eq(pages.branchId, mergeRequest.targetBranchId)),
  ]);
  const targetFolderByPath = new Map(
    targetFolders.map((folder) => [folder.path, folder])
  );
  const targetPageByPath = new Map(
    targetPages.map((page) => [page.path, page])
  );
  const folderIds = new Map(
    sourceFolders.map((folder) => [
      folder.id,
      targetFolderByPath.get(folder.path)?.id ?? crypto.randomUUID(),
    ])
  );
  const contentByPage = new Map(
    sourceContents.map(({ page_contents: content }) => [
      content.pageId,
      content,
    ])
  );
  const targetContentByPage = new Map(
    targetContents.map(({ page_contents: content }) => [
      content.pageId,
      content,
    ])
  );
  const sourceFolderPaths = new Set(sourceFolders.map((folder) => folder.path));
  const sourcePagePaths = new Set(sourcePages.map((page) => page.path));
  const now = Date.now();
  const statements: D1PreparedStatementBinding[] = [];
  for (const page of targetPages) {
    if (!sourcePagePaths.has(page.path)) {
      statements.push(
        context.env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(page.id)
      );
    }
  }
  for (const folder of targetFolders) {
    if (!sourceFolderPaths.has(folder.path)) {
      statements.push(
        context.env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(
          folder.id
        )
      );
    }
  }
  for (const folder of sourceFolders) {
    const targetFolder = targetFolderByPath.get(folder.path);
    if (targetFolder) {
      statements.push(
        context.env.DB.prepare(
          `UPDATE folders
             SET parent_id = ?, name = ?, slug = ?, position = ?, path = ?,
                 icon = ?, ai_generation_job_id = ?, ai_pending_review = ?,
                 updated_at = ?
             WHERE id = ?`
        ).bind(
          folder.parentId ? (folderIds.get(folder.parentId) ?? null) : null,
          folder.name,
          folder.slug,
          folder.position,
          folder.path,
          folder.icon,
          folder.aiGenerationJobId,
          folder.aiPendingReview ? 1 : 0,
          now,
          targetFolder.id
        )
      );
    } else {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO folders (
             id, branch_id, parent_id, name, slug, position, path, icon,
             ai_generation_job_id, ai_pending_review,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          folderIds.get(folder.id)!,
          mergeRequest.targetBranchId,
          folder.parentId ? (folderIds.get(folder.parentId) ?? null) : null,
          folder.name,
          folder.slug,
          folder.position,
          folder.path,
          folder.icon,
          folder.aiGenerationJobId,
          folder.aiPendingReview ? 1 : 0,
          now,
          now
        )
      );
    }
  }
  for (const page of sourcePages) {
    const targetPage = targetPageByPath.get(page.path);
    const pageId = targetPage?.id ?? crypto.randomUUID();
    if (targetPage) {
      statements.push(
        context.env.DB.prepare(
          `UPDATE pages
             SET folder_id = ?, title = ?, subtitle = ?, slug = ?, path = ?,
                 position = ?, is_published = ?, icon = ?, description = ?,
                 title_section_hidden = ?, title_icon_hidden = ?,
                 seo_title = ?, seo_description = ?, og_image_asset_id = ?,
                 noindex = ?, ai_generated = ?, ai_generation_job_id = ?,
                 ai_pending_review = ?, ai_folder_slug = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
          page.folderId ? (folderIds.get(page.folderId) ?? null) : null,
          page.title,
          page.subtitle,
          page.slug,
          page.path,
          page.position,
          page.isPublished ? 1 : 0,
          page.icon,
          page.description,
          page.titleSectionHidden ? 1 : 0,
          page.titleIconHidden ? 1 : 0,
          page.seoTitle,
          page.seoDescription,
          page.ogImageAssetId,
          page.noindex ? 1 : 0,
          page.aiGenerated ? 1 : 0,
          page.aiGenerationJobId,
          page.aiPendingReview ? 1 : 0,
          page.aiFolderSlug,
          now,
          targetPage.id
        )
      );
    } else {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO pages (
             id, branch_id, folder_id, title, subtitle, slug, path, position,
             is_published, icon, description, title_section_hidden,
             title_icon_hidden, seo_title, seo_description, og_image_asset_id,
             noindex, ai_generated, ai_generation_job_id, ai_pending_review,
             ai_folder_slug, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          pageId,
          mergeRequest.targetBranchId,
          page.folderId ? (folderIds.get(page.folderId) ?? null) : null,
          page.title,
          page.subtitle,
          page.slug,
          page.path,
          page.position,
          page.isPublished ? 1 : 0,
          page.icon,
          page.description,
          page.titleSectionHidden ? 1 : 0,
          page.titleIconHidden ? 1 : 0,
          page.seoTitle,
          page.seoDescription,
          page.ogImageAssetId,
          page.noindex ? 1 : 0,
          page.aiGenerated ? 1 : 0,
          page.aiGenerationJobId,
          page.aiPendingReview ? 1 : 0,
          page.aiFolderSlug,
          now,
          now
        )
      );
    }
    const content = contentByPage.get(page.id);
    if (targetContentByPage.has(pageId)) {
      statements.push(
        context.env.DB.prepare(
          `UPDATE page_contents
             SET content = ?, mdx_cache = ?, updated_by = ?, updated_at = ?
             WHERE page_id = ?`
        ).bind(
          content?.content ?? "[]",
          content?.mdxCache ?? null,
          content?.updatedBy ?? null,
          now,
          pageId
        )
      );
    } else {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO page_contents (
               id, page_id, content, mdx_cache, updated_by, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          pageId,
          content?.content ?? "[]",
          content?.mdxCache ?? null,
          content?.updatedBy ?? null,
          now
        )
      );
    }
  }
  await context.env.DB.batch(statements);
  await rebuildProjectSearchIndex(context.env.DB, mergeRequest.projectId);
}

export function createMergeRequestRoutes(
  authorize?: ProjectAuthorizer,
  publishEvent?: DataMutationEventPublisher
) {
  return new Hono<WorkerEnv>()
    .get(
      "/project/:projectId",
      zValidator("query", statusQuery),
      async (context) => {
        const projectId = context.req.param("projectId");
        await authorize?.(accessRequest(context), projectId);
        const { status } = context.req.valid("query");
        const db = createDatabase(context.env.DB);
        const rows = await db
          .select()
          .from(mergeRequests)
          .where(
            status
              ? and(
                  eq(mergeRequests.projectId, projectId),
                  eq(mergeRequests.status, status)
                )
              : eq(mergeRequests.projectId, projectId)
          )
          .orderBy(desc(mergeRequests.createdAt));
        return context.json(await hydrate(context, rows));
      }
    )
    .get("/project/:projectId/counts", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({ status: mergeRequests.status })
        .from(mergeRequests)
        .where(eq(mergeRequests.projectId, projectId));
      return context.json({
        open: rows.filter((row) => row.status === "open").length,
        merged: rows.filter((row) => row.status === "merged").length,
        closed: rows.filter((row) => row.status === "closed").length,
      });
    })
    .get("/project/:projectId/open-count", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({ id: mergeRequests.id })
        .from(mergeRequests)
        .where(
          and(
            eq(mergeRequests.projectId, projectId),
            eq(mergeRequests.status, "open")
          )
        );
      return context.json(rows.length);
    })
    .get("/source/:sourceBranchId/open", async (context) => {
      const db = createDatabase(context.env.DB);
      const branch = await db.query.branches.findFirst({
        where: eq(branches.id, context.req.param("sourceBranchId")),
      });
      if (!branch) throw new ApiError("Branch not found.", 404);
      await authorize?.(accessRequest(context), branch.projectId);
      return context.json(
        (await db.query.mergeRequests.findFirst({
          where: and(
            eq(mergeRequests.sourceBranchId, branch.id),
            eq(mergeRequests.status, "open")
          ),
        })) ?? null
      );
    })
    .get("/:mergeRequestId/comments", async (context) => {
      const { mergeRequest } = await requestFor(
        context,
        context.req.param("mergeRequestId"),
        authorize
      );
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({ comment: mergeRequestComments, user: users })
        .from(mergeRequestComments)
        .leftJoin(users, eq(mergeRequestComments.createdBy, users.id))
        .where(eq(mergeRequestComments.mergeRequestId, mergeRequest.id))
        .orderBy(mergeRequestComments.createdAt);
      return context.json(
        rows.map(({ comment, user }) => ({
          ...comment,
          creator: user
            ? {
                name: user.name || user.email,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        }))
      );
    })
    .get("/:mergeRequestId", async (context) => {
      const { mergeRequest } = await requestFor(
        context,
        context.req.param("mergeRequestId"),
        authorize
      );
      return context.json((await hydrate(context, [mergeRequest]))[0]!);
    })
    .post("/", zValidator("json", createInput), async (context) => {
      const input = context.req.valid("json");
      const access = await authorize?.(accessRequest(context), input.projectId);
      if (input.sourceBranchId === input.targetBranchId) {
        throw new ApiError("Source and target branches must differ.", 422);
      }
      const db = createDatabase(context.env.DB);
      const branchRows = await db
        .select()
        .from(branches)
        .where(eq(branches.projectId, input.projectId));
      if (
        !branchRows.some((branch) => branch.id === input.sourceBranchId) ||
        !branchRows.some((branch) => branch.id === input.targetBranchId)
      ) {
        throw new ApiError("A branch does not belong to this project.", 422);
      }
      const duplicate = await db.query.mergeRequests.findFirst({
        where: and(
          eq(mergeRequests.sourceBranchId, input.sourceBranchId),
          eq(mergeRequests.targetBranchId, input.targetBranchId),
          eq(mergeRequests.status, "open")
        ),
      });
      if (duplicate)
        throw new ApiError("An open merge request already exists.", 409);
      const id = crypto.randomUUID();
      const now = Date.now();
      const creatorId = effectiveUser(access, input.createdBy);
      await db.insert(mergeRequests).values({
        id,
        ...input,
        createdBy: creatorId,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      await publishEvent?.(context, {
        type: "merge_request.created",
        mergeRequestId: id,
        projectId: input.projectId,
        creatorId,
      });
      return context.json({ id }, 201);
    })
    .patch(
      "/:mergeRequestId",
      zValidator("json", updateInput),
      async (context) => {
        const { mergeRequest } = await requestFor(
          context,
          context.req.param("mergeRequestId"),
          authorize
        );
        const db = createDatabase(context.env.DB);
        await db
          .update(mergeRequests)
          .set({ ...context.req.valid("json"), updatedAt: Date.now() })
          .where(eq(mergeRequests.id, mergeRequest.id));
        return context.json({ id: mergeRequest.id });
      }
    )
    .post(
      "/:mergeRequestId/comments",
      zValidator("json", commentInput),
      async (context) => {
        const { mergeRequest, access } = await requestFor(
          context,
          context.req.param("mergeRequestId"),
          authorize
        );
        const input = context.req.valid("json");
        const id = crypto.randomUUID();
        const now = Date.now();
        const db = createDatabase(context.env.DB);
        await db.insert(mergeRequestComments).values({
          id,
          mergeRequestId: mergeRequest.id,
          ...input,
          createdBy: effectiveUser(access, input.createdBy),
          createdAt: now,
          updatedAt: now,
        });
        return context.json({ id }, 201);
      }
    )
    .post(
      "/:mergeRequestId/close",
      zValidator("json", closeInput),
      async (context) => {
        const { mergeRequest, access } = await requestFor(
          context,
          context.req.param("mergeRequestId"),
          authorize
        );
        if (mergeRequest.status !== "open")
          throw new ApiError("Only open merge requests can be closed.", 409);
        const db = createDatabase(context.env.DB);
        await db
          .update(mergeRequests)
          .set({
            status: "closed",
            closedBy: effectiveUser(access, context.req.valid("json").closedBy),
            closedAt: Date.now(),
            updatedAt: Date.now(),
          })
          .where(eq(mergeRequests.id, mergeRequest.id));
        return context.json({ id: mergeRequest.id });
      }
    )
    .post("/:mergeRequestId/reopen", async (context) => {
      const { mergeRequest } = await requestFor(
        context,
        context.req.param("mergeRequestId"),
        authorize
      );
      if (mergeRequest.status !== "closed")
        throw new ApiError("Only closed merge requests can be reopened.", 409);
      const db = createDatabase(context.env.DB);
      await db
        .update(mergeRequests)
        .set({
          status: "open",
          closedBy: null,
          closedAt: null,
          updatedAt: Date.now(),
        })
        .where(eq(mergeRequests.id, mergeRequest.id));
      return context.json({ id: mergeRequest.id });
    })
    .post(
      "/:mergeRequestId/merge",
      zValidator("json", mergeInput),
      async (context) => {
        const { mergeRequest, access } = await requestFor(
          context,
          context.req.param("mergeRequestId"),
          authorize
        );
        if (mergeRequest.status !== "open")
          throw new ApiError("Only open merge requests can be merged.", 409);
        await mergeBranches(context, mergeRequest);
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        const mergedById = effectiveUser(access, input.mergedBy);
        await db
          .update(mergeRequests)
          .set({
            status: "merged",
            mergedBy: mergedById,
            mergedAt: Date.now(),
            resolutions: input.resolutions,
            updatedAt: Date.now(),
          })
          .where(eq(mergeRequests.id, mergeRequest.id));
        await publishEvent?.(context, {
          type: "merge_request.merged",
          mergeRequestId: mergeRequest.id,
          projectId: mergeRequest.projectId,
          creatorId: mergeRequest.createdBy,
          mergedById,
        });
        return context.json({ id: mergeRequest.id });
      }
    );
}

export const mergeRequestRoutes = createMergeRequestRoutes();
