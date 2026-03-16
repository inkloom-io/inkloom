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

const PROJECT_ID = "proj_test123";
const DEPLOYMENT_ID = "deploy_abc123";

const MOCK_DEPLOYMENTS = [
  {
    id: "deploy_abc123",
    projectId: PROJECT_ID,
    branchId: "branch_main001",
    externalDeploymentId: "ext_001",
    url: "https://my-docs.pages.dev",
    status: "ready",
    target: "production",
    error: null,
    createdAt: 1707600000000,
    updatedAt: 1707600005000,
  },
  {
    id: "deploy_def456",
    projectId: PROJECT_ID,
    branchId: "branch_main001",
    externalDeploymentId: "ext_002",
    url: "https://preview-my-docs.pages.dev",
    status: "ready",
    target: "preview",
    error: null,
    createdAt: 1707500000000,
    updatedAt: 1707500005000,
  },
  {
    id: "deploy_ghi789",
    projectId: PROJECT_ID,
    branchId: null,
    externalDeploymentId: "ext_003",
    url: null,
    status: "error",
    target: "production",
    error: "Build failed",
    createdAt: 1707400000000,
    updatedAt: 1707400005000,
  },
];

const MOCK_DEPLOYMENT_DETAIL = {
  id: DEPLOYMENT_ID,
  projectId: PROJECT_ID,
  branchId: "branch_main001",
  externalDeploymentId: "ext_001",
  url: "https://my-docs.pages.dev",
  status: "ready",
  target: "production",
  error: null,
  createdAt: 1707600000000,
  updatedAt: 1707600005000,
};

const MOCK_ROLLBACK_RESPONSE = {
  deploymentId: "deploy_new789",
  url: "https://my-docs.pages.dev",
};

// --- Tests ---

describe("deployments list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deployments-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 200,
        body: {
          data: MOCK_DEPLOYMENTS,
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

  it("should list deployments in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deployments",
        "list",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stdout: ${stdout}`);
    assert.ok(stdout.includes("ID"), "Should have ID column header");
    assert.ok(stdout.includes("STATUS"), "Should have STATUS column header");
    assert.ok(stdout.includes("TARGET"), "Should have TARGET column header");
    assert.ok(stdout.includes("URL"), "Should have URL column header");
    assert.ok(stdout.includes("CREATED"), "Should have CREATED column header");
    assert.ok(
      stdout.includes("deploy_abc123"),
      "Should show first deployment ID"
    );
    assert.ok(
      stdout.includes("deploy_def456"),
      "Should show second deployment ID"
    );
    assert.ok(stdout.includes("ready"), "Should show status");
    assert.ok(stdout.includes("production"), "Should show target");
  });

  it("should list deployments in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deployments",
        "list",
        PROJECT_ID,
        "--json",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.data), "Should have data array");
    assert.equal(parsed.data.length, 3, "Should have 3 deployments");
    assert.equal(parsed.data[0].id, "deploy_abc123");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should pass --limit to the API", async () => {
    let receivedUrl = "";
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 200,
        body: {
          data: [MOCK_DEPLOYMENTS[0]],
          pagination: { cursor: null, hasMore: false },
        },
        handler: (req) => {
          receivedUrl = req.url ?? "";
          return {
            status: 200,
            body: {
              data: [MOCK_DEPLOYMENTS[0]],
              pagination: { cursor: null, hasMore: false },
            },
          };
        },
      },
    ]);

    try {
      await runCli(
        [
          "deployments",
          "list",
          PROJECT_ID,
          "--limit",
          "5",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.ok(
        receivedUrl.includes("limit=5"),
        `Should pass limit in URL. Got: ${receivedUrl}`
      );
    } finally {
      server.server.close();
    }
  });

  it("should pass --target to the API", async () => {
    let receivedUrl = "";
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 200,
        body: {
          data: [MOCK_DEPLOYMENTS[0]],
          pagination: { cursor: null, hasMore: false },
        },
        handler: (req) => {
          receivedUrl = req.url ?? "";
          return {
            status: 200,
            body: {
              data: [MOCK_DEPLOYMENTS[0]],
              pagination: { cursor: null, hasMore: false },
            },
          };
        },
      },
    ]);

    try {
      await runCli(
        [
          "deployments",
          "list",
          PROJECT_ID,
          "--target",
          "production",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.ok(
        receivedUrl.includes("target=production"),
        `Should pass target in URL. Got: ${receivedUrl}`
      );
    } finally {
      server.server.close();
    }
  });

  it("should show empty list message when no deployments", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "deployments",
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

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "list",
        PROJECT_ID,
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
});

describe("deployments status", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-status-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}$`
        ),
        status: 200,
        body: { data: MOCK_DEPLOYMENT_DETAIL },
      },
      {
        method: "GET",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/nonexistent$`
        ),
        status: 404,
        body: {
          error: { code: "not_found", message: "Deployment not found" },
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

  it("should get deployment status in key-value format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deployments",
        "status",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stdout: ${stdout}`);
    assert.ok(stdout.includes(DEPLOYMENT_ID), "Should show deployment ID");
    assert.ok(stdout.includes("ready"), "Should show status");
    assert.ok(
      stdout.includes("https://my-docs.pages.dev"),
      "Should show URL"
    );
    assert.ok(stdout.includes("production"), "Should show target");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deployments",
        "status",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--json",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.id, DEPLOYMENT_ID);
    assert.equal(parsed.data.status, "ready");
    assert.equal(parsed.data.url, "https://my-docs.pages.dev");
    assert.equal(parsed.data.target, "production");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "status",
        PROJECT_ID,
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

  it("should require both projectId and deploymentId arguments", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "status",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without arguments");
    assert.ok(
      stderr.includes("projectId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "status",
        PROJECT_ID,
        DEPLOYMENT_ID,
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
});

describe("deployments rollback", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let rollbackCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-rollback-"));
    rollbackCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "POST",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}/rollback$`
        ),
        status: 200,
        body: { data: MOCK_ROLLBACK_RESPONSE },
        handler: () => {
          rollbackCallCount++;
          return { status: 200, body: { data: MOCK_ROLLBACK_RESPONSE } };
        },
      },
      {
        method: "POST",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/nonexistent/rollback$`
        ),
        status: 404,
        body: {
          error: { code: "not_found", message: "Deployment not found" },
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

  it("should rollback with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Rollback initiated"),
      "Should show rollback success"
    );
    assert.ok(
      stderr.includes("deploy_new789"),
      "Should show new deployment ID"
    );
    assert.equal(rollbackCallCount, 1, "Should make rollback request");
  });

  it("should show URL after rollback when available", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--force",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("https://my-docs.pages.dev"),
      "Should show deployment URL"
    );
  });

  it("should output JSON when --json and --force flags are used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--force",
        "--json",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.deploymentId, "deploy_new789");
    assert.equal(parsed.data.url, "https://my-docs.pages.dev");
  });

  it("should fail in CI without --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
        PROJECT_ID,
        DEPLOYMENT_ID,
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
    assert.equal(rollbackCallCount, 0, "Should NOT make rollback request");
  });

  it("should handle not found error on rollback", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
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

  it("should handle 403 forbidden error", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}/rollback$`
        ),
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions to rollback",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deployments",
          "rollback",
          PROJECT_ID,
          DEPLOYMENT_ID,
          "--force",
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

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "rollback",
        PROJECT_ID,
        DEPLOYMENT_ID,
        "--force",
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
});

describe("deployments help", () => {
  it("should show deployments in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("deployments"),
      "Should show deployments command in root help"
    );
  });

  it("should show all subcommands in deployments help", async () => {
    const { stdout, exitCode } = await runCli(["deployments", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("status"), "Should show status command");
    assert.ok(stdout.includes("rollback"), "Should show rollback command");
  });

  it("should show list options", async () => {
    const { stdout, exitCode } = await runCli([
      "deployments",
      "list",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--limit"), "Should show --limit option");
    assert.ok(stdout.includes("--target"), "Should show --target option");
  });

  it("should show status arguments", async () => {
    const { stdout, exitCode } = await runCli([
      "deployments",
      "status",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(
      stdout.includes("deploymentId"),
      "Should show deploymentId argument"
    );
  });

  it("should show rollback options", async () => {
    const { stdout, exitCode } = await runCli([
      "deployments",
      "rollback",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(
      stdout.includes("deploymentId"),
      "Should show deploymentId argument"
    );
    assert.ok(stdout.includes("--force"), "Should show --force option");
  });
});

describe("deployments API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-err-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should handle 401 unauthorized on list", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deployments",
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

  it("should handle JSON error output for list", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deployments",
          "list",
          PROJECT_ID,
          "--json",
          "--token",
          "ik_live_user_badtoken123456789abcdef",
          "--api-url",
          server.url,
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

  it("should handle network errors gracefully", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deployments",
        "list",
        PROJECT_ID,
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

  it("should handle JSON error output for rollback", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}/rollback$`
        ),
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
          "deployments",
          "rollback",
          PROJECT_ID,
          DEPLOYMENT_ID,
          "--force",
          "--json",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 3);
      const parsed = JSON.parse(stderr);
      assert.ok(parsed.error, "Should have error field");
      assert.equal(parsed.error.code, "forbidden");
    } finally {
      server.server.close();
    }
  });
});

describe("deployments verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-verbose-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 200,
        body: {
          data: MOCK_DEPLOYMENTS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deployments",
          "list",
          PROJECT_ID,
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
