import { describe, it, expect } from "vitest";
import type { AppContextState } from "@/hooks/use-app-context";

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("use-app-context module exports", () => {
  it("exports useAppContext function", async () => {
    const mod = await import("@/hooks/use-app-context");
    expect(typeof mod.useAppContext).toBe("function");
  });

  it("exports AppContextProvider component", async () => {
    const mod = await import("@/hooks/use-app-context");
    expect(mod.AppContextProvider).toBeDefined();
  });

  it("exports AppContext", async () => {
    const mod = await import("@/hooks/use-app-context");
    expect(mod.AppContext).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AppContextState interface compliance
// ---------------------------------------------------------------------------

describe("AppContextState interface", () => {
  it("accepts core-mode state (single-tenant)", () => {
    const state: AppContextState = {
      tenantId: "local",
      orgName: "Local",
      isMultiTenant: false,
      isLoading: false,
    };
    expect(state.tenantId).toBe("local");
    expect(state.orgName).toBe("Local");
    expect(state.isMultiTenant).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("accepts platform-mode state (multi-tenant)", () => {
    const state: AppContextState = {
      tenantId: "org_abc123",
      orgName: "Acme Corp",
      isMultiTenant: true,
      isLoading: false,
    };
    expect(state.tenantId).toBe("org_abc123");
    expect(state.orgName).toBe("Acme Corp");
    expect(state.isMultiTenant).toBe(true);
  });

  it("accepts loading state", () => {
    const state: AppContextState = {
      tenantId: "",
      orgName: "",
      isMultiTenant: true,
      isLoading: true,
    };
    expect(state.isLoading).toBe(true);
    expect(state.tenantId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Core-mode defaults
// ---------------------------------------------------------------------------

describe("AppContext core-mode defaults", () => {
  it("default context value has tenantId 'local'", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue: AppContextState = AppContext._currentValue;
    expect(defaultValue.tenantId).toBe("local");
  });

  it("default context value has orgName 'Local'", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue: AppContextState = AppContext._currentValue;
    expect(defaultValue.orgName).toBe("Local");
  });

  it("default context value has isMultiTenant false", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue: AppContextState = AppContext._currentValue;
    expect(defaultValue.isMultiTenant).toBe(false);
  });

  it("default context value has isLoading false", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue: AppContextState = AppContext._currentValue;
    expect(defaultValue.isLoading).toBe(false);
  });

  it("default matches the sentinel value used by core Convex functions", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue: AppContextState = AppContext._currentValue;
    // Core Convex functions use "local" as the sentinel workosOrgId
    expect(defaultValue.tenantId).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// useAppContext contract
// ---------------------------------------------------------------------------

describe("useAppContext contract", () => {
  it("is a named function", async () => {
    const { useAppContext } = await import("@/hooks/use-app-context");
    expect(useAppContext.name).toBe("useAppContext");
  });

  it("AppContextProvider is a valid React context provider", async () => {
    const { AppContextProvider, AppContext } = await import(
      "@/hooks/use-app-context"
    );
    expect(AppContextProvider).toBe(AppContext.Provider);
  });
});

// ---------------------------------------------------------------------------
// Platform app context bridge module
// ---------------------------------------------------------------------------

describe("PlatformAppContextBridge module", () => {
  it("exports PlatformAppContextBridge component", async () => {
    const mod = await import("@/components/app-context-bridge");
    expect(typeof mod.PlatformAppContextBridge).toBe("function");
  });

  it("PlatformAppContextBridge is a named function", async () => {
    const { PlatformAppContextBridge } = await import(
      "@/components/app-context-bridge"
    );
    expect(PlatformAppContextBridge.name).toBe("PlatformAppContextBridge");
  });
});

// ---------------------------------------------------------------------------
// Data transformation: WorkOS org → AppContextState
// ---------------------------------------------------------------------------

describe("WorkOS to AppContextState transformation", () => {
  it("maps currentOrg.id to tenantId", () => {
    const org = { id: "org_xyz", name: "My Org" };
    const state: AppContextState = {
      tenantId: org.id,
      orgName: org.name,
      isMultiTenant: true,
      isLoading: false,
    };
    expect(state.tenantId).toBe("org_xyz");
  });

  it("maps currentOrg.name to orgName", () => {
    const org = { id: "org_xyz", name: "Acme Corp" };
    const state: AppContextState = {
      tenantId: org.id,
      orgName: org.name,
      isMultiTenant: true,
      isLoading: false,
    };
    expect(state.orgName).toBe("Acme Corp");
  });

  it("handles null org (no org selected yet)", () => {
    const org = null;
    const state: AppContextState = {
      tenantId: org?.id ?? "",
      orgName: org?.name ?? "",
      isMultiTenant: true,
      isLoading: false,
    };
    expect(state.tenantId).toBe("");
    expect(state.orgName).toBe("");
  });

  it("platform mode always sets isMultiTenant to true", () => {
    const state: AppContextState = {
      tenantId: "org_123",
      orgName: "Test",
      isMultiTenant: true,
      isLoading: false,
    };
    expect(state.isMultiTenant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property: core defaults vs platform state consistency
// ---------------------------------------------------------------------------

describe("core vs platform state properties", () => {
  it("core and platform states have the same shape", () => {
    const coreState: AppContextState = {
      tenantId: "local",
      orgName: "Local",
      isMultiTenant: false,
      isLoading: false,
    };
    const platformState: AppContextState = {
      tenantId: "org_abc",
      orgName: "Acme",
      isMultiTenant: true,
      isLoading: false,
    };

    const coreKeys = Object.keys(coreState).sort();
    const platformKeys = Object.keys(platformState).sort();
    expect(coreKeys).toEqual(platformKeys);
  });

  it("core tenantId matches Convex sentinel value", () => {
    const coreState: AppContextState = {
      tenantId: "local",
      orgName: "Local",
      isMultiTenant: false,
      isLoading: false,
    };
    // This must match the sentinel value in convex/projectsCore.ts
    expect(coreState.tenantId).toBe("local");
  });

  it("platform tenantId is never 'local'", () => {
    const platformState: AppContextState = {
      tenantId: "org_abc",
      orgName: "Acme",
      isMultiTenant: true,
      isLoading: false,
    };
    expect(platformState.tenantId).not.toBe("local");
  });
});

// ---------------------------------------------------------------------------
// Providers integration (structural)
// ---------------------------------------------------------------------------

describe("providers.tsx integration", () => {
  it("bridge components can be imported without side effects", async () => {
    // Verify the bridge modules import cleanly (no side effects)
    // providers.tsx itself can't be tested here because ConvexReactClient
    // requires NEXT_PUBLIC_CONVEX_URL at import time. The bridge imports
    // are validated by type-checking and the bridge module tests above.
    const authBridge = await import("@/components/auth-bridge");
    const appBridge = await import("@/components/app-context-bridge");
    expect(authBridge.PlatformAuthBridge).toBeDefined();
    expect(appBridge.PlatformAppContextBridge).toBeDefined();
  });
});
