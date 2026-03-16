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

    it("parses all pages referenced in navigation", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).toContain("guides/introduction");
      expect(slugs).toContain("guides/quickstart");
      expect(slugs).toContain("guides/auth/overview");
      expect(slugs).toContain("guides/auth/jwt-tokens");
      expect(slugs).toContain("api/overview");
      expect(slugs).toContain("api/endpoints");
    });

    it("extracts page titles from frontmatter", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "guides/introduction"
      );
      expect(introPage).toBeDefined();
      expect(introPage?.title).toBe("Introduction");
    });

    it("extracts metadata from frontmatter", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "guides/introduction"
      );
      expect(introPage?.metadata).toEqual(
        expect.objectContaining({
          title: "Introduction",
          description: "Welcome to Acme Docs",
        })
      );
    });

    it("strips Mintlify-only frontmatter fields (openapi)", () => {
      const jwtPage = result.pages.find(
        (p) => p.slug === "guides/auth/jwt-tokens"
      );
      expect(jwtPage).toBeDefined();
      // openapi field should be stripped from the output MDX
      expect(jwtPage?.mdxContent).not.toMatch(/^openapi:/m);
    });

    it("assigns pages to correct folders", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "guides/introduction"
      );
      expect(introPage?.folderPath).toBe("getting-started");

      const jwtPage = result.pages.find(
        (p) => p.slug === "guides/auth/jwt-tokens"
      );
      expect(jwtPage?.folderPath).toBe("authentication");
    });

    it("assigns position within folders", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "guides/introduction"
      );
      const quickstartPage = result.pages.find(
        (p) => p.slug === "guides/quickstart"
      );
      expect(introPage?.position).toBeLessThan(
        quickstartPage?.position ?? Infinity
      );
    });

    // ── Component transforms ─────────────────────────────────────────────

    it("transforms Note → Callout info", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "guides/introduction"
      );
      expect(introPage?.mdxContent).toContain('<Callout type="info">');
      expect(introPage?.mdxContent).not.toContain("<Note>");
    });

    it("transforms Warning → Callout warning", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "guides/quickstart"
      );
      expect(quickstartPage?.mdxContent).toContain(
        '<Callout type="warning">'
      );
      expect(quickstartPage?.mdxContent).not.toContain("<Warning>");
    });

    it("transforms Tip → Callout tip", () => {
      const authPage = result.pages.find(
        (p) => p.slug === "guides/auth/overview"
      );
      expect(authPage?.mdxContent).toContain('<Callout type="tip">');
      expect(authPage?.mdxContent).not.toContain("<Tip>");
    });

    it("transforms Info → Callout info", () => {
      const jwtPage = result.pages.find(
        (p) => p.slug === "guides/auth/jwt-tokens"
      );
      expect(jwtPage?.mdxContent).toContain('<Callout type="info">');
      expect(jwtPage?.mdxContent).not.toContain("<Info>");
    });

    it("transforms Check → Callout success", () => {
      const jwtPage = result.pages.find(
        (p) => p.slug === "guides/auth/jwt-tokens"
      );
      expect(jwtPage?.mdxContent).toContain('<Callout type="success">');
      expect(jwtPage?.mdxContent).not.toContain("<Check>");
    });

    it("preserves non-Mintlify components (Tabs, Card, CardGroup)", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "guides/quickstart"
      );
      expect(quickstartPage?.mdxContent).toContain("<Tabs>");
      expect(quickstartPage?.mdxContent).toContain("<Tab");
      expect(quickstartPage?.mdxContent).toContain("<Card");

      const authPage = result.pages.find(
        (p) => p.slug === "guides/auth/overview"
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

    it("builds URL map for all pages", () => {
      expect(result.urlMap.size).toBeGreaterThanOrEqual(6);
      expect(result.urlMap.get("/guides/introduction")).toBe(
        "/guides/introduction"
      );
      expect(result.urlMap.get("/api/overview")).toBe("/api/overview");
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

    // ── Warnings ─────────────────────────────────────────────────────────

    it("does not produce warnings for pages found in navigation", () => {
      const navMissingWarnings = result.warnings.filter((w) =>
        w.includes("referenced in navigation but file not found")
      );
      expect(navMissingWarnings).toHaveLength(0);
    });
  });
});
