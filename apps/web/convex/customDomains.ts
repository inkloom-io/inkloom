import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Core stub for custom domains.
 *
 * In core (single-tenant) mode custom domains are not supported,
 * so this returns an empty list. The platform layer overrides this
 * with a real implementation backed by the customDomains table.
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async () => {
    return [];
  },
});
