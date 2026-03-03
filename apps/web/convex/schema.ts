// Core standalone schema — includes core tables only
// In platform mode (apps/dev), this is overridden by a generated schema
// that imports both core-tables and platform-tables.
import { defineSchema } from "convex/server";
import { coreTables } from "./schema/core-tables";

export default defineSchema({ ...coreTables });
