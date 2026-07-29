import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { WorkerEnv } from "@/worker/env";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";
import {
  rebuildProjectSearchIndex,
  toFtsQuery,
} from "@/worker/services/search-index";

const searchInput = z.object({
  projectId: z.string().min(1),
  query: z.string().max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const rebuildInput = z.object({
  projectId: z.string().min(1),
});

interface SearchResultRow {
  id: string;
  page_id: string;
  title: string;
  path: string;
  excerpt: string;
  score: number;
}

export function createSearchRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .get("/", zValidator("query", searchInput), async (context) => {
      const input = context.req.valid("query");
      await authorize?.(accessRequest(context), input.projectId);
      const ftsQuery = toFtsQuery(input.query);
      if (!ftsQuery) return context.json([]);

      const { results } = await context.env.DB.prepare(
        `SELECT
           si.id,
           si.page_id,
           si.title,
           si.path,
           si.excerpt,
           bm25(search_fts, 8.0, 4.0, 1.0, 0.5) AS score
         FROM search_fts
         JOIN search_index si ON si.rowid = search_fts.rowid
         WHERE search_fts MATCH ? AND si.project_id = ?
         ORDER BY score
         LIMIT ?`
      )
        .bind(ftsQuery, input.projectId, input.limit)
        .all<SearchResultRow>();

      return context.json(
        results.map((result) => ({
          id: result.id,
          pageId: result.page_id,
          title: result.title,
          path: result.path,
          excerpt: result.excerpt,
          score: -result.score,
        }))
      );
    })
    .post("/rebuild", zValidator("json", rebuildInput), async (context) => {
      const { projectId } = context.req.valid("json");
      await authorize?.(accessRequest(context), projectId);
      return context.json({
        indexed: await rebuildProjectSearchIndex(context.env.DB, projectId),
      });
    });
}

export const searchRoutes = createSearchRoutes();
