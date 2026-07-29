import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { branches, folders, pageContents, pages } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { D1PreparedStatementBinding, WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";

const createBranchInput = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  sourceBranchId: z.string().min(1),
});

const renameBranchInput = z.object({
  name: z.string().min(1).max(120),
});

const changesQuery = z.object({
  compareToBranchId: z.string().min(1),
});

const branchNamePattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function normalizeBranchName(value: string): string {
  const normalized = value.toLowerCase().trim();
  if (!branchNamePattern.test(normalized)) {
    throw new ApiError(
      "Branch name must be lowercase alphanumeric with hyphens and cannot start or end with a hyphen.",
      422
    );
  }
  return normalized;
}

function hashContent(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "id")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeForHash(child)])
    );
  }
  return value;
}

function semanticHash(value: string): string {
  try {
    return hashContent(JSON.stringify(normalizeForHash(JSON.parse(value))));
  } catch {
    return hashContent(value);
  }
}

function regenerateBlockIds(value: string): string {
  try {
    const visit = (items: unknown[]): unknown[] =>
      items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const block = item as Record<string, unknown>;
        return {
          ...block,
          id: crypto.randomUUID(),
          ...(Array.isArray(block.children)
            ? { children: visit(block.children) }
            : {}),
        };
      });
    return JSON.stringify(visit(JSON.parse(value) as unknown[]));
  } catch {
    return value;
  }
}

async function branchFor(context: Context<WorkerEnv>, branchId: string) {
  const db = createDatabase(context.env.DB);
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });
  if (!branch) throw new ApiError("Branch not found.", 404);
  return branch;
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

export function createBranchesRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get("/project/:projectId", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      return context.json(
        await db
          .select()
          .from(branches)
          .where(
            and(eq(branches.projectId, projectId), isNull(branches.deletedAt))
          )
      );
    })
    .get(
      "/:branchId/changes",
      zValidator("query", changesQuery),
      async (context) => {
        const branchId = context.req.param("branchId");
        const { compareToBranchId } = context.req.valid("query");
        const [source, target] = await Promise.all([
          authorizeBranch(context, branchId, authorize),
          authorizeBranch(context, compareToBranchId, authorize),
        ]);
        if (source.projectId !== target.projectId) {
          throw new ApiError("Branches belong to different projects.", 409);
        }
        const db = createDatabase(context.env.DB);
        const [sourceRows, targetRows] = await Promise.all([
          db
            .select({ page: pages, content: pageContents.content })
            .from(pages)
            .leftJoin(pageContents, eq(pageContents.pageId, pages.id))
            .where(eq(pages.branchId, branchId)),
          db
            .select({ page: pages, content: pageContents.content })
            .from(pages)
            .leftJoin(pageContents, eq(pageContents.pageId, pages.id))
            .where(eq(pages.branchId, compareToBranchId)),
        ]);
        const targetByPath = new Map(
          targetRows.map((row) => [row.page.path, row])
        );
        if (
          sourceRows.length !== targetRows.length ||
          sourceRows.some((row) => !targetByPath.has(row.page.path))
        ) {
          return context.json({ hasChanges: true });
        }
        const changed = sourceRows.some((row) => {
          const other = targetByPath.get(row.page.path);
          return (
            !other ||
            row.page.title !== other.page.title ||
            row.page.description !== other.page.description ||
            semanticHash(row.content ?? "") !==
              semanticHash(other.content ?? "")
          );
        });
        return context.json({ hasChanges: changed });
      }
    )
    .get("/project/:projectId/name/:name", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      return context.json(
        (await db.query.branches.findFirst({
          where: and(
            eq(branches.projectId, projectId),
            eq(branches.name, context.req.param("name")),
            isNull(branches.deletedAt)
          ),
        })) ?? null
      );
    })
    .get("/:branchId", async (context) => {
      return context.json(
        await authorizeBranch(context, context.req.param("branchId"), authorize)
      );
    })
    .post("/", zValidator("json", createBranchInput), async (context) => {
      const input = context.req.valid("json");
      await authorize?.(accessRequest(context), input.projectId);
      const source = await branchFor(context, input.sourceBranchId);
      if (source.projectId !== input.projectId) {
        throw new ApiError("Source branch belongs to another project.", 409);
      }
      const name = normalizeBranchName(input.name);
      const db = createDatabase(context.env.DB);
      const conflict = await db.query.branches.findFirst({
        where: and(
          eq(branches.projectId, input.projectId),
          eq(branches.name, name),
          isNull(branches.deletedAt)
        ),
      });
      if (conflict) {
        throw new ApiError(`A branch named "${name}" already exists.`, 409);
      }

      const [sourceFolders, sourcePages] = await Promise.all([
        db
          .select()
          .from(folders)
          .where(eq(folders.branchId, input.sourceBranchId)),
        db
          .select({ page: pages, content: pageContents })
          .from(pages)
          .leftJoin(pageContents, eq(pageContents.pageId, pages.id))
          .where(eq(pages.branchId, input.sourceBranchId)),
      ]);
      const id = crypto.randomUUID();
      const now = Date.now();
      const folderIds = new Map(
        sourceFolders.map((folder) => [folder.id, crypto.randomUUID()])
      );
      const statements: D1PreparedStatementBinding[] = [
        context.env.DB.prepare(
          `INSERT INTO branches (
              id, project_id, name, is_default, is_locked, source_branch_id,
              created_at, updated_at
            ) VALUES (?, ?, ?, 0, 0, ?, ?, ?)`
        ).bind(id, input.projectId, name, input.sourceBranchId, now, now),
      ];
      for (const folder of sourceFolders) {
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO folders (
                id, branch_id, parent_id, name, slug, position, path, icon,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            folderIds.get(folder.id)!,
            id,
            folder.parentId ? (folderIds.get(folder.parentId) ?? null) : null,
            folder.name,
            folder.slug,
            folder.position,
            folder.path,
            folder.icon,
            now,
            now
          )
        );
      }
      const pageHashes: Record<string, string> = {};
      for (const { page, content } of sourcePages) {
        const pageId = crypto.randomUUID();
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO pages (
                id, branch_id, folder_id, title, slug, path, position,
                is_published, description, icon, subtitle,
                title_section_hidden, title_icon_hidden, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            pageId,
            id,
            page.folderId ? (folderIds.get(page.folderId) ?? null) : null,
            page.title,
            page.slug,
            page.path,
            page.position,
            page.isPublished ? 1 : 0,
            page.description,
            page.icon,
            page.subtitle,
            page.titleSectionHidden ? 1 : 0,
            page.titleIconHidden ? 1 : 0,
            now,
            now
          )
        );
        if (content) {
          pageHashes[page.path] = hashContent(content.content);
          statements.push(
            context.env.DB.prepare(
              `INSERT INTO page_contents (
                  id, page_id, content, mdx_cache, updated_at
                ) VALUES (?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              pageId,
              regenerateBlockIds(content.content),
              content.mdxCache,
              now
            )
          );
        }
      }
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO branch_snapshots (
              id, branch_id, source_branch_id, page_hashes, folder_paths,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          id,
          input.sourceBranchId,
          JSON.stringify(pageHashes),
          JSON.stringify(sourceFolders.map((folder) => folder.path)),
          now
        )
      );
      if (statements.length > 100) {
        throw new ApiError(
          "This branch is too large for synchronous cloning; use the asynchronous clone endpoint.",
          413,
          "branch_clone_requires_workflow"
        );
      }
      await context.env.DB.batch(statements);
      return context.json({ id }, 201);
    })
    .patch(
      "/:branchId",
      zValidator("json", renameBranchInput),
      async (context) => {
        const branchId = context.req.param("branchId");
        const branch = await authorizeBranch(context, branchId, authorize);
        if (branch.isDefault) {
          throw new ApiError("Cannot rename the default branch.", 409);
        }
        const name = normalizeBranchName(context.req.valid("json").name);
        const db = createDatabase(context.env.DB);
        const conflict = await db.query.branches.findFirst({
          where: and(
            eq(branches.projectId, branch.projectId),
            eq(branches.name, name),
            isNull(branches.deletedAt)
          ),
        });
        if (conflict && conflict.id !== branchId) {
          throw new ApiError(`A branch named "${name}" already exists.`, 409);
        }
        await db
          .update(branches)
          .set({ name, updatedAt: Date.now() })
          .where(eq(branches.id, branchId));
        return context.json({ id: branchId });
      }
    )
    .post("/:branchId/toggle-lock", async (context) => {
      const branchId = context.req.param("branchId");
      const branch = await authorizeBranch(context, branchId, authorize);
      if (!branch.isDefault) {
        throw new ApiError("Only the default branch can be locked.", 409);
      }
      const db = createDatabase(context.env.DB);
      await db
        .update(branches)
        .set({ isLocked: !branch.isLocked, updatedAt: Date.now() })
        .where(eq(branches.id, branchId));
      return context.json({ id: branchId, isLocked: !branch.isLocked });
    })
    .delete("/:branchId", async (context) => {
      const branchId = context.req.param("branchId");
      const branch = await authorizeBranch(context, branchId, authorize);
      if (branch.isDefault) {
        throw new ApiError("Cannot delete the default branch.", 409);
      }
      const db = createDatabase(context.env.DB);
      await db.delete(branches).where(eq(branches.id, branchId));
      return context.json({ deleted: true });
    });
}

export const branchesRoutes = createBranchesRoutes();
