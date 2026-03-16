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

// --- Async CLI runner ---

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

const MOCK_FOLDERS = [
  {
    _id: "folder_abc123",
    name: "Getting Started",
    slug: "getting-started",
    parentId: null,
    position: 0,
    branchId: "branch_main",
  },
  {
    _id: "folder_def456",
    name: "API Reference",
    slug: "api-reference",
    parentId: null,
    position: 1,
    branchId: "branch_main",
  },
  {
    _id: "folder_ghi789",
    name: "Quickstart",
    slug: "quickstart",
    parentId: "folder_abc123",
    position: 0,
    branchId: "branch_main",
  },
];

const MOCK_CREATED_FOLDER = {
  _id: "folder_new001",
  name: "Tutorials",
  slug: "tutorials",
  parentId: null,
  position: 3,
  branchId: "branch_main",
};

const PROJECT_ID = "proj_test123";

// --- Tests ---

describe("folders list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-folders-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 200,
        body: {
          data: MOCK_FOLDERS,
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

  it("should list folders in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "folders",
        "list",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr might have info.`);
    assert.ok(stdout.includes("ID"), "Should have ID column header");
    assert.ok(stdout.includes("NAME"), "Should have NAME column header");
    assert.ok(stdout.includes("SLUG"), "Should have SLUG column header");
    assert.ok(stdout.includes("PARENT"), "Should have PARENT column header");
    assert.ok(stdout.includes("POSITION"), "Should have POSITION column header");
    assert.ok(stdout.includes("Getting Started"), "Should show folder name");
    assert.ok(stdout.includes("api-reference"), "Should show folder slug");
    assert.ok(stdout.includes("folder_abc123"), "Should show parent ID for nested folder");
  });

  it("should list folders in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "folders",
        "list",
        PROJECT_ID,
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
    assert.equal(parsed.data.length, 3, "Should have 3 folders");
    assert.equal(parsed.data[0].name, "Getting Started");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should pass branchId from --branch flag to API", async () => {
    let receivedUrl = "";
    const serverWithCapture = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
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
          "folders",
          "list",
          PROJECT_ID,
          "--branch",
          "branch_dev",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          serverWithCapture.url,
        ],
        { HOME: tempHome }
      );
      assert.ok(
        receivedUrl.includes("branchId=branch_dev"),
        `Should pass branchId in URL. Got: ${receivedUrl}`
      );
    } finally {
      serverWithCapture.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["folders", "list", PROJECT_ID, "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should show empty list message when no folders", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "folders",
          "list",
          PROJECT_ID,
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

describe("folders create", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let lastRequestBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-folders-create-"));
    lastRequestBody = {};
    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 201,
        body: { data: MOCK_CREATED_FOLDER },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 201, body: { data: MOCK_CREATED_FOLDER } };
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

  it("should create a folder with --name", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "folders",
        "create",
        PROJECT_ID,
        "--name",
        "Tutorials",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("Folder created"), "Should show success message");
    assert.ok(stderr.includes("Tutorials"), "Should show folder name");
    assert.equal(lastRequestBody.name, "Tutorials");
  });

  it("should pass parentId from --parent flag", async () => {
    await runCli(
      [
        "folders",
        "create",
        PROJECT_ID,
        "--name",
        "Nested Folder",
        "--parent",
        "folder_abc123",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(
      lastRequestBody.parentId,
      "folder_abc123",
      "Should pass parentId in body"
    );
  });

  it("should pass branchId from --branch flag", async () => {
    await runCli(
      [
        "folders",
        "create",
        PROJECT_ID,
        "--name",
        "Branch Folder",
        "--branch",
        "branch_dev",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(
      lastRequestBody.branchId,
      "branch_dev",
      "Should pass branchId in body"
    );
  });

  it("should fail when --name is not provided", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "folders",
        "create",
        PROJECT_ID,
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
        "folders",
        "create",
        PROJECT_ID,
        "--name",
        "Tutorials",
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
    assert.equal(parsed.data.name, "Tutorials");
    assert.equal(parsed.data._id, "folder_new001");
  });

  it("should handle idempotent create (folder already exists)", async () => {
    const idempotentServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 200,
        body: { data: MOCK_FOLDERS[0] },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "folders",
          "create",
          PROJECT_ID,
          "--name",
          "Getting Started",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          idempotentServer.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0, "Should exit 0 for idempotent create");
      assert.ok(stderr.includes("Folder created"), "Should show success message");
    } finally {
      idempotentServer.server.close();
    }
  });

  it("should handle API validation error", async () => {
    const errorServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "name is required",
            details: { field: "name" },
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "folders",
          "create",
          PROJECT_ID,
          "--name",
          "",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          errorServer.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL error code");
      assert.ok(
        stderr.includes("name is required"),
        "Should show validation error message"
      );
    } finally {
      errorServer.server.close();
    }
  });
});

describe("folders delete", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let deleteCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-folders-delete-"));
    deleteCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj_test123\/folders\/folder_abc123$/,
        status: 200,
        body: { data: { success: true } },
        handler: () => {
          deleteCallCount++;
          return { status: 200, body: { data: { success: true } } };
        },
      },
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj_test123\/folders\/nonexistent$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Folder not found" },
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

  it("should delete a folder with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "folders",
        "delete",
        PROJECT_ID,
        "folder_abc123",
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
        "folders",
        "delete",
        PROJECT_ID,
        "folder_abc123",
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
        "folders",
        "delete",
        PROJECT_ID,
        "folder_abc123",
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
        "folders",
        "delete",
        PROJECT_ID,
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

  it("should require both projectId and folderId arguments", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "folders",
        "delete",
        PROJECT_ID,
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without folderId");
    assert.ok(
      stderr.includes("folderId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });
});

describe("folders help", () => {
  it("should show all subcommands in help", async () => {
    const { stdout, exitCode } = await runCli(["folders", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("create"), "Should show create command");
    assert.ok(stdout.includes("delete"), "Should show delete command");
  });

  it("should show list options", async () => {
    const { stdout, exitCode } = await runCli(["folders", "list", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
  });

  it("should show create options", async () => {
    const { stdout, exitCode } = await runCli([
      "folders",
      "create",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--name"), "Should show --name option");
    assert.ok(stdout.includes("--parent"), "Should show --parent option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
  });

  it("should show delete options", async () => {
    const { stdout, exitCode } = await runCli([
      "folders",
      "delete",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--force"), "Should show --force option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("folderId"), "Should show folderId argument");
  });

  it("should show folders in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("folders"), "Should show folders command in root help");
  });
});

describe("folders API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-folders-err-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "folders",
          "list",
          PROJECT_ID,
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
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
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
          "folders",
          "create",
          PROJECT_ID,
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

  it("should handle JSON error output for API errors", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/folders`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "folders",
          "list",
          PROJECT_ID,
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
    } finally {
      server.server.close();
    }
  });
});
