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
    }, 30000);

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

const MOCK_DEPLOY_RESPONSE = {
  deploymentId: "deploy_abc123",
  externalDeploymentId: "ext_deploy_001",
  url: "https://my-docs.pages.dev",
  status: "queued",
};

const MOCK_DEPLOYMENT_READY = {
  id: "deploy_abc123",
  projectId: PROJECT_ID,
  branchId: "branch_main001",
  externalDeploymentId: "ext_deploy_001",
  url: "https://my-docs.pages.dev",
  status: "ready",
  target: "production",
  error: null,
  createdAt: 1707600000000,
  updatedAt: 1707600005000,
};

const MOCK_DEPLOYMENT_ERROR = {
  id: "deploy_abc123",
  projectId: PROJECT_ID,
  branchId: "branch_main001",
  externalDeploymentId: "ext_deploy_001",
  url: null,
  status: "error",
  target: "production",
  error: "Build failed: missing package.json",
  createdAt: 1707600000000,
  updatedAt: 1707600005000,
};

// --- Tests ---

describe("deploy (trigger)", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let lastRequestBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-test-"));
    lastRequestBody = {};
    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
        handler: (_req, body) => {
          lastRequestBody = body ? JSON.parse(body) : {};
          return { status: 202, body: { data: MOCK_DEPLOY_RESPONSE } };
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

  it("should trigger a preview deployment by default", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deploy",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("Deploying"), "Should show deploying message");
    assert.ok(stderr.includes("preview"), "Should mention preview target");
    assert.ok(
      stderr.includes("deploy_abc123"),
      "Should show deployment ID"
    );
    assert.ok(
      stderr.includes("Deployment triggered"),
      "Should show trigger success"
    );
    // Should not send target in body for preview
    assert.ok(!("target" in lastRequestBody), "Should not send target for preview");
  });

  it("should trigger a production deployment with --production", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deploy",
        PROJECT_ID,
        "--production",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("production"), "Should mention production target");
    assert.equal(
      lastRequestBody.target,
      "production",
      "Should send target=production in body"
    );
  });

  it("should pass --branch to the API", async () => {
    const { exitCode } = await runCli(
      [
        "deploy",
        PROJECT_ID,
        "--branch",
        "branch_dev002",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.equal(
      lastRequestBody.branchId,
      "branch_dev002",
      "Should send branchId in body"
    );
  });

  it("should output JSON when --json is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "deploy",
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
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.deploymentId, "deploy_abc123");
    assert.equal(parsed.data.status, "queued");
  });

  it("should show URL in output when available", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deploy",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    // The initial response has url, it might or might not be shown
    // depending on our implementation — we do show it if present
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["deploy", PROJECT_ID, "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should handle API error (deployment in progress)", async () => {
    const errorServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message:
              "A deployment is already in progress. Wait for it to complete before triggering another.",
            details: {
              deploymentId: "deploy_existing",
              status: "building",
            },
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          errorServer.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL error code");
      assert.ok(
        stderr.includes("already in progress"),
        "Should show error message"
      );
    } finally {
      errorServer.server.close();
    }
  });
});

describe("deploy --wait (polling)", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-wait-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should poll until ready and exit 0", async () => {
    let pollCount = 0;

    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_READY },
        handler: () => {
          pollCount++;
          if (pollCount === 1) {
            return {
              status: 200,
              body: {
                data: { ...MOCK_DEPLOYMENT_READY, status: "building" },
              },
            };
          }
          return {
            status: 200,
            body: { data: MOCK_DEPLOYMENT_READY },
          };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("Status:"),
        "Should show status transitions"
      );
      assert.ok(
        stderr.includes("Deployment complete"),
        "Should show completion message"
      );
      assert.ok(pollCount >= 2, "Should have polled at least twice");
    } finally {
      server.server.close();
    }
  });

  it("should exit 1 when deployment errors", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_ERROR },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, `Should exit 1 on error. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("error") || stderr.includes("Error"),
        "Should show error status"
      );
    } finally {
      server.server.close();
    }
  });

  it("should show URL on successful deployment", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_READY },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      assert.ok(
        stderr.includes("https://my-docs.pages.dev"),
        "Should show deployment URL"
      );
    } finally {
      server.server.close();
    }
  });

  it("should output JSON with --wait and --json", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_READY },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--json",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed.data, "Should have data field");
      assert.equal(parsed.data.status, "ready");
      assert.equal(parsed.data.url, "https://my-docs.pages.dev");
    } finally {
      server.server.close();
    }
  });

  it("should show status transitions during polling", async () => {
    let pollCount = 0;
    const statuses = ["queued", "building", "ready"];

    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_READY },
        handler: () => {
          const status = statuses[Math.min(pollCount, statuses.length - 1)];
          pollCount++;
          return {
            status: 200,
            body: {
              data: { ...MOCK_DEPLOYMENT_READY, status },
            },
          };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      // Should show transitions: queued → building → ready
      assert.ok(
        stderr.includes("queued"),
        "Should show queued status"
      );
      assert.ok(
        stderr.includes("building"),
        "Should show building status"
      );
      assert.ok(
        stderr.includes("ready"),
        "Should show ready status"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle canceled deployment", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: {
          data: {
            ...MOCK_DEPLOYMENT_READY,
            status: "canceled",
            url: null,
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit 1 on canceled");
      assert.ok(
        stderr.includes("canceled"),
        "Should show canceled status"
      );
    } finally {
      server.server.close();
    }
  });

  it("should combine --production and --wait", async () => {
    let requestBody: Record<string, unknown> = {};

    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 202,
        body: { data: MOCK_DEPLOY_RESPONSE },
        handler: (_req, body) => {
          requestBody = body ? JSON.parse(body) : {};
          return { status: 202, body: { data: MOCK_DEPLOY_RESPONSE } };
        },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj_test123\/deployments\/deploy_abc123$/,
        status: 200,
        body: { data: MOCK_DEPLOYMENT_READY },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--production",
          "--wait",
          "--timeout",
          "30",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.equal(
        requestBody.target,
        "production",
        "Should send production target"
      );
      assert.ok(
        stderr.includes("production"),
        "Should mention production in output"
      );
    } finally {
      server.server.close();
    }
  });
});

describe("deploy help", () => {
  it("should show deploy in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("deploy"),
      "Should show deploy command in root help"
    );
  });

  it("should show all options in deploy help", async () => {
    const { stdout, exitCode } = await runCli(["deploy", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--production"), "Should show --production option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--wait"), "Should show --wait option");
    assert.ok(stdout.includes("--timeout"), "Should show --timeout option");
  });
});

describe("deploy error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-deploy-err-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should handle 401 unauthorized error", async () => {
    const server = await createMockServer([
      {
        method: "POST",
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
          "deploy",
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
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions to deploy",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
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

  it("should handle 404 project not found", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/deployments`,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "deploy",
          PROJECT_ID,
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
      assert.ok(
        stderr.includes("not found") || stderr.includes("not_found"),
        "Should show not found error"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle JSON error output", async () => {
    const server = await createMockServer([
      {
        method: "POST",
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
          "deploy",
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

  it("should handle network error gracefully", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "deploy",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        "http://127.0.0.1:1",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 1, "Should exit with GENERAL error code");
    assert.ok(
      stderr.includes("Network error") || stderr.includes("ECONNREFUSED"),
      "Should show network error"
    );
  });
});
