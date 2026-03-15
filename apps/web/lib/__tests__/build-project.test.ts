import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Mock Convex API refs (must be before any imports that use them)
// ---------------------------------------------------------------------------

vi.mock("@/convex/_generated/api", () => ({
  api: {
    projects: { get: "projects:get" },
    deployments: {
      create: "deployments:create",
      updateStatus: "deployments:updateStatus",
      updateBuildPhase: "deployments:updateBuildPhase",
    },
    pages: {
      listByBranch: "pages:listByBranch",
      getContent: "pages:getContent",
    },
    folders: { listByBranch: "folders:listByBranch" },
  },
}));

vi.mock("@/convex/_generated/dataModel", () => ({
  default: {} as any,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(),
}));

vi.mock("../generate-site", () => ({
  generateSiteFiles: vi.fn().mockResolvedValue({
    files: [{ file: "index.html", data: "<html></html>" }],
  }),
}));

// ---------------------------------------------------------------------------
// Mock Convex client
// ---------------------------------------------------------------------------

interface MockConvexClient {
  query: ReturnType<typeof vi.fn>;
  mutation: ReturnType<typeof vi.fn>;
}

function createMockConvex(data: {
  project?: Record<string, unknown> | null;
  pages?: Array<Record<string, unknown>>;
  folders?: Array<Record<string, unknown>>;
  pageContents?: Record<string, { content: string }>;
}): MockConvexClient {
  const queryFn = vi.fn().mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
    // Route based on args pattern
    if (args && "projectId" in args && !("branchId" in args) && !("pageId" in args)) {
      return data.project ?? null;
    }
    if (args && "branchId" in args && !("pageId" in args)) {
      // listByBranch — use call count to differentiate pages vs folders
      const branchCalls = queryFn.mock.calls.filter(
        (c: unknown[]) => (c[1] as Record<string, unknown>)?.branchId === args.branchId
      );
      if (branchCalls.length <= 1) return data.pages ?? [];
      return data.folders ?? [];
    }
    if (args && "pageId" in args) {
      return data.pageContents?.[args.pageId as string] ?? null;
    }
    return null;
  });

  return {
    query: queryFn,
    mutation: vi.fn().mockResolvedValue("mock_deployment_id"),
  };
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    _id: "proj_test",
    name: "Test Project",
    slug: "test-project",
    workosOrgId: "local",
    defaultBranchId: "branch_main",
    ...overrides,
  };
}

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    _id: "page_1",
    branchId: "branch_main",
    title: "Getting Started",
    slug: "getting-started",
    path: "/getting-started",
    position: 0,
    isPublished: true,
    ...overrides,
  };
}

const sampleBlockNoteContent = JSON.stringify([
  {
    id: "1",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "Hello world", styles: {} }],
    children: [],
  },
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildProject", () => {
  let testOutDir: string;

  beforeEach(() => {
    testOutDir = join(tmpdir(), `inkloom-build-test-${Date.now()}`);
  });

  afterEach(() => {
    if (existsSync(testOutDir)) {
      rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it("throws if project is not found", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({ project: null });

    await expect(
      buildProject(convex as never, {
        projectId: "nonexistent" as never,
        outDir: testOutDir,
      })
    ).rejects.toThrow("Project not found");
  });

  it("throws if project has no default branch and none specified", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject({ defaultBranchId: undefined }),
    });

    await expect(
      buildProject(convex as never, {
        projectId: "proj_test" as never,
        outDir: testOutDir,
      })
    ).rejects.toThrow("no default branch");
  });

  it("creates a deployment record before building", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [makePage()],
      folders: [],
      pageContents: {
        page_1: { content: sampleBlockNoteContent },
      },
    });

    await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
    });

    // First mutation call should be deployments.create
    expect(convex.mutation).toHaveBeenCalled();
    const firstCall = convex.mutation.mock.calls[0]!;
    expect(firstCall[1]).toMatchObject({
      projectId: "proj_test",
      branchId: "branch_main",
    });
  });

  it("generates files in the output directory", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [makePage()],
      folders: [],
      pageContents: {
        page_1: { content: sampleBlockNoteContent },
      },
    });

    const result = await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
    });

    expect(result.pageCount).toBe(1);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.outDir).toBe(testOutDir);
    expect(existsSync(testOutDir)).toBe(true);
  });

  it("updates deployment status to ready on success", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [makePage()],
      folders: [],
      pageContents: {
        page_1: { content: sampleBlockNoteContent },
      },
    });

    await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
    });

    // Last mutation call should be updateStatus with "ready"
    const mutationCalls = convex.mutation.mock.calls;
    const lastCall = mutationCalls[mutationCalls.length - 1]!;
    expect(lastCall[1]).toMatchObject({
      deploymentId: "mock_deployment_id",
      status: "ready",
    });
  });

  it("updates deployment status to error on failure", async () => {
    const { buildProject } = await import("../build-project");

    // Override: first query returns project, second throws
    let callCount = 0;
    const convex: MockConvexClient = {
      query: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeProject();
        throw new Error("Simulated Convex error");
      }),
      mutation: vi.fn().mockResolvedValue("mock_deployment_id"),
    };

    await expect(
      buildProject(convex as never, {
        projectId: "proj_test" as never,
        outDir: testOutDir,
      })
    ).rejects.toThrow("Simulated Convex error");

    // Should have called mutation to set error status
    const mutationCalls = convex.mutation.mock.calls;
    const lastCall = mutationCalls[mutationCalls.length - 1]!;
    expect(lastCall[1]).toMatchObject({
      deploymentId: "mock_deployment_id",
      status: "error",
    });
  });

  it("handles empty project (no pages)", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [],
      folders: [],
      pageContents: {},
    });

    const result = await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
    });

    expect(result.pageCount).toBe(0);
    expect(result.fileCount).toBeGreaterThan(0); // still has theme.css, navigation.json, etc.
  });

  it("uses specified branchId instead of default", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [],
      folders: [],
      pageContents: {},
    });

    await buildProject(convex as never, {
      projectId: "proj_test" as never,
      branchId: "branch_feature" as never,
      outDir: testOutDir,
    });

    // The deployment create should use the specified branchId
    const firstMutationCall = convex.mutation.mock.calls[0]!;
    expect(firstMutationCall[1]).toMatchObject({
      branchId: "branch_feature",
    });
  });

  it("returns deploymentId in result", async () => {
    const { buildProject } = await import("../build-project");
    const convex = createMockConvex({
      project: makeProject(),
      pages: [],
      folders: [],
      pageContents: {},
    });

    const result = await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
    });

    expect(result.deploymentId).toBe("mock_deployment_id");
  });

  it("cleans output directory by default", async () => {
    const { buildProject } = await import("../build-project");

    // Create a stale file in the output dir
    mkdirSync(testOutDir, { recursive: true });
    writeFileSync(join(testOutDir, "stale-file.txt"), "old content");

    const convex = createMockConvex({
      project: makeProject(),
      pages: [],
      folders: [],
      pageContents: {},
    });

    await buildProject(convex as never, {
      projectId: "proj_test" as never,
      outDir: testOutDir,
      clean: true,
    });

    expect(existsSync(join(testOutDir, "stale-file.txt"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deploy adapter getPublishEndpoint tests
// ---------------------------------------------------------------------------

describe("deploy adapter getPublishEndpoint", () => {
  it("core adapter returns /api/build", async () => {
    const { deployAdapter } = await import("../adapters/deploy.core");
    expect(deployAdapter.getPublishEndpoint("proj_123")).toBe("/api/build");
  });

  it("core adapter endpoint is constant regardless of projectId", async () => {
    const { deployAdapter } = await import("../adapters/deploy.core");
    expect(deployAdapter.getPublishEndpoint("proj_1")).toBe(
      deployAdapter.getPublishEndpoint("proj_2")
    );
  });
});

// ---------------------------------------------------------------------------
// API route handler tests (unit-level)
// ---------------------------------------------------------------------------

describe("/api/build route handler", () => {
  it("returns 400 when projectId is missing", async () => {
    const { POST } = await import("../../app/api/build/route");
    const request = new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.message).toContain("projectId");
  });

  it("returns 400 when projectId is not a string", async () => {
    const { POST } = await import("../../app/api/build/route");
    const request = new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: 123 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 when NEXT_PUBLIC_CONVEX_URL is not set", async () => {
    const origUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    try {
      const { POST } = await import("../../app/api/build/route");
      const request = new Request("http://localhost/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "proj_test" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.message).toContain("CONVEX_URL");
    } finally {
      if (origUrl) process.env.NEXT_PUBLIC_CONVEX_URL = origUrl;
    }
  });

  it("handles malformed JSON gracefully", async () => {
    const { POST } = await import("../../app/api/build/route");
    const request = new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    // Should return 400 because body.projectId is missing
    expect(response.status).toBe(400);
  });
});
