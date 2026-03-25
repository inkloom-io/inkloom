import "./ensure-build.js";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");

// --- Async CLI runner (avoids spawnSync blocking parent event loop) ---

function runCli(
  args: string[],
  env?: Record<string, string>
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 10000);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

// --- Mock server helpers ---

interface MockRoute {
  method: string;
  path: string | RegExp;
  status: number;
  body: unknown;
  handler?: (
    req: IncomingMessage,
    reqBody: string
  ) => { status: number; body: unknown };
}

function createMockServer(
  routes: MockRoute[]
): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        let reqBody = "";
        for await (const chunk of req) {
          reqBody += chunk;
        }

        const matchedRoute = routes.find((route) => {
          const methodMatch = route.method === req.method;
          const pathMatch =
            typeof route.path === "string"
              ? req.url === route.path ||
                req.url?.startsWith(route.path + "?")
              : route.path.test(req.url ?? "");
          return methodMatch && pathMatch;
        });

        if (matchedRoute) {
          let status = matchedRoute.status;
          let body = matchedRoute.body;

          if (matchedRoute.handler) {
            const result = matchedRoute.handler(req, reqBody);
            status = result.status;
            body = result.body;
          }

          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(body));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: { code: "not_found", message: "Route not found" },
            })
          );
        }
      }
    );

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve({ server, url: `http://127.0.0.1:${addr.port}` });
      }
    });
  });
}

// --- Test data ---

const MOCK_PROJECTS = [
  {
    _id: "j57f1234567890abc",
    name: "My API Docs",
    slug: "my-api-docs",
    createdAt: 1706745600000,
    workosOrgId: "org_01ABC",
  },
  {
    _id: "k83g1234567890def",
    name: "Product Guide",
    slug: "product-guide",
    createdAt: 1705276800000,
    workosOrgId: "org_01ABC",
  },
];

const MOCK_PROJECT_DETAIL = {
  _id: "j57f1234567890abc",
  name: "My API Docs",
  slug: "my-api-docs",
  description: "API documentation for our platform",
  createdAt: 1706745600000,
  workosOrgId: "org_01ABC",
  settings: { theme: "default" },
};

// --- Tests ---

describe("projects list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should list projects in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "list",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, "Should exit 0");
    assert.ok(stdout.includes("ID"), "Should have ID column header");
    assert.ok(stdout.includes("NAME"), "Should have NAME column header");
    assert.ok(stdout.includes("SLUG"), "Should have SLUG column header");
    assert.ok(stdout.includes("CREATED"), "Should have CREATED column header");
    assert.ok(stdout.includes("My API Docs"), "Should show project name");
    assert.ok(stdout.includes("my-api-docs"), "Should show project slug");
    assert.ok(stdout.includes("Product Guide"), "Should show second project");
  });

  it("should list projects in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "list",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.data), "Should have data array");
    assert.equal(parsed.data.length, 2, "Should have 2 projects");
    assert.equal(parsed.data[0].name, "My API Docs");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should pass orgId from --org flag to API", async () => {
    let receivedUrl = "";
    const serverWithCapture = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
        handler: (req) => {
          receivedUrl = req.url ?? "";
          return {
            status: 200,
            body: { data: [], pagination: { cursor: null, hasMore: false } },
          };
        },
      },
    ]);

    try {
      await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          serverWithCapture.url,
          "--org",
          "org_01MYORG",
        ],
        { HOME: tempHome }
      );
      assert.ok(
        receivedUrl.includes("orgId=org_01MYORG"),
        `Should pass orgId in URL. Got: ${receivedUrl}`
      );
    } finally {
      serverWithCapture.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["projects", "list", "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should show empty list message when no projects", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          emptyServer.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      assert.ok(
        stdout.includes("No results"),
        "Should show 'No results' for empty list"
      );
    } finally {
      emptyServer.server.close();
    }
  });
});

describe("projects create", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let lastRequestBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-test-"));
    lastRequestBody = {};
    mockServer = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        status: 201,
        body: { data: MOCK_PROJECT_DETAIL },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 201, body: { data: MOCK_PROJECT_DETAIL } };
        },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should create a project with --name", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "create",
        "--name",
        "My API Docs",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Project created"), "Should show success message");
    assert.ok(stderr.includes("My API Docs"), "Should show project name");
    assert.equal(lastRequestBody.name, "My API Docs");
  });

  it("should pass orgId from --org flag", async () => {
    await runCli(
      [
        "projects",
        "create",
        "--name",
        "Test Project",
        "--org",
        "org_01TEST",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(
      lastRequestBody.orgId,
      "org_01TEST",
      "Should pass orgId in body"
    );
  });

  it("should pass description when provided", async () => {
    await runCli(
      [
        "projects",
        "create",
        "--name",
        "Test Project",
        "--description",
        "A test project",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(lastRequestBody.description, "A test project");
  });

  it("should fail when --name is not provided", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "create",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --name");
    assert.ok(
      stderr.includes("--name") || stderr.includes("required"),
      "Should mention --name is required"
    );
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "create",
        "--name",
        "My API Docs",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.name, "My API Docs");
  });

  it("should handle API conflict error (duplicate name)", async () => {
    const conflictServer = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        status: 409,
        body: {
          error: {
            code: "conflict",
            message: "A project with this name already exists",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "create",
          "--name",
          "Duplicate Name",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          conflictServer.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL error code");
      assert.ok(
        stderr.includes("already exists"),
        "Should show conflict error message"
      );
    } finally {
      conflictServer.server.close();
    }
  });
});

describe("projects create orgId auto-resolve", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should auto-resolve orgId from existing projects when --org not set", async () => {
    let lastRequestBody: Record<string, unknown> = {};
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        status: 201,
        body: { data: MOCK_PROJECT_DETAIL },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 201, body: { data: MOCK_PROJECT_DETAIL } };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "create",
          "--name",
          "Auto Org Test",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.equal(
        lastRequestBody.orgId,
        "org_01ABC",
        "Should auto-resolve orgId from projects"
      );
    } finally {
      server.server.close();
    }
  });

  it("should error with helpful message when no projects and no --org", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: [],
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "create",
          "--name",
          "No Org Test",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.notEqual(exitCode, 0, "Should fail");
      assert.ok(
        stderr.includes("Could not determine organization"),
        `Should show helpful error. Got: ${stderr}`
      );
      assert.ok(
        stderr.includes("--org") || stderr.includes("INKLOOM_ORG_ID"),
        "Should mention --org or INKLOOM_ORG_ID"
      );
    } finally {
      server.server.close();
    }
  });

  it("should prefer --org flag over auto-resolve", async () => {
    let lastRequestBody: Record<string, unknown> = {};
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        status: 201,
        body: { data: MOCK_PROJECT_DETAIL },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 201, body: { data: MOCK_PROJECT_DETAIL } };
        },
      },
    ]);

    try {
      await runCli(
        [
          "projects",
          "create",
          "--name",
          "Explicit Org Test",
          "--org",
          "org_EXPLICIT",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(
        lastRequestBody.orgId,
        "org_EXPLICIT",
        "Should use explicit --org flag"
      );
    } finally {
      server.server.close();
    }
  });

  it("should error when multiple orgs found and no --org set", async () => {
    const multiOrgProjects = [
      { ...MOCK_PROJECTS[0], workosOrgId: "org_01AAA" },
      { ...MOCK_PROJECTS[1], workosOrgId: "org_01BBB" },
    ];
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: multiOrgProjects,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "create",
          "--name",
          "Multi Org Test",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.notEqual(exitCode, 0, "Should fail with multiple orgs");
      assert.ok(
        stderr.includes("Could not determine organization"),
        `Should show helpful error. Got: ${stderr}`
      );
    } finally {
      server.server.close();
    }
  });
});

describe("projects get", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/j57f1234567890abc$/,
        status: 200,
        body: { data: MOCK_PROJECT_DETAIL },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/nonexistent$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should get project details in key-value format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "get",
        "j57f1234567890abc",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("My API Docs"), "Should show project name");
    assert.ok(stdout.includes("my-api-docs"), "Should show project slug");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "get",
        "j57f1234567890abc",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data._id, "j57f1234567890abc");
    assert.equal(parsed.data.name, "My API Docs");
    assert.equal(parsed.data.slug, "my-api-docs");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "get",
        "nonexistent",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
    assert.ok(
      stderr.includes("not found") || stderr.includes("not_found"),
      "Should show not found message"
    );
  });

  it("should require projectId argument", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "get",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without projectId");
    assert.ok(
      stderr.includes("projectId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });
});

describe("projects delete", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let deleteCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-test-"));
    deleteCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/j57f1234567890abc$/,
        status: 200,
        body: { data: { success: true } },
        handler: () => {
          deleteCallCount++;
          return { status: 200, body: { data: { success: true } } };
        },
      },
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/nonexistent$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should delete a project with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "delete",
        "j57f1234567890abc",
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("deleted"), "Should show deletion success");
    assert.equal(deleteCallCount, 1, "Should make DELETE request");
  });

  it("should output JSON when --json and --force flags are used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "delete",
        "j57f1234567890abc",
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.success, true);
  });

  it("should fail in CI without --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "delete",
        "j57f1234567890abc",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome, CI: "true" }
    );
    assert.equal(
      exitCode,
      1,
      "Should exit with GENERAL error (confirmation needed)"
    );
    assert.ok(
      stderr.includes("--force") || stderr.includes("Confirmation required"),
      "Should mention --force flag"
    );
    assert.equal(deleteCallCount, 0, "Should NOT make DELETE request");
  });

  it("should handle not found error on delete", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "delete",
        "nonexistent",
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
    assert.ok(
      stderr.includes("not found") || stderr.includes("not_found"),
      "Should show not found error"
    );
  });
});

describe("projects help", () => {
  it("should show all subcommands in help", async () => {
    const { stdout, exitCode } = await runCli(["projects", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("create"), "Should show create command");
    assert.ok(stdout.includes("get"), "Should show get command");
    assert.ok(stdout.includes("delete"), "Should show delete command");
  });

  it("should show list description", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "list",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("List projects"),
      "Should show list description"
    );
  });

  it("should show create options", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "create",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--name"), "Should show --name option");
    assert.ok(
      stdout.includes("--description"),
      "Should show --description option"
    );
  });

  it("should show delete options", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "delete",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--force"), "Should show --force option");
    assert.ok(
      stdout.includes("projectId"),
      "Should show projectId argument"
    );
  });
});

describe("projects API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-err-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should handle 401 unauthorized error", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_badtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 2, "Should exit with AUTH code");
      assert.ok(
        stderr.includes("Invalid API key"),
        "Should show error message"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle 403 forbidden error", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "create",
          "--name",
          "Test",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 3, "Should exit with PERMISSION code");
      assert.ok(
        stderr.includes("Insufficient permissions"),
        "Should show error message"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle 429 rate limit error", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 429,
        body: {
          error: {
            code: "rate_limit_exceeded",
            message: "Rate limit exceeded",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code");
      assert.ok(
        stderr.includes("Rate limit"),
        "Should show rate limit error"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle JSON error output for API errors", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_badtoken123456789abcdef",
          "--api-url",
          server.url,
          "--json",
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 2);
      const parsed = JSON.parse(stderr);
      assert.ok(parsed.error, "Should have error field");
      assert.equal(parsed.error.code, "unauthorized");
      assert.ok(
        parsed.error.message.includes("Invalid API key"),
        "Should include API error message"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle network errors gracefully", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "list",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        "http://127.0.0.1:1",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 1, "Should exit with GENERAL code on network error");
    assert.ok(
      stderr.includes("Network error") || stderr.includes("ECONNREFUSED"),
      "Should show network error"
    );
  });
});

describe("projects verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-proj-verbose-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should show debug output with --verbose flag", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: "/api/v1/projects",
        status: 200,
        body: {
          data: MOCK_PROJECTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "list",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
          "--verbose",
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("[debug]"), "Should show debug prefix");
      assert.ok(stderr.includes("GET"), "Should show HTTP method");
      assert.ok(stderr.includes("200"), "Should show status code");
    } finally {
      server.server.close();
    }
  });
});

// --- Settings test data ---

const MOCK_SETTINGS = {
  theme: "default",
  primaryColor: "#3b82f6",
  logo: "https://example.com/logo.png",
  navTabs: [{ name: "Documentation", path: "/" }],
};

const MOCK_UPDATED_SETTINGS = {
  theme: "midnight",
  primaryColor: "#ff6600",
  logo: "https://example.com/logo.png",
  navTabs: [{ name: "Documentation", path: "/" }],
};

// --- Settings get ---

describe("projects settings get", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-settings-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/settings$/,
        status: 200,
        body: { data: MOCK_SETTINGS },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/nonexistent\/settings$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/empty\/settings$/,
        status: 200,
        body: { data: {} },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should get settings in key-value format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "get",
        "proj123",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stdout: ${stdout}`);
    assert.ok(stdout.includes("default"), "Should show theme value");
    assert.ok(stdout.includes("#3b82f6"), "Should show primary color");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "get",
        "proj123",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.theme, "default");
    assert.equal(parsed.data.primaryColor, "#3b82f6");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "get",
        "nonexistent",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
    assert.ok(
      stderr.includes("not found") || stderr.includes("not_found"),
      "Should show not found message"
    );
  });

  it("should handle empty settings", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "get",
        "empty",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("No data"),
      "Should show 'No data' for empty settings"
    );
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["projects", "settings", "get", "proj123", "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should require projectId argument", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "get",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without projectId");
    assert.ok(
      stderr.includes("projectId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });
});

// --- Settings update ---

describe("projects settings update", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let lastRequestBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-settings-update-"));
    lastRequestBody = {};
    mockServer = await createMockServer([
      {
        method: "PATCH",
        path: /^\/api\/v1\/projects\/proj123\/settings$/,
        status: 200,
        body: { data: MOCK_UPDATED_SETTINGS },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 200, body: { data: MOCK_UPDATED_SETTINGS } };
        },
      },
      {
        method: "PATCH",
        path: /^\/api\/v1\/projects\/nonexistent\/settings$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);
  });

  afterEach(() => {
    mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should update theme setting", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--theme",
        "midnight",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("Settings updated"), "Should show success message");
    assert.equal(lastRequestBody.theme, "midnight", "Should send theme in body");
    assert.equal(lastRequestBody.primaryColor, undefined, "Should NOT send primaryColor when not provided");
  });

  it("should update primary color setting", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--primary-color",
        "#ff6600",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.equal(lastRequestBody.primaryColor, "#ff6600", "Should send primaryColor in body");
    assert.equal(lastRequestBody.theme, undefined, "Should NOT send theme when not provided");
  });

  it("should update multiple settings at once", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--theme",
        "midnight",
        "--primary-color",
        "#ff6600",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.equal(lastRequestBody.theme, "midnight");
    assert.equal(lastRequestBody.primaryColor, "#ff6600");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--theme",
        "midnight",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.theme, "midnight");
  });

  it("should warn when no settings flags provided", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, "Should exit 0 (warning, not error)");
    assert.ok(
      stderr.includes("No settings to update") || stderr.includes("Warning"),
      "Should show warning about no settings"
    );
  });

  it("should warn about logo upload not being supported", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--logo",
        "./logo.png",
        "--theme",
        "midnight",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Logo upload via CLI is not yet supported"),
      "Should warn about logo not being supported"
    );
    // Should still update the other settings
    assert.equal(lastRequestBody.theme, "midnight", "Should still send theme");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "nonexistent",
        "--theme",
        "midnight",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
    assert.ok(
      stderr.includes("not found") || stderr.includes("not_found"),
      "Should show not found message"
    );
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "projects",
        "settings",
        "update",
        "proj123",
        "--theme",
        "midnight",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should only send logo warning without making API call when only --logo is passed", async () => {
    let apiCallMade = false;
    const server = await createMockServer([
      {
        method: "PATCH",
        path: /^\/api\/v1\/projects\/proj123\/settings$/,
        status: 200,
        body: { data: MOCK_SETTINGS },
        handler: () => {
          apiCallMade = true;
          return { status: 200, body: { data: MOCK_SETTINGS } };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "projects",
          "settings",
          "update",
          "proj123",
          "--logo",
          "./logo.png",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      assert.ok(
        stderr.includes("Logo upload via CLI is not yet supported"),
        "Should warn about logo"
      );
      assert.ok(
        stderr.includes("No settings to update"),
        "Should warn about no settings to update"
      );
      assert.equal(apiCallMade, false, "Should NOT make API call when only logo is passed");
    } finally {
      server.server.close();
    }
  });
});

// --- Settings help ---

describe("projects settings help", () => {
  it("should show settings subcommands in help", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "settings",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("get"), "Should show get command");
    assert.ok(stdout.includes("update"), "Should show update command");
  });

  it("should show settings in projects help", async () => {
    const { stdout, exitCode } = await runCli(["projects", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("settings"), "Should show settings command group");
  });

  it("should show update options", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "settings",
      "update",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--theme"), "Should show --theme option");
    assert.ok(stdout.includes("--primary-color"), "Should show --primary-color option");
    assert.ok(stdout.includes("--logo"), "Should show --logo option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should show get requires projectId", async () => {
    const { stdout, exitCode } = await runCli([
      "projects",
      "settings",
      "get",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });
});
