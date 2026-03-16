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
const WEBHOOK_ID = "wh_abc123";

const MOCK_WEBHOOKS = [
  {
    id: "wh_abc123",
    projectId: PROJECT_ID,
    url: "https://example.com/webhook1",
    events: ["deployment.ready"],
    isActive: true,
    createdAt: 1707600000000,
  },
  {
    id: "wh_def456",
    projectId: PROJECT_ID,
    url: "https://example.com/webhook2",
    events: ["deployment.ready", "deployment.error"],
    isActive: true,
    createdAt: 1707500000000,
  },
  {
    id: "wh_ghi789",
    projectId: PROJECT_ID,
    url: "https://example.com/webhook3",
    events: ["deployment.error"],
    isActive: false,
    createdAt: 1707400000000,
  },
];

const MOCK_ADD_RESPONSE = {
  id: "wh_new123",
  projectId: PROJECT_ID,
  url: "https://example.com/new-webhook",
  events: ["deployment.ready", "deployment.error"],
  isActive: true,
  secret: "whsec_abc123def456789012345678901234567890abcdef1234567890abcdef12",
  createdAt: Date.now(),
};

// --- Tests ---

describe("webhooks list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-webhooks-list-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 200,
        body: {
          data: MOCK_WEBHOOKS,
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

  it("should list webhooks in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "webhooks",
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
    assert.ok(stdout.includes("URL"), "Should have URL column header");
    assert.ok(stdout.includes("EVENTS"), "Should have EVENTS column header");
    assert.ok(stdout.includes("ACTIVE"), "Should have ACTIVE column header");
    assert.ok(
      stdout.includes("https://example.com/webhook1"),
      "Should show first webhook URL"
    );
    assert.ok(
      stdout.includes("https://example.com/webhook2"),
      "Should show second webhook URL"
    );
    assert.ok(
      stdout.includes("deployment.ready"),
      "Should show deployment.ready event"
    );
    assert.ok(stdout.includes("yes"), "Should show active status as 'yes'");
    assert.ok(stdout.includes("no"), "Should show inactive status as 'no'");
  });

  it("should list webhooks in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "webhooks",
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
    assert.equal(parsed.data.length, 3, "Should have 3 webhooks");
    assert.equal(parsed.data[0].id, "wh_abc123");
    assert.equal(parsed.data[0].url, "https://example.com/webhook1");
    assert.deepEqual(parsed.data[0].events, ["deployment.ready"]);
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should show empty list message when no webhooks", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "webhooks",
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
        "webhooks",
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

describe("webhooks add", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let receivedBody: string;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-webhooks-add-"));
    receivedBody = "";
    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 201,
        body: { data: MOCK_ADD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_ADD_RESPONSE } };
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

  it("should add a webhook and show ID and secret", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/new-webhook",
        "--events",
        "deployment.ready,deployment.error",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Webhook registered"),
      "Should show success message"
    );
    assert.ok(
      stderr.includes(MOCK_ADD_RESPONSE.id),
      "Should show webhook ID"
    );
    assert.ok(
      stderr.includes(MOCK_ADD_RESPONSE.url),
      "Should show webhook URL"
    );
    assert.ok(
      stderr.includes("whsec_"),
      "Should show the secret"
    );
    assert.ok(
      stderr.includes("Save the secret"),
      "Should warn about saving the secret"
    );
  });

  it("should send url and events in request body", async () => {
    await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/new-webhook",
        "--events",
        "deployment.ready,deployment.error",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    const parsed = JSON.parse(receivedBody);
    assert.equal(
      parsed.url,
      "https://example.com/new-webhook",
      "Should send url in body"
    );
    assert.deepEqual(
      parsed.events,
      ["deployment.ready", "deployment.error"],
      "Should send parsed events array in body"
    );
  });

  it("should trim whitespace from comma-separated events", async () => {
    await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/new-webhook",
        "--events",
        "deployment.ready , deployment.error",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    const parsed = JSON.parse(receivedBody);
    assert.deepEqual(
      parsed.events,
      ["deployment.ready", "deployment.error"],
      "Should trim whitespace from events"
    );
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/new-webhook",
        "--events",
        "deployment.ready",
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
    assert.equal(parsed.data.id, MOCK_ADD_RESPONSE.id);
    assert.equal(parsed.data.url, MOCK_ADD_RESPONSE.url);
    assert.ok(parsed.data.secret, "Should include secret in JSON output");
  });

  it("should fail when --url is missing", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--events",
        "deployment.ready",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --url");
    assert.ok(
      stderr.includes("url") || stderr.includes("required"),
      "Should mention missing url"
    );
  });

  it("should fail when --events is missing", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/webhook",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --events");
    assert.ok(
      stderr.includes("events") || stderr.includes("required"),
      "Should mention missing events"
    );
  });

  it("should handle validation error from API", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "url must use HTTPS",
            details: { field: "url" },
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
          "add",
          PROJECT_ID,
          "--url",
          "https://example.com/webhook",
          "--events",
          "deployment.ready",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code");
      assert.ok(
        stderr.includes("url must use HTTPS"),
        "Should show validation error"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle invalid events error from API", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Invalid event types: invalid.event",
            details: {
              field: "events",
              invalidEvents: ["invalid.event"],
              validEvents: ["deployment.ready", "deployment.error"],
            },
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
          "add",
          PROJECT_ID,
          "--url",
          "https://example.com/webhook",
          "--events",
          "invalid.event",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code");
      assert.ok(
        stderr.includes("Invalid event types"),
        "Should show validation error about events"
      );
    } finally {
      server.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "add",
        PROJECT_ID,
        "--url",
        "https://example.com/webhook",
        "--events",
        "deployment.ready",
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

describe("webhooks remove", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let removeCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-webhooks-remove-"));
    removeCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/webhooks/${WEBHOOK_ID}$`
        ),
        status: 200,
        body: { data: { success: true } },
        handler: () => {
          removeCallCount++;
          return { status: 200, body: { data: { success: true } } };
        },
      },
      {
        method: "DELETE",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/webhooks/wh_nonexistent$`
        ),
        status: 404,
        body: {
          error: { code: "not_found", message: "Webhook not found" },
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

  it("should remove webhook with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "remove",
        PROJECT_ID,
        WEBHOOK_ID,
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
      stderr.includes("removed"),
      "Should show removal confirmation"
    );
    assert.ok(
      stderr.includes(WEBHOOK_ID),
      "Should mention the webhook ID"
    );
    assert.equal(removeCallCount, 1, "Should make DELETE request");
  });

  it("should output JSON when --json and --force flags are used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "webhooks",
        "remove",
        PROJECT_ID,
        WEBHOOK_ID,
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
    assert.ok(parsed.data.success, "Should show success");
  });

  it("should fail in CI without --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "remove",
        PROJECT_ID,
        WEBHOOK_ID,
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
    assert.equal(removeCallCount, 0, "Should NOT make DELETE request");
  });

  it("should handle not found error on remove", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "webhooks",
        "remove",
        PROJECT_ID,
        "wh_nonexistent",
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
        method: "DELETE",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/webhooks/${WEBHOOK_ID}$`
        ),
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions to remove webhook",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
          "remove",
          PROJECT_ID,
          WEBHOOK_ID,
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
        "webhooks",
        "remove",
        PROJECT_ID,
        WEBHOOK_ID,
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

describe("webhooks help", () => {
  it("should show webhooks in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("webhooks"),
      "Should show webhooks command in root help"
    );
  });

  it("should show all subcommands in webhooks help", async () => {
    const { stdout, exitCode } = await runCli(["webhooks", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("add"), "Should show add command");
    assert.ok(stdout.includes("remove"), "Should show remove command");
  });

  it("should show list arguments", async () => {
    const { stdout, exitCode } = await runCli([
      "webhooks",
      "list",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should show add options", async () => {
    const { stdout, exitCode } = await runCli([
      "webhooks",
      "add",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--url"), "Should show --url option");
    assert.ok(stdout.includes("--events"), "Should show --events option");
  });

  it("should show remove options", async () => {
    const { stdout, exitCode } = await runCli([
      "webhooks",
      "remove",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("webhookId"), "Should show webhookId argument");
    assert.ok(stdout.includes("--force"), "Should show --force option");
  });
});

describe("webhooks API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-webhooks-err-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
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
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
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
        "webhooks",
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

  it("should handle JSON error output for remove", async () => {
    const server = await createMockServer([
      {
        method: "DELETE",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/webhooks/${WEBHOOK_ID}$`
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
          "webhooks",
          "remove",
          PROJECT_ID,
          WEBHOOK_ID,
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

describe("webhooks verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-webhooks-verbose-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/webhooks`,
        status: 200,
        body: {
          data: MOCK_WEBHOOKS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "webhooks",
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
