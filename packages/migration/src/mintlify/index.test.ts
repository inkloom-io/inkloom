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
});
