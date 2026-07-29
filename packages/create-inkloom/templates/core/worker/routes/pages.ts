import { and, desc, eq, isNull, max } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
  branches,
  folders,
  pageContents,
  pages,
  pageVersions,
  projects,
  users,
} from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { D1DatabaseBinding, WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";
import { syncPageSearchIndex } from "@/worker/services/search-index";

export interface ProjectAccessRequest {
  db: D1DatabaseBinding;
  workosUserId?: string;
  email?: string;
}

export interface ProjectAccessResult {
  userId?: string;
  role?: string;
}

export type ProjectAuthorizer = (
  request: ProjectAccessRequest,
  projectId: string
) => Promise<ProjectAccessResult | void>;

const createPageInput = z.object({
  projectId: z.string().optional(),
  branchId: z.string().min(1),
  folderId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(500),
  slug: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  isPublished: z.boolean().optional(),
  content: z.string().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional(),
  aiGenerationJobId: z.string().optional(),
});

const updatePageInput = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  slug: z.string().optional(),
  isPublished: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
  folderId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  titleSectionHidden: z.boolean().optional(),
  titleIconHidden: z.boolean().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  ogImageAssetId: z.string().nullable().optional(),
  noindex: z.boolean().optional(),
  skipBranchLock: z.boolean().optional(),
});

const updateContentInput = z.object({
  content: z.string(),
  updatedBy: z.string().optional(),
  skipBranchLock: z.boolean().optional(),
});

const reorderInput = z.object({
  newPosition: z.number().int().nonnegative(),
  newFolderId: z.string().nullable().optional(),
});

const createVersionInput = z.object({
  createdBy: z.string().optional(),
  message: z.string().max(500).optional(),
});

const restoreVersionInput = z.object({
  restoredBy: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashContent(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

async function branchFor(context: Context<WorkerEnv>, branchId: string) {
  const db = createDatabase(context.env.DB);
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });
  if (!branch) throw new ApiError("Branch not found.", 404);
  return branch;
}

async function pageFor(context: Context<WorkerEnv>, pageId: string) {
  const db = createDatabase(context.env.DB);
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });
  if (!page) throw new ApiError("Page not found.", 404);
  return page;
}

export function accessRequest(
  context: Context<WorkerEnv>
): ProjectAccessRequest {
  return {
    db: context.env.DB,
    workosUserId: context.req.header("X-Inkloom-WorkOS-User-Id"),
    email: context.req.header("X-Inkloom-User-Email"),
  };
}

async function authorizeBranch(
  context: Context<WorkerEnv>,
  branchId: string,
  authorize?: ProjectAuthorizer
) {
  const branch = await branchFor(context, branchId);
  await authorize?.(accessRequest(context), branch.projectId);
  return branch;
}

async function authorizePage(
  context: Context<WorkerEnv>,
  pageId: string,
  authorize?: ProjectAuthorizer
) {
  const page = await pageFor(context, pageId);
  const branch = await authorizeBranch(context, page.branchId, authorize);
  return { page, branch };
}

async function pathFor(
  context: Context<WorkerEnv>,
  slug: string,
  folderId: string | null | undefined
) {
  if (!folderId) return `/${slug}`;
  const db = createDatabase(context.env.DB);
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });
  return folder ? `${folder.path}/${slug}` : `/${slug}`;
}

export function createPagesRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get("/project/:projectId", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project?.defaultBranchId) return context.json([]);
      return context.json(
        await db
          .select()
          .from(pages)
          .where(
            and(
              eq(pages.branchId, project.defaultBranchId),
              eq(pages.aiPendingReview, false)
            )
          )
      );
    })
    .get("/branch/:branchId", async (context) => {
      const branchId = context.req.param("branchId");
      await authorizeBranch(context, branchId, authorize);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select()
        .from(pages)
        .where(eq(pages.branchId, branchId));
      return context.json(rows.filter((page) => !page.aiPendingReview));
    })
    .get("/:pageId/content", async (context) => {
      const pageId = context.req.param("pageId");
      await authorizePage(context, pageId, authorize);
      const db = createDatabase(context.env.DB);
      return context.json(
        (await db.query.pageContents.findFirst({
          where: eq(pageContents.pageId, pageId),
        })) ?? null
      );
    })
    .get("/:pageId/versions", async (context) => {
      const pageId = context.req.param("pageId");
      await authorizePage(context, pageId, authorize);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({
          id: pageVersions.id,
          version: pageVersions.version,
          message: pageVersions.message,
          createdAt: pageVersions.createdAt,
          creatorName: users.name,
          creatorAvatarUrl: users.avatarUrl,
        })
        .from(pageVersions)
        .leftJoin(users, eq(pageVersions.createdBy, users.id))
        .where(eq(pageVersions.pageId, pageId))
        .orderBy(desc(pageVersions.version))
        .limit(50);
      return context.json(
        rows.map((row) => ({
          id: row.id,
          version: row.version,
          message: row.message,
          createdAt: row.createdAt,
          creator: row.creatorName
            ? { name: row.creatorName, avatarUrl: row.creatorAvatarUrl }
            : null,
        }))
      );
    })
    .get("/:pageId/versions/:version", async (context) => {
      const pageId = context.req.param("pageId");
      await authorizePage(context, pageId, authorize);
      const db = createDatabase(context.env.DB);
      return context.json(
        (await db.query.pageVersions.findFirst({
          where: and(
            eq(pageVersions.pageId, pageId),
            eq(pageVersions.version, Number(context.req.param("version")))
          ),
        })) ?? null
      );
    })
    .get("/:pageId", async (context) => {
      const { page } = await authorizePage(
        context,
        context.req.param("pageId"),
        authorize
      );
      return context.json(page);
    })
    .post("/", zValidator("json", createPageInput), async (context) => {
      const input = context.req.valid("json");
      const branch = await authorizeBranch(context, input.branchId, authorize);
      if (branch.isLocked) throw new ApiError("This branch is locked.", 409);
      const db = createDatabase(context.env.DB);
      const slug = input.slug || slugify(input.title);
      const folderId = input.folderId ?? null;
      const pagePath = await pathFor(context, slug, folderId);
      let position = input.position;
      if (position === undefined) {
        const [pageCount, folderCount] = await Promise.all([
          db
            .select({ value: max(pages.position) })
            .from(pages)
            .where(
              folderId ? eq(pages.folderId, folderId) : isNull(pages.folderId)
            ),
          db
            .select({ value: max(folders.position) })
            .from(folders)
            .where(
              folderId
                ? eq(folders.parentId, folderId)
                : isNull(folders.parentId)
            ),
        ]);
        position =
          Math.max(pageCount[0]?.value ?? -1, folderCount[0]?.value ?? -1) + 1;
      }
      const id = crypto.randomUUID();
      const contentId = crypto.randomUUID();
      const now = Date.now();
      const content =
        input.content ?? JSON.stringify([{ type: "paragraph", content: [] }]);
      await context.env.DB.batch([
        context.env.DB.prepare(
          `INSERT INTO pages (
              id, branch_id, folder_id, title, slug, path, position,
              is_published, description, icon, ai_generated,
              subtitle, ai_generation_job_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          input.branchId,
          folderId,
          input.title,
          slug,
          pagePath,
          position,
          input.isPublished ? 1 : 0,
          input.description ?? null,
          input.icon ?? null,
          input.aiGenerated ? 1 : 0,
          input.subtitle ?? null,
          input.aiGenerationJobId ?? null,
          now,
          now
        ),
        context.env.DB.prepare(
          `INSERT INTO page_contents (id, page_id, content, updated_at)
             VALUES (?, ?, ?, ?)`
        ).bind(contentId, id, content, now),
      ]);
      await syncPageSearchIndex(context.env.DB, id);
      return context.json({ id }, 201);
    })
    .patch("/:pageId", zValidator("json", updatePageInput), async (context) => {
      const pageId = context.req.param("pageId");
      const input = context.req.valid("json");
      const { page, branch } = await authorizePage(context, pageId, authorize);
      if (branch.isLocked && !input.skipBranchLock) {
        throw new ApiError("This branch is locked.", 409);
      }
      const db = createDatabase(context.env.DB);
      const { skipBranchLock: _skip, ...updates } = input;
      let slug = input.slug ?? page.slug;
      let path = page.path;
      if (input.title !== undefined || input.slug !== undefined) {
        slug = input.slug ?? slugify(input.title ?? page.title);
        path = await pathFor(
          context,
          slug,
          input.folderId !== undefined ? input.folderId : page.folderId
        );
      }
      await db
        .update(pages)
        .set({
          ...updates,
          slug,
          path,
          updatedAt: Date.now(),
        })
        .where(eq(pages.id, pageId));
      await syncPageSearchIndex(context.env.DB, pageId);
      return context.json({ id: pageId });
    })
    .put(
      "/:pageId/content",
      zValidator("json", updateContentInput),
      async (context) => {
        const pageId = context.req.param("pageId");
        const input = context.req.valid("json");
        const { branch } = await authorizePage(context, pageId, authorize);
        if (branch.isLocked && !input.skipBranchLock) {
          throw new ApiError("This branch is locked.", 409);
        }
        const db = createDatabase(context.env.DB);
        const existing = await db.query.pageContents.findFirst({
          where: eq(pageContents.pageId, pageId),
        });
        const id = existing?.id ?? crypto.randomUUID();
        if (existing) {
          await db
            .update(pageContents)
            .set({
              content: input.content,
              updatedBy: input.updatedBy,
              updatedAt: Date.now(),
            })
            .where(eq(pageContents.id, existing.id));
        } else {
          await db.insert(pageContents).values({
            id,
            pageId,
            content: input.content,
            updatedBy: input.updatedBy,
            updatedAt: Date.now(),
          });
        }
        await syncPageSearchIndex(context.env.DB, pageId);
        return context.json({ id });
      }
    )
    .post(
      "/:pageId/versions",
      zValidator("json", createVersionInput),
      async (context) => {
        const pageId = context.req.param("pageId");
        await authorizePage(context, pageId, authorize);
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        const content = await db.query.pageContents.findFirst({
          where: eq(pageContents.pageId, pageId),
        });
        if (!content) throw new ApiError("Page has no content.", 409);
        const [latest] = await db
          .select({ value: max(pageVersions.version) })
          .from(pageVersions)
          .where(eq(pageVersions.pageId, pageId));
        const id = crypto.randomUUID();
        await db.insert(pageVersions).values({
          id,
          pageId,
          version: (latest?.value ?? 0) + 1,
          content: content.content,
          contentHash: hashContent(content.content),
          createdBy: input.createdBy,
          message: input.message,
          createdAt: Date.now(),
        });
        return context.json({ id });
      }
    )
    .post(
      "/:pageId/versions/:version/restore",
      zValidator("json", restoreVersionInput),
      async (context) => {
        const pageId = context.req.param("pageId");
        await authorizePage(context, pageId, authorize);
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        const version = await db.query.pageVersions.findFirst({
          where: and(
            eq(pageVersions.pageId, pageId),
            eq(pageVersions.version, Number(context.req.param("version")))
          ),
        });
        if (!version) throw new ApiError("Version not found.", 404);
        const current = await db.query.pageContents.findFirst({
          where: eq(pageContents.pageId, pageId),
        });
        if (!current) throw new ApiError("Page has no content.", 409);
        const existing = await db
          .select()
          .from(pageVersions)
          .where(eq(pageVersions.pageId, pageId));
        const currentHash = hashContent(current.content);
        const alreadySaved = existing.some(
          (entry) =>
            (entry.contentHash ?? hashContent(entry.content)) === currentHash
        );
        const statements = [];
        if (!alreadySaved) {
          const nextVersion =
            existing.reduce(
              (value, entry) => Math.max(value, entry.version),
              0
            ) + 1;
          statements.push(
            context.env.DB.prepare(
              `INSERT INTO page_versions (
                  id, page_id, version, content, content_hash, created_by,
                  message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              pageId,
              nextVersion,
              current.content,
              currentHash,
              input.restoredBy ?? null,
              "Auto-saved before restore",
              Date.now()
            )
          );
        }
        statements.push(
          context.env.DB.prepare(
            `UPDATE page_contents
               SET content = ?, updated_by = ?, updated_at = ?
               WHERE id = ?`
          ).bind(
            version.content,
            input.restoredBy ?? current.updatedBy,
            Date.now(),
            current.id
          )
        );
        await context.env.DB.batch(statements);
        await syncPageSearchIndex(context.env.DB, pageId);
        return context.json({ content: version.content });
      }
    )
    .patch(
      "/:pageId/reorder",
      zValidator("json", reorderInput),
      async (context) => {
        const pageId = context.req.param("pageId");
        const input = context.req.valid("json");
        const { page, branch } = await authorizePage(
          context,
          pageId,
          authorize
        );
        if (branch.isLocked) throw new ApiError("This branch is locked.", 409);
        const targetFolder =
          input.newFolderId !== undefined ? input.newFolderId : page.folderId;
        const newPath = await pathFor(context, page.slug, targetFolder);
        const statements = [
          context.env.DB.prepare(
            `UPDATE pages
               SET position = position - 1, updated_at = ?
               WHERE folder_id IS ? AND position > ? AND id <> ?`
          ).bind(Date.now(), page.folderId, page.position, pageId),
          context.env.DB.prepare(
            `UPDATE pages
               SET position = position + 1, updated_at = ?
               WHERE folder_id IS ? AND position >= ? AND id <> ?`
          ).bind(Date.now(), targetFolder, input.newPosition, pageId),
          context.env.DB.prepare(
            `UPDATE pages
               SET folder_id = ?, position = ?, path = ?, updated_at = ?
               WHERE id = ?`
          ).bind(targetFolder, input.newPosition, newPath, Date.now(), pageId),
        ];
        await context.env.DB.batch(statements);
        await syncPageSearchIndex(context.env.DB, pageId);
        return context.json({ id: pageId });
      }
    )
    .delete("/:pageId", async (context) => {
      const pageId = context.req.param("pageId");
      const { branch } = await authorizePage(context, pageId, authorize);
      if (branch.isLocked) throw new ApiError("This branch is locked.", 409);
      const db = createDatabase(context.env.DB);
      await db.delete(pages).where(eq(pages.id, pageId));
      return context.json({ deleted: true });
    });
}

export const pagesRoutes = createPagesRoutes();
