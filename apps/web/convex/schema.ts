// Core standalone schema — includes core tables only
// In platform mode (apps/dev), this is overridden by a generated schema
// that imports both core and platform tables.
import { defineSchema } from "convex/server";
import { coreTables } from "./schema/coreTables";

export default defineSchema({ ...coreTables });
