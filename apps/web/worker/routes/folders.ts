import { eq, isNull, max } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { branches, folders, pages, projects } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";

const createFolderInput = z.object({
  branchId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(500),
  slug: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  icon: z.string().nullable().optional(),
  skipBranchLock: z.boolean().optional(),
});

const updateFolderInput = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  position: z.number().int().nonnegative().optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  skipBranchLock: z.boolean().optional(),
});

const reorderFolderInput = z.object({
  newPosition: z.number().int().nonnegative(),
  newParentId: z.string().nullable().optional(),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function branchFor(context: Context<WorkerEnv>, branchId: string) {
  const db = createDatabase(context.env.DB);
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });
  if (!branch) throw new ApiError("Branch not found.", 404);
  return branch;
}

async function folderFor(context: Context<WorkerEnv>, folderId: string) {
  const db = createDatabase(context.env.DB);
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });
  if (!folder) throw new ApiError("Folder not found.", 404);
  return folder;
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

async function authorizeFolder(
  context: Context<WorkerEnv>,
  folderId: string,
  authorize?: ProjectAuthorizer
) {
  const folder = await folderFor(context, folderId);
  const branch = await authorizeBranch(context, folder.branchId, authorize);
  return { folder, branch };
}

async function folderPath(
  context: Context<WorkerEnv>,
  slug: string,
  parentId: string | null | undefined
) {
  if (!parentId) return `/${slug}`;
  const parent = await folderFor(context, parentId);
  return `${parent.path}/${slug}`;
}

export function createFoldersRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get("/project/:projectId", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project?.defaultBranchId) return context.json([]);
      const rows = await db
        .select()
        .from(folders)
        .where(eq(folders.branchId, project.defaultBranchId));
      return context.json(rows.filter((folder) => !folder.aiPendingReview));
    })
    .get("/branch/:branchId", async (context) => {
      const branchId = context.req.param("branchId");
      await authorizeBranch(context, branchId, authorize);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select()
        .from(folders)
        .where(eq(folders.branchId, branchId));
      return context.json(rows.filter((folder) => !folder.aiPendingReview));
    })
    .get("/:folderId", async (context) => {
      const { folder } = await authorizeFolder(
        context,
        context.req.param("folderId"),
        authorize
      );
      return context.json(folder);
    })
    .post("/", zValidator("json", createFolderInput), async (context) => {
      const input = context.req.valid("json");
      const branch = await authorizeBranch(context, input.branchId, authorize);
      if (branch.isLocked && !input.skipBranchLock) {
        throw new ApiError("This branch is locked.", 409);
      }
      const db = createDatabase(context.env.DB);
      const parentId = input.parentId ?? null;
      const slug = input.slug ?? slugify(input.name);
      const path = await folderPath(context, slug, parentId);
      let position = input.position;
      if (position === undefined) {
        const [folderPosition, pagePosition] = await Promise.all([
          db
            .select({ value: max(folders.position) })
            .from(folders)
            .where(
              parentId
                ? eq(folders.parentId, parentId)
                : isNull(folders.parentId)
            ),
          db
            .select({ value: max(pages.position) })
            .from(pages)
            .where(
              parentId ? eq(pages.folderId, parentId) : isNull(pages.folderId)
            ),
        ]);
        position =
          Math.max(
            folderPosition[0]?.value ?? -1,
            pagePosition[0]?.value ?? -1
          ) + 1;
      }
      const id = crypto.randomUUID();
      await db.insert(folders).values({
        id,
        branchId: input.branchId,
        parentId,
        name: input.name,
        slug,
        path,
        position,
        icon: input.icon,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return context.json({ id }, 201);
    })
    .patch(
      "/:folderId",
      zValidator("json", updateFolderInput),
      async (context) => {
        const folderId = context.req.param("folderId");
        const input = context.req.valid("json");
        const { folder, branch } = await authorizeFolder(
          context,
          folderId,
          authorize
        );
        if (branch.isLocked && !input.skipBranchLock) {
          throw new ApiError("This branch is locked.", 409);
        }
        const slug = input.name ? slugify(input.name) : folder.slug;
        const parentId =
          input.parentId !== undefined ? input.parentId : folder.parentId;
        const path = await folderPath(context, slug, parentId);
        const { skipBranchLock: _skip, ...updates } = input;
        const statements = [];
        if (path !== folder.path) {
          statements.push(
            context.env.DB.prepare(
              `UPDATE folders
                 SET path = ? || substr(path, ?), updated_at = ?
                 WHERE branch_id = ? AND path LIKE ?`
            ).bind(
              path,
              folder.path.length + 1,
              Date.now(),
              folder.branchId,
              `${folder.path}/%`
            ),
            context.env.DB.prepare(
              `UPDATE pages
                 SET path = ? || substr(path, ?), updated_at = ?
                 WHERE branch_id = ? AND path LIKE ?`
            ).bind(
              path,
              folder.path.length + 1,
              Date.now(),
              folder.branchId,
              `${folder.path}/%`
            )
          );
        }
        statements.push(
          context.env.DB.prepare(
            `UPDATE folders
               SET name = ?, slug = ?, path = ?, parent_id = ?, position = ?,
                   icon = ?, updated_at = ?
               WHERE id = ?`
          ).bind(
            updates.name ?? folder.name,
            slug,
            path,
            parentId,
            updates.position ?? folder.position,
            updates.icon !== undefined ? updates.icon : folder.icon,
            Date.now(),
            folderId
          )
        );
        await context.env.DB.batch(statements);
        return context.json({ id: folderId });
      }
    )
    .patch(
      "/:folderId/reorder",
      zValidator("json", reorderFolderInput),
      async (context) => {
        const folderId = context.req.param("folderId");
        const input = context.req.valid("json");
        const { folder, branch } = await authorizeFolder(
          context,
          folderId,
          authorize
        );
        if (branch.isLocked) throw new ApiError("This branch is locked.", 409);
        const targetParent =
          input.newParentId !== undefined ? input.newParentId : folder.parentId;
        if (targetParent === folderId) {
          throw new ApiError("Cannot move a folder into itself.", 409);
        }
        if (targetParent) {
          const parent = await folderFor(context, targetParent);
          if (parent.path.startsWith(`${folder.path}/`)) {
            throw new ApiError(
              "Cannot move a folder into one of its descendants.",
              409
            );
          }
        }
        const path = await folderPath(context, folder.slug, targetParent);
        await context.env.DB.batch([
          context.env.DB.prepare(
            `UPDATE folders
               SET position = position - 1, updated_at = ?
               WHERE parent_id IS ? AND position > ? AND id <> ?`
          ).bind(Date.now(), folder.parentId, folder.position, folderId),
          context.env.DB.prepare(
            `UPDATE folders
               SET position = position + 1, updated_at = ?
               WHERE parent_id IS ? AND position >= ? AND id <> ?`
          ).bind(Date.now(), targetParent, input.newPosition, folderId),
          context.env.DB.prepare(
            `UPDATE folders
               SET parent_id = ?, position = ?, path = ?, updated_at = ?
               WHERE id = ?`
          ).bind(targetParent, input.newPosition, path, Date.now(), folderId),
          context.env.DB.prepare(
            `UPDATE folders
               SET path = ? || substr(path, ?), updated_at = ?
               WHERE branch_id = ? AND path LIKE ?`
          ).bind(
            path,
            folder.path.length + 1,
            Date.now(),
            folder.branchId,
            `${folder.path}/%`
          ),
          context.env.DB.prepare(
            `UPDATE pages
               SET path = ? || substr(path, ?), updated_at = ?
               WHERE branch_id = ? AND path LIKE ?`
          ).bind(
            path,
            folder.path.length + 1,
            Date.now(),
            folder.branchId,
            `${folder.path}/%`
          ),
        ]);
        return context.json({ id: folderId });
      }
    )
    .delete("/:folderId", async (context) => {
      const folderId = context.req.param("folderId");
      const { folder, branch } = await authorizeFolder(
        context,
        folderId,
        authorize
      );
      if (branch.isLocked) throw new ApiError("This branch is locked.", 409);
      await context.env.DB.batch([
        context.env.DB.prepare(
          `UPDATE folders SET parent_id = NULL
             WHERE ai_pending_review = 1 AND path LIKE ?`
        ).bind(`${folder.path}/%`),
        context.env.DB.prepare(
          `UPDATE pages SET folder_id = NULL
             WHERE ai_pending_review = 1
               AND (folder_id = ? OR path LIKE ?)`
        ).bind(folderId, `${folder.path}/%`),
        context.env.DB.prepare(
          `DELETE FROM pages
             WHERE COALESCE(ai_pending_review, 0) = 0
               AND (folder_id = ? OR path LIKE ?)`
        ).bind(folderId, `${folder.path}/%`),
        context.env.DB.prepare(
          `DELETE FROM folders
             WHERE COALESCE(ai_pending_review, 0) = 0
               AND (id = ? OR path LIKE ?)`
        ).bind(folderId, `${folder.path}/%`),
      ]);
      return context.json({ deleted: true });
    });
}

export const foldersRoutes = createFoldersRoutes();
