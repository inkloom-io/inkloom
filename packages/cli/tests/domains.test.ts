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

const MOCK_DOMAINS = [
  {
    hostname: "docs.example.com",
    status: "active",
    sslStatus: "active",
    verificationErrors: null,
    createdAt: 1707600000000,
    updatedAt: 1707600005000,
  },
  {
    hostname: "api.example.com",
    status: "pending",
    sslStatus: "pending_validation",
    verificationErrors: null,
    createdAt: 1707500000000,
    updatedAt: 1707500005000,
  },
  {
    hostname: "help.example.com",
    status: "error",
    sslStatus: null,
    verificationErrors: "CNAME record not found",
    createdAt: 1707400000000,
    updatedAt: 1707400005000,
  },
];

const MOCK_DOMAIN_ADD_RESPONSE = {
  hostname: "new-docs.example.com",
  status: "pending",
  sslStatus: null,
  dnsInstructions:
    "Add a CNAME record: new-docs.example.com → your-platform-domain.com",
};

const MOCK_DOMAIN_STATUS = {
  hostname: "docs.example.com",
  status: "active",
  sslStatus: "active",
  verificationErrors: null,
  createdAt: 1707600000000,
  updatedAt: 1707600005000,
};

// --- Tests ---

describe("domains list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-list-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 200,
        body: {
          data: MOCK_DOMAINS,
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

  it("should list domains in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
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
    assert.ok(stdout.includes("HOSTNAME"), "Should have HOSTNAME column header");
    assert.ok(stdout.includes("STATUS"), "Should have STATUS column header");
    assert.ok(stdout.includes("SSL"), "Should have SSL column header");
    assert.ok(stdout.includes("CREATED"), "Should have CREATED column header");
    assert.ok(
      stdout.includes("docs.example.com"),
      "Should show first domain"
    );
    assert.ok(
      stdout.includes("api.example.com"),
      "Should show second domain"
    );
    assert.ok(
      stdout.includes("help.example.com"),
      "Should show third domain"
    );
    assert.ok(stdout.includes("active"), "Should show active status");
    assert.ok(stdout.includes("pending"), "Should show pending status");
  });

  it("should list domains in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
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
    assert.equal(parsed.data.length, 3, "Should have 3 domains");
    assert.equal(parsed.data[0].hostname, "docs.example.com");
    assert.equal(parsed.data[1].hostname, "api.example.com");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should show empty list message when no domains", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "domains",
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
        "domains",
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

describe("domains add", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let receivedBody: string;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-add-"));
    receivedBody = "";
    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 201,
        body: { data: MOCK_DOMAIN_ADD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_DOMAIN_ADD_RESPONSE } };
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

  it("should add a domain and show DNS instructions", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
        "add",
        PROJECT_ID,
        "--hostname",
        "new-docs.example.com",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("new-docs.example.com"),
      "Should mention the hostname"
    );
    assert.ok(
      stderr.includes("added"),
      "Should confirm domain was added"
    );
    assert.ok(
      stderr.includes("CNAME"),
      "Should show DNS instructions"
    );
  });

  it("should send hostname in request body", async () => {
    await runCli(
      [
        "domains",
        "add",
        PROJECT_ID,
        "--hostname",
        "new-docs.example.com",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    const parsed = JSON.parse(receivedBody);
    assert.equal(
      parsed.hostname,
      "new-docs.example.com",
      "Should send hostname in body"
    );
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
        "add",
        PROJECT_ID,
        "--hostname",
        "new-docs.example.com",
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
    assert.equal(parsed.data.hostname, "new-docs.example.com");
    assert.equal(parsed.data.status, "pending");
    assert.ok(parsed.data.dnsInstructions, "Should include DNS instructions");
  });

  it("should fail when --hostname is missing", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
        "add",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --hostname");
    assert.ok(
      stderr.includes("hostname") || stderr.includes("required"),
      "Should mention missing hostname"
    );
  });

  it("should handle conflict error (domain already in use)", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 409,
        body: {
          error: {
            code: "conflict",
            message: "This domain is already in use by another project",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
          "add",
          PROJECT_ID,
          "--hostname",
          "taken.example.com",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code for conflict");
      assert.ok(
        stderr.includes("already in use"),
        "Should show conflict message"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle validation error (invalid hostname)", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message:
              "Invalid hostname. Must be a valid domain (e.g., docs.example.com).",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
          "add",
          PROJECT_ID,
          "--hostname",
          "invalid",
          "--token",
          "ik_live_user_testtoken123456789abcdef",
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code");
      assert.ok(
        stderr.includes("Invalid hostname"),
        "Should show validation error"
      );
    } finally {
      server.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
        "add",
        PROJECT_ID,
        "--hostname",
        "new-docs.example.com",
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

describe("domains status", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-status-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/domains/docs\\.example\\.com$`
        ),
        status: 200,
        body: { data: MOCK_DOMAIN_STATUS },
      },
      {
        method: "GET",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/domains/nonexistent\\.example\\.com$`
        ),
        status: 404,
        body: {
          error: { code: "not_found", message: "Domain not found" },
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

  it("should show domain status in key-value format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
        "status",
        PROJECT_ID,
        "docs.example.com",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stdout: ${stdout}`);
    assert.ok(
      stdout.includes("docs.example.com"),
      "Should show hostname"
    );
    assert.ok(stdout.includes("active"), "Should show status");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
        "status",
        PROJECT_ID,
        "docs.example.com",
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
    assert.equal(parsed.data.hostname, "docs.example.com");
    assert.equal(parsed.data.status, "active");
    assert.equal(parsed.data.sslStatus, "active");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
        "status",
        PROJECT_ID,
        "nonexistent.example.com",
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

  it("should require both projectId and hostname arguments", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
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
        "domains",
        "status",
        PROJECT_ID,
        "docs.example.com",
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

describe("domains remove", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let removeCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-remove-"));
    removeCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: new RegExp(
          `^/api/v1/projects/${PROJECT_ID}/domains/docs\\.example\\.com$`
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
          `^/api/v1/projects/${PROJECT_ID}/domains/nonexistent\\.example\\.com$`
        ),
        status: 404,
        body: {
          error: { code: "not_found", message: "Domain not found" },
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

  it("should remove domain with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "domains",
        "remove",
        PROJECT_ID,
        "docs.example.com",
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
      stderr.includes("docs.example.com"),
      "Should mention the hostname"
    );
    assert.equal(removeCallCount, 1, "Should make DELETE request");
  });

  it("should output JSON when --json and --force flags are used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "domains",
        "remove",
        PROJECT_ID,
        "docs.example.com",
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
        "domains",
        "remove",
        PROJECT_ID,
        "docs.example.com",
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
        "domains",
        "remove",
        PROJECT_ID,
        "nonexistent.example.com",
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
          `^/api/v1/projects/${PROJECT_ID}/domains/docs\\.example\\.com$`
        ),
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions to remove domain",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
          "remove",
          PROJECT_ID,
          "docs.example.com",
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
        "domains",
        "remove",
        PROJECT_ID,
        "docs.example.com",
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

describe("domains help", () => {
  it("should show domains in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("domains"),
      "Should show domains command in root help"
    );
  });

  it("should show all subcommands in domains help", async () => {
    const { stdout, exitCode } = await runCli(["domains", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("add"), "Should show add command");
    assert.ok(stdout.includes("status"), "Should show status command");
    assert.ok(stdout.includes("remove"), "Should show remove command");
  });

  it("should show list arguments", async () => {
    const { stdout, exitCode } = await runCli([
      "domains",
      "list",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should show add options", async () => {
    const { stdout, exitCode } = await runCli([
      "domains",
      "add",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--hostname"), "Should show --hostname option");
  });

  it("should show status arguments", async () => {
    const { stdout, exitCode } = await runCli([
      "domains",
      "status",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("hostname"), "Should show hostname argument");
  });

  it("should show remove options", async () => {
    const { stdout, exitCode } = await runCli([
      "domains",
      "remove",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("hostname"), "Should show hostname argument");
    assert.ok(stdout.includes("--force"), "Should show --force option");
  });
});

describe("domains API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-err-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
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
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
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
        "domains",
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
          `^/api/v1/projects/${PROJECT_ID}/domains/docs\\.example\\.com$`
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
          "domains",
          "remove",
          PROJECT_ID,
          "docs.example.com",
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

describe("domains verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-domains-verbose-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/domains`,
        status: 200,
        body: {
          data: MOCK_DOMAINS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "domains",
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
