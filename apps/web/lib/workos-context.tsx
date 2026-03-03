"use client";

/**
 * Core-mode WorkOS context stub.
 *
 * In platform mode, this provides WorkOS org context. In core mode,
 * it returns static defaults matching the local single-tenant setup.
 *
 * This stub exists so bridge components can import it without breaking
 * the core build. Use useAppContext() for mode-agnostic code.
 */

export function useWorkOS() {
  return {
    currentOrg: {
      id: "local",
      name: "Local",
      role: "admin",
    },
    isLoading: false,
  };
}
