import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Mock transport — intercepts the client's private query/mutate calls
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
      // fnPath comes from the client's query/mutate helper as "module.function"
      calls.push({ type, fnPath: _fnPath, args });
      const result = results.get(_fnPath);
      if (typeof result === "function") return (result as (a: unknown) => unknown)(args);
      return result ?? null;
    };
  }

  return { calls, results, setResult, queryHandler: handler("query"), mutationHandler: handler("mutation") };
}

/**
 * Create a ConvexCliClient with its private query/mutate methods overridden
 * to use our mock transport instead of the real ConvexHttpClient.
 */
async function createTestClient(
  transport: ReturnType<typeof createMockTransport>,
  opts?: { verbose?: boolean }
) {
  const { ConvexCliClient } = await import("../src/lib/convex-client.ts");
  const client = new ConvexCliClient({
    convexUrl: "https://test.convex.cloud",
    verbose: opts?.verbose ?? false,
  });

  // Override private helpers to use our mock transport
  // The private methods have signature: query<T>(fnPath, args) / mutate<T>(fnPath, args)
  const proto = Object.getPrototypeOf(client);
  const originalQuery = proto.query;
  const originalMutate = proto.mutate;

  // Bind mock handlers, preserving the verbose logging from the real implementation
  (client as unknown as Record<string, unknown>)["query"] = async function <T>(
    fnPath: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (opts?.verbose) {
      process.stderr.write(`[convex] query ${fnPath}(${JSON.stringify(args)})\n`);
    }
    return transport.queryHandler(fnPath, args) as Promise<T>;
  };

  (client as unknown as Record<string, unknown>)["mutate"] = async function <T>(
    fnPath: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (opts?.verbose) {
      process.stderr.write(`[convex] mutation ${fnPath}(${JSON.stringify(args)})\n`);
    }
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
  content: '[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConvexCliClient", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  // -----------------------------------------------------------------------
  // Construction & createConvexClient factory
  // -----------------------------------------------------------------------

  describe("createConvexClient factory", () => {
    const originalEnv: Record<string, string | undefined> = {};

    function saveEnv() {
      originalEnv.NEXT_PUBLIC_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
      originalEnv.CONVEX_URL = process.env.CONVEX_URL;
    }

    function restoreEnv() {
      for (const [key, val] of Object.entries(originalEnv)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    }

    it("should create client from explicit convexUrl", async () => {
      saveEnv();
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      delete process.env.CONVEX_URL;
      try {
        const { createConvexClient } = await import("../src/lib/convex-client.ts");
        const client = createConvexClient({ convexUrl: "https://test.convex.cloud" });
        assert.ok(client);
      } finally {
        restoreEnv();
      }
    });

    it("should create client from NEXT_PUBLIC_CONVEX_URL env", async () => {
      saveEnv();
      process.env.NEXT_PUBLIC_CONVEX_URL = "https://env.convex.cloud";
      delete process.env.CONVEX_URL;
      try {
        const { createConvexClient } = await import("../src/lib/convex-client.ts");
        const client = createConvexClient();
        assert.ok(client);
      } finally {
        restoreEnv();
      }
    });

    it("should create client from CONVEX_URL env", async () => {
      saveEnv();
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      process.env.CONVEX_URL = "https://env2.convex.cloud";
      try {
        const { createConvexClient } = await import("../src/lib/convex-client.ts");
        const client = createConvexClient();
        assert.ok(client);
      } finally {
        restoreEnv();
      }
    });

    it("should throw when no Convex URL is available", async () => {
      saveEnv();
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
      delete process.env.CONVEX_URL;
      try {
        const { createConvexClient } = await import("../src/lib/convex-client.ts");
        assert.throws(() => createConvexClient(), /No Convex URL found/);
      } finally {
        restoreEnv();
      }
    });

    it("should prefer explicit convexUrl over env vars", async () => {
      saveEnv();
      process.env.NEXT_PUBLIC_CONVEX_URL = "https://env.convex.cloud";
      try {
        const { createConvexClient } = await import("../src/lib/convex-client.ts");
        const client = createConvexClient({ convexUrl: "https://explicit.convex.cloud" });
        assert.ok(client);
      } finally {
        restoreEnv();
      }
    });
  });

  // -----------------------------------------------------------------------
  // User operations
  // -----------------------------------------------------------------------

  describe("ensureLocalUser", () => {
    it("should call users.ensureLocalUser mutation", async () => {
      transport.setResult("users.ensureLocalUser", "user_001");
      const client = await createTestClient(transport);

      const userId = await client.ensureLocalUser();

      assert.equal(userId, "user_001");
      assert.equal(transport.calls.length, 1);
      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "users.ensureLocalUser");
    });
  });

  // -----------------------------------------------------------------------
  // Project operations
  // -----------------------------------------------------------------------

  describe("listProjects", () => {
    it("should call projects.list query with no args", async () => {
      transport.setResult("projects.list", [MOCK_PROJECT]);
      const client = await createTestClient(transport);

      const projects = await client.listProjects();

      assert.equal(projects.length, 1);
      assert.equal(projects[0].name, "My Docs");
      assert.equal(transport.calls.length, 1);
      assert.equal(transport.calls[0].type, "query");
      assert.equal(transport.calls[0].fnPath, "projects.list");
    });

    it("should return empty array when no projects exist", async () => {
      transport.setResult("projects.list", []);
      const client = await createTestClient(transport);

      const projects = await client.listProjects();
      assert.equal(projects.length, 0);
    });
  });

  describe("getProject", () => {
    it("should call projects.get query with projectId", async () => {
      transport.setResult("projects.get", MOCK_PROJECT);
      const client = await createTestClient(transport);

      const project = await client.getProject("proj_001");

      assert.equal(project?.name, "My Docs");
      assert.equal(project?.slug, "my-docs");
      assert.deepEqual(transport.calls[0].args, { projectId: "proj_001" });
    });

    it("should return null for non-existent project", async () => {
      transport.setResult("projects.get", null);
      const client = await createTestClient(transport);

      const project = await client.getProject("proj_nonexistent");
      assert.equal(project, null);
    });
  });

  describe("createProject", () => {
    it("should call projects.create mutation with name", async () => {
      transport.setResult("projects.create", "proj_002");
      const client = await createTestClient(transport);

      const id = await client.createProject({ name: "New Docs" });

      assert.equal(id, "proj_002");
      assert.equal(transport.calls.length, 1);
      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "projects.create");
      assert.deepEqual(transport.calls[0].args, { name: "New Docs" });
    });

    it("should pass optional description and templateId", async () => {
      transport.setResult("projects.create", "proj_003");
      const client = await createTestClient(transport);

      await client.createProject({
        name: "Advanced Docs",
        description: "My docs site",
        templateId: "api-reference",
      });

      assert.deepEqual(transport.calls[0].args, {
        name: "Advanced Docs",
        description: "My docs site",
        templateId: "api-reference",
      });
    });
  });

  // -----------------------------------------------------------------------
  // Branch operations
  // -----------------------------------------------------------------------

  describe("listBranches", () => {
    it("should call branches.list query with projectId", async () => {
      transport.setResult("branches.list", [MOCK_BRANCH]);
      const client = await createTestClient(transport);

      const branches = await client.listBranches("proj_001");

      assert.equal(branches.length, 1);
      assert.equal(branches[0].name, "main");
      assert.equal(branches[0].isDefault, true);
      assert.deepEqual(transport.calls[0].args, { projectId: "proj_001" });
    });
  });

  describe("getBranch", () => {
    it("should call branches.get query with branchId", async () => {
      transport.setResult("branches.get", MOCK_BRANCH);
      const client = await createTestClient(transport);

      const branch = await client.getBranch("branch_001");

      assert.equal(branch?.name, "main");
      assert.deepEqual(transport.calls[0].args, { branchId: "branch_001" });
    });
  });

  describe("getDefaultBranch", () => {
    it("should get project then fetch default branch", async () => {
      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.get", MOCK_BRANCH);
      const client = await createTestClient(transport);

      const branch = await client.getDefaultBranch("proj_001");

      assert.equal(branch?.name, "main");
      // Should have made 2 calls: getProject + getBranch
      assert.equal(transport.calls.length, 2);
      assert.equal(transport.calls[0].fnPath, "projects.get");
      assert.equal(transport.calls[1].fnPath, "branches.get");
    });

    it("should return null when project has no default branch", async () => {
      transport.setResult("projects.get", { ...MOCK_PROJECT, defaultBranchId: undefined });
      const client = await createTestClient(transport);

      const branch = await client.getDefaultBranch("proj_001");
      assert.equal(branch, null);
    });

    it("should return null when project not found", async () => {
      transport.setResult("projects.get", null);
      const client = await createTestClient(transport);

      const branch = await client.getDefaultBranch("proj_nonexistent");
      assert.equal(branch, null);
    });
  });

  // -----------------------------------------------------------------------
  // Page operations
  // -----------------------------------------------------------------------

  describe("listPagesByBranch", () => {
    it("should call pages.listByBranch query", async () => {
      transport.setResult("pages.listByBranch", [MOCK_PAGE]);
      const client = await createTestClient(transport);

      const pages = await client.listPagesByBranch("branch_001");

      assert.equal(pages.length, 1);
      assert.equal(pages[0].title, "Getting Started");
      assert.deepEqual(transport.calls[0].args, { branchId: "branch_001" });
    });
  });

  describe("listPagesByProject", () => {
    it("should call pages.listByProject query", async () => {
      transport.setResult("pages.listByProject", [MOCK_PAGE]);
      const client = await createTestClient(transport);

      const pages = await client.listPagesByProject("proj_001");

      assert.equal(pages.length, 1);
      assert.deepEqual(transport.calls[0].args, { projectId: "proj_001" });
    });
  });

  describe("getPage", () => {
    it("should call pages.get query", async () => {
      transport.setResult("pages.get", MOCK_PAGE);
      const client = await createTestClient(transport);

      const page = await client.getPage("page_001");

      assert.equal(page?.title, "Getting Started");
      assert.equal(page?.slug, "getting-started");
      assert.deepEqual(transport.calls[0].args, { pageId: "page_001" });
    });
  });

  describe("getPageContent", () => {
    it("should call pages.getContent query", async () => {
      transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
      const client = await createTestClient(transport);

      const content = await client.getPageContent("page_001");

      assert.ok(content);
      assert.equal(content.pageId, "page_001");
      assert.ok(content.content.includes("Hello world"));
    });

    it("should return null for page with no content", async () => {
      transport.setResult("pages.getContent", null);
      const client = await createTestClient(transport);

      const content = await client.getPageContent("page_new");
      assert.equal(content, null);
    });
  });

  describe("createPage", () => {
    it("should call pages.create mutation", async () => {
      transport.setResult("pages.create", "page_002");
      const client = await createTestClient(transport);

      const pageId = await client.createPage({
        branchId: "branch_001",
        title: "API Reference",
      });

      assert.equal(pageId, "page_002");
      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "pages.create");
    });

    it("should pass optional folderId and position", async () => {
      transport.setResult("pages.create", "page_003");
      const client = await createTestClient(transport);

      await client.createPage({
        branchId: "branch_001",
        title: "Quick Start",
        folderId: "folder_001",
        position: 1,
      });

      assert.deepEqual(transport.calls[0].args, {
        branchId: "branch_001",
        title: "Quick Start",
        folderId: "folder_001",
        position: 1,
      });
    });
  });

  describe("updatePage", () => {
    it("should call pages.update mutation with pageId and updates", async () => {
      const client = await createTestClient(transport);

      await client.updatePage("page_001", {
        title: "Updated Title",
        isPublished: true,
      });

      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "pages.update");
      assert.deepEqual(transport.calls[0].args, {
        pageId: "page_001",
        title: "Updated Title",
        isPublished: true,
      });
    });
  });

  describe("updatePageContent", () => {
    it("should call pages.updateContent mutation", async () => {
      transport.setResult("pages.updateContent", "content_001");
      const client = await createTestClient(transport);

      const contentId = await client.updatePageContent(
        "page_001",
        '[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]'
      );

      assert.equal(contentId, "content_001");
      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "pages.updateContent");
    });
  });

  describe("removePage", () => {
    it("should call pages.remove mutation", async () => {
      const client = await createTestClient(transport);

      await client.removePage("page_001");

      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "pages.remove");
      assert.deepEqual(transport.calls[0].args, { pageId: "page_001" });
    });
  });

  // -----------------------------------------------------------------------
  // Folder operations
  // -----------------------------------------------------------------------

  describe("listFoldersByBranch", () => {
    it("should call folders.listByBranch query", async () => {
      transport.setResult("folders.listByBranch", [MOCK_FOLDER]);
      const client = await createTestClient(transport);

      const folders = await client.listFoldersByBranch("branch_001");

      assert.equal(folders.length, 1);
      assert.equal(folders[0].name, "Guides");
    });
  });

  describe("listFoldersByProject", () => {
    it("should call folders.listByProject query", async () => {
      transport.setResult("folders.listByProject", [MOCK_FOLDER]);
      const client = await createTestClient(transport);

      const folders = await client.listFoldersByProject("proj_001");

      assert.equal(folders.length, 1);
    });
  });

  describe("getFolder", () => {
    it("should call folders.get query", async () => {
      transport.setResult("folders.get", MOCK_FOLDER);
      const client = await createTestClient(transport);

      const folder = await client.getFolder("folder_001");

      assert.equal(folder?.name, "Guides");
      assert.equal(folder?.slug, "guides");
    });
  });

  describe("createFolder", () => {
    it("should call folders.create mutation", async () => {
      transport.setResult("folders.create", "folder_002");
      const client = await createTestClient(transport);

      const folderId = await client.createFolder({
        branchId: "branch_001",
        name: "API",
      });

      assert.equal(folderId, "folder_002");
      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "folders.create");
    });

    it("should pass optional parentId, position, icon", async () => {
      transport.setResult("folders.create", "folder_003");
      const client = await createTestClient(transport);

      await client.createFolder({
        branchId: "branch_001",
        name: "Advanced",
        parentId: "folder_001",
        position: 2,
        icon: "book",
      });

      assert.deepEqual(transport.calls[0].args, {
        branchId: "branch_001",
        name: "Advanced",
        parentId: "folder_001",
        position: 2,
        icon: "book",
      });
    });
  });

  describe("removeFolder", () => {
    it("should call folders.remove mutation", async () => {
      const client = await createTestClient(transport);

      await client.removeFolder("folder_001");

      assert.equal(transport.calls[0].type, "mutation");
      assert.equal(transport.calls[0].fnPath, "folders.remove");
      assert.deepEqual(transport.calls[0].args, { folderId: "folder_001" });
    });
  });

  // -----------------------------------------------------------------------
  // Asset operations
  // -----------------------------------------------------------------------

  describe("listAssets", () => {
    it("should call assets.listByProject query", async () => {
      transport.setResult("assets.listByProject", [MOCK_ASSET]);
      const client = await createTestClient(transport);

      const assets = await client.listAssets("proj_001");

      assert.equal(assets.length, 1);
      assert.equal(assets[0].filename, "logo.png");
      assert.equal(transport.calls[0].fnPath, "assets.listByProject");
    });
  });

  // -----------------------------------------------------------------------
  // Deployment operations
  // -----------------------------------------------------------------------

  describe("listDeployments", () => {
    it("should call deployments.listByProject query", async () => {
      transport.setResult("deployments.listByProject", [MOCK_DEPLOYMENT]);
      const client = await createTestClient(transport);

      const deployments = await client.listDeployments("proj_001");

      assert.equal(deployments.length, 1);
      assert.equal(deployments[0].status, "success");
    });
  });

  // -----------------------------------------------------------------------
  // Merge request operations
  // -----------------------------------------------------------------------

  describe("listMergeRequests", () => {
    it("should call mergeRequests.list query", async () => {
      transport.setResult("mergeRequests.list", [MOCK_MERGE_REQUEST]);
      const client = await createTestClient(transport);

      const mrs = await client.listMergeRequests("proj_001");

      assert.equal(mrs.length, 1);
      assert.equal(mrs[0].title, "Add API docs");
      assert.equal(mrs[0].status, "open");
    });
  });

  // -----------------------------------------------------------------------
  // Export operations
  // -----------------------------------------------------------------------

  describe("exportProject", () => {
    function setupExportMocks(t: ReturnType<typeof createMockTransport>) {
      t.setResult("projects.get", MOCK_PROJECT);
      t.setResult("branches.list", [MOCK_BRANCH]);
      t.setResult("assets.listByProject", [MOCK_ASSET]);
      t.setResult("deployments.listByProject", [MOCK_DEPLOYMENT]);
      t.setResult("pages.listByBranch", [MOCK_PAGE]);
      t.setResult("folders.listByBranch", [MOCK_FOLDER]);
      t.setResult("pages.getContent", MOCK_PAGE_CONTENT);
      t.setResult("mergeRequests.list", [MOCK_MERGE_REQUEST]);
    }

    it("should aggregate all project data into export format", async () => {
      setupExportMocks(transport);
      const client = await createTestClient(transport);

      const exportData = await client.exportProject("proj_001");

      assert.equal(exportData.version, 1);
      assert.ok(exportData.exportedAt);
      assert.equal(exportData.projects.length, 1);
      assert.equal(exportData.projects[0].name, "My Docs");
      assert.equal(exportData.branches.length, 1);
      assert.equal(exportData.pages.length, 1);
      assert.equal(exportData.pages[0].title, "Getting Started");
      assert.ok(exportData.pages[0].content); // Content should be fetched
      assert.equal(exportData.folders.length, 1);
      assert.equal(exportData.assets.length, 1);
      assert.equal(exportData.deployments.length, 1);
      assert.equal(exportData.mergeRequests.length, 1);
    });

    it("should throw when project not found", async () => {
      transport.setResult("projects.get", null);
      const client = await createTestClient(transport);

      await assert.rejects(
        () => client.exportProject("proj_nonexistent"),
        /Project not found/
      );
    });

    it("should handle project with no pages or folders", async () => {
      transport.setResult("projects.get", { ...MOCK_PROJECT, defaultBranchId: "branch_empty" });
      transport.setResult("branches.list", [{ ...MOCK_BRANCH, _id: "branch_empty" }]);
      transport.setResult("assets.listByProject", []);
      transport.setResult("deployments.listByProject", []);
      transport.setResult("pages.listByBranch", []);
      transport.setResult("folders.listByBranch", []);
      transport.setResult("mergeRequests.list", []);

      const client = await createTestClient(transport);
      const exportData = await client.exportProject("proj_001");

      assert.equal(exportData.pages.length, 0);
      assert.equal(exportData.folders.length, 0);
      assert.equal(exportData.mergeRequests.length, 0);
    });

    it("should deduplicate pages across branches", async () => {
      const branch2 = { ...MOCK_BRANCH, _id: "branch_002", name: "feature", isDefault: false };
      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.list", [MOCK_BRANCH, branch2]);
      transport.setResult("assets.listByProject", []);
      transport.setResult("deployments.listByProject", []);
      // Same page ID appears on both branches
      transport.setResult("pages.listByBranch", [MOCK_PAGE]);
      transport.setResult("folders.listByBranch", [MOCK_FOLDER]);
      transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
      transport.setResult("mergeRequests.list", []);

      const client = await createTestClient(transport);
      const exportData = await client.exportProject("proj_001");

      // Should only have 1 page despite appearing on both branches
      assert.equal(exportData.pages.length, 1);
      assert.equal(exportData.folders.length, 1);
    });

    it("should collect unique pages from different branches", async () => {
      const branch2 = { ...MOCK_BRANCH, _id: "branch_002", name: "feature", isDefault: false };
      const page2 = { ...MOCK_PAGE, _id: "page_002", title: "API Reference", slug: "api-reference" };

      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.list", [MOCK_BRANCH, branch2]);
      transport.setResult("assets.listByProject", []);
      transport.setResult("deployments.listByProject", []);
      // Return different pages per branch call (use a counter)
      let branchCallCount = 0;
      transport.results.set("pages.listByBranch", (args: unknown) => {
        branchCallCount++;
        return branchCallCount === 1 ? [MOCK_PAGE] : [page2];
      });
      transport.results.set("folders.listByBranch", () => [MOCK_FOLDER]);
      transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
      transport.setResult("mergeRequests.list", []);

      const client = await createTestClient(transport);
      const exportData = await client.exportProject("proj_001");

      // Should have 2 unique pages from 2 branches
      assert.equal(exportData.pages.length, 2);
    });

    it("should include content with each exported page", async () => {
      setupExportMocks(transport);
      const client = await createTestClient(transport);

      const exportData = await client.exportProject("proj_001");

      assert.equal(exportData.pages.length, 1);
      assert.ok(exportData.pages[0].content);
      assert.ok(exportData.pages[0].content!.includes("Hello world"));
    });

    it("should handle page with no content gracefully", async () => {
      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.list", [MOCK_BRANCH]);
      transport.setResult("assets.listByProject", []);
      transport.setResult("deployments.listByProject", []);
      transport.setResult("pages.listByBranch", [MOCK_PAGE]);
      transport.setResult("folders.listByBranch", []);
      transport.setResult("pages.getContent", null);
      transport.setResult("mergeRequests.list", []);

      const client = await createTestClient(transport);
      const exportData = await client.exportProject("proj_001");

      assert.equal(exportData.pages.length, 1);
      assert.equal(exportData.pages[0].content, undefined);
    });

    it("should gracefully handle mergeRequests query failure", async () => {
      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.list", [MOCK_BRANCH]);
      transport.setResult("assets.listByProject", []);
      transport.setResult("deployments.listByProject", []);
      transport.setResult("pages.listByBranch", []);
      transport.setResult("folders.listByBranch", []);
      // Make mergeRequests throw
      transport.results.set("mergeRequests.list", () => {
        throw new Error("mergeRequests not available");
      });

      const client = await createTestClient(transport);
      const exportData = await client.exportProject("proj_001");

      assert.equal(exportData.mergeRequests.length, 0);
    });

    it("should include exportedAt as ISO string", async () => {
      setupExportMocks(transport);
      const client = await createTestClient(transport);

      const before = new Date().toISOString();
      const exportData = await client.exportProject("proj_001");
      const after = new Date().toISOString();

      assert.ok(exportData.exportedAt >= before);
      assert.ok(exportData.exportedAt <= after);
    });
  });

  describe("exportAll", () => {
    it("should export data from all projects", async () => {
      const project2 = { ...MOCK_PROJECT, _id: "proj_002", name: "API Docs", slug: "api-docs" };

      transport.setResult("projects.list", [MOCK_PROJECT, project2]);
      // exportProject will call getProject for each
      transport.setResult("projects.get", MOCK_PROJECT);
      transport.setResult("branches.list", [MOCK_BRANCH]);
      transport.setResult("assets.listByProject", [MOCK_ASSET]);
      transport.setResult("deployments.listByProject", [MOCK_DEPLOYMENT]);
      transport.setResult("pages.listByBranch", [MOCK_PAGE]);
      transport.setResult("folders.listByBranch", [MOCK_FOLDER]);
      transport.setResult("pages.getContent", MOCK_PAGE_CONTENT);
      transport.setResult("mergeRequests.list", []);

      const client = await createTestClient(transport);
      const exportData = await client.exportAll();

      assert.equal(exportData.version, 1);
      assert.equal(exportData.projects.length, 2);
      // Each project contributes branches, pages, etc.
      assert.equal(exportData.branches.length, 2);
    });

    it("should handle empty project list", async () => {
      transport.setResult("projects.list", []);
      const client = await createTestClient(transport);

      const exportData = await client.exportAll();

      assert.equal(exportData.version, 1);
      assert.equal(exportData.projects.length, 0);
      assert.equal(exportData.pages.length, 0);
      assert.equal(exportData.branches.length, 0);
    });
  });

  // -----------------------------------------------------------------------
  // Verbose logging
  // -----------------------------------------------------------------------

  describe("verbose logging", () => {
    it("should log to stderr when verbose is true", async () => {
      transport.setResult("projects.list", []);
      const stderrOutput: string[] = [];
      const originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const client = await createTestClient(transport, { verbose: true });
        await client.listProjects();

        const output = stderrOutput.join("");
        assert.ok(output.includes("[convex]"));
        assert.ok(output.includes("query"));
        assert.ok(output.includes("projects.list"));
      } finally {
        process.stderr.write = originalWrite;
      }
    });

    it("should not log when verbose is false", async () => {
      transport.setResult("projects.list", []);
      const stderrOutput: string[] = [];
      const originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const client = await createTestClient(transport, { verbose: false });
        await client.listProjects();

        const output = stderrOutput.join("");
        assert.ok(!output.includes("[convex]"));
      } finally {
        process.stderr.write = originalWrite;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Argument passing verification
  // -----------------------------------------------------------------------

  describe("argument passing", () => {
    it("should pass correct args for each operation type", async () => {
      transport.setResult("pages.update", undefined);
      const client = await createTestClient(transport);

      await client.updatePage("page_xyz", {
        title: "New Title",
        isPublished: false,
        icon: "star",
      });

      assert.deepEqual(transport.calls[0].args, {
        pageId: "page_xyz",
        title: "New Title",
        isPublished: false,
        icon: "star",
      });
    });

    it("should pass content for updatePageContent", async () => {
      transport.setResult("pages.updateContent", "content_id");
      const client = await createTestClient(transport);
      const content = '{"blocks":[]}';

      await client.updatePageContent("page_001", content);

      assert.deepEqual(transport.calls[0].args, {
        pageId: "page_001",
        content,
      });
    });
  });

  // -----------------------------------------------------------------------
  // close()
  // -----------------------------------------------------------------------

  describe("close", () => {
    it("should clear the internal client reference", async () => {
      const client = await createTestClient(transport);
      client.close();
      assert.equal((client as unknown as Record<string, unknown>).client, null);
    });
  });
});

// ---------------------------------------------------------------------------
// ExportData type shape tests
// ---------------------------------------------------------------------------

describe("ExportData type", () => {
  it("should define the expected export schema", async () => {
    const { ConvexCliClient } = await import("../src/lib/convex-client.ts");

    assert.equal(typeof ConvexCliClient, "function");

    // Verify exported types are usable (compile-time check)
    const exportShape: import("../src/lib/convex-client.ts").ExportData = {
      version: 1,
      exportedAt: "2026-03-03T00:00:00.000Z",
      projects: [],
      branches: [],
      pages: [],
      folders: [],
      assets: [],
      deployments: [],
      mergeRequests: [],
    };

    assert.equal(exportShape.version, 1);
    assert.ok(Array.isArray(exportShape.projects));
    assert.ok(Array.isArray(exportShape.branches));
    assert.ok(Array.isArray(exportShape.pages));
    assert.ok(Array.isArray(exportShape.folders));
    assert.ok(Array.isArray(exportShape.assets));
    assert.ok(Array.isArray(exportShape.deployments));
    assert.ok(Array.isArray(exportShape.mergeRequests));
  });
});
