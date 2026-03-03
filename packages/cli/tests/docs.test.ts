import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");

// --- Sync CLI runner for quick tests ---

function runCliSync(
  args: string[],
  env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 10000,
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// --- Async CLI runner for longer operations ---

function runCli(
  args: string[],
  env?: Record<string, string>,
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
    reqBody: string,
  ) => { status: number; body: unknown };
}

function createMockServer(
  routes: MockRoute[],
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
            }),
          );
        }
      },
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
const TOKEN = "ik_live_user_testtoken123456789abcdef";

// ─── Help Text Tests ────────────────────────────────────────────

describe("docs help", () => {
  it("should show docs in root help", () => {
    const { stdout, exitCode } = runCliSync(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("docs"), "Should show docs command in root help");
  });

  it("should show all docs subcommands in docs --help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("generate"), "Should show generate subcommand");
    assert.ok(stdout.includes("plan"), "Should show plan subcommand");
    assert.ok(stdout.includes("status"), "Should show status subcommand");
    assert.ok(stdout.includes("approve"), "Should show approve subcommand");
  });

  it("should show all options in docs generate --help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "generate", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--codebase"), "Should show --codebase option");
    assert.ok(stdout.includes("--description"), "Should show --description option");
    assert.ok(stdout.includes("--audience"), "Should show --audience option");
    assert.ok(stdout.includes("--mode"), "Should show --mode option");
    assert.ok(stdout.includes("--model"), "Should show --model option");
    assert.ok(stdout.includes("--config"), "Should show --config option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--dry-run"), "Should show --dry-run option");
    assert.ok(stdout.includes("--publish"), "Should show --publish option");
    assert.ok(stdout.includes("--openrouter-key"), "Should show --openrouter-key option");
    assert.ok(stdout.includes("--budget"), "Should show --budget option");
  });

  it("should show examples in docs generate help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "generate", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Examples:"), "Should show examples section");
    assert.ok(stdout.includes("--codebase ./my-project"), "Should show codebase example");
  });

  it("should show all options in docs plan --help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "plan", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--codebase"), "Should show --codebase option");
    assert.ok(stdout.includes("--description"), "Should show --description option");
    assert.ok(stdout.includes("--openrouter-key"), "Should show --openrouter-key option");
  });

  it("should show docs status help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "status", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("Check the status"), "Should show description");
  });

  it("should show docs approve help with optional jobId", () => {
    const { stdout, exitCode } = runCliSync(["docs", "approve", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("[jobId]"), "Should show optional jobId argument");
    assert.ok(stdout.includes("--pages"), "Should show --pages option");
  });
});

// ─── Generate Validation Tests ──────────────────────────────────

describe("docs generate validation", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should fail without OpenRouter API key", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      {
        HOME: tempHome,
        OPENROUTER_API_KEY: "",
        INKLOOM_OPENROUTER_KEY: "",
      },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("OpenRouter API key required"),
      "Should show API key error",
    );
  });

  it("should accept OPENROUTER_API_KEY env var", async () => {
    // This will fail later (connecting to the AI engine), but should NOT fail at key validation
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      {
        HOME: tempHome,
        OPENROUTER_API_KEY: "sk-or-v1-test1234567890123456",
      },
    );
    // Should not fail with "API key required" — it should fail later
    assert.ok(
      !stderr.includes("OpenRouter API key required"),
      "Should accept OPENROUTER_API_KEY env var",
    );
  });

  it("should accept INKLOOM_OPENROUTER_KEY env var", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      {
        HOME: tempHome,
        OPENROUTER_API_KEY: "",
        INKLOOM_OPENROUTER_KEY: "sk-or-v1-test1234567890123456",
      },
    );
    assert.ok(
      !stderr.includes("OpenRouter API key required"),
      "Should accept INKLOOM_OPENROUTER_KEY env var",
    );
  });

  it("should reject unsupported model ID", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--model", "unsupported/model-xyz",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes('Unsupported model: "unsupported/model-xyz"'),
      "Should show unsupported model error",
    );
    assert.ok(
      stderr.includes("Available models:"),
      "Should list available models",
    );
    assert.ok(
      stderr.includes("anthropic/claude-sonnet-4.5"),
      "Should list Claude Sonnet as available",
    );
  });

  it("should reject invalid API key format", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--openrouter-key", "short",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Invalid API key"),
      "Should show invalid key error",
    );
  });

  it("should fail without product description", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Product description is required"),
      "Should require product description",
    );
  });

  it("should fail with non-existent codebase path", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", "/nonexistent/path/to/project",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Codebase path not found") || stderr.includes("not found") || stderr.includes("does not exist"),
      "Should show codebase not found error",
    );
  });

  it("should load config from .inkloom/docs.yml when present", async () => {
    const codebasePath = mkdtempSync(join(tmpdir(), "inkloom-codebase-"));
    const configDir = join(codebasePath, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "docs.yml"),
      `product:
  description: "Config file description"
  audience: private
ai:
  mode: fast
  model: anthropic/claude-sonnet-4.5
`,
    );
    // Create a minimal file so it's not empty
    writeFileSync(join(codebasePath, "index.ts"), "export const x = 1;\n");

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "generate", PROJECT_ID,
          "--codebase", codebasePath,
          "--openrouter-key", "sk-or-v1-test1234567890123456",
          "--token", TOKEN,
          "--api-url", "http://127.0.0.1:1",
        ],
        { HOME: tempHome },
      );
      // Should recognize the config file (even if it fails later)
      assert.ok(
        stderr.includes("Config:") || stderr.includes("docs.yml"),
        `Should show config file was loaded. stderr: ${stderr}`,
      );
    } finally {
      rmSync(codebasePath, { recursive: true, force: true });
    }
  });

  it("should accept --config to specify custom config path", async () => {
    const codebasePath = mkdtempSync(join(tmpdir(), "inkloom-codebase-"));
    const configPath = join(tempHome, "custom-docs.yml");
    writeFileSync(
      configPath,
      `product:
  description: "Custom config description"
  audience: public
ai:
  mode: fast
`,
    );
    writeFileSync(join(codebasePath, "index.ts"), "export const x = 1;\n");

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "generate", PROJECT_ID,
          "--codebase", codebasePath,
          "--config", configPath,
          "--openrouter-key", "sk-or-v1-test1234567890123456",
          "--token", TOKEN,
          "--api-url", "http://127.0.0.1:1",
        ],
        { HOME: tempHome },
      );
      // Should show it loaded the custom config
      assert.ok(
        stderr.includes("Config:") && stderr.includes("custom-docs.yml"),
        `Should load custom config. stderr: ${stderr}`,
      );
    } finally {
      rmSync(codebasePath, { recursive: true, force: true });
    }
  });

  it("should override config with CLI flags", async () => {
    const codebasePath = mkdtempSync(join(tmpdir(), "inkloom-codebase-"));
    const configDir = join(codebasePath, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "docs.yml"),
      `product:
  description: "Config description"
ai:
  mode: extended
`,
    );
    writeFileSync(join(codebasePath, "index.ts"), "export const x = 1;\n");

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "generate", PROJECT_ID,
          "--codebase", codebasePath,
          "--mode", "fast",
          "--openrouter-key", "sk-or-v1-test1234567890123456",
          "--token", TOKEN,
          "--api-url", "http://127.0.0.1:1",
        ],
        { HOME: tempHome },
      );
      // The --mode flag should override config. Even if the command fails,
      // the display should show "fast" mode since the flag takes precedence.
      assert.ok(
        stderr.includes("Mode: fast"),
        `Should show fast mode from CLI flag override. stderr: ${stderr}`,
      );
    } finally {
      rmSync(codebasePath, { recursive: true, force: true });
    }
  });
});

// ─── Status Command Tests ───────────────────────────────────────

describe("docs status", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-status-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should display job status from API", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/generate`,
        status: 200,
        body: {
          data: {
            jobs: [
              {
                id: "job_abc123",
                status: "completed",
                mode: "generate",
                model: "anthropic/claude-sonnet-4.5",
                progress: {
                  plannedPages: 10,
                  writtenPages: 10,
                  currentPhase: "completed",
                },
                inputTokens: 150000,
                outputTokens: 50000,
                estimatedCostCents: 120,
                startedAt: 1707600000000,
                completedAt: 1707600060000,
                createdAt: 1707600000000,
              },
            ],
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "status", PROJECT_ID,
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(stderr.includes("job_abc123"), "Should show job ID");
      assert.ok(stderr.includes("completed"), "Should show status");
      assert.ok(stderr.includes("claude-sonnet-4.5"), "Should show model");
      assert.ok(stderr.includes("10/10"), "Should show page progress");
      assert.ok(stderr.includes("200,000"), "Should show token count");
      assert.ok(stderr.includes("$1.20"), "Should show cost");
    } finally {
      server.server.close();
    }
  });

  it("should handle no jobs found", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/generate`,
        status: 200,
        body: { data: { jobs: [] } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "status", PROJECT_ID,
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("No generation jobs found"),
        "Should show no jobs message",
      );
    } finally {
      server.server.close();
    }
  });

  it("should output JSON with --json flag", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/generate`,
        status: 200,
        body: {
          data: {
            jobs: [
              {
                id: "job_abc123",
                status: "writing",
                mode: "generate",
                model: "anthropic/claude-sonnet-4.5",
                progress: { plannedPages: 5, writtenPages: 2 },
                createdAt: 1707600000000,
              },
            ],
          },
        },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "docs", "status", PROJECT_ID,
          "--json",
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed.data, "Should have data field");
      assert.ok(parsed.data.jobs, "Should have jobs array");
      assert.equal(parsed.data.jobs[0].id, "job_abc123");
    } finally {
      server.server.close();
    }
  });

  it("should show error message for failed jobs", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/generate`,
        status: 200,
        body: {
          data: {
            jobs: [
              {
                id: "job_fail",
                status: "failed",
                mode: "generate",
                model: "anthropic/claude-sonnet-4.5",
                progress: {},
                error: "Budget exceeded after 100K tokens",
                createdAt: 1707600000000,
              },
            ],
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "status", PROJECT_ID,
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("failed"), "Should show failed status");
      assert.ok(
        stderr.includes("Budget exceeded"),
        "Should show error message",
      );
    } finally {
      server.server.close();
    }
  });
});

// ─── Approve Command Tests ──────────────────────────────────────

describe("docs approve", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-approve-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should approve all pages from latest job", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/generate/latest/approve`,
        status: 200,
        body: { data: { approved: 5, published: 5 } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "approve", PROJECT_ID,
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("Approved 5 pages"),
        "Should show approved count",
      );
      assert.ok(
        stderr.includes("published 5 pages"),
        "Should show published count",
      );
    } finally {
      server.server.close();
    }
  });

  it("should approve specific job ID", async () => {
    let requestPath = "";
    const server = await createMockServer([
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj_test123\/generate\/job_xyz\/approve$/,
        status: 200,
        body: { data: { approved: 3, published: 3 } },
        handler: (req) => {
          requestPath = req.url ?? "";
          return { status: 200, body: { data: { approved: 3, published: 3 } } };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "approve", PROJECT_ID, "job_xyz",
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        requestPath.includes("job_xyz"),
        "Should send request to specific job ID",
      );
    } finally {
      server.server.close();
    }
  });

  it("should output JSON with --json flag", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/generate/latest/approve`,
        status: 200,
        body: { data: { approved: 2, published: 2 } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "docs", "approve", PROJECT_ID,
          "--json",
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed.data, "Should have data field");
      assert.equal(parsed.data.approved, 2);
      assert.equal(parsed.data.published, 2);
    } finally {
      server.server.close();
    }
  });

  it("should handle singular page count", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/generate/latest/approve`,
        status: 200,
        body: { data: { approved: 1, published: 1 } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "docs", "approve", PROJECT_ID,
          "--token", TOKEN,
          "--api-url", server.url,
        ],
        { HOME: tempHome },
      );
      assert.equal(exitCode, 0);
      // Should use singular "page" not "pages"
      assert.ok(
        stderr.includes("1 page,") || stderr.includes("1 page\n"),
        "Should use singular for 1 page",
      );
    } finally {
      server.server.close();
    }
  });
});

// ─── Plan Command Tests ─────────────────────────────────────────

describe("docs plan validation", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-plan-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should fail without OpenRouter API key", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "plan", PROJECT_ID,
        "--description", "A test project",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      {
        HOME: tempHome,
        OPENROUTER_API_KEY: "",
        INKLOOM_OPENROUTER_KEY: "",
      },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("OpenRouter API key required"),
      "Should show API key error",
    );
  });

  it("should fail without product description", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "plan", PROJECT_ID,
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Product description is required"),
      "Should require product description",
    );
  });

  it("should reject unsupported model", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "plan", PROJECT_ID,
        "--description", "A test",
        "--model", "fake/model",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("Unsupported model"), "Should reject unsupported model");
  });
});

// ─── Auth Error Tests ───────────────────────────────────────────

describe("docs auth errors", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-auth-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should fail without InkLoom token for status", async () => {
    const { stderr, exitCode } = await runCli(
      ["docs", "status", PROJECT_ID, "--api-url", "http://127.0.0.1:1"],
      { HOME: tempHome, INKLOOM_TOKEN: "" },
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error",
    );
  });

  it("should fail without InkLoom token for approve", async () => {
    const { stderr, exitCode } = await runCli(
      ["docs", "approve", PROJECT_ID, "--api-url", "http://127.0.0.1:1"],
      { HOME: tempHome, INKLOOM_TOKEN: "" },
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
  });
});

// ─── Existing Docs Flag Tests ───────────────────────────────────

describe("docs --existing-docs flag", () => {
  let tempHome: string;
  let codebasePath: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-docs-existing-"));
    codebasePath = mkdtempSync(join(tmpdir(), "inkloom-codebase-existing-"));
    writeFileSync(join(codebasePath, "index.ts"), "export const x = 1;\n");
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
      rmSync(codebasePath, { recursive: true, force: true });
    } catch {}
  });

  it("should show --existing-docs in generate help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "generate", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("--existing-docs"),
      "Should show --existing-docs option",
    );
    assert.ok(
      stdout.includes("--existing-docs-format"),
      "Should show --existing-docs-format option",
    );
  });

  it("should show --existing-docs in plan help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "plan", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("--existing-docs"),
      "Should show --existing-docs option in plan help",
    );
    assert.ok(
      stdout.includes("--existing-docs-format"),
      "Should show --existing-docs-format option in plan help",
    );
  });

  it("should show existing docs example in generate help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "generate", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("--existing-docs ./docs"),
      "Should show existing docs example",
    );
  });

  it("should show existing docs example in plan help", () => {
    const { stdout, exitCode } = runCliSync(["docs", "plan", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("--existing-docs ./docs"),
      "Should show existing docs example in plan help",
    );
  });

  it("should fail with non-existent existing docs path", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "/nonexistent/docs/path",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Existing docs path not found"),
      `Should show existing docs not found error. stderr: ${stderr}`,
    );
  });

  it("should fail with non-existent existing docs path for plan", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "docs", "plan", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "/nonexistent/docs/path",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("Existing docs path not found"),
      `Should show existing docs not found error for plan. stderr: ${stderr}`,
    );
  });

  it("should accept valid existing docs path and show it in config summary", async () => {
    // Create a docs directory with some content
    const docsDir = join(codebasePath, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "getting-started.md"), "# Getting Started\n\nHello world.\n");

    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "docs",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    // It will fail eventually (connecting to AI), but should show the existing docs path
    assert.ok(
      stderr.includes("Existing docs: docs (mdx)"),
      `Should show existing docs path in config summary. stderr: ${stderr}`,
    );
  });

  it("should default to mdx format when --existing-docs-format not specified", async () => {
    const docsDir = join(codebasePath, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "intro.md"), "# Intro\n");

    const { stderr } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "docs",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.ok(
      stderr.includes("Existing docs: docs (mdx)"),
      `Should default to mdx format. stderr: ${stderr}`,
    );
  });

  it("should accept md format via --existing-docs-format", async () => {
    const docsDir = join(codebasePath, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "intro.md"), "# Intro\n");

    const { stderr } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "docs",
        "--existing-docs-format", "md",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.ok(
      stderr.includes("Existing docs: docs (md)"),
      `Should show md format. stderr: ${stderr}`,
    );
  });

  it("should reject invalid --existing-docs-format value", async () => {
    const docsDir = join(codebasePath, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "intro.md"), "# Intro\n");

    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "docs",
        "--existing-docs-format", "rst",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    assert.equal(exitCode, 1, `Should exit 1. stderr: ${stderr}`);
    assert.ok(
      stderr.includes('Invalid existing docs format') && stderr.includes('"rst"'),
      `Should reject invalid format. stderr: ${stderr}`,
    );
  });

  it("should override config file existing_docs with --existing-docs flag", async () => {
    // Set up config file pointing to "old-docs" which doesn't exist
    const configDir = join(codebasePath, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "docs.yml"),
      `product:
  description: "Config file project"
existing_docs:
  path: "old-docs"
  format: md
`,
    );

    // Create new-docs directory that the CLI flag will point to
    const newDocsDir = join(codebasePath, "new-docs");
    mkdirSync(newDocsDir, { recursive: true });
    writeFileSync(join(newDocsDir, "intro.mdx"), "# Intro\n");

    const { stderr } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--codebase", codebasePath,
        "--existing-docs", "new-docs",
        "--existing-docs-format", "mdx",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    // Should use the CLI flag path, not the config file path
    assert.ok(
      stderr.includes("Existing docs: new-docs (mdx)"),
      `Should override config file with CLI flag. stderr: ${stderr}`,
    );
  });

  it("should resolve existing docs path relative to codebase", async () => {
    // Create a nested docs directory
    const nestedDocsDir = join(codebasePath, "content", "docs");
    mkdirSync(nestedDocsDir, { recursive: true });
    writeFileSync(join(nestedDocsDir, "guide.md"), "# Guide\n");

    const { stderr, exitCode } = await runCli(
      [
        "docs", "generate", PROJECT_ID,
        "--description", "A test project",
        "--codebase", codebasePath,
        "--existing-docs", "content/docs",
        "--openrouter-key", "sk-or-v1-test1234567890123456",
        "--token", TOKEN,
        "--api-url", "http://127.0.0.1:1",
      ],
      { HOME: tempHome },
    );
    // Should NOT fail with "Existing docs path not found" since path is relative to codebase
    assert.ok(
      !stderr.includes("Existing docs path not found"),
      `Should resolve path relative to codebase. stderr: ${stderr}`,
    );
    assert.ok(
      stderr.includes("Existing docs: content/docs (mdx)"),
      `Should show nested existing docs path. stderr: ${stderr}`,
    );
  });
});
