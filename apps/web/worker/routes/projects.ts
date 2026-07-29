import { and, count, desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { projects } from "@/db/schema";
import type { JsonObject } from "@/db/schema";
import { getDefaultTemplate, getTemplateById } from "@/lib/templates";
import type { TemplateId } from "@/lib/templates";
import { createDatabase } from "@/worker/db";
import type { D1PreparedStatementBinding, WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";

const LOCAL_ORG_ID = "local";

const createProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000).optional(),
  templateId: z.enum(["blank", "product-docs", "sdk-api-docs"]).optional(),
  skipFolderPaths: z.array(z.string()).optional(),
  workosOrgId: z.string().optional(),
});

const updateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1_000).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const updateSettingsInput = z.record(z.unknown());

const updateCfSlugInput = z.object({
  cfSlug: z.string().trim().min(1).max(120).nullable(),
});

const cfSlugAvailabilityQuery = z.object({
  excludeProjectId: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const projectsRoutes = new Hono<WorkerEnv>()
  .get("/", async (context) => {
    const db = createDatabase(context.env.DB);
    const rows = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt));

    return context.json(rows);
  })
  .get("/by-org/:workosOrgId", async (context) => {
    // Core mode is a single tenant. Retaining the org-shaped route gives the
    // shared dashboard one stable contract in both OSS and platform builds.
    const db = createDatabase(context.env.DB);
    const rows = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt));

    return context.json(
      rows.map((project) => ({ ...project, plan: project.plan ?? "free" }))
    );
  })
  .get("/:projectId", async (context) => {
    const db = createDatabase(context.env.DB);
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, context.req.param("projectId")),
    });

    return context.json(project ?? null);
  })
  .get(
    "/cf-slug/:slug/available",
    zValidator("query", cfSlugAvailabilityQuery),
    async (context) => {
      const db = createDatabase(context.env.DB);
      const { excludeProjectId } = context.req.valid("query");
      const conditions = [eq(projects.cfSlug, context.req.param("slug"))];
      if (excludeProjectId) {
        conditions.push(ne(projects.id, excludeProjectId));
      }
      const [result] = await db
        .select({ total: count() })
        .from(projects)
        .where(and(...conditions));
      return context.json({ available: (result?.total ?? 0) === 0 });
    }
  )
  .patch(
    "/:projectId",
    zValidator("json", updateProjectInput),
    async (context) => {
      const input = context.req.valid("json");
      const db = createDatabase(context.env.DB);
      const projectId = context.req.param("projectId");
      const current = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!current) throw new ApiError("Project not found.", 404);

      const slug = input.name ? slugify(input.name) : current.slug;
      if (input.name) {
        const conflict = await db.query.projects.findFirst({
          where: and(
            eq(projects.workosOrgId, current.workosOrgId ?? LOCAL_ORG_ID),
            eq(projects.slug, slug),
            ne(projects.id, projectId)
          ),
        });
        if (conflict) {
          throw new ApiError(
            `A project with the slug "${slug}" already exists.`,
            409
          );
        }
      }

      await db
        .update(projects)
        .set({
          ...input,
          ...(input.name ? { slug } : {}),
          updatedAt: Date.now(),
        })
        .where(eq(projects.id, projectId));
      return context.json({ updated: true });
    }
  )
  .patch(
    "/:projectId/settings",
    zValidator("json", updateSettingsInput),
    async (context) => {
      const input = context.req.valid("json");
      const db = createDatabase(context.env.DB);
      const projectId = context.req.param("projectId");
      const current = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!current) throw new ApiError("Project not found.", 404);
      await db
        .update(projects)
        .set({
          settings: {
            ...(current.settings ?? {}),
            ...(input as JsonObject),
          },
          updatedAt: Date.now(),
        })
        .where(eq(projects.id, projectId));
      return context.json({ updated: true });
    }
  )
  .patch(
    "/:projectId/cf-slug",
    zValidator("json", updateCfSlugInput),
    async (context) => {
      const input = context.req.valid("json");
      const db = createDatabase(context.env.DB);
      if (input.cfSlug) {
        const existing = await db.query.projects.findFirst({
          where: and(
            eq(projects.cfSlug, input.cfSlug),
            ne(projects.id, context.req.param("projectId"))
          ),
        });
        if (existing)
          throw new ApiError("Deployment slug is already in use.", 409);
      }
      await db
        .update(projects)
        .set({ cfSlug: input.cfSlug, updatedAt: Date.now() })
        .where(eq(projects.id, context.req.param("projectId")));
      return context.json({ updated: true });
    }
  )
  .delete("/:projectId", async (context) => {
    const db = createDatabase(context.env.DB);
    await db
      .delete(projects)
      .where(eq(projects.id, context.req.param("projectId")));
    return context.json({ deleted: true });
  })
  .post("/", zValidator("json", createProjectInput), async (context) => {
    const input = context.req.valid("json");
    const db = createDatabase(context.env.DB);
    const slug = slugify(input.name);

    if (!slug) {
      throw new ApiError("Project name must contain a letter or number.", 422);
    }

    const existing = await db.query.projects.findFirst({
      where: and(
        eq(projects.workosOrgId, LOCAL_ORG_ID),
        eq(projects.slug, slug)
      ),
    });
    if (existing) {
      throw new ApiError(
        `A project with the slug "${slug}" already exists.`,
        409,
        "project_slug_conflict"
      );
    }

    const template =
      getTemplateById(input.templateId as TemplateId) ?? getDefaultTemplate();
    const skippedFolderPaths = new Set(input.skipFolderPaths ?? []);
    const now = Date.now();
    const projectId = crypto.randomUUID();
    const branchId = crypto.randomUUID();
    const folderIds = new Map<string, string>();

    const statements: D1PreparedStatementBinding[] = [
      context.env.DB.prepare(
        `INSERT INTO projects (
          id, workos_org_id, name, slug, description, is_public,
          default_branch_id, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        projectId,
        LOCAL_ORG_ID,
        input.name,
        slug,
        input.description ?? null,
        0,
        branchId,
        JSON.stringify({ showBranding: true }),
        now,
        now
      ),
      context.env.DB.prepare(
        `INSERT INTO branches (
          id, project_id, name, is_default, is_locked, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(branchId, projectId, "main", 1, 0, now, now),
    ];

    for (const folder of template.folders) {
      if (skippedFolderPaths.has(folder.path)) continue;
      const folderId = crypto.randomUUID();
      folderIds.set(folder.path, folderId);
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO folders (
            id, branch_id, name, slug, position, path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          folderId,
          branchId,
          folder.name,
          folder.slug,
          folder.position,
          folder.path,
          now,
          now
        )
      );
    }

    for (const page of template.pages) {
      if (
        page.folderPath &&
        (skippedFolderPaths.has(page.folderPath) ||
          !folderIds.has(page.folderPath))
      ) {
        continue;
      }

      const pageId = crypto.randomUUID();
      const content = JSON.stringify(page.content).replace(
        /\[Product Name\]/g,
        input.name
      );
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO pages (
            id, branch_id, folder_id, title, slug, path, position,
            is_published, subtitle, icon, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          pageId,
          branchId,
          page.folderPath ? (folderIds.get(page.folderPath) ?? null) : null,
          page.title.replace(/\[Product Name\]/g, input.name),
          page.slug,
          page.path,
          page.position,
          page.isPublished ? 1 : 0,
          page.subtitle?.replace(/\[Product Name\]/g, input.name) ?? null,
          page.icon ?? null,
          now,
          now
        ),
        context.env.DB.prepare(
          `INSERT INTO page_contents (
            id, page_id, content, updated_at
          ) VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), pageId, content, now)
      );
    }

    const localUser = await context.env.DB.prepare(
      "SELECT id FROM users WHERE workos_user_id = ? LIMIT 1"
    )
      .bind(LOCAL_ORG_ID)
      .first<{ id: string }>();
    if (localUser) {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO project_members (
            id, project_id, user_id, role, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), projectId, localUser.id, "admin", now, now)
      );
    }

    // D1 batches execute as one transaction and roll back the complete project
    // scaffold if any statement fails.
    await context.env.DB.batch(statements);

    return context.json({ id: projectId }, 201);
  });
