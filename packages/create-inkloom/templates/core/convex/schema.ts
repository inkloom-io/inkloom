import { defineSchema } from "convex/server";
import { coreTables } from "./schema/core-tables";

export default defineSchema({ ...coreTables });
