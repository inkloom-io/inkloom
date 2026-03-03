import type { ContextAdapter } from "./types";

/**
 * Core-mode context adapter.
 *
 * Fixed single-tenant context. Uses the sentinel value `"local"` as
 * the tenant ID — matching the Convex schema convention where
 * `workosOrgId: "local"` marks core-mode data.
 */
export const contextAdapter: ContextAdapter = {
  getTenantId() {
    return "local";
  },

  getOrgName() {
    return "Local";
  },

  isMultiTenant() {
    return false;
  },
};
