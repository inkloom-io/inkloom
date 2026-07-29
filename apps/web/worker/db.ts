import { drizzle } from "drizzle-orm/d1";

import { coreSchema } from "@/db/schema";
import type { D1DatabaseBinding } from "@/worker/env";

export function createDatabase(binding: D1DatabaseBinding) {
  return drizzle(binding as Parameters<typeof drizzle>[0], {
    schema: coreSchema,
  });
}

export type Database = ReturnType<typeof createDatabase>;
