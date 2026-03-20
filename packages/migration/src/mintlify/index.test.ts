import { describe, it, expect, vi, beforeAll } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { parseMintlify } from "./index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "__fixtures__", "sample-docs");

describe("parseMintlify", () => {
  it("throws when no config file found", async () => {
    await expect(parseMintlify("/nonexistent/path")).rejects.toThrow(
      /No Mintlify config found/
    );
  });

  describe("with sample-docs fixture (mint.json multi-tab)", () => {
    let result: Awaited<ReturnType<typeof parseMintlify>>;

    beforeAll(async () => {
      // Mock fetch for remote image URLs
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: new Headers({ "content-type": "image/png" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      result = await parseMintlify(FIXTURE_DIR);
    });

    // ── Pages ────────────────────────────────────────────────────────────

    it("parses all non-endpoint pages referenced in navigation", () => {
      const slugs = result.pages.map((p) => p.slug);
      // Slugs should be basenames only
      expect(slugs).toContain("introduction");
      expect(slugs).toContain("quickstart");
      expect(slugs).toContain("overview"); // from guides/auth/overview or api/overview
      expect(slugs).toContain("endpoints");
    });

    it("skips endpoint placeholder pages with openapi: frontmatter", () => {
      const slugs = result.pages.map((p) => p.slug);
      // jwt-tokens has openapi: POST /api/auth/token — should be skipped
      expect(slugs).not.toContain("jwt-tokens");
    });

    it("extracts page titles from frontmatter", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      expect(introPage).toBeDefined();
      expect(introPage?.title).toBe("Introduction");
    });

    it("extracts metadata from frontmatter", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      expect(introPage?.metadata).toEqual(
        expect.objectContaining({
          title: "Introduction",
          description: "Welcome to Acme Docs",
        })
      );
    });

    it("strips Mintlify-only frontmatter fields from remaining pages", () => {
      // Verify no remaining pages have openapi/api/mode in their MDX content
      for (const page of result.pages) {
        expect(page.mdxContent).not.toMatch(/^openapi:/m);
        expect(page.mdxContent).not.toMatch(/^mode:/m);
      }
    });

    it("assigns pages to correct folders", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      expect(introPage?.folderPath).toBe("getting-started");

      const authOverview = result.pages.find(
        (p) => p.slug === "overview" && p.folderPath === "authentication"
      );
      expect(authOverview?.folderPath).toBe("authentication");
    });

    it("assigns position within folders", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart"
      );
      expect(introPage?.position).toBeLessThan(
        quickstartPage?.position ?? Infinity
      );
    });

    // ── Component transforms ─────────────────────────────────────────────

    it("transforms Note → Callout info", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      expect(introPage?.mdxContent).toContain('<Callout type="info">');
      expect(introPage?.mdxContent).not.toContain("<Note>");
    });

    it("transforms Warning → Callout warning", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart"
      );
      expect(quickstartPage?.mdxContent).toContain(
        '<Callout type="warning">'
      );
      expect(quickstartPage?.mdxContent).not.toContain("<Warning>");
    });

    it("transforms Tip → Callout tip", () => {
      const authPage = result.pages.find(
        (p) => p.slug === "overview" && p.folderPath === "authentication"
      );
      expect(authPage?.mdxContent).toContain('<Callout type="tip">');
      expect(authPage?.mdxContent).not.toContain("<Tip>");
    });

    it("transforms Note → Callout info on introduction page", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction" && p.folderPath === "getting-started"
      );
      expect(introPage?.mdxContent).toContain('<Callout type="info">');
      expect(introPage?.mdxContent).not.toContain("<Note>");
    });

    it("preserves non-Mintlify components (Tabs, Card, CardGroup)", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart"
      );
      expect(quickstartPage?.mdxContent).toContain("<Tabs>");
      expect(quickstartPage?.mdxContent).toContain("<Tab");
      expect(quickstartPage?.mdxContent).toContain("<Card");

      const authPage = result.pages.find(
        (p) => p.slug === "overview" && p.folderPath === "authentication"
      );
      expect(authPage?.mdxContent).toContain("<CardGroup");
    });

    // ── Folders ──────────────────────────────────────────────────────────

    it("produces parsed folders from navigation groups", () => {
      expect(result.folders.length).toBeGreaterThanOrEqual(3);

      const folderNames = result.folders.map((f) => f.name);
      expect(folderNames).toContain("Getting Started");
      expect(folderNames).toContain("Authentication");
      expect(folderNames).toContain("REST API");
    });

    it("folders have correct slugs", () => {
      const gettingStarted = result.folders.find(
        (f) => f.name === "Getting Started"
      );
      expect(gettingStarted?.slug).toBe("getting-started");
    });

    // ── NavTabs ──────────────────────────────────────────────────────────

    it("produces navigation tabs", () => {
      expect(result.navTabs).toBeDefined();
      expect(result.navTabs?.length).toBeGreaterThanOrEqual(1);

      const tabNames = result.navTabs?.map((t) => t.name) ?? [];
      expect(tabNames).toContain("API Reference");
    });

    // ── URL Map ──────────────────────────────────────────────────────────

    it("builds URL map for all non-skipped pages", () => {
      // With deduplication, some slugs may collide (e.g. "overview" appears
      // in both auth and api), so the deduplicated slug gets "-1" suffix,
      // reducing unique URL map entries. 4 is the minimum after dedup.
      expect(result.urlMap.size).toBeGreaterThanOrEqual(4);
      // With basename slugs, URLs use basenames
      expect(result.urlMap.get("/introduction")).toBe("/introduction");
      expect(result.urlMap.get("/quickstart")).toBe("/quickstart");
    });

    // ── Redirects ────────────────────────────────────────────────────────

    it("includes redirects from config", () => {
      expect(result.redirects.length).toBeGreaterThanOrEqual(1);
      const oldPageRedirect = result.redirects.find(
        (r) => r.from === "/old-page"
      );
      expect(oldPageRedirect).toBeDefined();
      expect(oldPageRedirect?.to).toBe("/guides/introduction");
    });

    // ── Assets ───────────────────────────────────────────────────────────

    it("collects image assets from content", () => {
      expect(result.assets.length).toBeGreaterThanOrEqual(1);

      const localImage = result.assets.find(
        (a) => a.originalUrl === "/images/architecture.png"
      );
      expect(localImage).toBeDefined();

      const remoteImage = result.assets.find(
        (a) => a.originalUrl === "https://example.com/api-diagram.png"
      );
      expect(remoteImage).toBeDefined();
    });

    // ── Branding ─────────────────────────────────────────────────────────

    it("extracts branding from config", () => {
      expect(result.branding).toBeDefined();
      expect(result.branding?.primaryColor).toBe("#6366F1");
      expect(result.branding?.logoPath).toBe("/logo/acme-light.svg");
      expect(result.branding?.logoDarkPath).toBe("/logo/acme-dark.svg");
      expect(result.branding?.faviconPath).toBe("/favicon.png");
    });

    it("extracts social links", () => {
      expect(result.branding?.socialLinks).toBeDefined();
      expect(result.branding?.socialLinks?.length).toBeGreaterThanOrEqual(1);
      const github = result.branding?.socialLinks?.find(
        (s) => s.platform === "github"
      );
      expect(github?.url).toBe("https://github.com/acme/acme");
    });

    // ── Snippets ──────────────────────────────────────────────────────────

    it("inlines snippet content into pages that import them", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart"
      );
      expect(quickstartPage).toBeDefined();
      // The snippet content should be inlined
      expect(quickstartPage?.mdxContent).toContain("Before you begin");
      expect(quickstartPage?.mdxContent).toContain("Node.js 18 or later");
      expect(quickstartPage?.mdxContent).toContain("Acme API key");
      // The import statement should be removed
      expect(quickstartPage?.mdxContent).not.toContain("import Prereqs");
      // The component placeholder should be replaced
      expect(quickstartPage?.mdxContent).not.toContain("<Prereqs");
    });

    it("does not import snippet files as standalone pages", () => {
      const snippetPage = result.pages.find(
        (p) =>
          p.slug.startsWith("snippets/") ||
          p.path.startsWith("snippets/")
      );
      expect(snippetPage).toBeUndefined();
    });

    // ── OpenAPI ─────────────────────────────────────────────────────────

    it("reads OpenAPI spec files referenced in config", () => {
      expect(result.openapiSpecs).toBeDefined();
      expect(result.openapiSpecs).toHaveLength(1);
      const spec = result.openapiSpecs?.[0];
      expect(spec?.path).toBe("openapi.yaml");
      expect(spec?.format).toBe("yaml");
      expect(spec?.basePath).toBe("/api");
      expect(spec?.buffer).toBeInstanceOf(Buffer);
    });

    it("emits warning about skipped endpoint pages", () => {
      const warning = result.warnings.find(
        (w) => w.includes("Skipped") && w.includes("endpoint page"),
      );
      expect(warning).toBeDefined();
    });

    // ── Warnings ─────────────────────────────────────────────────────────

    it("does not produce warnings for pages found in navigation", () => {
      const navMissingWarnings = result.warnings.filter((w) =>
        w.includes("referenced in navigation but file not found")
      );
      expect(navMissingWarnings).toHaveLength(0);
    });
  });

  // ── Auto-detection of OpenAPI specs ──────────────────────────────────────

  describe("auto-detect OpenAPI spec in subdirectory (api-reference/openapi.json)", () => {
    const FIXTURE_DIR_NO_CONFIG = resolve(
      __dirname,
      "__fixtures__",
      "no-config-openapi",
    );
    let result: Awaited<ReturnType<typeof parseMintlify>>;

    beforeAll(async () => {
      result = await parseMintlify(FIXTURE_DIR_NO_CONFIG);
    });

    it("auto-detects OpenAPI spec in api-reference/ subdirectory", () => {
      expect(result.openapiSpecs).toBeDefined();
      expect(result.openapiSpecs).toHaveLength(1);
      const spec = result.openapiSpecs?.[0];
      expect(spec?.path).toBe("api-reference/openapi.json");
      expect(spec?.format).toBe("json");
      expect(spec?.buffer).toBeInstanceOf(Buffer);
    });

    it("derives basePath from the API Reference tab", () => {
      const spec = result.openapiSpecs?.[0];
      expect(spec?.basePath).toBe("/api-reference");
    });

    it("emits auto-detection warning", () => {
      const warning = result.warnings.find((w) =>
        w.includes("Auto-detected OpenAPI spec file"),
      );
      expect(warning).toBeDefined();
      expect(warning).toContain("api-reference/openapi.json");
    });

    it("skips endpoint placeholder pages", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).not.toContain("get-user");
    });

    it("preserves non-endpoint pages", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).toContain("introduction");
    });
  });

  describe("auto-detect OpenAPI spec at root (openapi.yaml)", () => {
    const FIXTURE_DIR_ROOT = resolve(
      __dirname,
      "__fixtures__",
      "no-config-openapi-root",
    );
    let result: Awaited<ReturnType<typeof parseMintlify>>;

    beforeAll(async () => {
      result = await parseMintlify(FIXTURE_DIR_ROOT);
    });

    it("auto-detects YAML spec at root", () => {
      expect(result.openapiSpecs).toBeDefined();
      expect(result.openapiSpecs).toHaveLength(1);
      const spec = result.openapiSpecs?.[0];
      expect(spec?.path).toBe("openapi.yaml");
      expect(spec?.format).toBe("yaml");
      expect(spec?.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe("no spec present (should not error)", () => {
    it("returns no openapiSpecs when no spec file exists", async () => {
      // The sample-docs fixture already has an openapi.yaml AND a config reference,
      // so we need a fixture with neither. We use the docs-json-openapi fixture
      // which has an explicit config reference — that's not what we need.
      // Instead, just confirm parseMintlify doesn't crash on a dir with no spec.
      // We'll use a temp dir approach.
      const { mkdtempSync, writeFileSync, mkdirSync } = await import("fs");
      const { tmpdir } = await import("os");
      const { join } = await import("path");

      const tmpDir = mkdtempSync(join(tmpdir(), "mintlify-no-spec-"));
      writeFileSync(
        join(tmpDir, "docs.json"),
        JSON.stringify({
          name: "Test",
          colors: { primary: "#000" },
          navigation: [
            {
              tab: "Docs",
              groups: [
                { group: "Start", pages: ["intro"] },
              ],
            },
          ],
        }),
      );
      writeFileSync(
        join(tmpDir, "intro.mdx"),
        "---\ntitle: Intro\n---\n\nHello.",
      );

      const result = await parseMintlify(tmpDir);
      expect(result.openapiSpecs).toBeUndefined();
      // No auto-detection warning
      const warning = result.warnings.find((w) =>
        w.includes("Auto-detected OpenAPI spec file"),
      );
      expect(warning).toBeUndefined();
    });
  });

  describe("config has explicit path — should not duplicate with auto-detect", () => {
    it("does not auto-detect when config already specifies OpenAPI paths", async () => {
      // The docs-json-openapi fixture has an explicit openapi reference at group level
      const DOCS_JSON_FIXTURE_DIR = resolve(
        __dirname,
        "__fixtures__",
        "docs-json-openapi",
      );
      const result = await parseMintlify(DOCS_JSON_FIXTURE_DIR);
      // Should only have the one from config, not duplicated
      expect(result.openapiSpecs).toHaveLength(1);
      // Should NOT have an auto-detection warning
      const warning = result.warnings.find((w) =>
        w.includes("Auto-detected OpenAPI spec file"),
      );
      expect(warning).toBeUndefined();
    });
  });

  // ── docs.json with group-level OpenAPI ──────────────────────────────────

  describe("with docs-json-openapi fixture (group-level openapi)", () => {
    const DOCS_JSON_FIXTURE_DIR = resolve(
      __dirname,
      "__fixtures__",
      "docs-json-openapi",
    );
    let result: Awaited<ReturnType<typeof parseMintlify>>;

    beforeAll(async () => {
      result = await parseMintlify(DOCS_JSON_FIXTURE_DIR);
    });

    it("reads OpenAPI spec referenced at group level in docs.json", () => {
      expect(result.openapiSpecs).toBeDefined();
      expect(result.openapiSpecs).toHaveLength(1);
      const spec = result.openapiSpecs?.[0];
      expect(spec?.path).toBe("openapi.json");
      expect(spec?.format).toBe("json");
      expect(spec?.buffer).toBeInstanceOf(Buffer);
    });

    it("derives basePath from the API Reference tab slug", () => {
      const spec = result.openapiSpecs?.[0];
      expect(spec?.basePath).toBe("/api-reference");
    });

    it("skips endpoint placeholder pages with openapi frontmatter", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).not.toContain("create-user");
    });

    it("preserves non-endpoint pages", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).toContain("introduction");
    });

    it("emits warning about skipped endpoint pages", () => {
      const warning = result.warnings.find(
        (w) => w.includes("Skipped") && w.includes("endpoint page"),
      );
      expect(warning).toBeDefined();
    });
  });
});
