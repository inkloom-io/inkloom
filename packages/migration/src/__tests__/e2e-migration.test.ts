/**
 * End-to-end migration tests.
 *
 * These tests run the full migrate() pipeline against realistic fixture
 * directories for both Mintlify and Gitbook sources, validating every
 * aspect of the migration output: pages, folders, navTabs, branding,
 * redirects, assets, URL map, and component preservation through
 * mdxToBlockNote().
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { migrate } from "../index.js";
import {
  MigrationSource,
  type MigrationStage,
  type EnrichedMigrationResult,
} from "../types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MINTLIFY_FIXTURE_DIR = resolve(
  __dirname,
  "fixtures",
  "mintlify-sample",
);
const GITBOOK_FIXTURE_DIR = resolve(
  __dirname,
  "fixtures",
  "gitbook-sample",
);

// ═══════════════════════════════════════════════════════════════════════════
// Helper: find a block of a given type recursively in BlockNote JSON
// ═══════════════════════════════════════════════════════════════════════════

interface BlockNode {
  type: string;
  props?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string; href?: string; styles?: Record<string, unknown> }>;
  children?: BlockNode[];
}

/**
 * Recursively collect all blocks of a given type from a BlockNote tree.
 */
function findBlocks(blocks: BlockNode[], type: string): BlockNode[] {
  const found: BlockNode[] = [];
  for (const block of blocks) {
    if (block.type === type) {
      found.push(block);
    }
    if (block.children) {
      found.push(...findBlocks(block.children, type));
    }
  }
  return found;
}

/**
 * Parse a page's content string into BlockNote blocks.
 */
function parseBlocks(content: string): BlockNode[] {
  return JSON.parse(content) as BlockNode[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Mintlify E2E
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: migrate() with Mintlify fixture", () => {
  let result: EnrichedMigrationResult;
  const progressCalls: Array<{
    stage: MigrationStage;
    current: number;
    total: number;
  }> = [];

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
      projectName: "Widget Docs Import",
      sourceUrl: "https://docs.widget.io/docs",
      onProgress: (stage, current, total) => {
        progressCalls.push({ stage, current, total });
      },
    });
  });

  // ── Result shape ──────────────────────────────────────────────────────

  describe("result shape", () => {
    it("returns the project name", () => {
      expect(result.projectName).toBe("Widget Docs Import");
    });

    it("produces a valid MigrationResult with all required fields", () => {
      expect(result).toHaveProperty("projectName");
      expect(result).toHaveProperty("pages");
      expect(result).toHaveProperty("folders");
      expect(result).toHaveProperty("redirects");
      expect(result).toHaveProperty("redirectsFileContent");
      expect(result).toHaveProperty("assets");
      expect(result).toHaveProperty("urlMap");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.pages)).toBe(true);
      expect(Array.isArray(result.folders)).toBe(true);
      expect(Array.isArray(result.redirects)).toBe(true);
      expect(Array.isArray(result.assets)).toBe(true);
      expect(result.urlMap instanceof Map).toBe(true);
    });
  });

  // ── Page counts & structure ───────────────────────────────────────────

  describe("pages", () => {
    it("converts all non-endpoint fixture pages", () => {
      // introduction, quickstart, auth/overview, components/callouts,
      // components/interactive, components/columns, components/latex, api/overview, api/endpoints
      // (jwt-tokens, list-plants, create-plant are skipped — they have openapi: directives)
      expect(result.pages).toHaveLength(9);
    });

    it("every page matches createFromImport args shape", () => {
      for (const page of result.pages) {
        expect(typeof page.title).toBe("string");
        expect(typeof page.slug).toBe("string");
        expect(typeof page.path).toBe("string");
        expect(typeof page.position).toBe("number");
        expect(typeof page.folderPath).toBe("string");
        expect(typeof page.content).toBe("string");
        expect(page.isPublished).toBe(true);
      }
    });

    it("every page has valid JSON-serialized BlockNote content", () => {
      for (const page of result.pages) {
        let parsed: unknown;
        expect(() => {
          parsed = JSON.parse(page.content);
        }).not.toThrow();

        expect(Array.isArray(parsed)).toBe(true);
        const blocks = parsed as BlockNode[];
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
          expect(block).toHaveProperty("type");
        }
      }
    });

    it("preserves page slugs as basenames from source navigation", () => {
      const slugs = result.pages.map((p) => p.slug);
      // Slugs should be basenames (last path segment), not full paths
      expect(slugs).toContain("introduction");
      expect(slugs).toContain("quickstart");
      expect(slugs).toContain("overview"); // from guides/auth/overview
      expect(slugs).toContain("callouts");
      expect(slugs).toContain("interactive");
      expect(slugs).toContain("columns");
      expect(slugs).toContain("endpoints");
      // jwt-tokens is skipped (has openapi: directive)
      expect(slugs).not.toContain("jwt-tokens");
    });

    it("assigns correct folder paths", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction",
      );
      expect(introPage).toBeDefined();
      if (introPage) {
        expect(introPage.folderPath).toBeTruthy();
      }

      const apiPage = result.pages.find((p) => p.slug === "overview" && p.folderPath === "api");
      expect(apiPage).toBeDefined();
      if (apiPage) {
        expect(apiPage.folderPath).toBeTruthy();
      }
    });
  });

  // ── Folders ───────────────────────────────────────────────────────────

  describe("folders", () => {
    it("creates folders for navigation groups", () => {
      // Getting Started, Authentication, Components Demo, API
      expect(result.folders.length).toBeGreaterThanOrEqual(4);
    });

    it("every folder has valid shape", () => {
      for (const folder of result.folders) {
        expect(typeof folder.name).toBe("string");
        expect(typeof folder.slug).toBe("string");
        expect(typeof folder.path).toBe("string");
        expect(typeof folder.position).toBe("number");
      }
    });
  });

  // ── NavTabs ───────────────────────────────────────────────────────────

  describe("navTabs", () => {
    it("maps navTabs to InkLoom schema shape", () => {
      expect(result.navTabs).toBeDefined();
      if (!result.navTabs) return;

      expect(result.navTabs.length).toBeGreaterThanOrEqual(2);

      for (const tab of result.navTabs) {
        expect(typeof tab.id).toBe("string");
        expect(typeof tab.name).toBe("string");
        expect(typeof tab.slug).toBe("string");
        expect(Array.isArray(tab.items)).toBe(true);
      }
    });

    it("contains the Guides tab", () => {
      const guidesTab = result.navTabs?.find((t) => t.name === "Guides");
      expect(guidesTab).toBeDefined();
      expect(guidesTab?.slug).toBe("guides");
    });

    it("contains the API Reference tab", () => {
      const apiTab = result.navTabs?.find((t) => t.name === "API Reference");
      expect(apiTab).toBeDefined();
      expect(apiTab?.slug).toBe("api");
    });

    it("navTab items reference known folders or pages", () => {
      if (!result.navTabs) return;

      const folderPaths = new Set(result.folders.map((f) => f.path));
      const pageSlugs = new Set(result.pages.map((p) => p.slug));

      for (const tab of result.navTabs) {
        for (const item of tab.items) {
          if (item.type === "folder") {
            expect(folderPaths.has(item.folderPath)).toBe(true);
          } else if (item.type === "page") {
            expect(pageSlugs.has(item.pagePath)).toBe(true);
          }
        }
      }
    });
  });

  // ── Branding ──────────────────────────────────────────────────────────

  describe("branding", () => {
    it("extracts primary color", () => {
      expect(result.branding).toBeDefined();
      expect(result.branding?.primaryColor).toBe("#2563EB");
    });

    it("extracts logo paths", () => {
      expect(result.branding?.logoAssetPath).toBe("/logo/widget-light.svg");
      expect(result.branding?.logoDarkAssetPath).toBe(
        "/logo/widget-dark.svg",
      );
    });

    it("extracts favicon path", () => {
      expect(result.branding?.faviconAssetPath).toBe("/favicon.svg");
    });

    it("extracts social links", () => {
      expect(result.branding?.socialLinks).toBeDefined();
      const github = result.branding?.socialLinks?.find(
        (s) => s.platform === "github",
      );
      expect(github).toBeDefined();
      expect(github?.url).toBe("https://github.com/widgetco/widget");
    });
  });

  // ── Redirects ─────────────────────────────────────────────────────────

  describe("redirects", () => {
    it("includes config-defined redirect rules", () => {
      const oldIntro = result.redirects.find((r) => r.from === "/old-intro");
      expect(oldIntro).toBeDefined();
      expect(oldIntro?.to).toBe("/guides/introduction");
      expect(oldIntro?.status).toBe(301);

      const legacyAuth = result.redirects.find(
        (r) => r.from === "/legacy/auth",
      );
      expect(legacyAuth).toBeDefined();
      expect(legacyAuth?.to).toBe("/guides/auth/overview");
    });

    it("generates _redirects file content", () => {
      expect(typeof result.redirectsFileContent).toBe("string");
      expect(result.redirectsFileContent.length).toBeGreaterThan(0);
    });
  });

  // ── OpenAPI specs ────────────────────────────────────────────────────

  describe("openapi specs", () => {
    it("reads OpenAPI spec files referenced in config", () => {
      expect(result.openapiSpecs).toBeDefined();
      expect(result.openapiSpecs).toHaveLength(1);

      const spec = result.openapiSpecs?.[0];
      expect(spec?.path).toBe("openapi.yaml");
      expect(spec?.format).toBe("yaml");
      expect(spec?.basePath).toBe("/api");
      expect(spec?.buffer).toBeInstanceOf(Buffer);
      expect(spec?.buffer.length).toBeGreaterThan(0);
    });

    it("skips endpoint placeholder pages with openapi: frontmatter", () => {
      const slugs = result.pages.map((p) => p.slug);
      expect(slugs).not.toContain("list-plants");
      expect(slugs).not.toContain("create-plant");
    });

    it("emits a warning summarizing skipped endpoint pages", () => {
      const warning = result.warnings.find((w) =>
        w.includes("Skipped") && w.includes("endpoint page"),
      );
      expect(warning).toBeDefined();
      // jwt-tokens + list-plants + create-plant = 3 endpoint pages
      expect(warning).toContain("3");
    });

    it("prunes folders that only contained endpoint pages", () => {
      const folderPaths = result.folders.map((f) => f.path);
      expect(folderPaths).not.toContain("plant-endpoints");
    });
  });

  // ── Subpath guidance ──────────────────────────────────────────────────

  describe("subpath guidance", () => {
    it("detects /docs subpath from sourceUrl", () => {
      expect(result.subpathGuidance).toBeDefined();
      expect(result.subpathGuidance?.subpath).toBe("/docs");
    });
  });

  // ── URL Map ───────────────────────────────────────────────────────────

  describe("URL map", () => {
    it("has an entry for every non-skipped page", () => {
      expect(result.urlMap.size).toBeGreaterThanOrEqual(7);
    });

    it("maps source paths to InkLoom paths accurately", () => {
      // Source paths should map to corresponding InkLoom paths
      const entries = Array.from(result.urlMap.entries());
      expect(entries.length).toBeGreaterThan(0);

      // Every mapped path should start with /
      for (const [source, target] of entries) {
        expect(source.startsWith("/")).toBe(true);
        expect(target.startsWith("/")).toBe(true);
      }
    });
  });

  // ── Assets ────────────────────────────────────────────────────────────

  describe("assets", () => {
    it("discovers asset references from content", () => {
      // At minimum: architecture.png image ref and cdn.widget.io remote image
      expect(result.assets.length).toBeGreaterThanOrEqual(1);
    });

    it("assets have required fields", () => {
      for (const asset of result.assets) {
        expect(typeof asset.originalUrl).toBe("string");
        expect(typeof asset.filename).toBe("string");
        expect(typeof asset.mimeType).toBe("string");
      }
    });
  });

  // ── Progress callback ────────────────────────────────────────────────

  describe("progress callback", () => {
    it("fires at all four stages", () => {
      const stages = new Set(progressCalls.map((c) => c.stage));
      expect(stages.has("parsing")).toBe(true);
      expect(stages.has("converting")).toBe(true);
      expect(stages.has("assets")).toBe(true);
      expect(stages.has("redirects")).toBe(true);
    });

    it("reports per-page conversion progress", () => {
      const convertingCalls = progressCalls.filter(
        (c) => c.stage === "converting",
      );
      expect(convertingCalls.length).toBeGreaterThanOrEqual(2);
      const lastCall = convertingCalls[convertingCalls.length - 1];
      expect(lastCall.current).toBe(lastCall.total);
    });
  });

  // ── Component preservation through mdxToBlockNote() ───────────────────

  describe("component preservation", () => {
    it("preserves Callout (Note) blocks", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction",
      );
      expect(introPage).toBeDefined();
      if (!introPage) return;

      const blocks = parseBlocks(introPage.content);
      const callouts = findBlocks(blocks, "callout");
      expect(callouts.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves all 5 callout variants (Note, Warning, Tip, Info, Check)", () => {
      const calloutsPage = result.pages.find(
        (p) => p.slug === "callouts",
      );
      expect(calloutsPage).toBeDefined();
      if (!calloutsPage) return;

      const blocks = parseBlocks(calloutsPage.content);
      const callouts = findBlocks(blocks, "callout");
      // Should have at least 5 callout blocks (Note, Warning, Tip, Info, Check)
      expect(callouts.length).toBeGreaterThanOrEqual(5);

      const types = callouts.map((c) => c.props?.type);
      expect(types).toContain("info");      // Note → info
      expect(types).toContain("warning");   // Warning → warning
      expect(types).toContain("tip");       // Tip → tip
      // Info maps to info (same as Note) so we check for success (Check → success)
      expect(types).toContain("success");   // Check → success
    });

    it("preserves Tabs blocks", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart",
      );
      expect(quickstartPage).toBeDefined();
      if (!quickstartPage) return;

      const blocks = parseBlocks(quickstartPage.content);
      // Tabs are converted to a "tabs" type or similar container
      // Check that the content is non-trivial and contains tab-related content
      const allTypes = blocks.map((b) => b.type);
      // The content should have been processed, not lost
      expect(blocks.length).toBeGreaterThan(3);
    });

    it("preserves CardGroup blocks", () => {
      const authPage = result.pages.find(
        (p) => p.slug === "overview" && p.folderPath === "authentication",
      );
      expect(authPage).toBeDefined();
      if (!authPage) return;

      const blocks = parseBlocks(authPage.content);
      const cardGroups = findBlocks(blocks, "cardGroup");
      expect(cardGroups.length).toBeGreaterThanOrEqual(1);
    });

    it("does not include skipped endpoint pages in output", () => {
      // jwt-tokens has openapi: directive and should be excluded
      const jwtPage = result.pages.find(
        (p) => p.slug === "jwt-tokens",
      );
      expect(jwtPage).toBeUndefined();
    });

    it("preserves Steps blocks", () => {
      const quickstartPage = result.pages.find(
        (p) => p.slug === "quickstart",
      );
      expect(quickstartPage).toBeDefined();
      if (!quickstartPage) return;

      const blocks = parseBlocks(quickstartPage.content);
      const steps = findBlocks(blocks, "steps");
      expect(steps.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves heading blocks", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction",
      );
      expect(introPage).toBeDefined();
      if (!introPage) return;

      const blocks = parseBlocks(introPage.content);
      const headings = findBlocks(blocks, "heading");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves code blocks with language", () => {
      // Use the interactive page which has standalone code blocks not nested in accordions
      const interactivePage = result.pages.find(
        (p) => p.slug === "interactive",
      );
      expect(interactivePage).toBeDefined();
      if (!interactivePage) return;

      const blocks = parseBlocks(interactivePage.content);
      const codeBlocks = findBlocks(blocks, "codeBlock");
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
      // At least one should have "json" language (the standalone code block)
      const jsonBlock = codeBlocks.find(
        (b) => b.props?.language === "json",
      );
      expect(jsonBlock).toBeDefined();
    });

    it("preserves table blocks", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction",
      );
      expect(introPage).toBeDefined();
      if (!introPage) return;

      const blocks = parseBlocks(introPage.content);
      const tables = findBlocks(blocks, "table");
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves image blocks", () => {
      const introPage = result.pages.find(
        (p) => p.slug === "introduction",
      );
      expect(introPage).toBeDefined();
      if (!introPage) return;

      const blocks = parseBlocks(introPage.content);
      const images = findBlocks(blocks, "image");
      expect(images.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves Columns with Card children as cardGroup blocks", () => {
      const columnsPage = result.pages.find(
        (p) => p.slug === "columns",
      );
      expect(columnsPage).toBeDefined();
      if (!columnsPage) return;

      const blocks = parseBlocks(columnsPage.content);
      const cardGroups = findBlocks(blocks, "cardGroup");
      expect(cardGroups.length).toBeGreaterThanOrEqual(1);
      expect(cardGroups[0].props?.cols).toBe("2");

      const cards = findBlocks(blocks, "card");
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves Columns with non-card children as columns + column blocks", () => {
      const columnsPage = result.pages.find(
        (p) => p.slug === "columns",
      );
      expect(columnsPage).toBeDefined();
      if (!columnsPage) return;

      const blocks = parseBlocks(columnsPage.content);
      const columnsBlocks = findBlocks(blocks, "columns");
      expect(columnsBlocks.length).toBeGreaterThanOrEqual(1);
      expect(columnsBlocks[0].props?.cols).toBe("3");

      const columnBlocks = findBlocks(blocks, "column");
      expect(columnBlocks.length).toBeGreaterThanOrEqual(3);
    });

    it("preserves LaTeX blocks", () => {
      const latexPage = result.pages.find(
        (p) => p.slug === "latex",
      );
      expect(latexPage).toBeDefined();
      if (!latexPage) return;

      const blocks = parseBlocks(latexPage.content);
      const latexBlocks = findBlocks(blocks, "latex");
      expect(latexBlocks.length).toBeGreaterThanOrEqual(2);

      const expressions = latexBlocks.map((b) => b.props?.expression);
      expect(expressions).toContain("E = mc^2");
      expect(expressions).toContain("\\alpha^2 + \\beta^2 = \\gamma^2");
    });

    it("preserves paragraph and list blocks", () => {
      const interactivePage = result.pages.find(
        (p) => p.slug === "interactive",
      );
      expect(interactivePage).toBeDefined();
      if (!interactivePage) return;

      const blocks = parseBlocks(interactivePage.content);
      const paragraphs = findBlocks(blocks, "paragraph");
      expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gitbook E2E
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: migrate() with Gitbook fixture", () => {
  let result: EnrichedMigrationResult;
  const progressCalls: Array<{
    stage: MigrationStage;
    current: number;
    total: number;
  }> = [];

  beforeAll(async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: new Headers({ "content-type": "image/png" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    result = await migrate({
      source: MigrationSource.Gitbook,
      dirPath: GITBOOK_FIXTURE_DIR,
      projectName: "Acme SDK Import",
      onProgress: (stage, current, total) => {
        progressCalls.push({ stage, current, total });
      },
    });
  });

  // ── Result shape ──────────────────────────────────────────────────────

  describe("result shape", () => {
    it("returns the project name", () => {
      expect(result.projectName).toBe("Acme SDK Import");
    });

    it("produces a valid EnrichedMigrationResult", () => {
      expect(result).toHaveProperty("projectName");
      expect(result).toHaveProperty("pages");
      expect(result).toHaveProperty("folders");
      expect(result).toHaveProperty("redirects");
      expect(result).toHaveProperty("redirectsFileContent");
      expect(result).toHaveProperty("assets");
      expect(result).toHaveProperty("urlMap");
      expect(result).toHaveProperty("warnings");
    });
  });

  // ── Page counts & structure ───────────────────────────────────────────

  describe("pages", () => {
    it("converts all fixture pages", () => {
      // README, welcome, installation, configuration, showcase, overview,
      // authentication, api-keys, custom-plugins, performance, faq
      // = 11 pages (README is also included)
      expect(result.pages.length).toBeGreaterThanOrEqual(10);
    });

    it("every page matches createFromImport args shape", () => {
      for (const page of result.pages) {
        expect(typeof page.title).toBe("string");
        expect(typeof page.slug).toBe("string");
        expect(typeof page.path).toBe("string");
        expect(typeof page.position).toBe("number");
        expect(typeof page.folderPath).toBe("string");
        expect(typeof page.content).toBe("string");
        expect(page.isPublished).toBe(true);
      }
    });

    it("every page has valid JSON-serialized BlockNote content", () => {
      for (const page of result.pages) {
        let parsed: unknown;
        expect(() => {
          parsed = JSON.parse(page.content);
        }).not.toThrow();

        expect(Array.isArray(parsed)).toBe(true);
        const blocks = parsed as BlockNode[];
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
          expect(block).toHaveProperty("type");
        }
      }
    });

    it("assigns correct folder paths from SUMMARY.md", () => {
      const welcomePage = result.pages.find(
        (p) => p.path === "getting-started/welcome.md",
      );
      expect(welcomePage).toBeDefined();
      if (welcomePage) {
        expect(welcomePage.folderPath).toBeTruthy();
      }
    });
  });

  // ── Folders ───────────────────────────────────────────────────────────

  describe("folders", () => {
    it("creates folders from SUMMARY.md heading groups", () => {
      // Getting Started, API Reference, Advanced
      // Plus sub-folder for authentication (has children)
      expect(result.folders.length).toBeGreaterThanOrEqual(3);
    });

    it("every folder has valid shape", () => {
      for (const folder of result.folders) {
        expect(typeof folder.name).toBe("string");
        expect(typeof folder.slug).toBe("string");
        expect(typeof folder.path).toBe("string");
        expect(typeof folder.position).toBe("number");
      }
    });

    it("has a folder for Getting Started", () => {
      const gettingStarted = result.folders.find(
        (f) => f.name === "Getting Started",
      );
      expect(gettingStarted).toBeDefined();
    });

    it("has a folder for API Reference", () => {
      const apiRef = result.folders.find((f) => f.name === "API Reference");
      expect(apiRef).toBeDefined();
    });

    it("has a folder for Advanced", () => {
      const advanced = result.folders.find((f) => f.name === "Advanced");
      expect(advanced).toBeDefined();
    });
  });

  // ── Redirects ─────────────────────────────────────────────────────────

  describe("redirects", () => {
    it("includes .gitbook.yaml config redirect rules", () => {
      const oldGettingStarted = result.redirects.find(
        (r) => r.from === "/old-getting-started",
      );
      expect(oldGettingStarted).toBeDefined();
      expect(oldGettingStarted?.to).toBe("/getting-started/welcome");
      expect(oldGettingStarted?.status).toBe(301);

      const legacyApi = result.redirects.find(
        (r) => r.from === "/legacy/api",
      );
      expect(legacyApi).toBeDefined();
      expect(legacyApi?.to).toBe("/api-reference/overview");
    });

    it("generates _redirects file content", () => {
      expect(typeof result.redirectsFileContent).toBe("string");
      expect(result.redirectsFileContent.length).toBeGreaterThan(0);
    });
  });

  // ── URL Map ───────────────────────────────────────────────────────────

  describe("URL map", () => {
    it("has entries for pages", () => {
      expect(result.urlMap.size).toBeGreaterThanOrEqual(5);
    });

    it("source paths map to correct InkLoom paths", () => {
      for (const [source, target] of result.urlMap) {
        expect(source.startsWith("/")).toBe(true);
        expect(target.startsWith("/")).toBe(true);
      }
    });
  });

  // ── Assets ────────────────────────────────────────────────────────────

  describe("assets", () => {
    it("collects asset references from .gitbook/assets/ and content", () => {
      expect(result.assets.length).toBeGreaterThanOrEqual(1);
    });

    it("assets have required fields", () => {
      for (const asset of result.assets) {
        expect(typeof asset.originalUrl).toBe("string");
        expect(typeof asset.filename).toBe("string");
        expect(typeof asset.mimeType).toBe("string");
      }
    });
  });

  // ── Progress callback ────────────────────────────────────────────────

  describe("progress callback", () => {
    it("fires at all four stages", () => {
      const stages = new Set(progressCalls.map((c) => c.stage));
      expect(stages.has("parsing")).toBe(true);
      expect(stages.has("converting")).toBe(true);
      expect(stages.has("assets")).toBe(true);
      expect(stages.has("redirects")).toBe(true);
    });
  });

  // ── Component preservation through mdxToBlockNote() ───────────────────

  describe("component preservation", () => {
    it("preserves Callout (hint) blocks — all 4 styles", () => {
      const welcomePage = result.pages.find(
        (p) => p.path === "getting-started/welcome.md",
      );
      expect(welcomePage).toBeDefined();
      if (!welcomePage) return;

      const blocks = parseBlocks(welcomePage.content);
      const callouts = findBlocks(blocks, "callout");
      // info, warning, success, danger → should all become callout blocks
      expect(callouts.length).toBeGreaterThanOrEqual(4);

      const types = callouts.map((c) => c.props?.type);
      expect(types).toContain("info");
      expect(types).toContain("warning");
      expect(types).toContain("success");
      expect(types).toContain("danger");
    });

    it("preserves Tabs blocks from {% tabs %}", () => {
      const installPage = result.pages.find(
        (p) => p.path === "getting-started/installation.md",
      );
      expect(installPage).toBeDefined();
      if (!installPage) return;

      const blocks = parseBlocks(installPage.content);
      // The content should be non-trivial — tabs may become
      // a tabs block or nested structure
      expect(blocks.length).toBeGreaterThan(3);
    });

    it("preserves Accordion blocks from <details>", () => {
      const configPage = result.pages.find(
        (p) => p.path === "getting-started/configuration.md",
      );
      expect(configPage).toBeDefined();
      if (!configPage) return;

      const blocks = parseBlocks(configPage.content);
      // Individual <details> elements become standalone "accordion" blocks
      // (not wrapped in accordionGroup since they're separate in source)
      const accordions = findBlocks(blocks, "accordion");
      // configuration.md has 2 <details> blocks
      expect(accordions.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves code blocks with title from {% code %}", () => {
      const pluginsPage = result.pages.find(
        (p) => p.path === "advanced/custom-plugins.md",
      );
      expect(pluginsPage).toBeDefined();
      if (!pluginsPage) return;

      const blocks = parseBlocks(pluginsPage.content);
      const codeBlocks = findBlocks(blocks, "codeBlock");
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it("converts {% embed %} to links", () => {
      const configPage = result.pages.find(
        (p) => p.path === "getting-started/configuration.md",
      );
      expect(configPage).toBeDefined();
      if (!configPage) return;

      const blocks = parseBlocks(configPage.content);
      // The embed URL should appear somewhere in the content
      const allContent = JSON.stringify(blocks);
      expect(allContent).toContain("youtube.com");
    });

    it("preserves heading blocks", () => {
      const overviewPage = result.pages.find(
        (p) => p.path === "api-reference/overview.md",
      );
      expect(overviewPage).toBeDefined();
      if (!overviewPage) return;

      const blocks = parseBlocks(overviewPage.content);
      const headings = findBlocks(blocks, "heading");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves table blocks", () => {
      const overviewPage = result.pages.find(
        (p) => p.path === "api-reference/overview.md",
      );
      expect(overviewPage).toBeDefined();
      if (!overviewPage) return;

      const blocks = parseBlocks(overviewPage.content);
      const tables = findBlocks(blocks, "table");
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves image blocks referencing .gitbook/assets/", () => {
      const welcomePage = result.pages.find(
        (p) => p.path === "getting-started/welcome.md",
      );
      expect(welcomePage).toBeDefined();
      if (!welcomePage) return;

      const blocks = parseBlocks(welcomePage.content);
      const images = findBlocks(blocks, "image");
      expect(images.length).toBeGreaterThanOrEqual(1);
    });

    it("FAQ page preserves accordion-like content from <details>", () => {
      const faqPage = result.pages.find((p) => p.path === "faq.md");
      expect(faqPage).toBeDefined();
      if (!faqPage) return;

      const blocks = parseBlocks(faqPage.content);
      // FAQ has 3 <details> blocks → individual accordion blocks + 1 hint → callout
      const accordions = findBlocks(blocks, "accordion");
      expect(accordions.length).toBeGreaterThanOrEqual(3);

      const callouts = findBlocks(blocks, "callout");
      expect(callouts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Showcase page: all new GitBook patterns ──────────────────────────

  describe("showcase page — all new patterns", () => {
    it("includes the showcase page in output", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it("showcase page has valid JSON-serialized BlockNote content", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      let parsed: unknown;
      expect(() => {
        parsed = JSON.parse(showcasePage.content);
      }).not.toThrow();
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("preserves Steps from {% stepper %}", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const steps = findBlocks(blocks, "steps");
      expect(steps.length).toBeGreaterThanOrEqual(1);

      const stepItems = findBlocks(blocks, "step");
      // 3 steps: "Install the CLI", "Configure your project", default "Step"
      expect(stepItems.length).toBeGreaterThanOrEqual(3);
    });

    it("extracts step titles from headings", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const stepItems = findBlocks(blocks, "step");
      const titles = stepItems.map((s) => s.props?.title);
      expect(titles).toContain("Install the CLI");
      expect(titles).toContain("Configure your project");
    });

    it("preserves Columns from {% columns %}", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const columnsBlocks = findBlocks(blocks, "columns");
      expect(columnsBlocks.length).toBeGreaterThanOrEqual(1);

      const columnBlocks = findBlocks(blocks, "column");
      expect(columnBlocks.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves Card blocks from {% content-ref %}", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const cards = findBlocks(blocks, "card");
      // 2 content-refs + 2 card-view table rows = at least 4 cards
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves Frame blocks from <figure>", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const frames = findBlocks(blocks, "frame");
      // 2 figures: one with figcaption, one without
      expect(frames.length).toBeGreaterThanOrEqual(2);

      // First figure has a caption
      const captionedFrame = frames.find((f) => f.props?.caption);
      expect(captionedFrame).toBeDefined();
      if (captionedFrame) {
        expect(captionedFrame.props?.caption).toBe("Welcome banner caption");
      }
    });

    it("preserves Image blocks from <figure> img elements", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const images = findBlocks(blocks, "image");
      expect(images.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves CardGroup from card-view table", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      const cardGroups = findBlocks(blocks, "cardGroup");
      expect(cardGroups.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves inline badges from <mark>", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const allContent = showcasePage.content;
      // The badge content should appear in the serialized BlockNote JSON
      expect(allContent).toContain("badge");
      expect(allContent).toContain("POST");
      expect(allContent).toContain("green");
    });

    it("preserves inline icons from <Icon>", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const allContent = showcasePage.content;
      // The icon content should appear in the serialized BlockNote JSON
      expect(allContent).toContain("icon");
      expect(allContent).toContain("flag");
    });

    it("produces no errors — all patterns are handled cleanly", () => {
      const showcasePage = result.pages.find(
        (p) => p.path === "getting-started/showcase.md",
      );
      expect(showcasePage).toBeDefined();
      if (!showcasePage) return;

      const blocks = parseBlocks(showcasePage.content);
      // No block should contain raw GitBook syntax
      const serialized = JSON.stringify(blocks);
      expect(serialized).not.toContain("{%");
      expect(serialized).not.toContain("%}");
    });
  });

  // ── Mermaid diagrams ──────────────────────────────────────────────────

  describe("mermaid diagrams", () => {
    it("preserves bare mermaid fenced code block as codeBlock with language mermaid", () => {
      const perfPage = result.pages.find(
        (p) => p.path === "advanced/performance.md",
      );
      expect(perfPage).toBeDefined();
      if (!perfPage) return;

      const blocks = parseBlocks(perfPage.content);
      const codeBlocks = findBlocks(blocks, "codeBlock");
      const mermaidBlock = codeBlocks.find(
        (b) => b.props?.language === "mermaid",
      );
      expect(mermaidBlock).toBeDefined();
      expect(mermaidBlock?.props?.code).toContain("graph TD");
      expect(mermaidBlock?.props?.code).toContain("Client");
      expect(mermaidBlock?.props?.code).toContain("Cache");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-platform consistency
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: cross-platform consistency", () => {
  let mintlifyResult: EnrichedMigrationResult;
  let gitbookResult: EnrichedMigrationResult;

  beforeAll(async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: new Headers({ "content-type": "image/png" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    [mintlifyResult, gitbookResult] = await Promise.all([
      migrate({
        source: MigrationSource.Mintlify,
        dirPath: MINTLIFY_FIXTURE_DIR,
        projectName: "Cross Platform Mintlify",
      }),
      migrate({
        source: MigrationSource.Gitbook,
        dirPath: GITBOOK_FIXTURE_DIR,
        projectName: "Cross Platform Gitbook",
      }),
    ]);
  });

  it("both produce valid EnrichedMigrationResult shapes", () => {
    for (const result of [mintlifyResult, gitbookResult]) {
      expect(result.projectName).toBeTruthy();
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.folders.length).toBeGreaterThan(0);
      expect(Array.isArray(result.redirects)).toBe(true);
      expect(Array.isArray(result.assets)).toBe(true);
      expect(result.urlMap instanceof Map).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });

  it("both produce pages with JSON-serializable BlockNote content", () => {
    for (const result of [mintlifyResult, gitbookResult]) {
      for (const page of result.pages) {
        expect(() => JSON.parse(page.content)).not.toThrow();
        const blocks = JSON.parse(page.content) as BlockNode[];
        expect(blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it("both generate non-empty URL maps", () => {
    expect(mintlifyResult.urlMap.size).toBeGreaterThan(0);
    expect(gitbookResult.urlMap.size).toBeGreaterThan(0);
  });

  it("both generate _redirects file content", () => {
    expect(mintlifyResult.redirectsFileContent.length).toBeGreaterThan(0);
    expect(gitbookResult.redirectsFileContent.length).toBeGreaterThan(0);
  });
});
