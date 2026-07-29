import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
  branches,
  folders,
  mergeRequests,
  pageContents,
  pages,
} from "@/db/schema";
import {
  computeBranchDiff,
  computePageDiff,
  type PageInfo,
} from "@/lib/diff-engine";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import { ApiError } from "@/worker/http";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";

const pageDiffInput = z.object({
  sourceBranchId: z.string().min(1),
  targetBranchId: z.string().min(1),
  pagePath: z.string().min(1),
  mergeRequestId: z.string().optional(),
});

async function pageInfos(context: Context<WorkerEnv>, branchId: string) {
  const db = createDatabase(context.env.DB);
  const rows = await db
    .select({ page: pages, content: pageContents.content })
    .from(pages)
    .leftJoin(pageContents, eq(pageContents.pageId, pages.id))
    .where(eq(pages.branchId, branchId));
  return rows
    .filter(({ page }) => page.aiPendingReview !== true)
    .map(
      ({ page, content }): PageInfo => ({
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description ?? undefined,
        content: content ?? "[]",
      })
    );
}

export function createMergeRequestDiffRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get("/:mergeRequestId", async (context) => {
      const mergeRequestId = context.req.param("mergeRequestId");
      const db = createDatabase(context.env.DB);
      const mergeRequest = await db.query.mergeRequests.findFirst({
        where: eq(mergeRequests.id, mergeRequestId),
      });
      if (!mergeRequest) throw new ApiError("Merge request not found.", 404);
      await authorize?.(accessRequest(context), mergeRequest.projectId);
      if (mergeRequest.status !== "open" && mergeRequest.diffSnapshot) {
        try {
          return context.json(JSON.parse(mergeRequest.diffSnapshot));
        } catch {
          // Recompute corrupted legacy snapshots.
        }
      }
      const [sourcePages, targetPages, sourceFolders, targetFolders] =
        await Promise.all([
          pageInfos(context, mergeRequest.sourceBranchId),
          pageInfos(context, mergeRequest.targetBranchId),
          db
            .select({ path: folders.path })
            .from(folders)
            .where(eq(folders.branchId, mergeRequest.sourceBranchId)),
          db
            .select({ path: folders.path })
            .from(folders)
            .where(eq(folders.branchId, mergeRequest.targetBranchId)),
        ]);
      const diff = computeBranchDiff(
        sourcePages,
        targetPages,
        sourceFolders,
        targetFolders
      );
      await db
        .update(mergeRequests)
        .set({
          diffSummary: diff.summary,
          diffSnapshot: JSON.stringify(diff),
          updatedAt: Date.now(),
        })
        .where(eq(mergeRequests.id, mergeRequest.id));
      return context.json(diff);
    })
    .get(
      "/page/compute",
      zValidator("query", pageDiffInput),
      async (context) => {
        const input = context.req.valid("query");
        const db = createDatabase(context.env.DB);
        if (input.mergeRequestId) {
          const mergeRequest = await db.query.mergeRequests.findFirst({
            where: eq(mergeRequests.id, input.mergeRequestId),
          });
          if (mergeRequest) {
            await authorize?.(accessRequest(context), mergeRequest.projectId);
            if (mergeRequest.status !== "open" && mergeRequest.diffSnapshot) {
              try {
                const snapshot = JSON.parse(mergeRequest.diffSnapshot) as {
                  pageDiffs?: Array<{ path: string }>;
                };
                const stored = snapshot.pageDiffs?.find(
                  (page) => page.path === input.pagePath
                );
                if (stored) return context.json(stored);
              } catch {
                // Recompute.
              }
            }
          }
        }
        const sourceBranch = await db.query.branches.findFirst({
          where: eq(branches.id, input.sourceBranchId),
        });
        const targetBranch = await db.query.branches.findFirst({
          where: eq(branches.id, input.targetBranchId),
        });
        if (
          !sourceBranch ||
          !targetBranch ||
          sourceBranch.projectId !== targetBranch.projectId
        ) {
          throw new ApiError("Branches do not belong to one project.", 422);
        }
        await authorize?.(accessRequest(context), sourceBranch.projectId);
        const [sourceInfos, targetInfos] = await Promise.all([
          pageInfos(context, input.sourceBranchId),
          pageInfos(context, input.targetBranchId),
        ]);
        const source = sourceInfos.find((page) => page.path === input.pagePath);
        const target = targetInfos.find((page) => page.path === input.pagePath);
        if (!source && !target)
          throw new ApiError("Page not found on either branch.", 404);
        if (source && target)
          return context.json(computePageDiff(source, target));
        if (source) {
          let blocks: unknown[] = [];
          try {
            blocks = JSON.parse(source.content) as unknown[];
          } catch {
            // Empty malformed content is represented as no blocks.
          }
          return context.json({
            path: source.path,
            status: "added" as const,
            sourcePageId: source.id,
            blockDiffs: blocks.map((block, index) => ({
              status: "added" as const,
              sourceIndex: index,
              sourceBlock: block,
            })),
            titleChanged: false,
            descriptionChanged: false,
          });
        }
        return context.json({
          path: target!.path,
          status: "removed" as const,
          targetPageId: target!.id,
          blockDiffs: [],
          titleChanged: false,
          descriptionChanged: false,
        });
      }
    );
}

export const mergeRequestDiffRoutes = createMergeRequestDiffRoutes();
