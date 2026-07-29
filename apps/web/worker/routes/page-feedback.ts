import { and, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { pageFeedback } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";
import { accessRequest, type ProjectAuthorizer } from "@/worker/routes/pages";

const reaction = z.enum(["positive", "neutral", "negative"]);
const submitInput = z.object({
  projectId: z.string().min(1),
  pageSlug: z.string().min(1).max(1_000),
  reaction,
  sessionId: z.string().max(500).optional(),
});
const statsInput = z.object({
  projectId: z.string().min(1),
  pageSlug: z.string().min(1),
  since: z.coerce.number().nonnegative().optional(),
});
const timeSeriesInput = statsInput.extend({
  bucketSize: z.enum(["daily", "weekly"]).default("daily"),
});

function countsFor(
  rows: Array<{ reaction: "positive" | "neutral" | "negative" }>
) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const row of rows) counts[row.reaction] += 1;
  return counts;
}

export function createPageFeedbackRoutes(authorize?: ProjectAuthorizer) {
  return new Hono<WorkerEnv>()
    .post("/submit", zValidator("json", submitInput), async (context) => {
      const input = context.req.valid("json");
      const db = createDatabase(context.env.DB);
      const now = Date.now();
      if (input.sessionId) {
        const existing = await db.query.pageFeedback.findFirst({
          where: and(
            eq(pageFeedback.projectId, input.projectId),
            eq(pageFeedback.pageSlug, input.pageSlug),
            eq(pageFeedback.sessionId, input.sessionId)
          ),
        });
        if (existing) {
          await db
            .update(pageFeedback)
            .set({ reaction: input.reaction, createdAt: now })
            .where(eq(pageFeedback.id, existing.id));
          return context.json({ id: existing.id });
        }
      }
      const id = crypto.randomUUID();
      await db.insert(pageFeedback).values({ id, ...input, createdAt: now });
      return context.json({ id }, 201);
    })
    .get("/stats", zValidator("query", statsInput), async (context) => {
      const input = context.req.valid("query");
      await authorize?.(accessRequest(context), input.projectId);
      const db = createDatabase(context.env.DB);
      const rows = await db
        .select({ reaction: pageFeedback.reaction })
        .from(pageFeedback)
        .where(
          and(
            eq(pageFeedback.projectId, input.projectId),
            eq(pageFeedback.pageSlug, input.pageSlug),
            ...(input.since ? [gte(pageFeedback.createdAt, input.since)] : [])
          )
        );
      const counts = countsFor(rows);
      const total = rows.length;
      return context.json({
        total,
        ...counts,
        positivePercent:
          total > 0 ? Math.round((counts.positive / total) * 100) : 0,
        neutralPercent:
          total > 0 ? Math.round((counts.neutral / total) * 100) : 0,
        negativePercent:
          total > 0 ? Math.round((counts.negative / total) * 100) : 0,
      });
    })
    .get(
      "/time-series",
      zValidator("query", timeSeriesInput),
      async (context) => {
        const input = context.req.valid("query");
        await authorize?.(accessRequest(context), input.projectId);
        const db = createDatabase(context.env.DB);
        const rows = await db
          .select({
            reaction: pageFeedback.reaction,
            createdAt: pageFeedback.createdAt,
          })
          .from(pageFeedback)
          .where(
            and(
              eq(pageFeedback.projectId, input.projectId),
              eq(pageFeedback.pageSlug, input.pageSlug),
              ...(input.since ? [gte(pageFeedback.createdAt, input.since)] : [])
            )
          );
        const bucketMs =
          input.bucketSize === "weekly" ? 7 * 86_400_000 : 86_400_000;
        const buckets = new Map<
          string,
          { positive: number; neutral: number; negative: number }
        >();
        for (const row of rows) {
          const start = Math.floor(row.createdAt / bucketMs) * bucketMs;
          const date = new Date(start).toISOString().slice(0, 10);
          const counts = buckets.get(date) ?? {
            positive: 0,
            neutral: 0,
            negative: 0,
          };
          counts[row.reaction] += 1;
          buckets.set(date, counts);
        }
        return context.json(
          [...buckets.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([date, counts]) => ({
              date,
              ...counts,
              total: counts.positive + counts.neutral + counts.negative,
            }))
        );
      }
    );
}

export const pageFeedbackRoutes = createPageFeedbackRoutes();
