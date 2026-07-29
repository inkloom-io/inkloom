import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { deployments, pages, projects } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { ProjectAccessRequest } from "@/worker/routes/pages";
import { accessRequest } from "@/worker/routes/pages";
import type { WorkerEnv } from "@/worker/env";

const statsInput = z.object({
  workosOrgId: z.string().min(1).default("local"),
});

type TenantAuthorizer = (
  request: ProjectAccessRequest,
  workosOrgId: string
) => Promise<void>;

export function createDashboardRoutes(authorizeTenant?: TenantAuthorizer) {
  return new Hono<WorkerEnv>().get(
    "/stats",
    zValidator("query", statsInput),
    async (context) => {
      const { workosOrgId } = context.req.valid("query");
      await authorizeTenant?.(accessRequest(context), workosOrgId);
      const db = createDatabase(context.env.DB);
      const projectRows = await db
        .select()
        .from(projects)
        .where(eq(projects.workosOrgId, workosOrgId))
        .orderBy(desc(projects.updatedAt));
      const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
      let totalPages = 0;
      let recentDeployments = 0;
      let unpublishedCount = 0;
      const enriched = [];

      for (const [index, project] of projectRows.entries()) {
        const pageCount = project.defaultBranchId
          ? (
              await db
                .select({ id: pages.id })
                .from(pages)
                .where(eq(pages.branchId, project.defaultBranchId))
            ).length
          : 0;
        totalPages += pageCount;
        const projectDeployments = await db
          .select()
          .from(deployments)
          .where(eq(deployments.projectId, project.id))
          .orderBy(desc(deployments.createdAt));
        recentDeployments += projectDeployments.filter(
          (deployment) => deployment.createdAt > thirtyDaysAgo
        ).length;
        const latestProduction = projectDeployments.find(
          (deployment) => deployment.target === "production"
        );
        const hasUnpublishedChanges =
          !latestProduction ||
          latestProduction.status !== "ready" ||
          project.updatedAt > latestProduction.createdAt;
        if (hasUnpublishedChanges) unpublishedCount += 1;

        if (index < 6) {
          const deploymentStatus =
            latestProduction?.status === "ready"
              ? "ready"
              : latestProduction?.status === "error"
                ? "error"
                : latestProduction?.status === "building" ||
                    latestProduction?.status === "queued"
                  ? "building"
                  : "never_deployed";
          enriched.push({
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            plan: project.plan ?? "free",
            updatedAt: project.updatedAt,
            settings: project.settings
              ? { customDomain: project.settings.customDomain }
              : undefined,
            deploymentStatus,
            hasUnpublishedChanges,
            pageCount,
          });
        }
      }

      return context.json({
        totalProjects: projectRows.length,
        totalPages,
        recentDeployments,
        unpublishedCount,
        projects: enriched,
      });
    }
  );
}

export const dashboardRoutes = createDashboardRoutes();
