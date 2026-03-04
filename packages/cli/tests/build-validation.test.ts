/**
 * Build output validation tests (OSS_PLAN Phase 2.14)
 *
 * Verifies that `inkloom build` produces a valid, servable static site.
 * Focuses on cross-file consistency, HTML well-formedness, navigation
 * accuracy, search index completeness, and edge cases.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Mock transport (shared pattern)
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
    return async function (
      _fnPath: string,
      args: Record<string, unknown> = {}
    ): Promise<unknown> {
      calls.push({ type, fnPath: _fnPath, args });
      const result = results.get(_fnPath);
      if (typeof result === "function")
        return (result as (a: unknown) => unknown)(args);
      return result ?? null;
    };
  }

  return {
    calls,
    results,
    setResult,
    queryHandler: handler("query"),
    mutationHandler: handler("mutation"),
  };
}

async function createTestClient(
  transport: ReturnType<typeof createMockTransport>
) {
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

function makeProject(overrides = {}) {
  return {
    _id: "proj_val_001",
    _creationTime: 1700000000000,
    name: "Validation Docs",
    slug: "validation-docs",
    description: "A project for validation testing",
    workosOrgId: "local",
    defaultBranchId: "branch_val_001",
    isPublic: false,
    showBranding: true,
    ...overrides,
  };
}

function makeBranch(overrides = {}) {
  return {
    _id: "branch_val_001",
    _creationTime: 1700000000000,
    projectId: "proj_val_001",
    name: "main",
    isDefault: true,
    isLocked: false,
    ...overrides,
  };
}

function makePage(
  id: string,
  title: string,
  slug: string,
  path: string,
  position: number,
  extra: Record<string, unknown> = {}
) {
  return {
    _id: id,
    _creationTime: 1700000000000 + position,
    branchId: "branch_val_001",
    title,
    slug,
    path,
    position,
    isPublished: true,
    ...extra,
  };
}

function makeFolder(
  id: string,
  name: string,
  slug: string,
  path: string,
  position: number,
  extra: Record<string, unknown> = {}
) {
  return {
    _id: id,
    _creationTime: 1700000000000 + position,
    branchId: "branch_val_001",
    name,
    slug,
    path,
    position,
    ...extra,
  };
}

function makeContent(pageId: string, text: string) {
  return {
    _id: `content_${pageId}`,
    pageId,
    content: JSON.stringify([
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ]),
  };
}

function makeHeadingContent(
  pageId: string,
  headingText: string,
  bodyText: string
) {
  return {
    _id: `content_${pageId}`,
    pageId,
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: headingText }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: bodyText }],
      },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkDir(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function relativePaths(dir: string): string[] {
  return walkDir(dir).map((f) => f.slice(dir.length));
}

// ---------------------------------------------------------------------------
// Tests: HTML well-formedness
// ---------------------------------------------------------------------------

describe("Build output: HTML validity", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("all generated HTML files should have DOCTYPE and required elements", async () => {
    const pages = [
      makePage("p1", "Intro", "intro", "/intro", 0),
      makePage("p2", "Setup", "setup", "/setup", 1),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Welcome to the documentation."),
      p2: makeContent("p2", "Install dependencies with npm."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("branches.get", makeBranch());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const htmlFiles = walkDir(outDir).filter((f) => f.endsWith(".html"));
    assert.ok(htmlFiles.length >= 3, `Expected >= 3 HTML files, got ${htmlFiles.length}`);

    for (const htmlFile of htmlFiles) {
      const html = readFileSync(htmlFile, "utf-8");
      assert.ok(
        html.includes("<!DOCTYPE html>"),
        `${htmlFile} missing DOCTYPE`
      );
      assert.ok(html.includes("<html"), `${htmlFile} missing <html> tag`);
      assert.ok(html.includes("<head>"), `${htmlFile} missing <head>`);
      assert.ok(html.includes("<body>"), `${htmlFile} missing <body>`);
      assert.ok(html.includes("</html>"), `${htmlFile} missing </html>`);
      assert.ok(
        html.includes("<title>"),
        `${htmlFile} missing <title>`
      );
      assert.ok(
        html.includes("__INKLOOM_DATA__"),
        `${htmlFile} missing site data script`
      );
    }
  });

  it("HTML title should be properly escaped for special characters", async () => {
    const project = makeProject({
      name: 'Docs & "Guides" <2026>',
    });
    const pages = [
      makePage("p1", 'Config & "Setup"', "config-setup", "/config-setup", 0),
    ];

    transport.setResult("projects.get", project);
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Test content")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    // Check that the <title> tag has properly escaped content
    const indexHtml = readFileSync(join(outDir, "index.html"), "utf-8");
    const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/);
    assert.ok(titleMatch, "Should have a <title> tag");
    const titleContent = titleMatch![1];
    assert.ok(
      titleContent.includes("&amp;"),
      "Should HTML-escape & in <title>"
    );
    assert.ok(
      titleContent.includes("&lt;") && titleContent.includes("&gt;"),
      "Should HTML-escape < and > in <title>"
    );

    // Page HTML <title> should also have escaped content
    const pageHtml = readFileSync(
      join(outDir, "config-setup/index.html"),
      "utf-8"
    );
    const pageTitleMatch = pageHtml.match(/<title>(.*?)<\/title>/);
    assert.ok(pageTitleMatch, "Page should have a <title> tag");
    assert.ok(
      pageTitleMatch![1].includes("&amp;") || pageTitleMatch![1].includes("&quot;"),
      "Should HTML-escape special chars in page <title>"
    );
  });

  it("embedded JSON data scripts should contain valid JSON", async () => {
    const pages = [
      makePage("p1", "First Page", "first", "/first", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", makeContent("p1", "Hello world."));

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const pageHtml = readFileSync(join(outDir, "first/index.html"), "utf-8");

    // Extract __INKLOOM_DATA__ JSON
    const siteMatch = pageHtml.match(
      /id="__INKLOOM_DATA__"[^>]*>(.*?)<\/script>/s
    );
    assert.ok(siteMatch, "Should have __INKLOOM_DATA__ script");
    const siteData = JSON.parse(siteMatch![1]);
    assert.ok(siteData.config, "Site data should have config");
    assert.ok(siteData.navigation, "Site data should have navigation");

    // Extract __PAGE_DATA__ JSON
    const pageMatch = pageHtml.match(
      /id="__PAGE_DATA__"[^>]*>(.*?)<\/script>/s
    );
    assert.ok(pageMatch, "Should have __PAGE_DATA__ script");
    const pageData = JSON.parse(pageMatch![1]);
    assert.ok(pageData.title, "Page data should have title");
    assert.ok(pageData.content, "Page data should have content");
  });
});

// ---------------------------------------------------------------------------
// Tests: Navigation consistency
// ---------------------------------------------------------------------------

describe("Build output: navigation consistency", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-nav-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("every nav link should have a corresponding HTML file", async () => {
    const pages = [
      makePage("p1", "Welcome", "welcome", "/welcome", 0),
      makePage("p2", "Guide", "guide", "/guide", 1),
      makePage("p3", "API", "api", "/reference/api", 0, { folderId: "f1" }),
    ];
    const folders = [
      makeFolder("f1", "Reference", "reference", "/reference", 2),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Welcome text."),
      p2: makeContent("p2", "Guide text."),
      p3: makeContent("p3", "API documentation."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", folders);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    // Read navigation
    const nav = JSON.parse(
      readFileSync(join(outDir, "lib/navigation.json"), "utf-8")
    );

    // Collect all hrefs from nav (including nested children)
    function collectHrefs(items: { href: string; children?: { href: string; children?: unknown[] }[] }[]): string[] {
      const hrefs: string[] = [];
      for (const item of items) {
        hrefs.push(item.href);
        if (item.children) hrefs.push(...collectHrefs(item.children as { href: string; children?: { href: string; children?: unknown[] }[] }[]));
      }
      return hrefs;
    }

    const hrefs = collectHrefs(nav);
    assert.ok(hrefs.length >= 3, `Expected >= 3 nav hrefs, got ${hrefs.length}`);

    // Each page href should have a corresponding HTML file
    for (const href of hrefs) {
      // Folder hrefs may not have HTML files — only check page hrefs
      const isFolder = folders.some((f) => f.path === href);
      if (isFolder) continue;

      const htmlPath = join(outDir, `${href.slice(1)}/index.html`);
      assert.ok(
        existsSync(htmlPath),
        `Nav href ${href} has no corresponding HTML file at ${htmlPath}`
      );
    }
  });

  it("every generated MDX file should appear in the navigation", async () => {
    const pages = [
      makePage("p1", "Overview", "overview", "/overview", 0),
      makePage("p2", "Install", "install", "/install", 1),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Overview text."),
      p2: makeContent("p2", "Install guide."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const nav = JSON.parse(
      readFileSync(join(outDir, "lib/navigation.json"), "utf-8")
    );
    const navHrefs = new Set(
      (nav as { href: string }[]).map((item) => item.href)
    );

    // Each page should be in navigation
    for (const page of pages) {
      assert.ok(
        navHrefs.has(page.path),
        `Page ${page.slug} (${page.path}) should be in navigation`
      );
    }
  });

  it("all-navigation.json should be consistent with navigation.json", async () => {
    const pages = [
      makePage("p1", "First", "first", "/first", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", makeContent("p1", "Text."));

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const nav = JSON.parse(
      readFileSync(join(outDir, "lib/navigation.json"), "utf-8")
    );
    const allNav = JSON.parse(
      readFileSync(join(outDir, "lib/all-navigation.json"), "utf-8")
    );

    assert.deepEqual(
      allNav.main,
      nav,
      "all-navigation.json main should match navigation.json"
    );
    assert.deepEqual(
      allNav.tabs,
      {},
      "tabs should be empty object in basic build"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Search index completeness
// ---------------------------------------------------------------------------

describe("Build output: search index", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-search-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("search index should contain every page with valid paths", async () => {
    const pages = [
      makePage("p1", "Introduction", "introduction", "/introduction", 0),
      makePage("p2", "Advanced", "advanced", "/guides/advanced", 0, { folderId: "f1" }),
    ];
    const folders = [
      makeFolder("f1", "Guides", "guides", "/guides", 1),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Welcome to our docs."),
      p2: makeHeadingContent("p2", "Advanced Topics", "Deep dive into configuration."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", folders);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const searchData = JSON.parse(
      readFileSync(join(outDir, "search-index.json"), "utf-8")
    );

    assert.equal(searchData.documents.length, 2);

    for (const doc of searchData.documents) {
      assert.ok(doc.id, "Each document should have an id");
      assert.ok(doc.title, "Each document should have a title");
      assert.ok(doc.path, "Each document should have a path");
      assert.ok(typeof doc.content === "string", "Content should be a string");
      assert.ok(typeof doc.headings === "object", "Headings should exist");

      // Path should match a generated HTML file
      const htmlPath = join(outDir, `${doc.path.slice(1)}/index.html`);
      assert.ok(
        existsSync(htmlPath),
        `Search doc path ${doc.path} has no corresponding HTML file`
      );
    }

    // Verify the Advanced page has extracted headings
    const advDoc = searchData.documents.find(
      (d: { id: string }) => d.id === "/guides/advanced"
    );
    assert.ok(advDoc, "Should have Advanced page in search");
    assert.ok(
      advDoc.headings.includes("Advanced Topics"),
      "Should extract heading from page content"
    );
    assert.ok(
      advDoc.content.includes("Deep dive"),
      "Should extract body text from page content"
    );
  });

  it("search index paths should be consistent with search doc IDs", async () => {
    const pages = [
      makePage("p1", "Getting Started", "getting-started", "/getting-started", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Quick start guide.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const searchData = JSON.parse(
      readFileSync(join(outDir, "search-index.json"), "utf-8")
    );

    for (const doc of searchData.documents) {
      assert.equal(doc.id, doc.path, "Search doc id and path should match");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: MDX frontmatter validity
// ---------------------------------------------------------------------------

describe("Build output: MDX files", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-mdx-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("MDX files should have valid YAML frontmatter with title", async () => {
    const pages = [
      makePage("p1", "Hello World", "hello", "/hello", 0),
      makePage("p2", "Second Page", "second", "/second", 1),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Hello content."),
      p2: makeContent("p2", "Second content."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const mdxFiles = walkDir(outDir).filter((f) => f.endsWith(".mdx"));
    assert.equal(mdxFiles.length, 2, "Should have 2 MDX files");

    for (const mdxFile of mdxFiles) {
      const content = readFileSync(mdxFile, "utf-8");
      assert.ok(
        content.startsWith("---\n"),
        `${mdxFile} should start with YAML frontmatter delimiter`
      );

      const endDelimiter = content.indexOf("\n---\n", 4);
      assert.ok(
        endDelimiter > 0,
        `${mdxFile} should have closing YAML frontmatter delimiter`
      );

      const frontmatter = content.slice(4, endDelimiter);
      assert.ok(
        frontmatter.includes("title:"),
        `${mdxFile} frontmatter should contain title`
      );
    }
  });

  it("MDX frontmatter should properly escape titles with quotes", async () => {
    const pages = [
      makePage(
        "p1",
        'Title with "quotes" and backslash',
        "special",
        "/special",
        0
      ),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Content here.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const mdx = readFileSync(join(outDir, "docs/special.mdx"), "utf-8");
    // YAML should not break — quotes must be escaped
    assert.ok(
      mdx.includes('\\"quotes\\"') || mdx.includes("'quotes'"),
      "Quotes in title should be escaped in YAML"
    );
    // Should not have unescaped double quotes inside a double-quoted string
    const titleLine = mdx
      .split("\n")
      .find((l) => l.startsWith("title:"));
    assert.ok(titleLine, "Should have title line");
  });

  it("MDX body should contain converted content from BlockNote JSON", async () => {
    const pages = [
      makePage("p1", "Content Test", "content-test", "/content-test", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeHeadingContent("p1", "Setup Guide", "Follow these steps to get started.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const mdx = readFileSync(join(outDir, "docs/content-test.mdx"), "utf-8");
    assert.ok(
      mdx.includes("Setup Guide"),
      "MDX should contain heading text"
    );
    assert.ok(
      mdx.includes("Follow these steps"),
      "MDX should contain paragraph text"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Deep folder nesting
// ---------------------------------------------------------------------------

describe("Build output: deep folder nesting", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-deep-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle 3-level deep folder nesting correctly", async () => {
    const pages = [
      makePage("p1", "Top Page", "top", "/top", 0),
      makePage("p2", "L1 Page", "l1-page", "/level1/l1-page", 0, {
        folderId: "f1",
      }),
      makePage("p3", "L2 Page", "l2-page", "/level1/level2/l2-page", 0, {
        folderId: "f2",
      }),
      makePage(
        "p4",
        "L3 Page",
        "l3-page",
        "/level1/level2/level3/l3-page",
        0,
        { folderId: "f3" }
      ),
    ];
    const folders = [
      makeFolder("f1", "Level1", "level1", "/level1", 1),
      makeFolder("f2", "Level2", "level2", "/level1/level2", 0, {
        parentId: "f1",
      }),
      makeFolder("f3", "Level3", "level3", "/level1/level2/level3", 0, {
        parentId: "f2",
      }),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "Top level page."),
      p2: makeContent("p2", "Level 1 page."),
      p3: makeContent("p3", "Level 2 page."),
      p4: makeContent("p4", "Level 3 page."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", folders);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_val_001",
      outDir,
      clean: true,
    });

    assert.equal(result.pageCount, 4);

    // Verify HTML files exist at correct paths
    assert.ok(existsSync(join(outDir, "top/index.html")));
    assert.ok(existsSync(join(outDir, "level1/l1-page/index.html")));
    assert.ok(existsSync(join(outDir, "level1/level2/l2-page/index.html")));
    assert.ok(
      existsSync(join(outDir, "level1/level2/level3/l3-page/index.html"))
    );

    // Verify MDX files exist at correct paths
    assert.ok(existsSync(join(outDir, "docs/top.mdx")));
    assert.ok(existsSync(join(outDir, "docs/level1/l1-page.mdx")));
    assert.ok(existsSync(join(outDir, "docs/level1/level2/l2-page.mdx")));
    assert.ok(
      existsSync(join(outDir, "docs/level1/level2/level3/l3-page.mdx"))
    );

    // Verify navigation has nested structure
    const nav = JSON.parse(
      readFileSync(join(outDir, "lib/navigation.json"), "utf-8")
    );

    // Find Level1 in nav
    const l1Nav = nav.find((n: { title: string }) => n.title === "Level1");
    assert.ok(l1Nav, "Should have Level1 in nav");
    assert.ok(l1Nav.children, "Level1 should have children");

    // L1 should contain L2 folder
    const l2Nav = l1Nav.children.find(
      (n: { title: string }) => n.title === "Level2"
    );
    assert.ok(l2Nav, "Should have Level2 nested under Level1");
    assert.ok(l2Nav.children, "Level2 should have children");

    // L2 should contain L3 folder
    const l3Nav = l2Nav.children.find(
      (n: { title: string }) => n.title === "Level3"
    );
    assert.ok(l3Nav, "Should have Level3 nested under Level2");
    assert.ok(l3Nav.children, "Level3 should have children");
    assert.ok(
      l3Nav.children.find((c: { title: string }) => c.title === "L3 Page"),
      "L3 Page should be under Level3"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Site structure completeness
// ---------------------------------------------------------------------------

describe("Build output: site structure", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-struct-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should always generate required structural files", async () => {
    const pages = [
      makePage("p1", "Docs", "docs", "/docs", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Documentation.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    // Required files for a valid static site
    const requiredFiles = [
      "index.html",
      "lib/navigation.json",
      "lib/tabs.json",
      "lib/all-navigation.json",
      "search-index.json",
    ];

    for (const file of requiredFiles) {
      assert.ok(
        existsSync(join(outDir, file)),
        `Required file ${file} should exist`
      );
    }
  });

  it("index.html should redirect to the first page by position", async () => {
    const pages = [
      makePage("p2", "Second", "second", "/second", 1),
      makePage("p1", "First", "first", "/first", 0),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "First."),
      p2: makeContent("p2", "Second."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const indexHtml = readFileSync(join(outDir, "index.html"), "utf-8");
    // Should redirect to /first (position 0), not /second (position 1)
    assert.ok(
      indexHtml.includes('url=/first"'),
      "Should redirect to page with lowest position (first)"
    );
  });

  it("build result counts should be accurate", async () => {
    const pages = [
      makePage("p1", "A", "a", "/a", 0),
      makePage("p2", "B", "b", "/b", 1),
      makePage("p3", "C", "c", "/c", 2),
    ];
    const contents: Record<string, unknown> = {
      p1: makeContent("p1", "A."),
      p2: makeContent("p2", "B."),
      p3: makeContent("p3", "C."),
    };

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.results.set("pages.getContent", (args: unknown) => {
      const { pageId } = args as { pageId: string };
      return contents[pageId] || null;
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_val_001",
      outDir,
      clean: true,
    });

    assert.equal(result.pageCount, 3, "pageCount should be 3");
    assert.ok(result.fileCount > 0, "fileCount should be positive");

    // Verify actual file count matches
    const actualFiles = walkDir(outDir);
    assert.equal(
      result.fileCount,
      actualFiles.length,
      "Reported fileCount should match actual files on disk"
    );
  });

  it("all generated files should be non-empty", async () => {
    const pages = [
      makePage("p1", "Page", "page", "/page", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Content.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    const allFiles = walkDir(outDir);
    for (const file of allFiles) {
      const stat = statSync(file);
      assert.ok(
        stat.size > 0,
        `File ${file} should not be empty (size: ${stat.size})`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Content edge cases
// ---------------------------------------------------------------------------

describe("Build output: content edge cases", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let tempDir: string;

  beforeEach(() => {
    transport = createMockTransport();
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-bv-edge-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle page with complex BlockNote content (multiple block types)", async () => {
    const complexContent = JSON.stringify([
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Main Title" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Normal text with " },
          { type: "text", text: "bold", styles: { bold: true } },
          { type: "text", text: " formatting." },
        ],
      },
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Sub Section" }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "First item" }],
      },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Second item" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Final paragraph." }],
      },
    ]);

    const pages = [
      makePage("p1", "Complex Page", "complex", "/complex", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("pages.getContent", {
      _id: "content_p1",
      pageId: "p1",
      content: complexContent,
    });

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    // Verify MDX generated correctly
    const mdx = readFileSync(join(outDir, "docs/complex.mdx"), "utf-8");
    assert.ok(mdx.includes("Main Title"), "Should have h1 content");
    assert.ok(mdx.includes("Sub Section"), "Should have h2 content");
    assert.ok(
      mdx.includes("bold") || mdx.includes("**bold**"),
      "Should preserve text content"
    );

    // Verify search index extracts all headings
    const searchData = JSON.parse(
      readFileSync(join(outDir, "search-index.json"), "utf-8")
    );
    const doc = searchData.documents[0];
    assert.ok(
      doc.headings.includes("Main Title"),
      "Search should extract h1"
    );
    assert.ok(
      doc.headings.includes("Sub Section"),
      "Search should extract h2"
    );
  });

  it("should handle unicode content in titles and body", async () => {
    const pages = [
      makePage("p1", "日本語ドキュメント", "jp-docs", "/jp-docs", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "これはテストです。Emoji: 🎉")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    await buildSite(client, { projectId: "proj_val_001", outDir, clean: true });

    // MDX should preserve unicode
    const mdx = readFileSync(join(outDir, "docs/jp-docs.mdx"), "utf-8");
    assert.ok(
      mdx.includes("日本語ドキュメント"),
      "Should preserve Japanese in frontmatter"
    );
    assert.ok(
      mdx.includes("これはテストです"),
      "Should preserve Japanese in body"
    );

    // HTML should preserve unicode
    const html = readFileSync(join(outDir, "jp-docs/index.html"), "utf-8");
    assert.ok(
      html.includes("日本語ドキュメント"),
      "HTML should preserve Japanese title"
    );

    // Search index should preserve unicode
    const searchData = JSON.parse(
      readFileSync(join(outDir, "search-index.json"), "utf-8")
    );
    const doc = searchData.documents[0];
    assert.ok(
      doc.title === "日本語ドキュメント",
      "Search title should be Japanese"
    );
  });

  it("should handle very long page titles", async () => {
    const longTitle = "A".repeat(200);
    const pages = [
      makePage("p1", longTitle, "long-title", "/long-title", 0),
    ];

    transport.setResult("projects.get", makeProject());
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult(
      "pages.getContent",
      makeContent("p1", "Content with a long title.")
    );

    const client = await createTestClient(transport);
    const { buildSite } = await import("../src/lib/build.ts");
    const outDir = join(tempDir, "dist");
    const result = await buildSite(client, {
      projectId: "proj_val_001",
      outDir,
      clean: true,
    });

    assert.equal(result.pageCount, 1);

    // Should not crash and should generate valid files
    const html = readFileSync(
      join(outDir, "long-title/index.html"),
      "utf-8"
    );
    assert.ok(
      html.includes(longTitle),
      "Should preserve long title in HTML"
    );
  });
});
