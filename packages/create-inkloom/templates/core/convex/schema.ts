import { defineSchema } from "convex/server";
import { coreTables } from "./schema/coreTables";

export default defineSchema({ ...coreTables });
