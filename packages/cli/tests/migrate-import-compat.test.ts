/**
 * Tests for export → import compatibility.
 *
 * Verifies that the data produced by `inkloom export` (via ConvexCliClient)
 * passes the validation required by the import endpoint and `inkloom migrate`.
 * This ensures the two sides of the OSS→SaaS pipeline are in sync.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { validateExportData } from "../src/commands/migrate.ts";
import type { ExportData } from "../src/lib/convex-client.ts";

// ---------------------------------------------------------------------------
// Mock transport (reused from export.test.ts)
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
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PROJECT = {
  _id: "proj_001",
  _creationTime: 1700000000000,
  name: "My Docs",
  slug: "my-docs",
  workosOrgId: "local",
  defaultBranchId: "branch_001",
  primaryColor: "#3b82f6",
  theme: "modern",
  showBranding: true,
  seoTitle: "My Docs - API Reference",
};

const MOCK_BRANCH = {
  _id: "branch_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  name: "main",
  isDefault: true,
  isLocked: false,
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
};

const MOCK_PAGE_CONTENT = {
  _id: "content_001",
  pageId: "page_001",
  content:
    '[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]',
};

const MOCK_FOLDER = {
  _id: "folder_001",
  _creationTime: 1700000000000,
  branchId: "branch_001",
  name: "Guides",
  slug: "guides",
  path: "/guides",
  position: 0,
};

const MOCK_ASSET = {
  _id: "asset_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  filename: "logo.png",
  mimeType: "image/png",
  size: 12345,
};

const MOCK_DEPLOYMENT = {
  _id: "deploy_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  status: "success",
  target: "production",
  url: "https://my-docs.inkloom.dev",
};

const MOCK_MERGE_REQUEST = {
  _id: "mr_001",
  _creationTime: 1700000000000,
  projectId: "proj_001",
  sourceBranchId: "branch_002",
  targetBranchId: "branch_001",
  title: "Add API docs",
  status: "open",
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
// Tests: Export output passes import validation
// ---------------------------------------------------------------------------

describe("export → import pipeline compatibility", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("single project export should pass import validation", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const errors = validateExportData(data);
    assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`);
  });

  it("multi-project export should pass import validation", async () => {
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
    };
    const page2 = {
      ...MOCK_PAGE,
      _id: "page_002",
      branchId: "branch_002",
      title: "API Overview",
      slug: "api-overview",
    };

    transport.setResult("projects.list", [MOCK_PROJECT, project2]);
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
    transport.setResult("folders.listByBranch", [MOCK_FOLDER]);
    transport.setResult("assets.listByProject", [MOCK_ASSET]);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportAll();

    const errors = validateExportData(data);
    assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`);
    assert.equal(data.projects.length, 2);
  });

  it("export with empty content pages should pass validation", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("projects.list", [MOCK_PROJECT]);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", [MOCK_PAGE]);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", null); // No content
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("export should survive JSON serialization and still pass validation", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    // Simulate writing to file and reading back
    const json = JSON.stringify(data, null, 2);
    const restored = JSON.parse(json);

    const errors = validateExportData(restored);
    assert.deepEqual(errors, []);
  });

  it("export should survive minified JSON and still pass validation", async () => {
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const json = JSON.stringify(data);
    const restored = JSON.parse(json);

    const errors = validateExportData(restored);
    assert.deepEqual(errors, []);
  });

  it("empty project export should pass validation", async () => {
    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH]);
    transport.setResult("pages.listByBranch", []);
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("export with multi-branch project should pass validation", async () => {
    const devBranch = {
      ...MOCK_BRANCH,
      _id: "branch_dev",
      name: "development",
      isDefault: false,
    };
    const devPage = {
      ...MOCK_PAGE,
      _id: "page_dev",
      branchId: "branch_dev",
      title: "Dev Page",
      slug: "dev-page",
    };

    transport.setResult("projects.get", MOCK_PROJECT);
    transport.setResult("branches.list", [MOCK_BRANCH, devBranch]);

    let pageListCalls = 0;
    transport.results.set("pages.listByBranch", () => {
      pageListCalls++;
      return pageListCalls === 1 ? [MOCK_PAGE] : [devPage];
    });
    transport.setResult("folders.listByBranch", []);
    transport.setResult("assets.listByProject", []);
    transport.setResult("deployments.listByProject", []);
    transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
    transport.setResult("mergeRequests.list", []);

    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    const errors = validateExportData(data);
    assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`);
    assert.equal(data.branches.length, 2);
    assert.equal(data.pages.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Tests: Import endpoint contract
// ---------------------------------------------------------------------------

describe("import endpoint contract", () => {
  it("exported data has version field required by import endpoint", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    assert.equal(data.version, 1, "Import endpoint requires version: 1");
  });

  it("exported projects have required fields for import", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    for (const project of data.projects) {
      // Fields required by POST /api/import
      assert.ok(project._id, "Project must have _id for source mapping");
      assert.ok(project.name, "Project must have name for createFromImport");
      assert.ok(project.slug, "Project must have slug");
    }
  });

  it("exported branches have required fields for import", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    for (const branch of data.branches) {
      assert.ok(branch._id, "Branch must have _id");
      assert.ok(branch.projectId, "Branch must have projectId");
      assert.ok(branch.name, "Branch must have name");
      assert.equal(typeof branch.isDefault, "boolean", "Branch must have boolean isDefault");
    }
  });

  it("exported pages have required fields for import", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    for (const page of data.pages) {
      assert.ok(page._id, "Page must have _id");
      assert.ok(page.branchId, "Page must have branchId");
      assert.ok(page.title, "Page must have title");
      assert.ok(page.slug, "Page must have slug");
    }
  });

  it("exported folders have required fields for import", async () => {
    const transport = createMockTransport();
    setupExportMocks(transport);
    const client = await createTestClient(transport);
    const data = await client.exportProject("proj_001");

    for (const folder of data.folders) {
      assert.ok(folder._id, "Folder must have _id");
      assert.ok(folder.branchId, "Folder must have branchId");
      assert.ok(folder.name, "Folder must have name");
      assert.ok(folder.slug, "Folder must have slug");
    }
  });
});
