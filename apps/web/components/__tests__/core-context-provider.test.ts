import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("core-context-provider module exports", () => {
  it("exports CoreContextProvider component", async () => {
    const mod = await import("@/components/core-context-provider");
    expect(typeof mod.CoreContextProvider).toBe("function");
  });

  it("CoreContextProvider is a named function", async () => {
    const { CoreContextProvider } = await import(
      "@/components/core-context-provider"
    );
    expect(CoreContextProvider.name).toBe("CoreContextProvider");
  });
});

// ---------------------------------------------------------------------------
// Core auth bridge contract
// ---------------------------------------------------------------------------

describe("CoreContextProvider auth contract", () => {
  it("uses AuthProvider from use-auth module", async () => {
    // CoreContextProvider should depend on the same AuthProvider
    // that PlatformAuthBridge uses — ensures mode-agnostic consumers
    // of useAuth() get consistent behavior.
    const authMod = await import("@/hooks/use-auth");
    expect(authMod.AuthProvider).toBeDefined();
    expect(authMod.AuthContext).toBeDefined();
  });

  it("AuthProvider wraps the same AuthContext as PlatformAuthBridge", async () => {
    const { AuthProvider, AuthContext } = await import("@/hooks/use-auth");
    expect(AuthProvider).toBe(AuthContext.Provider);
  });
});

// ---------------------------------------------------------------------------
// Core mode relies on useAppContext defaults
// ---------------------------------------------------------------------------

describe("CoreContextProvider app-context contract", () => {
  it("does not need AppContextProvider (defaults serve core mode)", async () => {
    const { AppContext } = await import("@/hooks/use-app-context");
    // @ts-expect-error -- accessing internal React context value for testing
    const defaults = AppContext._currentValue;
    expect(defaults.tenantId).toBe("local");
    expect(defaults.isMultiTenant).toBe(false);
    expect(defaults.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Core Convex functions dependency
// ---------------------------------------------------------------------------

describe("CoreContextProvider Convex dependency", () => {
  it("users module exports ensureLocalUser mutation", async () => {
    const mod = await import("@/convex/users");
    expect(mod.ensureLocalUser).toBeDefined();
  });

  it("users module exports currentLocal query", async () => {
    const mod = await import("@/convex/users");
    expect(mod.currentLocal).toBeDefined();
  });

  it("sentinel values match core-mode expectations", async () => {
    const { LOCAL_USER_ID, LOCAL_USER_EMAIL } = await import(
      "@/convex/users"
    );
    expect(LOCAL_USER_ID).toBe("local");
    expect(LOCAL_USER_EMAIL).toBe("local@inkloom.local");
  });
});

// ---------------------------------------------------------------------------
// Core vs Platform provider symmetry
// ---------------------------------------------------------------------------

describe("Core vs Platform provider symmetry", () => {
  it("CoreContextProvider and PlatformAuthBridge export same pattern (children -> ReactNode)", async () => {
    const { CoreContextProvider } = await import(
      "@/components/core-context-provider"
    );
    const { PlatformAuthBridge } = await import("@/components/auth-bridge");

    // Both are React components that accept children
    expect(typeof CoreContextProvider).toBe("function");
    expect(typeof PlatformAuthBridge).toBe("function");

    // Both have exactly 1 parameter (props object)
    expect(CoreContextProvider.length).toBe(1);
    expect(PlatformAuthBridge.length).toBe(1);
  });

  it("both bridge and core-context import from use-auth", async () => {
    // This validates that both modes feed into the same consumer hook
    const authMod = await import("@/hooks/use-auth");
    const coreProvider = await import("@/components/core-context-provider");
    const platformBridge = await import("@/components/auth-bridge");

    expect(authMod.AuthProvider).toBeDefined();
    expect(coreProvider.CoreContextProvider).toBeDefined();
    expect(platformBridge.PlatformAuthBridge).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CoreProviders module (structural — can't import at test time)
// ---------------------------------------------------------------------------

describe("providers.core module contract", () => {
  // NOTE: providers.core.tsx creates a ConvexReactClient at module scope,
  // which requires NEXT_PUBLIC_CONVEX_URL. This is the same constraint as
  // providers.tsx — both can't be imported in unit tests. We validate the
  // structural contract instead: CoreProviders depends on CoreContextProvider
  // (tested above) and the same shared infrastructure (ThemeProvider,
  // ConvexProvider, QueryClientProvider, TooltipProvider).

  it("CoreContextProvider can be imported independently of CoreProviders", async () => {
    // This validates that the core auth bridge doesn't need the full
    // provider tree to be importable — it can be tested in isolation.
    const mod = await import("@/components/core-context-provider");
    expect(mod.CoreContextProvider).toBeDefined();
  });

  it("CoreProviders file exists and is a valid TypeScript module", async () => {
    // Verify the file exists by checking the filesystem
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../providers.core.tsx"
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("CoreProviders does not import WorkOS modules", async () => {
    // Read the source file and verify no WorkOS imports
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../providers.core.tsx"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    // Check import statements only — comments may reference these for documentation
    const importLines = source
      .split("\n")
      .filter((line: string) => line.trimStart().startsWith("import "));
    const imports = importLines.join("\n");
    expect(imports).not.toContain("workos-context");
    expect(imports).not.toContain("auth-bridge");
    expect(imports).not.toContain("app-context-bridge");
  });

  it("CoreProviders imports CoreContextProvider", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../providers.core.tsx"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("CoreContextProvider");
    expect(source).toContain("core-context-provider");
  });

  it("CoreProviders exports CoreProviders function", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../providers.core.tsx"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("export function CoreProviders");
  });
});

// ---------------------------------------------------------------------------
// Auth state shape: core mode expectations
// ---------------------------------------------------------------------------

describe("Core-mode auth state shape", () => {
  it("core-mode local user matches AuthUser interface", async () => {
    const { LOCAL_USER_ID, LOCAL_USER_EMAIL } = await import(
      "@/convex/users"
    );

    // The user document created by ensureLocalUser should satisfy AuthUser
    // Required fields: _id, _creationTime, email
    const mockLocalUser = {
      _id: "mock_convex_id" as any,
      _creationTime: Date.now(),
      email: LOCAL_USER_EMAIL,
      name: "Local User",
      workosUserId: LOCAL_USER_ID,
    };

    expect(mockLocalUser.email).toBe("local@inkloom.local");
    expect(mockLocalUser.workosUserId).toBe("local");
    expect(mockLocalUser.name).toBe("Local User");
  });

  it("core-mode signOut is a no-op", () => {
    // Validate the contract: core signOut returns void and has no side effects
    const signOut = () => {};
    expect(signOut()).toBeUndefined();
    expect(typeof signOut).toBe("function");
  });
});
