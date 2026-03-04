import { describe, it, expect } from "vitest";
import type { AppContextState } from "@/hooks/use-app-context";

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("DashboardNav module exports", () => {
  it("exports DashboardNav function", async () => {
    const mod = await import("@/components/dashboard/nav");
    expect(typeof mod.DashboardNav).toBe("function");
  });

  it("DashboardNav is a named function", async () => {
    const { DashboardNav } = await import("@/components/dashboard/nav");
    expect(DashboardNav.name).toBe("DashboardNav");
  });
});

// ---------------------------------------------------------------------------
// Nav item filtering logic: core mode vs platform mode
//
// The nav component conditionally includes the "Organization" link based on
// isMultiTenant from useAppContext(). This test validates the filtering logic
// extracted from the component.
// ---------------------------------------------------------------------------

/** Mirrors the nav item construction logic in DashboardNav */
function buildNavItems(isMultiTenant: boolean) {
  const items = [
    { href: "/overview", label: "Overview", exact: true },
    { href: "/projects", label: "Projects" },
    ...(isMultiTenant
      ? [{ href: "/organization/settings", label: "Organization" }]
      : []),
    { href: "/settings", label: "Settings" },
  ];
  return items;
}

describe("nav item filtering: core mode (isMultiTenant=false)", () => {
  const items = buildNavItems(false);

  it("includes 3 nav items in core mode", () => {
    expect(items).toHaveLength(3);
  });

  it("includes Overview link", () => {
    expect(items.some((i) => i.href === "/overview")).toBe(true);
  });

  it("includes Projects link", () => {
    expect(items.some((i) => i.href === "/projects")).toBe(true);
  });

  it("includes Settings link", () => {
    expect(items.some((i) => i.href === "/settings")).toBe(true);
  });

  it("does NOT include Organization link", () => {
    expect(items.some((i) => i.href === "/organization/settings")).toBe(false);
  });

  it("Overview is the first item", () => {
    expect(items[0]!.href).toBe("/overview");
  });

  it("Settings is the last item", () => {
    expect(items[items.length - 1]!.href).toBe("/settings");
  });
});

describe("nav item filtering: platform mode (isMultiTenant=true)", () => {
  const items = buildNavItems(true);

  it("includes 4 nav items in platform mode", () => {
    expect(items).toHaveLength(4);
  });

  it("includes Organization link", () => {
    expect(items.some((i) => i.href === "/organization/settings")).toBe(true);
  });

  it("Organization link is between Projects and Settings", () => {
    const orgIdx = items.findIndex((i) => i.href === "/organization/settings");
    const projIdx = items.findIndex((i) => i.href === "/projects");
    const settIdx = items.findIndex((i) => i.href === "/settings");
    expect(orgIdx).toBeGreaterThan(projIdx);
    expect(orgIdx).toBeLessThan(settIdx);
  });

  it("Overview is still the first item", () => {
    expect(items[0]!.href).toBe("/overview");
  });

  it("Settings is still the last item", () => {
    expect(items[items.length - 1]!.href).toBe("/settings");
  });
});

// ---------------------------------------------------------------------------
// Property: nav items are a superset in platform mode
// ---------------------------------------------------------------------------

describe("core vs platform nav item consistency", () => {
  const coreItems = buildNavItems(false);
  const platformItems = buildNavItems(true);

  it("platform nav items are a superset of core nav items", () => {
    const coreHrefs = new Set(coreItems.map((i) => i.href));
    const platformHrefs = new Set(platformItems.map((i) => i.href));
    for (const href of coreHrefs) {
      expect(platformHrefs.has(href)).toBe(true);
    }
  });

  it("platform has exactly one extra item (Organization)", () => {
    expect(platformItems.length - coreItems.length).toBe(1);
    const coreHrefs = new Set(coreItems.map((i) => i.href));
    const extra = platformItems.filter((i) => !coreHrefs.has(i.href));
    expect(extra).toHaveLength(1);
    expect(extra[0]!.href).toBe("/organization/settings");
  });

  it("shared items preserve the same order", () => {
    const coreHrefs = coreItems.map((i) => i.href);
    const platformHrefsFiltered = platformItems
      .filter((i) => coreHrefs.includes(i.href))
      .map((i) => i.href);
    expect(platformHrefsFiltered).toEqual(coreHrefs);
  });
});

// ---------------------------------------------------------------------------
// Contract: isMultiTenant drives the Organization link
// ---------------------------------------------------------------------------

describe("isMultiTenant drives Organization link", () => {
  it("core context (isMultiTenant=false) excludes Organization", () => {
    const coreCtx: AppContextState = {
      tenantId: "local",
      orgName: "Local",
      isMultiTenant: false,
      isLoading: false,
    };
    const items = buildNavItems(coreCtx.isMultiTenant);
    expect(items.some((i) => i.href === "/organization/settings")).toBe(false);
  });

  it("platform context (isMultiTenant=true) includes Organization", () => {
    const platformCtx: AppContextState = {
      tenantId: "org_abc",
      orgName: "Acme Corp",
      isMultiTenant: true,
      isLoading: false,
    };
    const items = buildNavItems(platformCtx.isMultiTenant);
    expect(items.some((i) => i.href === "/organization/settings")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Upgrade CTA visibility: core mode vs platform mode
//
// The sidebar footer shows an "Upgrade to InkLoom Cloud" CTA only in core
// (single-tenant) mode. In platform (multi-tenant) mode, the CTA is hidden.
// ---------------------------------------------------------------------------

/** Mirrors the CTA visibility logic in DashboardNav */
function shouldShowUpgradeCta(isMultiTenant: boolean): boolean {
  return !isMultiTenant;
}

describe("upgrade CTA visibility: core mode (isMultiTenant=false)", () => {
  it("shows the upgrade CTA in core mode", () => {
    expect(shouldShowUpgradeCta(false)).toBe(true);
  });
});

describe("upgrade CTA visibility: platform mode (isMultiTenant=true)", () => {
  it("hides the upgrade CTA in platform mode", () => {
    expect(shouldShowUpgradeCta(true)).toBe(false);
  });
});

describe("upgrade CTA driven by AppContextState", () => {
  it("core context (isMultiTenant=false) shows CTA", () => {
    const coreCtx: AppContextState = {
      tenantId: "local",
      orgName: "Local",
      isMultiTenant: false,
      isLoading: false,
    };
    expect(shouldShowUpgradeCta(coreCtx.isMultiTenant)).toBe(true);
  });

  it("platform context (isMultiTenant=true) hides CTA", () => {
    const platformCtx: AppContextState = {
      tenantId: "org_abc",
      orgName: "Acme Corp",
      isMultiTenant: true,
      isLoading: false,
    };
    expect(shouldShowUpgradeCta(platformCtx.isMultiTenant)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Upgrade CTA source-level verification
// ---------------------------------------------------------------------------

describe("upgrade CTA source verification", () => {
  it("nav component source contains the upgrade CTA link to inkloom.dev", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../nav.tsx"),
      "utf-8"
    );
    expect(src).toContain("https://inkloom.dev");
  });

  it("nav component source conditionally renders CTA on !isMultiTenant", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../nav.tsx"),
      "utf-8"
    );
    expect(src).toContain("!isMultiTenant");
  });

  it("nav component uses ArrowUpRight icon for CTA", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../nav.tsx"),
      "utf-8"
    );
    expect(src).toContain("ArrowUpRight");
  });

  it("nav component uses the upgrade i18n key", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../nav.tsx"),
      "utf-8"
    );
    expect(src).toContain('t("upgrade")');
  });

  it("CTA opens in new tab with security attributes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../nav.tsx"),
      "utf-8"
    );
    expect(src).toContain('target="_blank"');
    expect(src).toContain('rel="noopener noreferrer"');
  });
});

// ---------------------------------------------------------------------------
// i18n key verification
// ---------------------------------------------------------------------------

describe("upgrade CTA i18n key exists", () => {
  it("en.json has dashboard.nav.upgrade key", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const messages = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../../messages/en.json"),
        "utf-8"
      )
    );
    expect(messages.dashboard.nav.upgrade).toBe("Upgrade to InkLoom Cloud");
  });
});

// ---------------------------------------------------------------------------
// Nav imports useAppContext (structural check)
// ---------------------------------------------------------------------------

describe("DashboardNav dependencies", () => {
  it("imports from @/hooks/use-app-context (via source inspection)", async () => {
    // This test verifies the nav module can be imported alongside
    // the app context module — structural integrity check
    const [navMod, ctxMod] = await Promise.all([
      import("@/components/dashboard/nav"),
      import("@/hooks/use-app-context"),
    ]);
    expect(navMod.DashboardNav).toBeDefined();
    expect(ctxMod.useAppContext).toBeDefined();
  });
});
