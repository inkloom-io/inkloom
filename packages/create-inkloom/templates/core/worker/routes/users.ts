import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { users } from "@/db/schema";
import { createDatabase } from "@/worker/db";
import type { WorkerEnv } from "@/worker/env";

const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@inkloom.local";

export const usersRoutes = new Hono<WorkerEnv>()
  .get("/current", async (context) => {
    const db = createDatabase(context.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.workosUserId, LOCAL_USER_ID),
    });

    return context.json(user ?? null);
  })
  .post("/ensure-local", async (context) => {
    const db = createDatabase(context.env.DB);
    const existing = await db.query.users.findFirst({
      where: eq(users.workosUserId, LOCAL_USER_ID),
    });

    if (existing) {
      return context.json({ id: existing.id });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(users).values({
      id,
      workosUserId: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      name: "Local User",
      authProvider: "email",
      createdAt: now,
      updatedAt: now,
    });

    return context.json({ id }, 201);
  });
