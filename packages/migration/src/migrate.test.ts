import { describe, it, expect, vi, beforeAll } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { migrate } from "./index.js";
import {
  MigrationSource,
  type MigrationStage,
  type EnrichedMigrationResult,
} from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MINTLIFY_FIXTURE_DIR = resolve(
  __dirname,
  "mintlify",
  "__fixtures__",
  "sample-docs",
);

describe("migrate() orchestrator", () => {
  describe("with Mintlify fixture", () => {
    let result: EnrichedMigrationResult;
    const progressCalls: Array<{
      stage: MigrationStage;
      current: number;
      total: number;
    }> = [];

    beforeAll(async () => {
      // Mock fetch for remote image URLs
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: new Headers({ "content-type": "image/png" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      result = await migrate({
        source: MigrationSource.Mintlify,
        dirPath: MINTLIFY_FIXTURE_DIR,
        projectName: "Acme Docs Import",
        sourceUrl: "https://docs.acme.com/docs",
        onProgress: (stage, current, total) => {
          progressCalls.push({ stage, current, total });
        },
      });
    });

    // ── Project name ──────────────────────────────────────────────────────

    it("returns the project name", () => {
      expect(result.projectName).toBe("Acme Docs Import");
    });

    // ── Pages with BlockNote JSON content ─────────────────────────────────

    it("converts pages to ImportReadyPage shape", () => {
      expect(result.pages.length).toBeGreaterThanOrEqual(5);

      for (const page of result.pages) {
        expect(page).toHaveProperty("title");
        expect(page).toHaveProperty("slug");
        expect(page).toHaveProperty("path");
        expect(page).toHaveProperty("position");
        expect(page).toHaveProperty("folderPath");
        expect(page).toHaveProperty("content");
        expect(page).toHaveProperty("isPublished");
        expect(typeof page.content).toBe("string");
        expect(page.isPublished).toBe(true);
      }
    });

    it("pages have valid JSON-serialized BlockNote content", () => {
      for (const page of result.pages) {
        let parsed: unknown;
        expect(() => {
          parsed = JSON.parse(page.content);
        }).not.toThrow();

        expect(Array.isArray(parsed)).toBe(true);
        const blocks = parsed as Array<{ type: string }>;
        expect(blocks.length).toBeGreaterThan(0);
        // Every block should have a type
        for (const block of blocks) {
          expect(block).toHaveProperty("type");
        }
      }
    });

    it("pages match createFromImport args shape", () => {
      for (const page of result.pages) {
        // Validate required fields for createFromImport
        expect(typeof page.title).toBe("string");
        expect(typeof page.slug).toBe("string");
        expect(typeof page.path).toBe("string");
        expect(typeof page.position).toBe("number");
        expect(typeof page.content).toBe("string");
        expect(typeof page.isPublished).toBe("boolean");
        // folderPath should be a string (empty for root pages)
        expect(typeof page.folderPath).toBe("string");
      }
    });

    it("preserves page slugs as basenames from source", () => {
      const slugs = result.pages.map((p) => p.slug);
      // Slugs should be basenames (last path segment), not full paths
      expect(slugs).toContain("introduction");
      expect(slugs).toContain("quickstart");
      expect(slugs).toContain("overview");
    });

    // ── Folders ──────────────────────────────────────────────────────────

    it("includes parsed folders", () => {
      expect(result.folders.length).toBeGreaterThanOrEqual(3);

      for (const folder of result.folders) {
        expect(folder).toHaveProperty("name");
        expect(folder).toHaveProperty("slug");
        expect(folder).toHaveProperty("path");
        expect(folder).toHaveProperty("position");
      }
    });

    it("folders match createFromImport args shape", () => {
      for (const folder of result.folders) {
        expect(typeof folder.name).toBe("string");
        expect(typeof folder.slug).toBe("string");
        expect(typeof folder.path).toBe("string");
        expect(typeof folder.position).toBe("number");
        // parentPath is optional
        if (folder.parentPath !== undefined) {
          expect(typeof folder.parentPath).toBe("string");
        }
      }
    });

    // ── NavTabs ──────────────────────────────────────────────────────────

    it("maps navTabs to InkLoom schema shape", () => {
      expect(result.navTabs).toBeDefined();
      if (!result.navTabs) return;

      expect(result.navTabs.length).toBeGreaterThanOrEqual(1);

      for (const tab of result.navTabs) {
        expect(tab).toHaveProperty("id");
        expect(tab).toHaveProperty("name");
        expect(tab).toHaveProperty("slug");
        expect(tab).toHaveProperty("items");

        expect(typeof tab.id).toBe("string");
        expect(typeof tab.name).toBe("string");
        expect(typeof tab.slug).toBe("string");
        expect(Array.isArray(tab.items)).toBe(true);

        for (const item of tab.items) {
          expect(item).toHaveProperty("type");
          if (item.type === "folder") {
            expect(item).toHaveProperty("folderPath");
          } else if (item.type === "page") {
            expect(item).toHaveProperty("pagePath");
          }
        }
      }
    });

    it("navTabs contain the API Reference tab", () => {
      const apiTab = result.navTabs?.find((t) => t.name === "API Reference");
      expect(apiTab).toBeDefined();
      expect(apiTab?.slug).toBe("api");
    });

    // ── Branding ─────────────────────────────────────────────────────────

    it("maps branding to InkLoom settings shape", () => {
      expect(result.branding).toBeDefined();
      expect(result.branding?.primaryColor).toBe("#6366F1");
      expect(result.branding?.logoAssetPath).toBe("/logo/acme-light.svg");
      expect(result.branding?.logoDarkAssetPath).toBe("/logo/acme-dark.svg");
      expect(result.branding?.faviconAssetPath).toBe("/favicon.png");
    });

    it("maps social links in branding", () => {
      expect(result.branding?.socialLinks).toBeDefined();
      const github = result.branding?.socialLinks?.find(
        (s) => s.platform === "github",
      );
      expect(github).toBeDefined();
      expect(github?.url).toBe("https://github.com/acme/acme");
    });

    // ── Redirects ────────────────────────────────────────────────────────

    it("includes redirect rules", () => {
      expect(result.redirects.length).toBeGreaterThanOrEqual(1);

      const oldPageRedirect = result.redirects.find(
        (r) => r.from === "/old-page",
      );
      expect(oldPageRedirect).toBeDefined();
      expect(oldPageRedirect?.to).toBe("/guides/introduction");
    });

    it("generates _redirects file content", () => {
      expect(typeof result.redirectsFileContent).toBe("string");
      expect(result.redirectsFileContent.length).toBeGreaterThan(0);
      // Should contain SPA fallback rules
      expect(result.redirectsFileContent).toContain("/*  /index.html  200");
    });

    // ── Subpath guidance ─────────────────────────────────────────────────

    it("detects subpath and provides guidance", () => {
      expect(result.subpathGuidance).toBeDefined();
      expect(result.subpathGuidance?.subpath).toBe("/docs");
      expect(result.subpathGuidance?.originalHost).toBe("docs.acme.com");
      expect(result.subpathGuidance?.recommendedSubdomain).toBe(
        "docs.docs.acme.com",
      );
      expect(result.subpathGuidance?.snippets).toBeDefined();
    });

    // ── Assets ───────────────────────────────────────────────────────────

    it("includes discovered assets", () => {
      expect(result.assets.length).toBeGreaterThanOrEqual(1);
    });

    // ── URL Map ──────────────────────────────────────────────────────────

    it("includes URL map", () => {
      // With basename slugs, collisions reduce URL map entries
      // (e.g. auth/overview and api/overview both produce /overview)
      expect(result.urlMap.size).toBeGreaterThanOrEqual(4);
    });

    // ── Progress callback ────────────────────────────────────────────────

    it("fires progress callback at each stage", () => {
      const stages = new Set(progressCalls.map((c) => c.stage));
      expect(stages.has("parsing")).toBe(true);
      expect(stages.has("converting")).toBe(true);
      expect(stages.has("assets")).toBe(true);
      expect(stages.has("redirects")).toBe(true);
    });

    it("progress callback reports correct completion for parsing", () => {
      const parsingCalls = progressCalls.filter(
        (c) => c.stage === "parsing",
      );
      expect(parsingCalls.length).toBeGreaterThanOrEqual(2);
      // First call should be 0/1 (start), last should be 1/1 (done)
      expect(parsingCalls[0].current).toBe(0);
      expect(parsingCalls[parsingCalls.length - 1].current).toBe(1);
    });

    it("progress callback reports per-page conversion progress", () => {
      const convertingCalls = progressCalls.filter(
        (c) => c.stage === "converting",
      );
      expect(convertingCalls.length).toBeGreaterThanOrEqual(2);
      // First call should be 0/N (start)
      expect(convertingCalls[0].current).toBe(0);
      // Last call should be N/N (done)
      const lastCall = convertingCalls[convertingCalls.length - 1];
      expect(lastCall.current).toBe(lastCall.total);
    });

    // ── Warnings ─────────────────────────────────────────────────────────

    it("includes warnings array", () => {
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  // ── Dry-run mode ─────────────────────────────────────────────────────────

  describe("dry-run mode", () => {
    let result: EnrichedMigrationResult;

    beforeAll(async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: new Headers({ "content-type": "image/png" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      result = await migrate({
        source: MigrationSource.Mintlify,
        dirPath: MINTLIFY_FIXTURE_DIR,
        projectName: "Dry Run Test",
        dryRun: true,
      });
    });

    it("returns result without errors in dry-run mode", () => {
      expect(result.projectName).toBe("Dry Run Test");
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.folders.length).toBeGreaterThan(0);
    });

    it("still converts pages to BlockNote JSON in dry-run", () => {
      for (const page of result.pages) {
        expect(() => JSON.parse(page.content)).not.toThrow();
      }
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws for unsupported source", async () => {
      await expect(
        migrate({
          source: "unknown" as MigrationSource,
          dirPath: "/nonexistent",
          projectName: "Test",
        }),
      ).rejects.toThrow(/Unsupported migration source/);
    });

    it("throws when Mintlify config not found", async () => {
      await expect(
        migrate({
          source: MigrationSource.Mintlify,
          dirPath: "/nonexistent/path",
          projectName: "Test",
        }),
      ).rejects.toThrow(/No Mintlify config found/);
    });
  });
});
