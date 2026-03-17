import { describe, it, expect } from "vitest";
import {
  parseMintlifyConfig,
  isDocsJsonFormat,
  type RawMintlifyConfig,
} from "./config.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Real-world-style docs.json with multi-tab recursive navigation.
 * Modeled after Particle Network / Stripe-like Mintlify sites.
 */
const docsJsonMultiTab: RawMintlifyConfig = {
  $schema: "https://mintlify.com/docs.json",
  name: "Acme Docs",
  description: "Documentation for the Acme platform",
  theme: "mint",
  colors: {
    primary: "#6366F1",
    light: "#818CF8",
    dark: "#4F46E5",
  },
  logo: {
    light: "/logo/acme-light.svg",
    dark: "/logo/acme-dark.svg",
  },
  favicon: "/favicon.png",
  navigation: [
    {
      tab: "Guides",
      groups: [
        {
          group: "Getting Started",
          pages: ["guides/introduction", "guides/quickstart", "guides/concepts"],
        },
        {
          group: "Authentication",
          pages: ["guides/auth/overview", "guides/auth/jwt-tokens"],
        },
      ],
    },
    {
      tab: "API Reference",
      groups: [
        {
          group: "REST API",
          pages: ["api/overview", "api/authentication"],
        },
        {
          group: "Endpoints",
          pages: [
            "api/endpoints/users",
            "api/endpoints/projects",
            {
              group: "Billing",
              pages: [
                "api/endpoints/billing/invoices",
                "api/endpoints/billing/subscriptions",
              ],
            },
          ],
        },
      ],
    },
    {
      tab: "SDKs",
      groups: [
        {
          group: "Client Libraries",
          pages: ["sdks/javascript", "sdks/python", "sdks/go"],
        },
      ],
    },
  ],
  navbar: {
    links: [
      { label: "GitHub", url: "https://github.com/acme/acme" },
      { label: "Discord", url: "https://discord.gg/acme" },
    ],
  },
  redirects: [
    { source: "/docs/intro", destination: "/guides/introduction" },
    { source: "/v1/api", destination: "/api/overview" },
  ],
  openapi: "api/openapi.json",
};

/**
 * docs.json with single-tab (no tab wrappers, just groups at top level).
 */
const docsJsonSingleTab: RawMintlifyConfig = {
  $schema: "https://mintlify.com/docs.json",
  name: "Simple Docs",
  theme: "mint",
  colors: {
    primary: "#0EA5E9",
  },
  logo: "/logo.svg",
  favicon: "/favicon.ico",
  navigation: [
    {
      group: "Overview",
      pages: ["introduction", "quickstart"],
    },
    {
      group: "Features",
      pages: ["features/search", "features/deploy"],
    },
  ],
};

/**
 * Real-world-style mint.json with multi-tab configuration.
 */
const mintJsonMultiTab: RawMintlifyConfig = {
  name: "Legacy Platform",
  description: "Legacy platform documentation",
  logo: {
    light: "/images/logo-light.png",
    dark: "/images/logo-dark.png",
  },
  favicon: "/images/favicon.png",
  colors: {
    primary: "#E11D48",
    light: "#FB7185",
    dark: "#BE123C",
  },
  tabs: [
    { name: "Components", url: "content" },
    { name: "Integrations", url: "integrations" },
  ],
  navigation: [
    {
      group: "Getting Started",
      pages: ["introduction", "quickstart", "faq"],
    },
    {
      group: "Components",
      pages: [
        "content/components/accordions",
        "content/components/callouts",
        "content/components/tabs",
      ],
    },
    {
      group: "Layout",
      pages: ["content/layout/sidebar", "content/layout/header"],
    },
    {
      group: "Analytics",
      pages: [
        "integrations/analytics/posthog",
        "integrations/analytics/segment",
      ],
    },
    {
      group: "Chat",
      pages: ["integrations/chat/intercom", "integrations/chat/crisp"],
    },
  ],
  topbarLinks: [
    { name: "GitHub", url: "https://github.com/legacy/platform" },
    { name: "Blog", url: "https://blog.legacy.com" },
  ],
  redirects: [
    { source: "/old-docs", destination: "/introduction" },
  ],
  openapi: "api/spec.yaml",
};

/**
 * mint.json single-tab (no tabs field).
 */
const mintJsonSingleTab: RawMintlifyConfig = {
  name: "Tiny Docs",
  colors: {
    primary: "#10B981",
  },
  favicon: "/favicon.svg",
  navigation: [
    {
      group: "Docs",
      pages: ["index", "getting-started"],
    },
    {
      group: "Advanced",
      pages: [
        "advanced/configuration",
        {
          group: "Plugins",
          pages: ["advanced/plugins/auth", "advanced/plugins/cache"],
        },
      ],
    },
  ],
};

/**
 * Minimal valid config — edge case.
 */
const minimalConfig: RawMintlifyConfig = {
  name: "Minimal",
  colors: { primary: "#000000" },
  navigation: [
    { group: "Home", pages: ["index"] },
  ],
};

/**
 * Empty config — edge case.
 */
const emptyConfig: RawMintlifyConfig = {};

// ── Format Detection ─────────────────────────────────────────────────────────

describe("isDocsJsonFormat", () => {
  it("detects docs.json with tab entries", () => {
    expect(isDocsJsonFormat(docsJsonMultiTab)).toBe(true);
  });

  it("returns false for docs.json without tabs (treated as mint.json format)", () => {
    // Single-tab docs.json with only group entries looks like mint.json
    expect(isDocsJsonFormat(docsJsonSingleTab)).toBe(false);
  });

  it("returns false for mint.json with separate tabs array", () => {
    expect(isDocsJsonFormat(mintJsonMultiTab)).toBe(false);
  });

  it("returns false for empty navigation", () => {
    expect(isDocsJsonFormat(emptyConfig)).toBe(false);
  });
});

// ── docs.json Multi-Tab ──────────────────────────────────────────────────────

describe("parseMintlifyConfig — docs.json multi-tab", () => {
  const result = parseMintlifyConfig(docsJsonMultiTab);

  it("extracts three navigation tabs", () => {
    expect(result.navTabs).toHaveLength(3);
    expect(result.navTabs.map((t) => t.name)).toEqual([
      "Guides",
      "API Reference",
      "SDKs",
    ]);
  });

  it("assigns correct slugs to tabs", () => {
    expect(result.navTabs.map((t) => t.slug)).toEqual([
      "guides",
      "api-reference",
      "sdks",
    ]);
  });

  it("maps top-level folder paths as tab items", () => {
    const guidesTab = result.navTabs.find((t) => t.slug === "guides");
    expect(guidesTab?.items).toEqual(["getting-started", "authentication"]);

    const apiTab = result.navTabs.find((t) => t.slug === "api-reference");
    expect(apiTab?.items).toEqual(["rest-api", "endpoints"]);
  });

  it("creates folders for all groups including nested", () => {
    const folderNames = result.folders.map((f) => f.name);
    expect(folderNames).toContain("Getting Started");
    expect(folderNames).toContain("Authentication");
    expect(folderNames).toContain("REST API");
    expect(folderNames).toContain("Endpoints");
    expect(folderNames).toContain("Billing");
    expect(folderNames).toContain("Client Libraries");
  });

  it("sets correct parentPath for nested groups", () => {
    const billing = result.folders.find((f) => f.name === "Billing");
    expect(billing?.parentPath).toBe("endpoints");
    expect(billing?.path).toBe("endpoints/billing");
  });

  it("collects all page references", () => {
    expect(result.pageRefs).toContain("guides/introduction");
    expect(result.pageRefs).toContain("api/endpoints/users");
    expect(result.pageRefs).toContain("api/endpoints/billing/invoices");
    expect(result.pageRefs).toContain("sdks/javascript");
  });

  it("extracts branding with logo variants", () => {
    expect(result.branding.primaryColor).toBe("#6366F1");
    expect(result.branding.logoPath).toBe("/logo/acme-light.svg");
    expect(result.branding.logoDarkPath).toBe("/logo/acme-dark.svg");
    expect(result.branding.faviconPath).toBe("/favicon.png");
  });

  it("extracts social links from navbar", () => {
    expect(result.branding.socialLinks).toHaveLength(2);
    expect(result.branding.socialLinks).toEqual([
      { platform: "github", url: "https://github.com/acme/acme" },
      { platform: "discord", url: "https://discord.gg/acme" },
    ]);
  });

  it("parses redirects", () => {
    expect(result.redirects).toHaveLength(2);
    expect(result.redirects[0]).toEqual({
      from: "/docs/intro",
      to: "/guides/introduction",
      status: 301,
    });
  });

  it("extracts OpenAPI path", () => {
    expect(result.openApiPaths).toEqual(["api/openapi.json"]);
  });

  it("extracts site metadata", () => {
    expect(result.metadata.name).toBe("Acme Docs");
    expect(result.metadata.description).toBe(
      "Documentation for the Acme platform"
    );
  });

  it("produces no warnings for complete config", () => {
    expect(result.warnings).toHaveLength(0);
  });
});

// ── docs.json Single-Tab ─────────────────────────────────────────────────────

describe("parseMintlifyConfig — docs.json single-tab (no tabs)", () => {
  const result = parseMintlifyConfig(docsJsonSingleTab);

  it("returns no navTabs for single-tab site", () => {
    expect(result.navTabs).toHaveLength(0);
  });

  it("creates folders for each group", () => {
    expect(result.folders).toHaveLength(2);
    expect(result.folders[0].name).toBe("Overview");
    expect(result.folders[1].name).toBe("Features");
  });

  it("assigns positions to folders", () => {
    expect(result.folders[0].position).toBe(0);
    expect(result.folders[1].position).toBe(1);
  });

  it("collects page references", () => {
    expect(result.pageRefs).toEqual([
      "introduction",
      "quickstart",
      "features/search",
      "features/deploy",
    ]);
  });

  it("handles string logo", () => {
    expect(result.branding.logoPath).toBe("/logo.svg");
    expect(result.branding.logoDarkPath).toBeUndefined();
  });
});

// ── mint.json Multi-Tab ──────────────────────────────────────────────────────

describe("parseMintlifyConfig — mint.json multi-tab", () => {
  const result = parseMintlifyConfig(mintJsonMultiTab);

  it("creates tabs including a default tab for ungrouped content", () => {
    expect(result.navTabs.length).toBeGreaterThanOrEqual(2);

    const tabNames = result.navTabs.map((t) => t.name);
    expect(tabNames).toContain("Components");
    expect(tabNames).toContain("Integrations");
    // "Getting Started" group doesn't match any tab prefix, goes to default
    expect(tabNames).toContain("Documentation");
  });

  it("assigns groups to correct tabs by URL prefix", () => {
    const componentsTab = result.navTabs.find((t) => t.name === "Components");
    // Should contain both "Components" and "Layout" groups (both under content/)
    expect(componentsTab?.items.length).toBeGreaterThanOrEqual(1);

    const integrationsTab = result.navTabs.find(
      (t) => t.name === "Integrations"
    );
    expect(integrationsTab?.items.length).toBeGreaterThanOrEqual(1);
  });

  it("collects all page references across tabs", () => {
    expect(result.pageRefs).toContain("introduction");
    expect(result.pageRefs).toContain("content/components/accordions");
    expect(result.pageRefs).toContain("integrations/analytics/posthog");
  });

  it("extracts branding from mint.json fields", () => {
    expect(result.branding.primaryColor).toBe("#E11D48");
    expect(result.branding.logoPath).toBe("/images/logo-light.png");
    expect(result.branding.logoDarkPath).toBe("/images/logo-dark.png");
    expect(result.branding.faviconPath).toBe("/images/favicon.png");
  });

  it("extracts social links from topbarLinks", () => {
    // Only GitHub matches a known social platform
    const github = result.branding.socialLinks?.find(
      (s) => s.platform === "github"
    );
    expect(github).toBeDefined();
    expect(github?.url).toBe("https://github.com/legacy/platform");
  });

  it("parses redirects", () => {
    expect(result.redirects).toEqual([
      { from: "/old-docs", to: "/introduction", status: 301 },
    ]);
  });

  it("extracts OpenAPI path", () => {
    expect(result.openApiPaths).toEqual(["api/spec.yaml"]);
  });
});

// ── mint.json Single-Tab ─────────────────────────────────────────────────────

describe("parseMintlifyConfig — mint.json single-tab", () => {
  const result = parseMintlifyConfig(mintJsonSingleTab);

  it("returns no navTabs for single-tab site", () => {
    expect(result.navTabs).toHaveLength(0);
  });

  it("creates top-level and nested folders", () => {
    const folderNames = result.folders.map((f) => f.name);
    expect(folderNames).toContain("Docs");
    expect(folderNames).toContain("Advanced");
    expect(folderNames).toContain("Plugins");
  });

  it("sets parentPath for nested group", () => {
    const plugins = result.folders.find((f) => f.name === "Plugins");
    expect(plugins?.parentPath).toBe("advanced");
    expect(plugins?.path).toBe("advanced/plugins");
  });

  it("collects all page refs including nested", () => {
    expect(result.pageRefs).toContain("index");
    expect(result.pageRefs).toContain("advanced/plugins/auth");
    expect(result.pageRefs).toContain("advanced/plugins/cache");
  });

  it("handles missing logo gracefully", () => {
    expect(result.branding.logoPath).toBeUndefined();
    expect(result.branding.logoDarkPath).toBeUndefined();
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("parseMintlifyConfig — edge cases", () => {
  it("handles minimal config", () => {
    const result = parseMintlifyConfig(minimalConfig);
    expect(result.folders).toHaveLength(1);
    expect(result.pageRefs).toEqual(["index"]);
    expect(result.branding.primaryColor).toBe("#000000");
    expect(result.warnings).toHaveLength(0);
  });

  it("handles empty config with warnings", () => {
    const result = parseMintlifyConfig(emptyConfig);
    expect(result.navTabs).toHaveLength(0);
    expect(result.folders).toHaveLength(0);
    expect(result.pageRefs).toHaveLength(0);
    expect(result.warnings).toContain(
      "Missing 'name' field in Mintlify config"
    );
    expect(result.warnings).toContain(
      "Missing 'colors.primary' field in Mintlify config"
    );
    expect(result.warnings).toContain(
      "Empty or missing 'navigation' in Mintlify config"
    );
  });

  it("handles multiple OpenAPI paths", () => {
    const result = parseMintlifyConfig({
      name: "Multi API",
      colors: { primary: "#000" },
      navigation: [{ group: "Home", pages: ["index"] }],
      openapi: ["api/v1.json", "api/v2.json"],
    });
    expect(result.openApiPaths).toEqual(["api/v1.json", "api/v2.json"]);
  });

  it("handles api.spec field", () => {
    const result = parseMintlifyConfig({
      name: "API Spec",
      colors: { primary: "#000" },
      navigation: [{ group: "Home", pages: ["index"] }],
      api: { spec: "openapi/spec.yaml" },
    });
    expect(result.openApiPaths).toEqual(["openapi/spec.yaml"]);
  });

  it("extracts favicon from object format", () => {
    const result = parseMintlifyConfig({
      name: "Favicon Test",
      colors: { primary: "#000" },
      favicon: { light: "/favicon-light.png", dark: "/favicon-dark.png" },
      navigation: [{ group: "Home", pages: ["index"] }],
    } as RawMintlifyConfig);
    expect(result.branding.faviconPath).toBe("/favicon-light.png");
  });

  it("falls back logoDarkPath to logoPath when only dark is set", () => {
    const result = parseMintlifyConfig({
      name: "Dark Logo Only",
      colors: { primary: "#000" },
      logo: { dark: "/logo-dark.svg" },
      navigation: [{ group: "Home", pages: ["index"] }],
    });
    expect(result.branding.logoPath).toBe("/logo-dark.svg");
    expect(result.branding.logoDarkPath).toBe("/logo-dark.svg");
  });

  it("detects social platforms from URLs", () => {
    const result = parseMintlifyConfig({
      name: "Social",
      colors: { primary: "#000" },
      navigation: [{ group: "Home", pages: ["index"] }],
      topbarLinks: [
        { name: "X", url: "https://x.com/acme" },
        { name: "Join us", url: "https://discord.gg/acme" },
        { name: "Watch", url: "https://youtube.com/acme" },
        { name: "Jobs", url: "https://linkedin.com/company/acme" },
      ],
    });
    const platforms = result.branding.socialLinks?.map((s) => s.platform);
    expect(platforms).toContain("twitter");
    expect(platforms).toContain("discord");
    expect(platforms).toContain("youtube");
    expect(platforms).toContain("linkedin");
  });

  it("ignores non-social topbar links", () => {
    const result = parseMintlifyConfig({
      name: "Non-Social",
      colors: { primary: "#000" },
      navigation: [{ group: "Home", pages: ["index"] }],
      topbarLinks: [
        { name: "Docs", url: "https://docs.example.com" },
        { name: "Dashboard", url: "https://app.example.com" },
      ],
    });
    expect(result.branding.socialLinks).toBeUndefined();
  });

  it("docs.json with top-level groups alongside tabs creates default tab", () => {
    const config: RawMintlifyConfig = {
      name: "Mixed",
      colors: { primary: "#000" },
      navigation: [
        { group: "Home", pages: ["index"] },
        {
          tab: "API",
          groups: [{ group: "Reference", pages: ["api/ref"] }],
        },
      ],
    };
    const result = parseMintlifyConfig(config);
    expect(result.navTabs.length).toBe(2);
    // Default tab for top-level groups should come first
    expect(result.navTabs[0].name).toBe("Documentation");
    expect(result.navTabs[1].name).toBe("API");
  });
});

// ── docs.json with nested pages array instead of groups ──────────────────────

describe("parseMintlifyConfig — docs.json tab with pages array", () => {
  it("handles tabs that use pages instead of groups", () => {
    const config: RawMintlifyConfig = {
      name: "Pages Tab",
      colors: { primary: "#000" },
      navigation: [
        {
          tab: "Guides",
          pages: [
            {
              group: "Basics",
              pages: ["basics/intro", "basics/setup"],
            },
          ],
        },
      ],
    };
    const result = parseMintlifyConfig(config);
    expect(result.navTabs).toHaveLength(1);
    expect(result.navTabs[0].name).toBe("Guides");
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe("Basics");
    expect(result.pageRefs).toContain("basics/intro");
  });
});

// ── Object-wrapped navigation (new Mintlify starter format) ──────────────────

describe("parseMintlifyConfig — object-wrapped navigation", () => {
  const objectNavConfig: RawMintlifyConfig = {
    $schema: "https://mintlify.com/docs.json",
    name: "Modern Starter",
    colors: { primary: "#6366F1" },
    navigation: {
      tabs: [
        {
          tab: "Guides",
          groups: [
            {
              group: "Get Started",
              pages: ["guides/introduction", "guides/quickstart"],
            },
            {
              group: "Advanced",
              pages: ["guides/advanced/config"],
            },
          ],
        },
        {
          tab: "API Reference",
          groups: [
            {
              group: "REST API",
              pages: ["api/overview", "api/auth"],
            },
          ],
        },
      ],
      global: {
        anchors: [
          { name: "GitHub", url: "https://github.com/example/repo" },
        ],
      },
    } as RawMintlifyConfig["navigation"],
  };

  it("detects object-wrapped navigation as docs.json format", () => {
    expect(isDocsJsonFormat(objectNavConfig)).toBe(true);
  });

  it("extracts tabs from navigation.tabs", () => {
    const result = parseMintlifyConfig(objectNavConfig);
    expect(result.navTabs).toHaveLength(2);
    expect(result.navTabs.map((t) => t.name)).toEqual([
      "Guides",
      "API Reference",
    ]);
  });

  it("extracts folders from object-wrapped navigation", () => {
    const result = parseMintlifyConfig(objectNavConfig);
    const folderNames = result.folders.map((f) => f.name);
    expect(folderNames).toContain("Get Started");
    expect(folderNames).toContain("Advanced");
    expect(folderNames).toContain("REST API");
  });

  it("collects all page refs from object-wrapped navigation", () => {
    const result = parseMintlifyConfig(objectNavConfig);
    expect(result.pageRefs).toContain("guides/introduction");
    expect(result.pageRefs).toContain("guides/quickstart");
    expect(result.pageRefs).toContain("guides/advanced/config");
    expect(result.pageRefs).toContain("api/overview");
    expect(result.pageRefs).toContain("api/auth");
  });

  it("produces no errors for valid object-wrapped config", () => {
    const result = parseMintlifyConfig(objectNavConfig);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles object-wrapped navigation with empty tabs", () => {
    const config: RawMintlifyConfig = {
      name: "Empty Tabs",
      colors: { primary: "#000" },
      navigation: {
        tabs: [],
        global: {},
      } as RawMintlifyConfig["navigation"],
    };
    const result = parseMintlifyConfig(config);
    expect(result.navTabs).toHaveLength(0);
    expect(result.pageRefs).toHaveLength(0);
    expect(result.warnings).toContain(
      "Empty or missing 'navigation' in Mintlify config"
    );
  });
});
