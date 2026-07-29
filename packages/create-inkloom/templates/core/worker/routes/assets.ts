import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { assets } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";

const createAssetInput = z.object({
  projectId: z.string().min(1),
  r2Key: z.string().min(1),
  url: z.string().url(),
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
});

export const assetsRoutes = new Hono<WorkerEnv>()
  .get("/project/:projectId", async (context) => {
    const db = createDatabase(context.env.DB);
    return context.json(
      await db
        .select()
        .from(assets)
        .where(eq(assets.projectId, context.req.param("projectId")))
    );
  })
  .get("/:assetId", async (context) => {
    const db = createDatabase(context.env.DB);
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, context.req.param("assetId")),
    });
    return context.json(asset ?? null);
  })
  .post("/", zValidator("json", createAssetInput), async (context) => {
    const input = context.req.valid("json");
    const db = createDatabase(context.env.DB);
    const id = crypto.randomUUID();
    await db.insert(assets).values({
      id,
      ...input,
      createdAt: Date.now(),
    });
    return context.json({ assetId: id, url: input.url }, 201);
  })
  .delete("/:assetId", async (context) => {
    const db = createDatabase(context.env.DB);
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, context.req.param("assetId")),
    });
    if (!asset) return context.json({ r2Key: null as string | null });
    await db.delete(assets).where(eq(assets.id, asset.id));
    return context.json({ r2Key: asset.r2Key as string | null });
  });
