import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────
const {
  mockConvexQuery,
  mockConvexMutation,
  mockCreateDeployment,
  mockRollbackDeployment,
  mockGenerateSiteFiles,
  mockBuildSiteData,
  mockGeneratePageHtml,
  mockGenerateShellHtml,
  mockGetPrebuiltAssets,
  mockGetAssetManifest,
} = vi.hoisted(() => ({
  mockConvexQuery: vi.fn(),
  mockConvexMutation: vi.fn(),
  mockCreateDeployment: vi.fn(),
  mockRollbackDeployment: vi.fn(),
  mockGenerateSiteFiles: vi.fn(),
  mockBuildSiteData: vi.fn(),
  mockGeneratePageHtml: vi.fn(),
  mockGenerateShellHtml: vi.fn(),
  mockGetPrebuiltAssets: vi.fn(),
  mockGetAssetManifest: vi.fn(),
}));

vi.mock("convex/browser", () => {
  class MockConvexHttpClient {
    constructor(_url: string) {}
    query = mockConvexQuery;
    mutation = mockConvexMutation;
  }
  return { ConvexHttpClient: MockConvexHttpClient };
});

vi.mock("@/lib/cloudflare", () => ({
  createCloudflareClient: () => ({
    createDeployment: mockCreateDeployment,
    rollbackDeployment: mockRollbackDeployment,
  }),
  mapCfStatus: (status: string) => {
    switch (status) {
      case "idle": return "queued";
      case "active": return "building";
      case "success": return "ready";
      case "failure": return "error";
      case "canceled": return "canceled";
      default: return "queued";
    }
  },
}));

vi.mock("@/lib/generate-site", () => ({
  generateSiteFiles: mockGenerateSiteFiles,
  buildSiteData: mockBuildSiteData,
}));

vi.mock("@/lib/generate-html", () => ({
  generatePageHtml: mockGeneratePageHtml,
  generateShellHtml: mockGenerateShellHtml,
}));

vi.mock("create-inkloom", () => ({
  getPrebuiltAssets: mockGetPrebuiltAssets,
  getAssetManifest: mockGetAssetManifest,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    projects: {
      get: "projects:get",
      updateCfSlug: "projects:updateCfSlug",
    },
    pages: {
      listByBranch: "pages:listByBranch",
      getContent: "pages:getContent",
      createVersion: "pages:createVersion",
    },
    folders: {
      listByBranch: "folders:listByBranch",
    },
    assets: {
      getAssetUrl: "assets:getAssetUrl",
    },
    users: {
      current: "users:current",
    },
    deployments: {
      get: "deployments:get",
      create: "deployments:create",
      updateStatus: "deployments:updateStatus",
      updateBuildPhase: "deployments:updateBuildPhase",
      upsertConfig: "deployments:upsertConfig",
      setLiveDeployment: "deployments:setLiveDeployment",
    },
    github: {
      getConnection: "github:getConnection",
    },
  },
}));

// ── Test data fixtures ──────────────────────────────────────────────────
const PROJECT_ID = "project123" as any;
const BRANCH_ID = "branch456" as any;
const DEPLOYMENT_ID = "deploy789" as any;
const USER_ID = "workos_user_abc";
const CONVEX_USER_ID = "user_convex_abc" as any;

const mockProject = {
  _id: PROJECT_ID,
  name: "Test Project",
  slug: "test-project",
  description: "A test project",
  cfSlug: "test-project-12345",
  defaultBranchId: BRANCH_ID,
  workosOrgId: "org_123",
  settings: {
    theme: "default",
    primaryColor: "#3b82f6",
  },
};

const mockPages = [
  {
    _id: "page1",
    title: "Getting Started",
    slug: "getting-started",
    path: "/getting-started",
    isPublished: true,
    position: 0,
    icon: undefined,
    folderId: undefined,
    branchId: BRANCH_ID,
  },
  {
    _id: "page2",
    title: "API Reference",
    slug: "api-reference",
    path: "/guides/api-reference",
    isPublished: true,
    position: 1,
    icon: "code",
    folderId: "folder1",
    branchId: BRANCH_ID,
  },
  {
    _id: "page3",
    title: "Draft Page",
    slug: "draft",
    path: "/draft",
    isPublished: false,
    position: 2,
    icon: undefined,
    folderId: undefined,
    branchId: BRANCH_ID,
  },
];

const mockFolders = [
  {
    _id: "folder1",
    name: "Guides",
    slug: "guides",
    path: "/guides",
    position: 0,
    icon: "book",
    parentId: undefined,
    branchId: BRANCH_ID,
  },
];

const mockDeploymentResult = {
  id: "cf_deploy_abc",
  url: "https://test-project.pages.dev",
  environment: "production",
  latest_stage: {
    name: "deploy",
    status: "success" as const,
  },
};

// ── Import after mocks ──────────────────────────────────────────────────
import { deployProject, rollbackDeployment } from "@/lib/deploy";
import type { DeployProjectOptions, RollbackOptions } from "@/lib/deploy";

// ── Setup ───────────────────────────────────────────────────────────────
function mockConvex() {
  const convex = {
    query: mockConvexQuery,
    mutation: mockConvexMutation,
  };
  return convex as any;
}

function setupDefaultMocks() {
  // Project lookup
  mockConvexQuery.mockImplementation((fnName: string, args: any) => {
    if (fnName === "projects:get") return mockProject;
    if (fnName === "pages:listByBranch") return mockPages;
    if (fnName === "folders:listByBranch") return mockFolders;
    if (fnName === "pages:getContent") {
      if (args.pageId === "page1")
        return { content: '[{"type":"paragraph","content":[]}]' };
      if (args.pageId === "page2")
        return { content: '[{"type":"heading","content":[]}]' };
      return null;
    }
    if (fnName === "users:current") return { _id: CONVEX_USER_ID };
    if (fnName === "deployments:get") return null;
    if (fnName === "assets:getAssetUrl") return null;
    if (fnName === "github:getConnection") return null;
    return null;
  });

  mockConvexMutation.mockImplementation((fnName: string) => {
    if (fnName === "deployments:create") return DEPLOYMENT_ID;
    return undefined;
  });

  // Cloudflare
  mockCreateDeployment.mockResolvedValue(mockDeploymentResult);
  mockRollbackDeployment.mockResolvedValue(mockDeploymentResult);

  // Site generation
  mockGenerateSiteFiles.mockResolvedValue([
    {
      file: "docs/getting-started.mdx",
      data: '---\ntitle: "Getting Started"\n---\n# Hello',
    },
    {
      file: "docs/guides/api-reference.mdx",
      data: '---\ntitle: "API Reference"\n---\n# API',
    },
    { file: "lib/navigation.json", data: "[]" },
    { file: "lib/tabs.json", data: "[]" },
    { file: "theme.css", data: ":root { --color-primary: blue; }" },
    { file: "public/search-index.json", data: "[]" },
  ]);
  mockBuildSiteData.mockReturnValue({
    name: "Test Project",
    navigation: [],
    tabs: [],
  });
  mockGeneratePageHtml.mockReturnValue("<html>page</html>");
  mockGenerateShellHtml.mockReturnValue("<html>shell</html>");
  mockGetPrebuiltAssets.mockReturnValue([
    { path: "assets/main.js", content: Buffer.from("js") },
    { path: "assets/main.css", content: Buffer.from("css") },
    { path: "index.html", content: Buffer.from("<html></html>") },
  ]);
  mockGetAssetManifest.mockReturnValue({
    js: ["assets/main.js"],
    css: ["assets/main.css"],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("deployProject", () => {
  function makeOpts(overrides?: Partial<DeployProjectOptions>): DeployProjectOptions {
    return {
      projectId: PROJECT_ID,
      target: "production",
      userId: USER_ID,
      convex: mockConvex(),
      appUrl: "https://app.inkloom.dev",
      ...overrides,
    };
  }

  it("deploys a project successfully and returns DeployResult", async () => {
    const result = await deployProject(makeOpts());

    expect(result).toEqual({
      deploymentId: DEPLOYMENT_ID,
      externalDeploymentId: "cf_deploy_abc",
      url: "https://test-project.pages.dev",
      status: "ready",
      buildPhase: "propagating",
    });
  });

  it("throws if project is not found", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "projects:get") return null;
      return null;
    });

    await expect(deployProject(makeOpts())).rejects.toThrow("Project not found");
  });

  it("throws if project has no default branch", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "projects:get") return { ...mockProject, defaultBranchId: null };
      return null;
    });

    await expect(deployProject(makeOpts())).rejects.toThrow(
      "Project has no default branch"
    );
  });

  it("throws if no published pages are found", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "projects:get") return mockProject;
      if (fnName === "pages:listByBranch")
        return [{ ...mockPages[0], isPublished: false }];
      if (fnName === "folders:listByBranch") return [];
      if (fnName === "users:current") return { _id: CONVEX_USER_ID };
      return null;
    });

    await expect(deployProject(makeOpts())).rejects.toThrow(
      "No published pages found"
    );
  });

  it("uses the provided branchId instead of defaultBranchId", async () => {
    const customBranch = "custom_branch" as any;

    await deployProject(makeOpts({ branchId: customBranch }));

    // Should query pages with the custom branch, not default
    expect(mockConvexQuery).toHaveBeenCalledWith("pages:listByBranch", {
      branchId: customBranch,
    });
  });

  it("uses defaultBranchId when no branchId is provided", async () => {
    await deployProject(makeOpts({ branchId: undefined }));

    expect(mockConvexQuery).toHaveBeenCalledWith("pages:listByBranch", {
      branchId: BRANCH_ID,
    });
  });

  it("deploys to 'main' branch on CF for production target", async () => {
    await deployProject(makeOpts({ target: "production" }));

    expect(mockCreateDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "main" })
    );
  });

  it("deploys to 'preview' branch on CF for non-production target", async () => {
    await deployProject(makeOpts({ target: undefined }));

    expect(mockCreateDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "preview" })
    );
  });

  it("forces preview branch for non-default branch even if target=production", async () => {
    const customBranch = "feature_branch" as any;

    await deployProject(makeOpts({ branchId: customBranch, target: "production" }));

    // Non-default branch should force preview
    expect(mockCreateDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "preview" })
    );
  });

  it("only deploys published pages (filters out drafts)", async () => {
    await deployProject(makeOpts());

    // page3 (draft) should not have getContent called
    const getContentCalls = mockConvexQuery.mock.calls.filter(
      ([fn]: [string]) => fn === "pages:getContent"
    );
    expect(getContentCalls).toHaveLength(2);
    expect(getContentCalls[0][1]).toEqual({ pageId: "page1" });
    expect(getContentCalls[1][1]).toEqual({ pageId: "page2" });
  });

  it("creates version snapshots for published pages", async () => {
    await deployProject(makeOpts());

    const versionCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "pages:createVersion"
    );
    expect(versionCalls).toHaveLength(2);
    expect(versionCalls[0][1]).toEqual({
      pageId: "page1",
      createdBy: CONVEX_USER_ID,
      message: "Published to production",
    });
  });

  it("creates deployment record early with buildPhase and updates phases", async () => {
    await deployProject(makeOpts());

    // Early creation — no CF metadata yet
    const createCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "deployments:create"
    );
    expect(createCalls).toHaveLength(1);
    const [, createArgs] = createCalls[0];
    expect(createArgs.projectId).toBe(PROJECT_ID);
    expect(createArgs.branchId).toBe(BRANCH_ID);
    expect(createArgs.buildPhase).toBe("generating");
    expect(createArgs.target).toBe("production");

    // Phase updates — "uploading" then "propagating" with CF metadata
    const phaseCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "deployments:updateBuildPhase"
    );
    expect(phaseCalls).toHaveLength(2);
    expect(phaseCalls[0][1].buildPhase).toBe("uploading");
    expect(phaseCalls[1][1].buildPhase).toBe("propagating");
    expect(phaseCalls[1][1].externalDeploymentId).toBe("cf_deploy_abc");
    expect(phaseCalls[1][1].cfProjectName).toBe("inkloom-test-project-12345");
    expect(phaseCalls[1][1].contentHashes).toBeDefined();
    expect(phaseCalls[1][1].contentHashes.__project_settings__).toBeDefined();
  });

  it("updates deployment status via background poller after CF deploy", async () => {
    await deployProject(makeOpts());
    // The status update happens in a fire-and-forget background poller —
    // wait a tick for the IIFE to resolve
    await new Promise((r) => setTimeout(r, 0));

    const statusCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "deployments:updateStatus"
    );
    expect(statusCalls).toHaveLength(1);
    expect(statusCalls[0][1]).toEqual({
      deploymentId: DEPLOYMENT_ID,
      status: "ready",
      url: "https://test-project.pages.dev",
    });
  });

  it("upserts deployment config with liveDeploymentId for production", async () => {
    await deployProject(makeOpts({ target: "production" }));

    const upsertCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "deployments:upsertConfig"
    );
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0][1]).toEqual({
      projectId: PROJECT_ID,
      cfProjectName: "inkloom-test-project-12345",
      liveDeploymentId: DEPLOYMENT_ID,
    });
  });

  it("does NOT set liveDeploymentId for preview deploys", async () => {
    await deployProject(makeOpts({ target: undefined }));

    const upsertCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "deployments:upsertConfig"
    );
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0][1].liveDeploymentId).toBeUndefined();
  });

  it("generates a legacy cfSlug if project has none", async () => {
    mockConvexQuery.mockImplementation((fnName: string, args: any) => {
      if (fnName === "projects:get")
        return { ...mockProject, cfSlug: undefined };
      if (fnName === "pages:listByBranch") return mockPages;
      if (fnName === "folders:listByBranch") return mockFolders;
      if (fnName === "pages:getContent")
        return { content: "[]" };
      if (fnName === "users:current") return { _id: CONVEX_USER_ID };
      if (fnName === "github:getConnection") return null;
      return null;
    });

    await deployProject(makeOpts());

    // Should call updateCfSlug mutation
    const cfSlugCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "projects:updateCfSlug"
    );
    expect(cfSlugCalls).toHaveLength(1);
    expect(cfSlugCalls[0][1].projectId).toBe(PROJECT_ID);
    expect(cfSlugCalls[0][1].cfSlug).toBeDefined();
    expect(typeof cfSlugCalls[0][1].cfSlug).toBe("string");
  });

  it("skips index.html from prebuilt assets", async () => {
    await deployProject(makeOpts());

    // The deploy files should not include the prebuilt index.html
    // Check that createDeployment was called with files array
    const deployArgs = mockCreateDeployment.mock.calls[0][0];
    const paths = deployArgs.files.map((f: any) => f.path);
    // Should have our generated index.html, not the prebuilt one
    expect(paths).toContain("index.html"); // our generated shell
    expect(paths).toContain("assets/main.js");
    expect(paths).toContain("assets/main.css");
  });

  it("includes _content JSON and HTML for each MDX page", async () => {
    await deployProject(makeOpts());

    const deployArgs = mockCreateDeployment.mock.calls[0][0];
    const paths = deployArgs.files.map((f: any) => f.path);

    expect(paths).toContain("_content/getting-started.json");
    expect(paths).toContain("docs/getting-started/index.html");
    expect(paths).toContain("_content/guides/api-reference.json");
    expect(paths).toContain("docs/guides/api-reference/index.html");
  });

  it("includes search-index.json and _content/site.json", async () => {
    await deployProject(makeOpts());

    const deployArgs = mockCreateDeployment.mock.calls[0][0];
    const paths = deployArgs.files.map((f: any) => f.path);

    expect(paths).toContain("search-index.json");
    expect(paths).toContain("_content/site.json");
  });

  it("includes _redirects file", async () => {
    await deployProject(makeOpts());

    const deployArgs = mockCreateDeployment.mock.calls[0][0];
    const redirectsFile = deployArgs.files.find(
      (f: any) => f.path === "_redirects"
    );
    expect(redirectsFile).toBeDefined();
    expect(redirectsFile.content).toContain("/docs/*  /docs/index.html  200");
  });

  it("prefixes https:// to deployment URL if missing", async () => {
    mockCreateDeployment.mockResolvedValue({
      ...mockDeploymentResult,
      url: "test-project.pages.dev",
    });

    const result = await deployProject(makeOpts());
    expect(result.url).toBe("https://test-project.pages.dev");
  });

  it("passes logo to site files when logo asset is configured", async () => {
    const projectWithLogo = {
      ...mockProject,
      settings: {
        ...mockProject.settings,
        logoAssetId: "logo_asset_1",
      },
    };

    // Mock logo fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: new Headers({ "content-type": "image/png" }),
    });
    global.fetch = mockFetch as any;

    mockConvexQuery.mockImplementation((fnName: string, args: any) => {
      if (fnName === "projects:get") return projectWithLogo;
      if (fnName === "pages:listByBranch") return mockPages;
      if (fnName === "folders:listByBranch") return mockFolders;
      if (fnName === "pages:getContent") return { content: "[]" };
      if (fnName === "users:current") return { _id: CONVEX_USER_ID };
      if (fnName === "assets:getAssetUrl") {
        if (args.assetId === "logo_asset_1") return "https://r2.example.com/logo.png";
        return null;
      }
      if (fnName === "github:getConnection") return null;
      return null;
    });

    await deployProject(makeOpts());

    // Should include logo file in deploy
    const deployArgs = mockCreateDeployment.mock.calls[0][0];
    const paths = deployArgs.files.map((f: any) => f.path);
    expect(paths).toContain("logo.png");
  });

  it("does not trigger GitHub push if no appUrl provided", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    await deployProject(makeOpts({ appUrl: undefined }));

    // Should NOT call fetch for GitHub push
    const fetchCalls = mockFetch.mock.calls.filter(
      (call: any[]) =>
        typeof call[0] === "string" && call[0].includes("/api/github/push")
    );
    expect(fetchCalls).toHaveLength(0);
  });

  it("handles user lookup failure gracefully (version lacks createdBy)", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "projects:get") return mockProject;
      if (fnName === "pages:listByBranch") return mockPages;
      if (fnName === "folders:listByBranch") return mockFolders;
      if (fnName === "pages:getContent") return { content: "[]" };
      if (fnName === "users:current") throw new Error("User lookup failed");
      if (fnName === "github:getConnection") return null;
      return null;
    });

    // Should not throw — just creates versions without createdBy
    const result = await deployProject(makeOpts());
    expect(result.deploymentId).toBe(DEPLOYMENT_ID);

    const versionCalls = mockConvexMutation.mock.calls.filter(
      ([fn]: [string]) => fn === "pages:createVersion"
    );
    expect(versionCalls[0][1].createdBy).toBeUndefined();
  });

  it("computes folder paths from parent chain", async () => {
    const nestedFolders = [
      {
        _id: "folder_root",
        name: "Root",
        slug: "root",
        path: "/root",
        position: 0,
        parentId: undefined,
        branchId: BRANCH_ID,
      },
      {
        _id: "folder_child",
        name: "Child",
        slug: "child",
        path: "/root/child",
        position: 0,
        parentId: "folder_root",
        branchId: BRANCH_ID,
      },
    ];

    const nestedPages = [
      {
        _id: "page_nested",
        title: "Nested Page",
        slug: "nested",
        path: "/root/child/nested",
        isPublished: true,
        position: 0,
        folderId: "folder_child",
        branchId: BRANCH_ID,
      },
    ];

    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "projects:get") return mockProject;
      if (fnName === "pages:listByBranch") return nestedPages;
      if (fnName === "folders:listByBranch") return nestedFolders;
      if (fnName === "pages:getContent") return { content: "[]" };
      if (fnName === "users:current") return { _id: CONVEX_USER_ID };
      if (fnName === "github:getConnection") return null;
      return null;
    });

    await deployProject(makeOpts());

    // generateSiteFiles should receive page with computed path
    const siteFilesCall = mockGenerateSiteFiles.mock.calls[0];
    const pages = siteFilesCall[0];
    expect(pages[0].path).toBe("/root/child/nested");
  });

  it("passes correct project config to generateSiteFiles", async () => {
    await deployProject(makeOpts());

    const siteFilesCall = mockGenerateSiteFiles.mock.calls[0];
    const config = siteFilesCall[2];
    expect(config.name).toBe("Test Project");
    expect(config.description).toBe("A test project");
    expect(config.theme).toBe("default");
    expect(config.primaryColor).toBe("#3b82f6");
  });
});

describe("rollbackDeployment", () => {
  const mockDeployRecord = {
    _id: DEPLOYMENT_ID,
    projectId: PROJECT_ID,
    status: "ready",
    externalDeploymentId: "cf_deploy_old",
    cfProjectName: "inkloom-test-project-12345",
    url: "https://test-project.pages.dev",
  };

  function makeOpts(overrides?: Partial<RollbackOptions>): RollbackOptions {
    return {
      projectId: PROJECT_ID,
      deploymentId: DEPLOYMENT_ID,
      userId: USER_ID,
      convex: mockConvex(),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "deployments:get") return mockDeployRecord;
      return null;
    });
    mockRollbackDeployment.mockResolvedValue({
      id: "cf_rollback_id",
      url: "https://test-project.pages.dev",
    });
  });

  it("rolls back to a successful deployment", async () => {
    const result = await rollbackDeployment(makeOpts());

    expect(result).toEqual({
      deploymentId: DEPLOYMENT_ID,
      url: "https://test-project.pages.dev",
    });
  });

  it("calls CF rollback with correct project and deployment ID", async () => {
    await rollbackDeployment(makeOpts());

    expect(mockRollbackDeployment).toHaveBeenCalledWith(
      "inkloom-test-project-12345",
      "cf_deploy_old"
    );
  });

  it("updates liveDeploymentId in Convex", async () => {
    await rollbackDeployment(makeOpts());

    expect(mockConvexMutation).toHaveBeenCalledWith(
      "deployments:setLiveDeployment",
      {
        projectId: PROJECT_ID,
        deploymentId: DEPLOYMENT_ID,
      }
    );
  });

  it("throws if deployment is not found", async () => {
    mockConvexQuery.mockImplementation(() => null);

    await expect(rollbackDeployment(makeOpts())).rejects.toThrow(
      "Deployment not found"
    );
  });

  it("throws if deployment belongs to a different project", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "deployments:get")
        return { ...mockDeployRecord, projectId: "other_project" };
      return null;
    });

    await expect(rollbackDeployment(makeOpts())).rejects.toThrow(
      "Deployment does not belong to this project"
    );
  });

  it("throws if deployment status is not 'ready'", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "deployments:get")
        return { ...mockDeployRecord, status: "error" };
      return null;
    });

    await expect(rollbackDeployment(makeOpts())).rejects.toThrow(
      "Can only rollback to a successful deployment"
    );
  });

  it("throws if deployment is missing Cloudflare metadata", async () => {
    mockConvexQuery.mockImplementation((fnName: string) => {
      if (fnName === "deployments:get")
        return {
          ...mockDeployRecord,
          externalDeploymentId: null,
          cfProjectName: null,
        };
      return null;
    });

    await expect(rollbackDeployment(makeOpts())).rejects.toThrow(
      "Deployment is missing Cloudflare metadata"
    );
  });

  it("prefixes https:// to rollback URL if missing", async () => {
    mockRollbackDeployment.mockResolvedValue({
      id: "cf_rollback_id",
      url: "test-project.pages.dev",
    });

    const result = await rollbackDeployment(makeOpts());
    expect(result.url).toBe("https://test-project.pages.dev");
  });
});
