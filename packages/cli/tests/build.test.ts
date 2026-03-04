import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Mock transport (same pattern as convex-client.test.ts)
// ---------------------------------------------------------------------------

interface MockCall {
  type: "query" | "mutation";
  fnPath: string;
  args: Record<string, unknown>;
}

function createMockTransport() {
  const calls: MockCall[] = [];
  const results = new Map<string, unknown>();

  function setResult(fnPath: string, value: unknown) {
    results.set(fnPath, value);
  }

  function handler(type: "query" | "mutation") {
    return async function (_fnPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
      calls.push({ type, fnPath: _fnPath, args });
      const result = results.get(_fnPath);
      if (typeof result === "function") return (result as (a: unknown) => unknown)(args);
      return result ?? null;
    };
  }

  return { calls, results, setResult, queryHandler: handler("query"), mutationHandler: handler("mutation") };
}

async function createTestClient(transport: ReturnType<typeof createMockTransport>) {
  const { ConvexCliClient } = await import("../src/lib/convex-client.ts");
  const client = new ConvexCliClient({
    convexUrl: "https://test.convex.cloud",
    verbose: false,
  });

  (client as unknown as Record<string, unknown>)["query"] = async function <T>(
    fnPath: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    return transport.queryHandler(fnPath, args) as Promise<T>;
  };

  (client as unknown as Record<string, unknown>)["mutate"] = async function <T>(
    fnPath: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    return transport.mutationHandler(fnPath, args) as Promise<T>;
  };

  return client;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_PROJECT = {
  _id: "proj_build_001",
  _creationTime: 1700000000000,
  name: "Build Test Docs",
  slug: "build-test-docs",
  description: "A test project for the build command",
  workosOrgId: "local",
  defaultBranchId: "branch_build_001",
  isPublic: false,
  showBranding: true,
};

const MOCK_BRANCH = {
  _id: "branch_build_001",
  _creationTime: 1700000000000,
  projectId: "proj_build_001",
  name: "main",
  isDefault: true,
  isLocked: false,
};

const MOCK_PAGES = [
  {
    _id: "page_index",
    _creationTime: 1700000000000,
    branchId: "branch_build_001",
    title: "Welcome",
    slug: "welcome",
    path: "/welcome",
    position: 0,
    isPublished: true,
  },
  {
    _id: "page_gs",
    _creationTime: 1700000000001,
    branchId: "branch_build_001",
    title: "Getting Started",
    slug: "getting-started",
    path: "/getting-started",
    position: 1,
    isPublished: true,
    icon: "rocket",
  },
  {
    _id: "page_api",
    _creationTime: 1700000000002,
    branchId: "branch_build_001",
    folderId: "folder_ref",
    title: "API Reference",
    slug: "api-reference",
    path: "/reference/api-reference",
    position: 0,
    isPublished: true,
    description: "Complete API docs",
  },
];

const MOCK_CONTENTS: Record<string, { _id: string; pageId: string; content: string }> = {
  page_index: {
    _id: "content_index",
    pageId: "page_index",
    content: '[{"type":"paragraph","content":[{"type":"text","text":"Welcome to the docs."}]}]',
  },
  page_gs: {
    _id: "content_gs",
    pageId: "page_gs",
    content:
      '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"Installation"}]},{"type":"paragraph","content":[{"type":"text","text":"Run npm install to get started."}]}]',
  },
  page_api: {
    _id: "content_api",
    pageId: "page_api",
    content: '[{"type":"paragraph","content":[{"type":"text","text":"Use the API to manage resources."}]}]',
  },
};

const MOCK_FOLDERS = [
  {
    _id: "folder_ref",
    _creationTime: 1700000000000,
    branchId: "branch_build_001",
    name: "Reference",
    slug: "reference",
    path: "/reference",
    position: 2,
    icon: "book",
  },
];

function setupBuildMocks(transport: ReturnType<typeof createMockTransport>) {
  transport.setResult("projects.get", MOCK_PROJECT);
  transport.setResult("branches.get", MOCK_BRANCH);
  transport.setResult("pages.listByBranch", MOCK_PAGES);
  transport.setResult("folders.listByBranch", MOCK_FOLDERS);
  transport.results.set("pages.getContent", (args: unknown) => {
    const { pageId } = args as { pageId: string };
    return MOCK_CONTENTS[pageId] || null;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildSite", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-build-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("should generate a static site from project data", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_build_001",
      outDir,
      clean: true,
    });

    // Verify result
    assert.equal(result.pageCount, 3, "Should have 3 pages");
    assert.ok(result.fileCount > 0, "Should have written files");
    assert.equal(result.outDir, outDir, "Should report correct outDir");

    // Verify output directory exists
    assert.ok(existsSync(outDir), "Output directory should exist");
  });

  it("should generate MDX files for each page", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    // Check MDX files exist
    const welcomeMdx = join(outDir, "docs/welcome.mdx");
    const gsMdx = join(outDir, "docs/getting-started.mdx");
    const apiMdx = join(outDir, "docs/reference/api-reference.mdx");

    assert.ok(existsSync(welcomeMdx), "Welcome MDX should exist");
    assert.ok(existsSync(gsMdx), "Getting Started MDX should exist");
    assert.ok(existsSync(apiMdx), "API Reference MDX should exist");

    // Check MDX content has frontmatter
    const welcomeContent = readFileSync(welcomeMdx, "utf-8");
    assert.ok(welcomeContent.startsWith("---"), "MDX should start with frontmatter");
    assert.ok(welcomeContent.includes('title: "Welcome"'), "Should have title in frontmatter");
    assert.ok(welcomeContent.includes("Welcome to the docs"), "Should contain page content");
  });

  it("should generate navigation.json", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const navPath = join(outDir, "lib/navigation.json");
    assert.ok(existsSync(navPath), "navigation.json should exist");

    const nav = JSON.parse(readFileSync(navPath, "utf-8"));
    assert.ok(Array.isArray(nav), "Navigation should be an array");
    assert.ok(nav.length > 0, "Navigation should have items");

    // Check that Welcome page is in nav
    const welcomeItem = nav.find((item: { title: string }) => item.title === "Welcome");
    assert.ok(welcomeItem, "Should have Welcome in navigation");
    assert.equal(welcomeItem.href, "/welcome", "Welcome href should be /welcome");
  });

  it("should generate navigation with folders and nested pages", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const nav = JSON.parse(readFileSync(join(outDir, "lib/navigation.json"), "utf-8"));

    // Find the Reference folder in navigation
    const refFolder = nav.find((item: { title: string }) => item.title === "Reference");
    assert.ok(refFolder, "Should have Reference folder in navigation");
    assert.equal(refFolder.href, "/reference", "Reference href should be /reference");
    assert.ok(refFolder.icon === "book", "Reference should have book icon");
    assert.ok(Array.isArray(refFolder.children), "Reference should have children");
    assert.ok(refFolder.children.length > 0, "Reference should have child pages");

    // Check that API Reference is nested under Reference
    const apiItem = refFolder.children.find((c: { title: string }) => c.title === "API Reference");
    assert.ok(apiItem, "Should have API Reference under Reference");
    assert.equal(apiItem.href, "/reference/api-reference");
  });

  it("should generate search-index.json", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const searchPath = join(outDir, "search-index.json");
    assert.ok(existsSync(searchPath), "search-index.json should exist");

    const searchData = JSON.parse(readFileSync(searchPath, "utf-8"));
    assert.ok(searchData.documents, "Should have documents array");
    assert.equal(searchData.documents.length, 3, "Should have 3 search documents");

    // Check that headings are extracted
    const gsDoc = searchData.documents.find((d: { id: string }) => d.id === "/getting-started");
    assert.ok(gsDoc, "Should have Getting Started in search index");
    assert.ok(gsDoc.headings.includes("Installation"), "Should extract Installation heading");
  });

  it("should generate index.html with redirect", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const indexPath = join(outDir, "index.html");
    assert.ok(existsSync(indexPath), "index.html should exist");

    const html = readFileSync(indexPath, "utf-8");
    assert.ok(html.includes("<!DOCTYPE html>"), "Should be valid HTML");
    assert.ok(html.includes("Build Test Docs"), "Should have project name in title");
    assert.ok(html.includes("__INKLOOM_DATA__"), "Should embed site data");
    // Should redirect to first page
    assert.ok(html.includes('content="0;url=/welcome"'), "Should redirect to first page");
  });

  it("should generate individual page HTML files", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    // Check individual page HTML
    const gsHtmlPath = join(outDir, "getting-started/index.html");
    assert.ok(existsSync(gsHtmlPath), "Getting Started HTML should exist");

    const gsHtml = readFileSync(gsHtmlPath, "utf-8");
    assert.ok(gsHtml.includes("Getting Started - Build Test Docs"), "Should have page title");
    assert.ok(gsHtml.includes("__INKLOOM_DATA__"), "Should embed site data");
    assert.ok(gsHtml.includes("__PAGE_DATA__"), "Should embed page data");
  });

  it("should generate tabs.json (empty for no tabs)", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const tabsPath = join(outDir, "lib/tabs.json");
    assert.ok(existsSync(tabsPath), "tabs.json should exist");

    const tabs = JSON.parse(readFileSync(tabsPath, "utf-8"));
    assert.deepEqual(tabs, [], "Should be empty array when no tabs");
  });

  it("should use specified branch when --branch is given", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", MOCK_PAGES);
    transport.setResult("folders.listByBranch", MOCK_FOLDERS);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return MOCK_CONTENTS[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, {
      projectId: "proj_build_001",
      branchId: "branch_feature_001",
      outDir,
      clean: true,
    });

    // Check that the correct branch was queried
    const branchCalls = transport.calls.filter((c) => c.fnPath === "pages.listByBranch");
    assert.equal(branchCalls.length, 1);
    assert.deepEqual(branchCalls[0].args, { branchId: "branch_feature_001" });
  });

  it("should throw when project not found", async () => {
    transport.setResult("projects.get", null);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await assert.rejects(
      () => buildSite(client, { projectId: "proj_nonexistent", outDir }),
      /Project not found/
    );
  });

  it("should throw when no default branch and no --branch specified", async () => {
    transport.setResult("projects.get", { ...MOCK_PROJECT, defaultBranchId: undefined });
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await assert.rejects(
      () => buildSite(client, { projectId: "proj_build_001", outDir }),
      /no default branch/
    );
  });

  it("should clean output directory when clean option is true", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");

    // Build twice with clean — second build should replace first
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });
    const firstFiles = walkDir(outDir);

    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });
    const secondFiles = walkDir(outDir);

    // File count should be the same (clean removed old files)
    assert.equal(firstFiles.length, secondFiles.length, "Clean build should have same file count");
  });

  it("should handle pages with no content gracefully", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", [MOCK_PAGES[0]]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", null); // No content

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_build_001",
      outDir,
      clean: true,
    });

    // Page with no content should be skipped
    assert.equal(result.pageCount, 0, "Pages with no content should be skipped");
  });

  it("should handle empty project (no pages or folders)", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", []);

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_build_001",
      outDir,
      clean: true,
    });

    assert.equal(result.pageCount, 0, "Should have 0 pages");
    // Should still generate navigation.json etc.
    assert.ok(existsSync(join(outDir, "lib/navigation.json")), "Should still have navigation.json");
    assert.ok(existsSync(join(outDir, "index.html")), "Should still have index.html");
  });

  it("should use default output dir 'dist' when not specified", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    // Build with explicit outDir to control where files go
    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_build_001",
      outDir,
    });

    assert.equal(result.outDir, outDir);
  });

  it("should generate correct page positions in navigation order", async () => {
    // Pages with specific positions to verify ordering
    const orderedPages = [
      { ...MOCK_PAGES[0], position: 2, title: "Third" },
      { ...MOCK_PAGES[1], _id: "page_first", position: 0, title: "First", path: "/first", slug: "first" },
      { ...MOCK_PAGES[2], _id: "page_second", position: 1, title: "Second", path: "/second", slug: "second", folderId: undefined },
    ];

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", orderedPages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      return {
        _id: "content_test",
        pageId: (args as { pageId: string }).pageId,
        content: '[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]',
      };
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const nav = JSON.parse(readFileSync(join(outDir, "lib/navigation.json"), "utf-8"));
    assert.equal(nav[0].title, "First", "First nav item should be First");
    assert.equal(nav[1].title, "Second", "Second nav item should be Second");
    assert.equal(nav[2].title, "Third", "Third nav item should be Third (Welcome at position 2)");
  });

  it("should convert BlockNote JSON to MDX correctly", async () => {
    const pageWithHeading = {
      _id: "page_heading",
      _creationTime: 1700000000000,
      branchId: "branch_build_001",
      title: "With Heading",
      slug: "with-heading",
      path: "/with-heading",
      position: 0,
    };

    const headingContent = {
      _id: "content_heading",
      pageId: "page_heading",
      content: JSON.stringify([
        { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "My Heading" }] },
        { type: "paragraph", content: [{ type: "text", text: "Some paragraph text." }] },
      ]),
    };

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", [pageWithHeading]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", headingContent);

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const mdxContent = readFileSync(join(outDir, "docs/with-heading.mdx"), "utf-8");
    assert.ok(mdxContent.includes("## My Heading"), "Should convert heading to markdown");
    assert.ok(mdxContent.includes("Some paragraph text"), "Should include paragraph text");
  });

  it("should handle raw MDX content (not BlockNote JSON)", async () => {
    const rawMdxPage = {
      _id: "page_raw",
      _creationTime: 1700000000000,
      branchId: "branch_build_001",
      title: "Raw MDX",
      slug: "raw-mdx",
      path: "/raw-mdx",
      position: 0,
    };

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("pages.listByBranch", [rawMdxPage]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", {
      _id: "content_raw",
      pageId: "page_raw",
      content: "---\ntitle: Raw MDX\n---\n\n# Already MDX\n\nThis is raw MDX content.",
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const mdxContent = readFileSync(join(outDir, "docs/raw-mdx.mdx"), "utf-8");
    assert.ok(mdxContent.includes("# Already MDX"), "Should preserve raw MDX content");
  });

  it("should generate all-navigation.json", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const allNavPath = join(outDir, "lib/all-navigation.json");
    assert.ok(existsSync(allNavPath), "all-navigation.json should exist");

    const allNav = JSON.parse(readFileSync(allNavPath, "utf-8"));
    assert.ok(allNav.main, "Should have main navigation");
    assert.ok(allNav.tabs, "Should have tabs object");
    assert.ok(Array.isArray(allNav.main), "main should be an array");
  });

  it("should include page icons in navigation", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const nav = JSON.parse(readFileSync(join(outDir, "lib/navigation.json"), "utf-8"));
    const gsItem = nav.find((item: { title: string }) => item.title === "Getting Started");
    assert.ok(gsItem, "Should have Getting Started in navigation");
    assert.equal(gsItem.icon, "rocket", "Should preserve page icon");
  });

  it("should embed page description in search index", async () => {
    setupBuildMocks(transport);
    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");

    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_build_001", outDir, clean: true });

    const searchData = JSON.parse(readFileSync(join(outDir, "search-index.json"), "utf-8"));
    const apiDoc = searchData.documents.find(
      (d: { id: string }) => d.id === "/reference/api-reference"
    );
    assert.ok(apiDoc, "Should have API Reference in search index");
    assert.equal(apiDoc.excerpt, "Complete API docs", "Should include description as excerpt");
  });
});

describe("build command CLI wiring", () => {
  it("should show build command in help output", async () => {
    const { spawn } = await import("node:child_process");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(__dirname, "../dist/cli.js");

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        const child = spawn("node", [cliPath, "--help"], {
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
        child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        child.on("close", (code: number | null) =>
          resolve({ stdout, stderr, exitCode: code ?? 1 })
        );
      }
    );

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("build"), "Should show build command in help");
  });

  it("should show build help with all options", async () => {
    const { spawn } = await import("node:child_process");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(__dirname, "../dist/cli.js");

    const result = await new Promise<{ stdout: string; exitCode: number }>((resolve) => {
      const child = spawn("node", [cliPath, "build", "--help"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      child.on("close", (code: number | null) =>
        resolve({ stdout, exitCode: code ?? 1 })
      );
    });

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(result.stdout.includes("--output"), "Should show --output option");
    assert.ok(result.stdout.includes("--branch"), "Should show --branch option");
    assert.ok(result.stdout.includes("--clean"), "Should show --clean option");
    assert.ok(result.stdout.includes("--convex-url"), "Should show --convex-url option");
  });

  it("should require projectId argument", async () => {
    const { spawn } = await import("node:child_process");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(__dirname, "../dist/cli.js");

    const result = await new Promise<{ stderr: string; exitCode: number }>((resolve) => {
      const child = spawn("node", [cliPath, "build"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("close", (code: number | null) =>
        resolve({ stderr, exitCode: code ?? 1 })
      );
    });

    assert.ok(result.exitCode !== 0, "Should fail without projectId");
    assert.ok(
      result.stderr.includes("projectId") || result.stderr.includes("missing"),
      "Should mention missing projectId"
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
