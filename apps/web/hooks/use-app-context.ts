"use client";

import { createContext, useContext } from "react";

/**
 * Mode-agnostic application context hook.
 *
 * Wraps the context adapter for client-side use. Consumer code uses
 * `useAppContext()` instead of importing platform-specific hooks like
 * `useWorkOS()`.
 *
 * The context is populated by:
 * - Platform mode: `PlatformAppContextBridge` (wraps `useWorkOS()`)
 * - Core mode: Falls back to core defaults (tenantId: "local")
 */

export interface AppContextState {
  /** Tenant identifier. `"local"` in core mode, WorkOS org ID in platform. */
  tenantId: string;
  /** Human-readable org/tenant name. */
  orgName: string;
  /** Whether multi-tenancy is active. Always `false` in core mode. */
  isMultiTenant: boolean;
  /** True while org data is being fetched. */
  isLoading: boolean;
}

/** Core-mode defaults — single-tenant, no org loading. */
const CORE_DEFAULTS: AppContextState = {
  tenantId: "local",
  orgName: "Local",
  isMultiTenant: false,
  isLoading: false,
};

const AppContext = createContext<AppContextState>(CORE_DEFAULTS);

/**
 * Get the current application context (tenant/org info) in a mode-agnostic way.
 *
 * In platform mode, this returns the current WorkOS org context.
 * In core mode (or if no provider is present), this returns core defaults.
 */
export function useAppContext(): AppContextState {
  return useContext(AppContext);
}

export { AppContext };
export const AppContextProvider = AppContext.Provider;
