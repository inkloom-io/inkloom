/**
 * Export output validation tests (OSS_PLAN Phase 2.15)
 *
 * Verifies that `inkloom export` produces a valid inkloom-export.json file
 * that can be used for data portability and import into InkLoom Cloud.
 * Focuses on schema completeness, data integrity, content preservation,
 * and edge cases for the portable export format.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { ExportData } from "../src/lib/convex-client.ts";

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

const FULL_PROJECT = {
  _id: "proj_full",
  _creationTime: 1700000000000,
  name: "Full Project",
  slug: "full-project",
  description: "A complete project with all settings",
  workosOrgId: "local",
  defaultBranchId: "branch_main",
  isPublic: true,
  showBranding: true,
  primaryColor: "#3b82f6",
  theme: "default",
  seoTitle: "Full Project Docs",
  seoDescription: "Complete documentation",
  favicon: "https://example.com/favicon.ico",
  ogImage: "https://example.com/og.png",
  customCss: "body { font-size: 16px; }",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const BRANCHES = [
  {
    _id: "branch_main",
    _creationTime: 1700000000000,
    projectId: "proj_full",
    name: "main",
    isDefault: true,
    isLocked: false,
  },
  {
    _id: "branch_dev",
    _creationTime: 1700000001000,
    projectId: "proj_full",
    name: "development",
    isDefault: false,
    isLocked: false,
    sourceBranchId: "branch_main",
  },
];

const PAGES = [
  {
    _id: "page_intro",
    _creationTime: 1700000000000,
    branchId: "branch_main",
    folderId: undefined,
    title: "Introduction",
    slug: "introduction",
    path: "/introduction",
    position: 0,
    isPublished: true,
    icon: "book",
    description: "Getting started with the project",
  },
  {
    _id: "page_api",
    _creationTime: 1700000001000,
    branchId: "branch_main",
    folderId: "folder_ref",
    title: "API Reference",
    slug: "api-reference",
    path: "/reference/api-reference",
    position: 0,
    isPublished: true,
    icon: "code",
    description: "Complete API documentation",
  },
  {
    _id: "page_dev_intro",
    _creationTime: 1700000002000,
    branchId: "branch_dev",
    title: "Dev Introduction",
    slug: "dev-introduction",
    path: "/dev-introduction",
    position: 0,
    isPublished: false,
  },
];

const CONTENTS: Record<string, { _id: string; pageId: string; content: string }> = {
  page_intro: {
    _id: "content_intro",
    pageId: "page_intro",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Welcome" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is the introduction to " },
          { type: "text", text: "Full Project", styles: { bold: true } },
          { type: "text", text: "." },
        ],
      },
    ]),
  },
  page_api: {
    _id: "content_api",
    pageId: "page_api",
    content: JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Endpoints" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "GET /api/v1/projects — List all projects.",
          },
        ],
      },
    ]),
  },
  page_dev_intro: {
    _id: "content_dev",
    pageId: "page_dev_intro",
    content: JSON.stringify([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Development branch content." }],
      },
    ]),
  },
};

const FOLDERS = [
  {
    _id: "folder_ref",
    _creationTime: 1700000000000,
    branchId: "branch_main",
    name: "Reference",
    slug: "reference",
    path: "/reference",
    position: 1,
    icon: "folder",
  },
];

const ASSETS = [
  {
    _id: "asset_logo",
    _creationTime: 1700000000000,
    projectId: "proj_full",
    filename: "logo.png",
    mimeType: "image/png",
    size: 24576,
    storageId: "storage_123",
    url: "https://cdn.example.com/logo.png",
  },
  {
    _id: "asset_pdf",
    _creationTime: 1700000001000,
    projectId: "proj_full",
    filename: "guide.pdf",
    mimeType: "application/pdf",
    size: 1048576,
  },
];

const DEPLOYMENTS = [
  {
    _id: "deploy_001",
    _creationTime: 1700000000000,
    projectId: "proj_full",
    status: "success",
    target: "production",
    url: "https://full-project.inkloom.dev",
    createdAt: 1700000000000,
    completedAt: 1700000060000,
  },
  {
    _id: "deploy_002",
    _creationTime: 1700000100000,
    projectId: "proj_full",
    status: "error",
    target: "production",
    createdAt: 1700000100000,
    completedAt: 1700000110000,
    error: "Build failed: missing dependency",
  },
];

const MERGE_REQUESTS = [
  {
    _id: "mr_001",
    _creationTime: 1700000000000,
    projectId: "proj_full",
    sourceBranchId: "branch_dev",
    targetBranchId: "branch_main",
    title: "Merge dev into main",
    description: "Merging development changes",
    status: "open",
    createdBy: "user_local",
  },
];

function setupFullMocks(transport: ReturnType<typeof createMockTransport>) {
  transport.setResult("projects.get", FULL_PROJECT);
  transport.setResult("projects.list", [FULL_PROJECT]);
  transport.setResult("branches.list", BRANCHES);
  transport.setResult("assets.listByProject", ASSETS);
  transport.setResult("deployments.listByProject", DEPLOYMENTS);
  transport.setResult("mergeRequests.list", MERGE_REQUESTS);

  // Pages are fetched per branch
  let pageListCalls = 0;
  transport.results.set("pages.listByBranch", () => {
    pageListCalls++;
    // First call: main branch pages, second call: dev branch pages
    return pageListCalls === 1
      ? PAGES.filter((p) => p.branchId === "branch_main")
      : PAGES.filter((p) => p.branchId === "branch_dev");
  });

  let folderListCalls = 0;
  transport.results.set("folders.listByBranch", () => {
    folderListCalls++;
    return folderListCalls === 1 ? FOLDERS : [];
  });

  transport.results.set("pages.getContent", (args: unknown) => {
    const { pageId } = args as { pageId: string };
    return CONTENTS[pageId] || null;
  });
}

// ---------------------------------------------------------------------------
// Tests: Schema completeness for import compatibility
// ---------------------------------------------------------------------------

describe("Export schema completeness", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("exported data should have all top-level fields required by import", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // All required top-level fields for import compatibility
    const requiredFields: (keyof ExportData)[] = [
      "version",
      "exportedAt",
      "projects",
      "branches",
      "pages",
      "folders",
      "assets",
      "deployments",
      "mergeRequests",
    ];

    for (const field of requiredFields) {
      assert.ok(
        field in data,
        `Export should have required field: ${field}`
      );
    }

    // Types should be correct
    assert.equal(typeof data.version, "number");
    assert.equal(typeof data.exportedAt, "string");
    assert.ok(Array.isArray(data.projects));
    assert.ok(Array.isArray(data.branches));
    assert.ok(Array.isArray(data.pages));
    assert.ok(Array.isArray(data.folders));
    assert.ok(Array.isArray(data.assets));
    assert.ok(Array.isArray(data.deployments));
    assert.ok(Array.isArray(data.mergeRequests));
  });

  it("exported project should preserve all settings fields", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const proj = data.projects[0];
    assert.ok(proj, "Should have at least one project");

    // Core fields
    assert.equal(proj._id, "proj_full");
    assert.equal(proj.name, "Full Project");
    assert.equal(proj.slug, "full-project");
    assert.equal(proj.description, "A complete project with all settings");
    assert.equal(proj.workosOrgId, "local");
    assert.equal(proj.defaultBranchId, "branch_main");

    // Settings fields (important for import)
    assert.equal(proj.primaryColor, "#3b82f6");
    assert.equal(proj.theme, "default");
    assert.equal(proj.isPublic, true);
    assert.equal(proj.showBranding, true);
  });

  it("exported pages should include content inline", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // Find pages with content
    const pagesWithContent = data.pages.filter((p) => p.content);
    assert.ok(
      pagesWithContent.length > 0,
      "At least some pages should have inline content"
    );

    for (const page of pagesWithContent) {
      // Content should be valid JSON (BlockNote format)
      try {
        const blocks = JSON.parse(page.content!);
        assert.ok(
          Array.isArray(blocks),
          `Content for ${page.title} should be JSON array of blocks`
        );
      } catch {
        // Content might be raw MDX, which is also valid
        assert.ok(
          typeof page.content === "string",
          `Content for ${page.title} should be a string`
        );
      }
    }
  });

  it("exported branches should preserve parent branch references", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const devBranch = data.branches.find((b) => b.name === "development");
    assert.ok(devBranch, "Should have development branch");
    assert.equal(
      devBranch!.sourceBranchId,
      "branch_main",
      "Dev branch should reference source branch"
    );
  });

  it("exported pages should preserve all metadata fields", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const introPage = data.pages.find((p) => p.title === "Introduction");
    assert.ok(introPage, "Should have Introduction page");

    // All metadata fields should be preserved
    assert.equal(introPage!.slug, "introduction");
    assert.equal(introPage!.path, "/introduction");
    assert.equal(introPage!.position, 0);
    assert.equal(introPage!.isPublished, true);
    assert.equal(introPage!.icon, "book");
    assert.equal(introPage!.description, "Getting started with the project");
    assert.equal(introPage!.branchId, "branch_main");
  });

  it("exported folders should preserve hierarchy and metadata", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.ok(data.folders.length > 0, "Should have folders");
    const refFolder = data.folders.find((f) => f.name === "Reference");
    assert.ok(refFolder, "Should have Reference folder");
    assert.equal(refFolder!.slug, "reference");
    assert.equal(refFolder!.path, "/reference");
    assert.equal(refFolder!.icon, "folder");
  });
});

// ---------------------------------------------------------------------------
// Tests: Content preservation through round-trip
// ---------------------------------------------------------------------------

describe("Export content preservation", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("BlockNote JSON content should survive JSON serialization round-trip", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // Serialize and deserialize (simulates write-to-file then read-from-file)
    const json = JSON.stringify(data);
    const restored = JSON.parse(json) as ExportData;

    // Find page with content
    const introPage = restored.pages.find((p) => p.title === "Introduction");
    assert.ok(introPage?.content, "Intro page should have content after round-trip");

    const blocks = JSON.parse(introPage!.content!);
    assert.ok(Array.isArray(blocks), "Content should be array of blocks");
    assert.equal(blocks.length, 2, "Should have 2 blocks (heading + paragraph)");

    // Verify block structure preserved
    assert.equal(blocks[0].type, "heading");
    assert.equal(blocks[0].props.level, 1);
    assert.equal(blocks[0].content[0].text, "Welcome");

    // Verify inline formatting preserved
    assert.equal(blocks[1].type, "paragraph");
    const boldText = blocks[1].content.find(
      (c: { text: string; styles?: { bold?: boolean } }) =>
        c.styles?.bold === true
    );
    assert.ok(boldText, "Bold formatting should be preserved");
    assert.equal(boldText.text, "Full Project");
  });

  it("multi-branch export should include pages from all branches", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // Should have pages from both branches
    const mainPages = data.pages.filter((p) => p.branchId === "branch_main");
    const devPages = data.pages.filter((p) => p.branchId === "branch_dev");

    assert.ok(mainPages.length >= 1, "Should have main branch pages");
    assert.ok(devPages.length >= 1, "Should have dev branch pages");
  });

  it("exported data should contain deployment history", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.equal(data.deployments.length, 2);
    const successDeploy = data.deployments.find((d) => d.status === "success");
    const errorDeploy = data.deployments.find((d) => d.status === "error");

    assert.ok(successDeploy, "Should have successful deployment");
    assert.ok(errorDeploy, "Should have error deployment");
    assert.ok(successDeploy!.url, "Successful deploy should have URL");
  });

  it("exported data should contain merge request info", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.equal(data.mergeRequests.length, 1);
    const mr = data.mergeRequests[0];
    assert.equal(mr.title, "Merge dev into main");
    assert.equal(mr.status, "open");
    assert.equal(mr.sourceBranchId, "branch_dev");
    assert.equal(mr.targetBranchId, "branch_main");
  });

  it("exported assets should preserve metadata", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.equal(data.assets.length, 2);

    const logo = data.assets.find((a) => a.filename === "logo.png");
    assert.ok(logo, "Should have logo asset");
    assert.equal(logo!.mimeType, "image/png");
    assert.equal(logo!.size, 24576);

    const pdf = data.assets.find((a) => a.filename === "guide.pdf");
    assert.ok(pdf, "Should have PDF asset");
    assert.equal(pdf!.mimeType, "application/pdf");
  });
});

// ---------------------------------------------------------------------------
// Tests: Data integrity across collections
// ---------------------------------------------------------------------------

describe("Export data cross-referential integrity", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("every page branchId should reference an exported branch", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const branchIds = new Set(data.branches.map((b) => b._id));
    for (const page of data.pages) {
      assert.ok(
        branchIds.has(page.branchId),
        `Page "${page.title}" references branch ${page.branchId} which is not in export`
      );
    }
  });

  it("every folder branchId should reference an exported branch", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const branchIds = new Set(data.branches.map((b) => b._id));
    for (const folder of data.folders) {
      assert.ok(
        branchIds.has(folder.branchId),
        `Folder "${folder.name}" references branch ${folder.branchId} which is not in export`
      );
    }
  });

  it("every page with folderId should reference an exported folder", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const folderIds = new Set(data.folders.map((f) => f._id));
    for (const page of data.pages) {
      if (page.folderId) {
        assert.ok(
          folderIds.has(page.folderId),
          `Page "${page.title}" references folder ${page.folderId} which is not in export`
        );
      }
    }
  });

  it("every branch projectId should reference an exported project", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const projectIds = new Set(data.projects.map((p) => p._id));
    for (const branch of data.branches) {
      assert.ok(
        projectIds.has(branch.projectId),
        `Branch "${branch.name}" references project ${branch.projectId} which is not in export`
      );
    }
  });

  it("project defaultBranchId should reference an exported branch", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const branchIds = new Set(data.branches.map((b) => b._id));
    for (const project of data.projects) {
      if (project.defaultBranchId) {
        assert.ok(
          branchIds.has(project.defaultBranchId),
          `Project "${project.name}" has defaultBranchId ${project.defaultBranchId} which is not in export`
        );
      }
    }
  });

  it("all IDs across all collections should be unique", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    const allIds = [
      ...data.projects.map((p) => p._id),
      ...data.branches.map((b) => b._id),
      ...data.pages.map((p) => p._id),
      ...data.folders.map((f) => f._id),
      ...data.assets.map((a) => a._id),
      ...data.deployments.map((d) => d._id),
      ...data.mergeRequests.map((m) => m._id),
    ];

    const uniqueIds = new Set(allIds);
    assert.equal(
      uniqueIds.size,
      allIds.length,
      `All IDs should be globally unique. Found ${allIds.length - uniqueIds.size} duplicates`
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge cases for portability
// ---------------------------------------------------------------------------

describe("Export portability edge cases", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("should handle project with no pages or folders", async () => {
    transport.setResult("projects.get", FULL_PROJECT);
    transport.setResult("branches.list", [BRANCHES[0]]);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.equal(data.version, 1);
    assert.equal(data.projects.length, 1);
    assert.equal(data.branches.length, 1);
    assert.equal(data.pages.length, 0);
    assert.equal(data.folders.length, 0);

    // Should still be valid JSON
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, 1);
  });

  it("should handle page with unicode content in export", async () => {
    const unicodePage = {
      ...PAGES[0],
      _id: "page_unicode",
      title: "Dokumentation 日本語 中文 한국어",
      slug: "unicode-docs",
    };
    const unicodeContent = {
      _id: "content_unicode",
      pageId: "page_unicode",
      content: JSON.stringify([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ünîcödé special chars: é à ü ö ñ ¿ ¡ 🎉 ™ © ®" },
          ],
        },
      ]),
    };

    transport.setResult("projects.get", FULL_PROJECT);
    transport.setResult("branches.list", [BRANCHES[0]]);
    transport.setResult("pages.listByBranch", [unicodePage]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", unicodeContent);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // Serialize and deserialize to simulate file I/O
    const json = JSON.stringify(data);
    const restored = JSON.parse(json) as ExportData;

    assert.equal(restored.pages[0].title, "Dokumentation 日本語 中文 한국어");
    const blocks = JSON.parse(restored.pages[0].content!);
    assert.ok(
      blocks[0].content[0].text.includes("🎉"),
      "Should preserve emoji in exported content"
    );
    assert.ok(
      blocks[0].content[0].text.includes("ñ"),
      "Should preserve accented characters"
    );
  });

  it("should handle page with very large content", async () => {
    const largeBlocks = Array.from({ length: 500 }, (_, i) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `Paragraph ${i}: ${"Lorem ipsum dolor sit amet. ".repeat(20)}`,
        },
      ],
    }));

    transport.setResult("projects.get", FULL_PROJECT);
    transport.setResult("branches.list", [BRANCHES[0]]);
    transport.setResult("pages.listByBranch", [
      { ...PAGES[0], _id: "page_large" },
    ]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", {
      _id: "content_large",
      pageId: "page_large",
      content: JSON.stringify(largeBlocks),
    });
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    // Should not crash and content should be preserved
    assert.ok(data.pages[0].content, "Should have content");
    const blocks = JSON.parse(data.pages[0].content!);
    assert.equal(blocks.length, 500, "Should preserve all 500 blocks");

    // Verify JSON round-trip works for large content
    const json = JSON.stringify(data);
    const restored = JSON.parse(json) as ExportData;
    const restoredBlocks = JSON.parse(restored.pages[0].content!);
    assert.equal(restoredBlocks.length, 500);
  });

  it("export version should be 1 (current schema version)", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    assert.equal(
      data.version,
      1,
      "Export version should be 1 (matches OSS_PLAN spec)"
    );
  });

  it("workosOrgId should be 'local' for core-mode exports", async () => {
    setupFullMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_full");

    for (const project of data.projects) {
      assert.equal(
        project.workosOrgId,
        "local",
        "Core-mode projects should have workosOrgId='local'"
      );
    }
  });
});
