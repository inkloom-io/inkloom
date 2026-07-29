import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
  branches,
  deploymentConfigs,
  deployments,
  folders,
  pageContents,
  pages,
  projects,
} from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";

const deploymentStatus = z.enum([
  "queued",
  "building",
  "ready",
  "error",
  "canceled",
]);
const deploymentTarget = z.enum(["production", "preview"]);
const buildPhase = z.enum(["generating", "uploading", "propagating"]);

const createInput = z.object({
  projectId: z.string().min(1),
  branchId: z.string().min(1),
  externalDeploymentId: z.string().optional(),
  cfProjectName: z.string().optional(),
  target: deploymentTarget.default("preview"),
  contentHashes: z.record(z.string(), z.string()).optional(),
  buildPhase: buildPhase.optional(),
});
const statusInput = z.object({
  status: deploymentStatus,
  url: z.string().optional(),
  error: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
const phaseInput = z.object({
  buildPhase,
  externalDeploymentId: z.string().optional(),
  cfProjectName: z.string().optional(),
  contentHashes: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
});
const listInput = z.object({
  target: deploymentTarget.optional(),
});
const changesInput = z.object({
  branchId: z.string().optional(),
});
const configInput = z.object({
  projectId: z.string().min(1),
  cfProjectName: z.string().nullable().optional(),
  liveDeploymentId: z.string().nullable().optional(),
  accessAppId: z.string().nullable().optional(),
  productionUrl: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
});
const liveInput = z.object({
  deploymentId: z.string().min(1),
});

function hashContent(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function hashesMatch(
  current: Record<string, string>,
  deployed: Record<string, string>
) {
  const currentKeys = Object.keys(current);
  const deployedKeys = Object.keys(deployed);
  return (
    currentKeys.length === deployedKeys.length &&
    currentKeys.every((key) => current[key] === deployed[key])
  );
}

async function deploymentFor(
  context: Context<WorkerEnv>,
  deploymentId: string,
  authorize?: ProjectAuthorizer
) {
  const db = createDatabase(context.env.DB);
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });
  if (!deployment) throw new ApiError("Deployment not found.", 404);
  await authorize?.(accessRequest(context), deployment.projectId);
  return deployment;
}

async function currentContentHashes(
  context: Context<WorkerEnv>,
  projectId: string,
  requestedBranchId?: string
) {
  const db = createDatabase(context.env.DB);
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project?.defaultBranchId) return null;
  const branchId = requestedBranchId ?? project.defaultBranchId;

  const [folderRows, pageRows, contentRows] = await Promise.all([
    db.select().from(folders).where(eq(folders.branchId, branchId)),
    db.select().from(pages).where(eq(pages.branchId, branchId)),
    db
      .select({ pageId: pageContents.pageId, content: pageContents.content })
      .from(pageContents)
      .innerJoin(pages, eq(pages.id, pageContents.pageId))
      .where(eq(pages.branchId, branchId)),
  ]);
  const visibleFolders = folderRows.filter(
    (folder) => folder.aiPendingReview !== true
  );
  const folderById = new Map(
    visibleFolders.map((folder) => [folder.id, folder])
  );
  const pathCache = new Map<string, string>();
  const folderPath = (folderId: string, seen = new Set<string>()): string => {
    const cached = pathCache.get(folderId);
    if (cached) return cached;
    const folder = folderById.get(folderId);
    if (!folder || seen.has(folderId)) return "";
    seen.add(folderId);
    const parentPath = folder.parentId ? folderPath(folder.parentId, seen) : "";
    const path = `${parentPath}/${folder.slug}`;
    pathCache.set(folderId, path);
    return path;
  };
  const contentByPage = new Map(
    contentRows.map((content) => [content.pageId, content.content])
  );

  const hashes: Record<string, string> = {
    __project_settings__: hashContent(JSON.stringify(project.settings ?? {})),
  };
  for (const page of pageRows) {
    if (!page.isPublished || page.aiPendingReview === true) continue;
    const path = page.folderId
      ? `${folderPath(page.folderId)}/${page.slug}`
      : `/${page.slug}`;
    hashes[path] = hashContent(
      JSON.stringify({
        path,
        title: page.title,
        content: contentByPage.get(page.id) ?? "[]",
        icon: page.icon,
        subtitle: page.subtitle,
        titleSectionHidden: page.titleSectionHidden,
        titleIconHidden: page.titleIconHidden,
      })
    );
  }
  for (const folder of visibleFolders) {
    const path = folderPath(folder.id);
    hashes[`__folder__${path}`] = hashContent(
      JSON.stringify({ path, name: folder.name, icon: folder.icon })
    );
  }
  return { branchId, hashes };
}

export function createDeploymentsRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get(
      "/project/:projectId/unpublished",
      zValidator("query", changesInput),
      async (context) => {
        const projectId = context.req.param("projectId");
        await authorize?.(accessRequest(context), projectId);
        const { branchId } = context.req.valid("query");
        const current = await currentContentHashes(
          context,
          projectId,
          branchId
        );
        if (!current) return context.json({ preview: true, production: true });

        const db = createDatabase(context.env.DB);
        const rows = await db
          .select()
          .from(deployments)
          .where(eq(deployments.branchId, current.branchId))
          .orderBy(desc(deployments.createdAt));
        const latest = (target: "preview" | "production") =>
          rows.find(
            (deployment) =>
              deployment.target === target &&
              deployment.contentHashes &&
              deployment.status !== "error" &&
              deployment.status !== "canceled"
          );
        const preview = latest("preview")?.contentHashes;
        const production = latest("production")?.contentHashes;
        return context.json({
          preview: preview ? !hashesMatch(current.hashes, preview) : true,
          production: production
            ? !hashesMatch(current.hashes, production)
            : true,
        });
      }
    )
    .get("/project/:projectId/in-progress", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      const cutoff = Date.now() - 5 * 60 * 1000;
      return context.json(
        (
          await db
            .select()
            .from(deployments)
            .where(eq(deployments.projectId, projectId))
            .orderBy(desc(deployments.createdAt))
        ).find(
          (deployment) =>
            (deployment.status === "queued" ||
              deployment.status === "building") &&
            deployment.updatedAt > cutoff
        ) ?? null
      );
    })
    .get(
      "/project/:projectId/list",
      zValidator("query", listInput),
      async (context) => {
        const projectId = context.req.param("projectId");
        await authorize?.(accessRequest(context), projectId);
        const input = context.req.valid("query");
        const db = createDatabase(context.env.DB);
        return context.json(
          await db
            .select()
            .from(deployments)
            .where(
              input.target
                ? and(
                    eq(deployments.projectId, projectId),
                    eq(deployments.target, input.target)
                  )
                : eq(deployments.projectId, projectId)
            )
            .orderBy(desc(deployments.createdAt))
        );
      }
    )
    .get("/external/:externalDeploymentId", async (context) => {
      const db = createDatabase(context.env.DB);
      const deployment = await db.query.deployments.findFirst({
        where: eq(
          deployments.externalDeploymentId,
          context.req.param("externalDeploymentId")
        ),
      });
      if (!deployment) return context.json(null);
      await authorize?.(accessRequest(context), deployment.projectId);
      return context.json(deployment);
    })
    .get("/config/:projectId", async (context) => {
      const projectId = context.req.param("projectId");
      await authorize?.(accessRequest(context), projectId);
      const db = createDatabase(context.env.DB);
      return context.json(
        (await db.query.deploymentConfigs.findFirst({
          where: eq(deploymentConfigs.projectId, projectId),
        })) ?? null
      );
    })
    .post("/", zValidator("json", createInput), async (context) => {
      const input = context.req.valid("json");
      await authorize?.(accessRequest(context), input.projectId);
      const db = createDatabase(context.env.DB);
      const branch = await db.query.branches.findFirst({
        where: and(
          eq(branches.id, input.branchId),
          eq(branches.projectId, input.projectId)
        ),
      });
      if (!branch) throw new ApiError("Branch not found in project.", 404);
      const id = crypto.randomUUID();
      const now = Date.now();
      await db.insert(deployments).values({
        id,
        projectId: input.projectId,
        branchId: input.branchId,
        externalDeploymentId: input.externalDeploymentId,
        cfProjectName: input.cfProjectName,
        status: "building",
        target: input.target,
        contentHashes: input.contentHashes,
        buildPhase: input.buildPhase,
        createdAt: now,
        updatedAt: now,
      });
      return context.json({ id }, 201);
    })
    .put("/config", zValidator("json", configInput), async (context) => {
      const input = context.req.valid("json");
      await authorize?.(accessRequest(context), input.projectId);
      const db = createDatabase(context.env.DB);
      const existing = await db.query.deploymentConfigs.findFirst({
        where: eq(deploymentConfigs.projectId, input.projectId),
      });
      const { projectId, ...values } = input;
      const now = Date.now();
      if (existing) {
        await db
          .update(deploymentConfigs)
          .set({ ...values, updatedAt: now })
          .where(eq(deploymentConfigs.id, existing.id));
        return context.json({ id: existing.id });
      }
      const id = crypto.randomUUID();
      await db.insert(deploymentConfigs).values({
        id,
        projectId,
        ...values,
        createdAt: now,
        updatedAt: now,
      });
      return context.json({ id }, 201);
    })
    .post(
      "/config/:projectId/live",
      zValidator("json", liveInput),
      async (context) => {
        const projectId = context.req.param("projectId");
        await authorize?.(accessRequest(context), projectId);
        const db = createDatabase(context.env.DB);
        const result = await db
          .update(deploymentConfigs)
          .set({
            liveDeploymentId: context.req.valid("json").deploymentId,
            updatedAt: Date.now(),
          })
          .where(eq(deploymentConfigs.projectId, projectId));
        return context.json({ updated: result.success });
      }
    )
    .patch(
      "/:deploymentId/status",
      zValidator("json", statusInput),
      async (context) => {
        const deployment = await deploymentFor(
          context,
          context.req.param("deploymentId"),
          authorize
        );
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        await db
          .update(deployments)
          .set({ ...input, updatedAt: Date.now() })
          .where(eq(deployments.id, deployment.id));
        return context.json({ id: deployment.id });
      }
    )
    .patch(
      "/:deploymentId/phase",
      zValidator("json", phaseInput),
      async (context) => {
        const deployment = await deploymentFor(
          context,
          context.req.param("deploymentId"),
          authorize
        );
        const input = context.req.valid("json");
        const db = createDatabase(context.env.DB);
        await db
          .update(deployments)
          .set({ ...input, updatedAt: Date.now() })
          .where(eq(deployments.id, deployment.id));
        return context.json({ id: deployment.id });
      }
    )
    .get("/:deploymentId", async (context) =>
      context.json(
        await deploymentFor(
          context,
          context.req.param("deploymentId"),
          authorize
        )
      )
    );
}

export const deploymentsRoutes = createDeploymentsRoutes();
