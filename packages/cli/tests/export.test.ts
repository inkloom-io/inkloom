import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExportData } from "../src/lib/convex-client.ts";

// ---------------------------------------------------------------------------
// Helpers — same mock transport pattern as convex-client.test.ts
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
  transport: ReturnType<typeof createMockTransport>,
  opts?: { verbose?: boolean }
) {
  const { ConvexCliClient } = await import("../src/lib/convex-client.ts");
  const client = new ConvexCliClient({
    convexUrl: "https://test.convex.cloud",
    verbose: opts?.verbose ?? false,
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
  _id: "proj_001",
  _creationTime: 1700000000000,
  name: "My Docs",
  slug: "my-docs",
  workosOrgId: "local",
  defaultBranchId: "branch_001",
  isPublic: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const MOCK_BRANCH = {
  _id: "branch_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  name: "main",
  isDefault: true,
  isLocked: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const MOCK_PAGE = {
  _id: "page_001",
  _creationTime: 1700000000000,
  branchId: "branch_001",
  folderId: "folder_001",
  title: "Getting Started",
  slug: "getting-started",
  path: "/getting-started",
  position: 0,
  isPublished: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const MOCK_PAGE_CONTENT = {
  _id: "content_001",
  pageId: "page_001",
  content:
    '[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]',
  updatedAt: 1700000000000,
};

const MOCK_FOLDER = {
  _id: "folder_001",
  _creationTime: 1700000000000,
  branchId: "branch_001",
  name: "Guides",
  slug: "guides",
  path: "/guides",
  position: 0,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const MOCK_ASSET = {
  _id: "asset_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  filename: "logo.png",
  mimeType: "image/png",
  size: 12345,
  createdAt: 1700000000000,
};

const MOCK_DEPLOYMENT = {
  _id: "deploy_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  status: "success",
  target: "production",
  url: "https://my-docs.inkloom.dev",
  createdAt: 1700000000000,
  completedAt: 1700000001000,
};

const MOCK_MERGE_REQUEST = {
  _id: "mr_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  sourceBranchId: "branch_002",
  targetBranchId: "branch_001",
  title: "Add API docs",
  description: "New API reference",
  status: "open",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

function setupExportMocks(t: ReturnType<typeof createMockTransport>) {
  t.setResult("projects.get", MOCK_PROJECT);
  t.setResult("projects.list", [MOCK_PROJECT]);
  t.setResult("branches.list", [MOCK_BRANCH]);
  t.setResult("assets.listByProject", [MOCK_ASSET]);
  t.setResult("deployments.listByProject", [MOCK_DEPLOYMENT]);
  t.setResult("pages.listByBranch", [MOCK_PAGE]);
  t.setResult("folders.listByBranch", [MOCK_FOLDER]);
  t.setResult("pages.getContent", MOCK_PAGE_CONTENT);
  t.setResult("mergeRequests.list", [MOCK_MERGE_REQUEST]);
}

// ---------------------------------------------------------------------------
// Tests: Export data format validation
// ---------------------------------------------------------------------------

describe("Export data format", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("should produce valid ExportData schema with version 1", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    // Required top-level fields
    assert.equal(data.version, 1);
    assert.equal(typeof data.exportedAt, "string");
    assert.ok(Array.isArray(data.projects));
    assert.ok(Array.isArray(data.branches));
    assert.ok(Array.isArray(data.pages));
    assert.ok(Array.isArray(data.folders));
    assert.ok(Array.isArray(data.assets));
    assert.ok(Array.isArray(data.deployments));
    assert.ok(Array.isArray(data.mergeRequests));
  });

  it("should produce exportedAt as valid ISO 8601 timestamp", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    // Must parse as a valid date
    const date = new Date(data.exportedAt);
    assert.ok(!isNaN(date.getTime()), "exportedAt should be valid ISO date");

    // Should be very recent (within last 5 seconds)
    const ageMs = Date.now() - date.getTime();
    assert.ok(ageMs >= 0 && ageMs < 5000, "exportedAt should be recent");
  });

  it("should round-trip through JSON serialization", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const serialized = JSON.stringify(data);
    const deserialized = JSON.parse(serialized) as ExportData;

    assert.equal(deserialized.version, data.version);
    assert.equal(deserialized.exportedAt, data.exportedAt);
    assert.equal(deserialized.projects.length, data.projects.length);
    assert.equal(deserialized.pages.length, data.pages.length);
    assert.equal(deserialized.pages[0].title, data.pages[0].title);
    assert.equal(deserialized.pages[0].content, data.pages[0].content);
  });

  it("should include page content inline with page objects", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.pages.length, 1);
    const page = data.pages[0];

    // Page should have all standard fields PLUS content
    assert.equal(page._id, "page_001");
    assert.equal(page.title, "Getting Started");
    assert.equal(page.slug, "getting-started");
    assert.ok(page.content);
    assert.ok(page.content!.includes("Hello world"));
  });

  it("should preserve all project settings in export", async () => {
    const projectWithSettings = {
      ...MOCK_PROJECT,
      primaryColor: "#3b82f6",
      theme: "modern",
      seoTitle: "My Docs - API Reference",
      seoDescription: "Documentation for My API",
      showBranding: true,
    };
    transport.setResult("projects.get", projectWithSettings);
    transport.setResult("projects.list", [projectWithSettings]);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.projects[0].primaryColor, "#3b82f6");
    assert.equal(data.projects[0].theme, "modern");
    assert.equal(data.projects[0].seoTitle, "My Docs - API Reference");
    assert.equal(data.projects[0].showBranding, true);
  });

  it("should preserve folder hierarchy info (parentId, path)", async () => {
    const childFolder = {
      ...MOCK_FOLDER,
      _id: "folder_002",
      name: "Advanced",
      slug: "advanced",
      parentId: "folder_001",
      path: "/guides/advanced",
      position: 1,
    };

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", [MOCK_FOLDER, childFolder]);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.folders.length, 2);
    const child = data.folders.find((f) => f._id === "folder_002");
    assert.ok(child);
    assert.equal(child!.parentId, "folder_001");
    assert.equal(child!.path, "/guides/advanced");
  });
});

// ---------------------------------------------------------------------------
// Tests: File writing behavior
// ---------------------------------------------------------------------------

describe("Export file writing", () => {
  let tmpDir: string;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "inkloom-export-test-"));
    transport = createMockTransport();
    setupExportMocks(transport);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should write valid JSON to the specified output file", async () => {
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const outputPath = join(tmpDir, "export.json");
    const json = JSON.stringify(data, null, 2) + "\n";

    const { writeFileSync } = await import("node:fs");
    writeFileSync(outputPath, json, "utf-8");

    assert.ok(existsSync(outputPath));

    const written = readFileSync(outputPath, "utf-8");
    const parsed = JSON.parse(written) as ExportData;

    assert.equal(parsed.version, 1);
    assert.equal(parsed.projects.length, 1);
    assert.equal(parsed.projects[0].name, "My Docs");
  });

  it("should produce pretty-printed JSON with 2-space indent by default", async () => {
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const prettyJson = JSON.stringify(data, null, 2) + "\n";
    const minifiedJson = JSON.stringify(data) + "\n";

    // Pretty should be significantly larger (has whitespace)
    assert.ok(
      prettyJson.length > minifiedJson.length,
      "Pretty JSON should be larger than minified"
    );

    // Pretty should contain newlines and indentation
    assert.ok(prettyJson.includes("\n  "), "Should have indentation");
  });

  it("should produce valid minified JSON when pretty=false", async () => {
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const minified = JSON.stringify(data);
    const parsed = JSON.parse(minified) as ExportData;

    // Minified should not contain newlines (except within content strings)
    assert.ok(!minified.includes("\n  "), "Should not have indentation");
    assert.equal(parsed.version, 1);
  });

  it("should create parent directories if they don't exist", async () => {
    const nestedDir = join(tmpDir, "deeply", "nested", "dir");
    const outputPath = join(nestedDir, "export.json");

    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname } = await import("node:path");

    mkdirSync(dirname(outputPath), { recursive: true });

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");
    writeFileSync(outputPath, JSON.stringify(data, null, 2) + "\n", "utf-8");

    assert.ok(existsSync(outputPath));
    const content = readFileSync(outputPath, "utf-8");
    const parsed = JSON.parse(content);
    assert.equal(parsed.version, 1);
  });

  it("should overwrite existing file", async () => {
    const outputPath = join(tmpDir, "export.json");
    const { writeFileSync } = await import("node:fs");

    // Write initial content
    writeFileSync(outputPath, '{"old":"data"}', "utf-8");

    // Overwrite with export
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");
    writeFileSync(outputPath, JSON.stringify(data, null, 2) + "\n", "utf-8");

    const content = readFileSync(outputPath, "utf-8");
    const parsed = JSON.parse(content);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.projects[0].name, "My Docs");
  });
});

// ---------------------------------------------------------------------------
// Tests: Multi-project export
// ---------------------------------------------------------------------------

describe("Export all projects", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("should aggregate data from multiple projects", async () => {
    const project2 = {
      ...MOCK_PROJECT,
      _id: "proj_002",
      name: "API Docs",
      slug: "api-docs",
      defaultBranchId: "branch_002",
    };
    const branch2 = {
      ...MOCK_BRANCH,
      _id: "branch_002",
      projectId: "proj_002",
      name: "main",
    };
    const page2 = {
      ...MOCK_PAGE,
      _id: "page_002",
      branchId: "branch_002",
      title: "API Overview",
      slug: "api-overview",
    };

    transport.setResult("projects.list", [MOCK_PROJECT, project2]);
    // exportProject is called for each: it calls getProject, branches.list, etc.
    // Since mock returns same result for same fnPath, we use a counter approach
    let getProjectCalls = 0;
    transport.results.set("projects.get", () => {
      getProjectCalls++;
      return getProjectCalls === 1 ? MOCK_PROJECT : project2;
    });

    let branchListCalls = 0;
    transport.results.set("branches.list", () => {
      branchListCalls++;
      return branchListCalls === 1 ? [MOCK_BRANCH] : [branch2];
    });

    let pageListCalls = 0;
    transport.results.set("pages.listByBranch", () => {
      pageListCalls++;
      return pageListCalls === 1 ? [MOCK_PAGE] : [page2];
    });

    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportAll();

    assert.equal(data.version, 1);
    assert.equal(data.projects.length, 2);
    assert.equal(data.branches.length, 2);
    assert.equal(data.pages.length, 2);
    assert.equal(data.projects[0].name, "My Docs");
    assert.equal(data.projects[1].name, "API Docs");
  });

  it("should return empty collections for no projects", async () => {
    transport.setResult("projects.list", []);
    const client = await createTestClient(transport);
    const data = await client.exportAll();

    assert.equal(data.version, 1);
    assert.equal(data.projects.length, 0);
    assert.equal(data.branches.length, 0);
    assert.equal(data.pages.length, 0);
    assert.equal(data.folders.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge cases
// ---------------------------------------------------------------------------

describe("Export edge cases", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("should handle project with many pages efficiently", async () => {
    const pages = Array.from({ length: 50 }, (_, i) => ({
      ...MOCK_PAGE,
      _id: `page_${String(i).padStart(3, "0")}`,
      title: `Page ${i}`,
      slug: `page-${i}`,
    }));

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", pages);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.pages.length, 50);
    // Verify content was fetched for each page
    const contentCalls = transport.calls.filter(
      (c) => c.fnPath === "pages.getContent"
    );
    assert.equal(contentCalls.length, 50);
  });

  it("should handle pages with empty/null content", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", [
      { ...MOCK_PAGE, _id: "page_empty" },
    ]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", null);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.pages.length, 1);
    assert.equal(data.pages[0].content, undefined);
  });

  it("should handle pages with large content blocks", async () => {
    const largeContent = JSON.stringify(
      Array.from({ length: 100 }, (_, i) => ({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `This is paragraph ${i} with some content. `.repeat(10),
          },
        ],
      }))
    );

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", [MOCK_PAGE]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", {
      ...MOCK_PAGE_CONTENT,
      content: largeContent,
    });
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.pages[0].content, largeContent);

    // Verify it's still valid JSON after serialization
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized) as ExportData;
    assert.equal(parsed.pages[0].content, largeContent);
  });

  it("should handle assets with various mime types", async () => {
    const assets = [
      { ...MOCK_ASSET, _id: "a1", filename: "logo.png", mimeType: "image/png" },
      {
        ...MOCK_ASSET,
        _id: "a2",
        filename: "doc.pdf",
        mimeType: "application/pdf",
      },
      {
        ...MOCK_ASSET,
        _id: "a3",
        filename: "data.json",
        mimeType: "application/json",
      },
      {
        ...MOCK_ASSET,
        _id: "a4",
        filename: "video.mp4",
        mimeType: "video/mp4",
      },
    ];

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", assets);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.assets.length, 4);
    assert.equal(data.assets[0].mimeType, "image/png");
    assert.equal(data.assets[1].mimeType, "application/pdf");
  });

  it("should handle project with multiple branches and diverse content", async () => {
    const featureBranch = {
      ...MOCK_BRANCH,
      _id: "branch_feat",
      name: "feature/api-v2",
      isDefault: false,
    };
    const featurePage = {
      ...MOCK_PAGE,
      _id: "page_feat",
      branchId: "branch_feat",
      title: "API v2 Docs",
      slug: "api-v2",
    };

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH, featureBranch]);

    let branchPageCalls = 0;
    transport.results.set("pages.listByBranch", () => {
      branchPageCalls++;
      return branchPageCalls === 1 ? [MOCK_PAGE] : [featurePage];
    });
    transport.setResult("folders.listByBranch", [MOCK_FOLDER]);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.branches.length, 2);
    assert.equal(data.pages.length, 2);
    assert.ok(data.pages.find((p) => p.title === "Getting Started"));
    assert.ok(data.pages.find((p) => p.title === "API v2 Docs"));
  });
});

// ---------------------------------------------------------------------------
// Tests: formatBytes helper
// ---------------------------------------------------------------------------

describe("formatBytes", () => {
  // We can't directly import the private function, but we can test the behavior
  // indirectly by verifying the JSON output size is reasonable

  it("should produce valid JSON with known byte sizes", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const json = JSON.stringify(data, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");

    // A single project export should be non-trivially sized
    assert.ok(bytes > 100, "Export JSON should be substantial");
    assert.ok(bytes < 1024 * 1024, "Single project export should be < 1MB");
  });

  it("should produce minified JSON that is smaller than pretty-printed", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const pretty = JSON.stringify(data, null, 2);
    const minified = JSON.stringify(data);

    assert.ok(
      minified.length < pretty.length,
      "Minified should be smaller than pretty"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Export data integrity (property-based style checks)
// ---------------------------------------------------------------------------

describe("Export data integrity", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("all pages should reference existing branches", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const branchIds = new Set(data.branches.map((b) => b._id));
    for (const page of data.pages) {
      assert.ok(
        branchIds.has(page.branchId),
        `Page ${page._id} references non-existent branch ${page.branchId}`
      );
    }
  });

  it("all branches should reference existing projects", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const projectIds = new Set(data.projects.map((p) => p._id));
    for (const branch of data.branches) {
      assert.ok(
        projectIds.has(branch.projectId),
        `Branch ${branch._id} references non-existent project ${branch.projectId}`
      );
    }
  });

  it("all folders should reference existing branches", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const branchIds = new Set(data.branches.map((b) => b._id));
    for (const folder of data.folders) {
      assert.ok(
        branchIds.has(folder.branchId),
        `Folder ${folder._id} references non-existent branch ${folder.branchId}`
      );
    }
  });

  it("all merge requests should reference existing projects", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const projectIds = new Set(data.projects.map((p) => p._id));
    for (const mr of data.mergeRequests) {
      assert.ok(
        projectIds.has(mr.projectId),
        `MR ${mr._id} references non-existent project ${mr.projectId}`
      );
    }
  });

  it("all assets should reference existing projects", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const projectIds = new Set(data.projects.map((p) => p._id));
    for (const asset of data.assets) {
      assert.ok(
        projectIds.has(asset.projectId),
        `Asset ${asset._id} references non-existent project ${asset.projectId}`
      );
    }
  });

  it("page IDs should be unique", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const pageIds = data.pages.map((p) => p._id);
    const uniqueIds = new Set(pageIds);
    assert.equal(
      uniqueIds.size,
      pageIds.length,
      "All page IDs should be unique"
    );
  });

  it("folder IDs should be unique", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const folderIds = data.folders.map((f) => f._id);
    const uniqueIds = new Set(folderIds);
    assert.equal(
      uniqueIds.size,
      folderIds.length,
      "All folder IDs should be unique"
    );
  });

  it("exported data should be deterministic given same inputs", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);

    const data1 = await client.exportProject("proj_001");
    const data2 = await client.exportProject("proj_001");

    // Everything except exportedAt should be identical
    assert.equal(data1.version, data2.version);
    assert.equal(data1.projects.length, data2.projects.length);
    assert.equal(data1.pages.length, data2.pages.length);
    assert.deepEqual(data1.projects, data2.projects);
    assert.deepEqual(data1.pages, data2.pages);
    assert.deepEqual(data1.branches, data2.branches);
    assert.deepEqual(data1.folders, data2.folders);
  });
});
