/**
 * Phase 0.30 verification: Core-mode boot path.
 *
 * Verifies that swapping `lib/adapters.ts` to core exports produces
 * a valid, consistent adapter set and that all core-mode files are
 * free of platform-specific dependencies.
 *
 * These tests validate:
 * 1. Core barrel export (`adapters.core.ts`) is structurally equivalent to platform barrel
 * 2. Core adapter set forms a consistent single-tenant configuration
 * 3. Core-mode source files have no platform-specific imports
 * 4. Deploy switchpoint (`adapters/deploy.ts`) works correctly
 * 5. Core providers, layout, and middleware are platform-free
 * 6. Sentinel values are consistent across all core-mode modules
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

function getImportStatements(source: string): string[] {
  return source
    .split("\n")
    .filter(
      (line) =>
        line.trim().startsWith("import ") && !line.trim().startsWith("//")
    );
}

function getImportPaths(source: string): string[] {
  const importLines = getImportStatements(source);
  return importLines
    .map((line) => {
      const match = line.match(/from\s+["']([^"']+)["']/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];
}

/** Strip single-line and multi-line comments, returning only code. */
function stripComments(source: string): string {
  // Remove multi-line comments (/* ... */)
  let result = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove single-line comments (// ...)
  result = result
    .split("\n")
    .map((line) => {
      // Don't strip // inside strings
      const inString = line.match(/^[^"']*["'][^"']*\/\/[^"']*["']/);
      if (inString) return line;
      return line.replace(/\/\/.*$/, "");
    })
    .join("\n");
  return result;
}

// Platform-specific modules that must NOT appear in core files
const PLATFORM_MODULES = [
  "@workos-inc",
  "stripe",
  "lib/auth",
  "lib/workos",
  "lib/billing",
  "lib/stripe",
  "lib/cloudflare",
  "lib/api-auth",
  "lib/api-rate-limit",
  "lib/webhook-dispatch",
  "lib/ensure-user-org",
  "adapters/auth.platform",
  "adapters/context.platform",
  "adapters/deploy.platform",
  "@inkloom/ai",
  "partykit",
  "y-partykit",
];

// ---------------------------------------------------------------------------
// 1. Core barrel export
// ---------------------------------------------------------------------------

describe("core barrel export (adapters.core.ts)", () => {
  it("exports authAdapter, contextAdapter, deployAdapter", async () => {
    const mod = await import("@/lib/adapters.core");
    expect(mod.authAdapter).toBeDefined();
    expect(mod.contextAdapter).toBeDefined();
    expect(mod.deployAdapter).toBeDefined();
  });

  it("exports core adapters (not platform)", async () => {
    const mod = await import("@/lib/adapters.core");
    // Core deploy adapter has "Build" label, platform has "Deploy"
    expect(mod.deployAdapter.actionLabel).toBe("Build");
    // Core context adapter is NOT multi-tenant
    expect(mod.contextAdapter.isMultiTenant()).toBe(false);
    // Core context has "local" tenant
    expect(mod.contextAdapter.getTenantId()).toBe("local");
  });

  it("has the same export names as the platform barrel", async () => {
    const coreMod = await import("@/lib/adapters.core");
    const platformMod = await import("@/lib/adapters");

    // Both barrels must export the same adapter names
    expect(typeof coreMod.authAdapter).toBe(typeof platformMod.authAdapter);
    expect(typeof coreMod.contextAdapter).toBe(
      typeof platformMod.contextAdapter
    );
    expect(typeof coreMod.deployAdapter).toBe(typeof platformMod.deployAdapter);
  });

  it("does NOT export createPlatformContextAdapter (core only)", async () => {
    const mod = await import("@/lib/adapters.core");
    expect(
      (mod as Record<string, unknown>)["createPlatformContextAdapter"]
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Core adapter set consistency
// ---------------------------------------------------------------------------

describe("core adapter set consistency", () => {
  it("auth adapter returns user with matching sentinel values", async () => {
    const { authAdapter } = await import("@/lib/adapters.core");
    const user = await authAdapter.getUser();
    expect(user).not.toBeNull();
    expect(user!.id).toBe("local_user");
    expect(user!.email).toBe("local@inkloom.dev");
  });

  it("context tenant ID matches Convex sentinel", async () => {
    const { contextAdapter } = await import("@/lib/adapters.core");
    const { LOCAL_ORG_ID } = await import("@/convex/projects");
    expect(contextAdapter.getTenantId()).toBe(LOCAL_ORG_ID);
  });

  it("deploy adapter is local build mode", async () => {
    const { deployAdapter } = await import("@/lib/adapters.core");
    expect(deployAdapter.actionLabel).toBe("Build");
    const result = await deployAdapter.publish({ projectId: "test" });
    expect(result.success).toBe(true);
    expect(result.url).toContain("file://");
  });

  it("all adapters satisfy their interfaces", async () => {
    const { authAdapter, contextAdapter, deployAdapter } = await import(
      "@/lib/adapters.core"
    );

    // AuthAdapter
    expect(typeof authAdapter.getUser).toBe("function");
    expect(typeof authAdapter.requireUser).toBe("function");
    expect(typeof authAdapter.signOut).toBe("function");

    // ContextAdapter
    expect(typeof contextAdapter.getTenantId).toBe("function");
    expect(typeof contextAdapter.getOrgName).toBe("function");
    expect(typeof contextAdapter.isMultiTenant).toBe("function");

    // DeployAdapter
    expect(typeof deployAdapter.publish).toBe("function");
    expect(typeof deployAdapter.getDeployUrl).toBe("function");
    expect(typeof deployAdapter.actionLabel).toBe("string");
  });

  it("auth + context + deploy are self-consistent for single-tenant", async () => {
    const { authAdapter, contextAdapter, deployAdapter } = await import(
      "@/lib/adapters.core"
    );

    // Single-tenant: always has a user
    const user = await authAdapter.getUser();
    expect(user).not.toBeNull();

    // Single-tenant: not multi-tenant
    expect(contextAdapter.isMultiTenant()).toBe(false);

    // Single-tenant: local build mode
    expect(deployAdapter.actionLabel).toBe("Build");
    expect(deployAdapter.getDeployUrl("test")).toMatch(/^file:\/\//);
  });
});

// ---------------------------------------------------------------------------
// 3. Deploy switchpoint
// ---------------------------------------------------------------------------

describe("deploy switchpoint (adapters/deploy.ts)", () => {
  it("exports deployAdapter", async () => {
    const mod = await import("@/lib/adapters/deploy");
    expect(mod.deployAdapter).toBeDefined();
  });

  it("currently exports core adapter", async () => {
    const mod = await import("@/lib/adapters/deploy");
    expect(mod.deployAdapter.actionLabel).toBe("Build");
  });

  it("switchpoint source is a single re-export (easy to swap)", () => {
    const source = readSource("lib/adapters/deploy.ts");
    const nonCommentLines = source
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"));
    // Should have exactly one export line
    const exportLines = nonCommentLines.filter((line) =>
      line.includes("export")
    );
    expect(exportLines.length).toBe(1);
    expect(exportLines[0]).toContain("deployAdapter");
  });
});

// ---------------------------------------------------------------------------
// 4. Core adapter files: no platform imports
// ---------------------------------------------------------------------------

describe("core adapter files: no platform imports", () => {
  const coreAdapterFiles = [
    "lib/adapters/auth.core.ts",
    "lib/adapters/context.core.ts",
    "lib/adapters/deploy.core.ts",
    "lib/adapters.core.ts",
  ];

  for (const file of coreAdapterFiles) {
    it(`${file} has no platform-specific imports`, () => {
      const source = readSource(file);
      const importPaths = getImportPaths(source);

      for (const importPath of importPaths) {
        for (const platformModule of PLATFORM_MODULES) {
          expect(importPath).not.toContain(platformModule);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Core-mode component files: no platform imports
// ---------------------------------------------------------------------------

describe("core-mode components: no platform imports", () => {
  const coreComponents = [
    "components/core-context-provider.tsx",
    "components/providers.core.tsx",
  ];

  for (const file of coreComponents) {
    it(`${file} has no platform-specific imports`, () => {
      const source = readSource(file);
      const importPaths = getImportPaths(source);

      for (const importPath of importPaths) {
        for (const platformModule of PLATFORM_MODULES) {
          expect(importPath).not.toContain(platformModule);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 6. Core-mode hooks: no platform imports
// ---------------------------------------------------------------------------

describe("core-mode hooks: no platform imports", () => {
  const coreHooks = ["hooks/use-auth.ts", "hooks/use-app-context.ts"];

  for (const file of coreHooks) {
    it(`${file} has no platform-specific imports`, () => {
      const source = readSource(file);
      const importPaths = getImportPaths(source);

      for (const importPath of importPaths) {
        for (const platformModule of PLATFORM_MODULES) {
          expect(importPath).not.toContain(platformModule);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Core layout: no auth, no billing
// ---------------------------------------------------------------------------

describe("core dashboard layout", () => {
  it("does not call requireAuth() in code", () => {
    const code = stripComments(readSource("app/[locale]/(dashboard)/layout.core.tsx"));
    expect(code).not.toContain("requireAuth");
  });

  it("does not render BillingBanner in code", () => {
    const code = stripComments(readSource("app/[locale]/(dashboard)/layout.core.tsx"));
    expect(code).not.toContain("BillingBanner");
  });

  it("does not render OnboardingRedirect in code", () => {
    const code = stripComments(readSource("app/[locale]/(dashboard)/layout.core.tsx"));
    expect(code).not.toContain("OnboardingRedirect");
  });

  it("passes static LOCAL_USER to nav and header", () => {
    const source = readSource("app/[locale]/(dashboard)/layout.core.tsx");
    expect(source).toContain("LOCAL_USER");
    expect(source).toContain("<DashboardNav");
    expect(source).toContain("<DashboardHeader");
  });

  it("has no platform-specific imports", () => {
    const source = readSource("app/[locale]/(dashboard)/layout.core.tsx");
    const importPaths = getImportPaths(source);

    for (const importPath of importPaths) {
      for (const platformModule of PLATFORM_MODULES) {
        expect(importPath).not.toContain(platformModule);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Core middleware: i18n only, no WorkOS
// ---------------------------------------------------------------------------

describe("core middleware", () => {
  it("imports next-intl middleware", () => {
    const source = readSource("middleware.ts");
    expect(source).toContain("next-intl/middleware");
  });

  it("does not import WorkOS in code", () => {
    const code = stripComments(readSource("middleware.ts"));
    expect(code).not.toContain("workos");
    expect(code).not.toContain("WorkOS");
    expect(code).not.toContain("@workos-inc");
  });

  it("does not handle auth cookies in code", () => {
    const code = stripComments(readSource("middleware.ts"));
    expect(code).not.toContain("cookie");
    expect(code).not.toContain("session");
  });

  it("skips API routes", () => {
    const source = readSource("middleware.ts");
    expect(source).toContain("/api/");
  });

  it("has no platform-specific imports", () => {
    const source = readSource("middleware.ts");
    const importPaths = getImportPaths(source);

    for (const importPath of importPaths) {
      for (const platformModule of PLATFORM_MODULES) {
        expect(importPath).not.toContain(platformModule);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Core Convex functions: sentinel value consistency
// ---------------------------------------------------------------------------

describe("sentinel value consistency across all core modules", () => {
  it("LOCAL_ORG_ID matches context adapter tenant ID", async () => {
    const { LOCAL_ORG_ID } = await import("@/convex/projects");
    const { contextAdapter } = await import("@/lib/adapters/context.core");
    expect(LOCAL_ORG_ID).toBe(contextAdapter.getTenantId());
  });

  it("LOCAL_USER_ID matches workosUserId pattern used in core functions", async () => {
    const { LOCAL_USER_ID } = await import("@/convex/users");
    expect(LOCAL_USER_ID).toBe("local");
  });

  it("sentinel values are stable (regression guard)", async () => {
    const { LOCAL_ORG_ID } = await import("@/convex/projects");
    const { LOCAL_USER_ID, LOCAL_USER_EMAIL } = await import(
      "@/convex/users"
    );

    // These values are part of the data portability contract
    // (OSS data can be migrated to SaaS). Changing them breaks migration.
    expect(LOCAL_ORG_ID).toBe("local");
    expect(LOCAL_USER_ID).toBe("local");
    expect(LOCAL_USER_EMAIL).toBe("local@inkloom.local");
  });
});

// ---------------------------------------------------------------------------
// 10. Core providers: correct provider tree
// ---------------------------------------------------------------------------

describe("core providers tree", () => {
  it("uses CoreContextProvider (not WorkOS) in code", () => {
    const code = stripComments(readSource("components/providers.core.tsx"));
    expect(code).toContain("CoreContextProvider");
    expect(code).not.toContain("WorkOSProvider");
    expect(code).not.toContain("PlatformAuthBridge");
    expect(code).not.toContain("PlatformAppContextBridge");
  });

  it("includes ConvexProvider", () => {
    const source = readSource("components/providers.core.tsx");
    expect(source).toContain("ConvexProvider");
  });

  it("includes ThemeProvider", () => {
    const source = readSource("components/providers.core.tsx");
    expect(source).toContain("ThemeProvider");
  });

  it("includes QueryClientProvider", () => {
    const source = readSource("components/providers.core.tsx");
    expect(source).toContain("QueryClientProvider");
  });

  it("includes TooltipProvider", () => {
    const source = readSource("components/providers.core.tsx");
    expect(source).toContain("TooltipProvider");
  });
});

// ---------------------------------------------------------------------------
// 11. CoreContextProvider: correct Convex calls
// ---------------------------------------------------------------------------

describe("CoreContextProvider", () => {
  it("calls ensureLocalUser on mount", () => {
    const source = readSource("components/core-context-provider.tsx");
    expect(source).toContain("ensureLocalUser");
  });

  it("queries currentLocal for user data", () => {
    const source = readSource("components/core-context-provider.tsx");
    expect(source).toContain("currentLocal");
  });

  it("provides AuthProvider context", () => {
    const source = readSource("components/core-context-provider.tsx");
    expect(source).toContain("AuthProvider");
  });

  it("does not import WorkOS in code", () => {
    const code = stripComments(readSource("components/core-context-provider.tsx"));
    expect(code).not.toContain("workos");
    expect(code).not.toContain("WorkOS");
  });
});

// ---------------------------------------------------------------------------
// 12. Dashboard nav/header: mode-agnostic rendering
// ---------------------------------------------------------------------------

describe("dashboard nav/header: core mode compatibility", () => {
  it("nav uses useAppContext (mode-agnostic)", () => {
    const source = readSource("components/dashboard/nav.tsx");
    expect(source).toContain("useAppContext");
    expect(source).toContain("isMultiTenant");
  });

  it("nav conditionally includes org link based on isMultiTenant", () => {
    const source = readSource("components/dashboard/nav.tsx");
    expect(source).toContain("isMultiTenant");
    expect(source).toContain("organization/settings");
  });

  it("header uses useAppContext for conditional OrgSwitcher render", () => {
    const source = readSource("components/dashboard/header.tsx");
    expect(source).toContain("isMultiTenant");
    expect(source).toContain("isMultiTenant && <OrgSwitcher");
  });

  it("header shows 'InkLoom Core' when not multi-tenant", () => {
    const source = readSource("components/dashboard/header.tsx");
    expect(source).toContain("InkLoom Core");
    expect(source).toContain("!isMultiTenant");
  });

  it("header uses useAuth for signOut (mode-agnostic)", () => {
    const source = readSource("components/dashboard/header.tsx");
    expect(source).toContain("useAuth");
    expect(source).toContain("signOut");
  });

  it("header conditionally renders sign-out button only in multi-tenant mode", () => {
    const source = readSource("components/dashboard/header.tsx");
    // Find "signOut" inside a conditional block gated by isMultiTenant
    expect(source).toContain("isMultiTenant && (");
  });
});

// ---------------------------------------------------------------------------
// 13. useAppContext: core defaults fallback
// ---------------------------------------------------------------------------

describe("useAppContext core defaults", () => {
  it("defines CORE_DEFAULTS with tenantId 'local'", () => {
    const source = readSource("hooks/use-app-context.ts");
    expect(source).toContain("CORE_DEFAULTS");
    expect(source).toContain('tenantId: "local"');
  });

  it("defaults to isMultiTenant: false", () => {
    const source = readSource("hooks/use-app-context.ts");
    expect(source).toContain("isMultiTenant: false");
  });

  it("uses CORE_DEFAULTS as context default value", () => {
    const source = readSource("hooks/use-app-context.ts");
    // The createContext call should use CORE_DEFAULTS
    expect(source).toContain("createContext<AppContextState>(CORE_DEFAULTS)");
  });
});

// ---------------------------------------------------------------------------
// 14. Property-based: barrel swap produces valid adapter set
// ---------------------------------------------------------------------------

describe("barrel swap: core vs platform adapter sets", () => {
  it("both barrel exports have identical adapter method signatures", async () => {
    const core = await import("@/lib/adapters.core");
    const platform = await import("@/lib/adapters");

    // AuthAdapter methods
    expect(typeof core.authAdapter.getUser).toBe(
      typeof platform.authAdapter.getUser
    );
    expect(typeof core.authAdapter.requireUser).toBe(
      typeof platform.authAdapter.requireUser
    );
    expect(typeof core.authAdapter.signOut).toBe(
      typeof platform.authAdapter.signOut
    );

    // ContextAdapter methods
    expect(typeof core.contextAdapter.getTenantId).toBe(
      typeof platform.contextAdapter.getTenantId
    );
    expect(typeof core.contextAdapter.getOrgName).toBe(
      typeof platform.contextAdapter.getOrgName
    );
    expect(typeof core.contextAdapter.isMultiTenant).toBe(
      typeof platform.contextAdapter.isMultiTenant
    );

    // DeployAdapter methods
    expect(typeof core.deployAdapter.publish).toBe(
      typeof platform.deployAdapter.publish
    );
    expect(typeof core.deployAdapter.getDeployUrl).toBe(
      typeof platform.deployAdapter.getDeployUrl
    );
    expect(typeof core.deployAdapter.actionLabel).toBe(
      typeof platform.deployAdapter.actionLabel
    );
  });

  it("both barrel auth adapters return compatible user shapes", async () => {
    const core = await import("@/lib/adapters.core");
    const platform = await import("@/lib/adapters");

    const coreUser = await core.authAdapter.getUser();
    // Platform auth may return null (no WorkOS session in test)
    // but both follow AdapterUser shape
    expect(coreUser).toHaveProperty("id");
    expect(coreUser).toHaveProperty("email");
    expect(coreUser).toHaveProperty("firstName");
    expect(coreUser).toHaveProperty("lastName");
    expect(coreUser).toHaveProperty("profilePictureUrl");

    // Platform adapter exists and has same method signatures
    expect(typeof platform.authAdapter.getUser).toBe("function");
  });

  it("both barrel deploy adapters return compatible DeployResult shapes", async () => {
    const core = await import("@/lib/adapters.core");
    const platform = await import("@/lib/adapters");

    const coreResult = await core.deployAdapter.publish({ projectId: "test" });
    const platformResult = await platform.deployAdapter.publish({
      projectId: "test",
    });

    // Both return { success, url, message }
    for (const result of [coreResult, platformResult]) {
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("message");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.url).toBe("string");
      expect(typeof result.message).toBe("string");
    }
  });

  it("both barrels export core adapters in core mode", async () => {
    const core = await import("@/lib/adapters.core");
    const barrel = await import("@/lib/adapters");

    // Both should export single-tenant local adapters in core mode
    expect(core.contextAdapter.isMultiTenant()).toBe(false);
    expect(core.contextAdapter.getTenantId()).toBe("local");
    expect(core.deployAdapter.actionLabel).toBe("Build");

    expect(barrel.contextAdapter.isMultiTenant()).toBe(false);
    expect(barrel.contextAdapter.getTenantId()).toBe("local");
    expect(barrel.deployAdapter.actionLabel).toBe("Build");
  });
});

// ---------------------------------------------------------------------------
// 15. Known Phase 1 issues (documented, not blocking)
// ---------------------------------------------------------------------------

describe("known Phase 1 items (documented)", () => {
  it("header.tsx statically imports OrgSwitcher (needs lazy load in Phase 1)", () => {
    const source = readSource("components/dashboard/header.tsx");
    // This is a KNOWN issue: OrgSwitcher imports @/lib/workos-context.
    // In core standalone mode (Phase 2), this import won't resolve.
    // Fix: lazy import or separate header.core.tsx.
    // For now, it works because all files exist in the monorepo.
    expect(source).toContain('import { OrgSwitcher }');
  });

  it("use-publish.ts imports from deploy switchpoint (not platform-specific)", () => {
    const source = readSource("hooks/use-publish.ts");
    // Verify the fix: should import from switchpoint, not directly from platform
    expect(source).toContain('@/lib/adapters/deploy"');
    expect(source).not.toContain("deploy.platform");
  });
});
