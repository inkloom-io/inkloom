import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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

const MOCK_PAGES = [
  {
    _id: "page_001",
    title: "Getting Started",
    slug: "getting-started",
    isPublished: true,
    folderId: "folder_001",
    position: 0,
    createdAt: 1706745600000,
  },
  {
    _id: "page_002",
    title: "API Reference",
    slug: "api-reference",
    isPublished: false,
    folderId: null,
    position: 1,
    createdAt: 1705276800000,
  },
];

const MOCK_PAGE_DETAIL = {
  _id: "page_001",
  title: "Getting Started",
  slug: "getting-started",
  isPublished: true,
  folderId: "folder_001",
  position: 0,
  createdAt: 1706745600000,
  content: "# Getting Started\n\nWelcome to the docs.",
  contentFormat: "mdx",
};

const TOKEN_ARGS = ["--token", "ik_live_user_testtoken123456789abcdef"];

// --- Tests ---

describe("pages list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-test-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: {
          data: MOCK_PAGES,
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

  it("should list pages in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "list",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr may have info`);
    assert.ok(stdout.includes("ID"), "Should have ID column header");
    assert.ok(stdout.includes("TITLE"), "Should have TITLE column header");
    assert.ok(stdout.includes("SLUG"), "Should have SLUG column header");
    assert.ok(stdout.includes("PUBLISHED"), "Should have PUBLISHED column header");
    assert.ok(stdout.includes("Getting Started"), "Should show page title");
    assert.ok(stdout.includes("getting-started"), "Should show page slug");
    assert.ok(stdout.includes("API Reference"), "Should show second page");
  });

  it("should list pages in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "list",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.data), "Should have data array");
    assert.equal(parsed.data.length, 2, "Should have 2 pages");
    assert.equal(parsed.data[0].title, "Getting Started");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should pass query parameters to API", async () => {
    let receivedUrl = "";
    const serverWithCapture = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
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
          "pages",
          "list",
          "proj123",
          "--branch",
          "branch_001",
          "--folder",
          "folder_001",
          "--include-content",
          "--format",
          "mdx",
          ...TOKEN_ARGS,
          "--api-url",
          serverWithCapture.url,
        ],
        { HOME: tempHome }
      );
      assert.ok(
        receivedUrl.includes("branchId=branch_001"),
        `Should pass branchId. Got: ${receivedUrl}`
      );
      assert.ok(
        receivedUrl.includes("folderId=folder_001"),
        `Should pass folderId. Got: ${receivedUrl}`
      );
      assert.ok(
        receivedUrl.includes("includeContent=true"),
        `Should pass includeContent. Got: ${receivedUrl}`
      );
      assert.ok(
        receivedUrl.includes("format=mdx"),
        `Should pass format. Got: ${receivedUrl}`
      );
    } finally {
      serverWithCapture.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["pages", "list", "proj123", "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should show empty list message when no pages", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "pages",
          "list",
          "proj123",
          ...TOKEN_ARGS,
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

describe("pages create", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let lastRequestBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-create-"));
    lastRequestBody = {};
    mockServer = await createMockServer([
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages$/,
        status: 201,
        body: { data: MOCK_PAGE_DETAIL },
        handler: (_req, body) => {
          lastRequestBody = JSON.parse(body);
          return { status: 201, body: { data: MOCK_PAGE_DETAIL } };
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

  it("should create a page from an MDX file", async () => {
    const mdxFile = join(tempHome, "test-page.mdx");
    writeFileSync(mdxFile, "# Hello\n\nThis is a test page.", "utf-8");

    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--title",
        "Getting Started",
        "--file",
        mdxFile,
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("Page created"), "Should show success message");
    assert.ok(stderr.includes("Getting Started"), "Should show page title");
    assert.equal(lastRequestBody.title, "Getting Started");
    assert.equal(lastRequestBody.content, "# Hello\n\nThis is a test page.");
    assert.equal(lastRequestBody.contentFormat, "mdx");
  });

  it("should pass optional parameters", async () => {
    const mdxFile = join(tempHome, "test-page.mdx");
    writeFileSync(mdxFile, "# Hello", "utf-8");

    await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--title",
        "My Page",
        "--file",
        mdxFile,
        "--slug",
        "my-page",
        "--folder",
        "folder_001",
        "--branch",
        "branch_001",
        "--publish",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(lastRequestBody.slug, "my-page");
    assert.equal(lastRequestBody.folderId, "folder_001");
    assert.equal(lastRequestBody.branchId, "branch_001");
    assert.equal(lastRequestBody.isPublished, true);
  });

  it("should output JSON when --json flag is used", async () => {
    const mdxFile = join(tempHome, "test-page.mdx");
    writeFileSync(mdxFile, "# Hello", "utf-8");

    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--title",
        "Getting Started",
        "--file",
        mdxFile,
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.title, "Getting Started");
  });

  it("should fail when --title is not provided", async () => {
    const mdxFile = join(tempHome, "test-page.mdx");
    writeFileSync(mdxFile, "# Hello", "utf-8");

    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--file",
        mdxFile,
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --title");
    assert.ok(
      stderr.includes("--title") || stderr.includes("required"),
      "Should mention --title is required"
    );
  });

  it("should fail when --file is not provided", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--title",
        "My Page",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --file");
    assert.ok(
      stderr.includes("--file") || stderr.includes("required"),
      "Should mention --file is required"
    );
  });

  it("should fail when file does not exist", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "create",
        "proj123",
        "--title",
        "My Page",
        "--file",
        "/nonexistent/path/test.mdx",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail with nonexistent file");
    assert.ok(
      stderr.includes("ENOENT") || stderr.includes("no such file"),
      `Should show file not found error. Got: ${stderr}`
    );
  });
});

describe("pages get", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-get-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001/,
        status: 200,
        body: { data: MOCK_PAGE_DETAIL },
        handler: (req) => {
          const url = req.url ?? "";
          // If includeContent or format requested, return with content
          if (url.includes("includeContent=true") || url.includes("format=")) {
            return { status: 200, body: { data: MOCK_PAGE_DETAIL } };
          }
          // Otherwise return without content
          const { content: _c, contentFormat: _f, ...metadata } = MOCK_PAGE_DETAIL;
          return { status: 200, body: { data: metadata } };
        },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages\/nonexistent/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Page not found" },
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

  it("should get page details in key-value format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Getting Started"), "Should show page title");
    assert.ok(stdout.includes("getting-started"), "Should show page slug");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data._id, "page_001");
    assert.equal(parsed.data.title, "Getting Started");
  });

  it("should include content when --format is specified", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        "page_001",
        "--format",
        "mdx",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data.content, "Should include content when --format is used");
  });

  it("should write content to file with --output", async () => {
    const outputFile = join(tempHome, "output.mdx");

    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        "page_001",
        "--output",
        outputFile,
        "--format",
        "mdx",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("Content written to"), "Should confirm file write");

    // Verify file was written
    const { readFileSync } = await import("node:fs");
    const fileContent = readFileSync(outputFile, "utf-8");
    assert.equal(
      fileContent,
      "# Getting Started\n\nWelcome to the docs.",
      "Should write content to file"
    );
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        "nonexistent",
        ...TOKEN_ARGS,
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

  it("should require both projectId and pageId arguments", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "get",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without pageId");
    assert.ok(
      stderr.includes("pageId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });
});

describe("pages update", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let patchCalled: boolean;
  let patchBody: Record<string, unknown>;
  let putBody: Record<string, unknown>;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-update-"));
    patchCalled = false;
    patchBody = {};
    putBody = {};
    mockServer = await createMockServer([
      {
        method: "PATCH",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001$/,
        status: 200,
        body: { data: MOCK_PAGE_DETAIL },
        handler: (_req, body) => {
          patchCalled = true;
          patchBody = JSON.parse(body);
          return { status: 200, body: { data: MOCK_PAGE_DETAIL } };
        },
      },
      {
        method: "PUT",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001\/content$/,
        status: 200,
        body: {
          data: {
            format: "blocknote",
            content: "[]",
            updatedAt: Date.now(),
          },
        },
        handler: (_req, body) => {
          putBody = JSON.parse(body);
          return {
            status: 200,
            body: {
              data: {
                format: "blocknote",
                content: "[]",
                updatedAt: Date.now(),
              },
            },
          };
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

  it("should update page content from file", async () => {
    const mdxFile = join(tempHome, "updated.mdx");
    writeFileSync(mdxFile, "# Updated Content\n\nNew text here.", "utf-8");

    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "update",
        "proj123",
        "page_001",
        "--file",
        mdxFile,
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("updated"), "Should show success message");
    assert.equal(patchCalled, false, "Should NOT call PATCH when --title not provided");
    assert.equal(putBody.content, "# Updated Content\n\nNew text here.");
    assert.equal(putBody.contentFormat, "mdx");
  });

  it("should update title and content when --title is provided", async () => {
    const mdxFile = join(tempHome, "updated.mdx");
    writeFileSync(mdxFile, "# New Content", "utf-8");

    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "update",
        "proj123",
        "page_001",
        "--file",
        mdxFile,
        "--title",
        "New Title",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.equal(patchCalled, true, "Should call PATCH when --title provided");
    assert.equal(patchBody.title, "New Title");
    assert.equal(putBody.content, "# New Content");
  });

  it("should output JSON when --json flag is used", async () => {
    const mdxFile = join(tempHome, "updated.mdx");
    writeFileSync(mdxFile, "# Content", "utf-8");

    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "update",
        "proj123",
        "page_001",
        "--file",
        mdxFile,
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
  });

  it("should fail when --file is not provided", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "update",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --file");
    assert.ok(
      stderr.includes("--file") || stderr.includes("required"),
      "Should mention --file is required"
    );
  });
});

describe("pages delete", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let deleteCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-delete-"));
    deleteCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001$/,
        status: 200,
        body: { data: { success: true } },
        handler: () => {
          deleteCallCount++;
          return { status: 200, body: { data: { success: true } } };
        },
      },
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj123\/pages\/nonexistent$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Page not found" },
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

  it("should delete a page with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "delete",
        "proj123",
        "page_001",
        "--force",
        ...TOKEN_ARGS,
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
        "pages",
        "delete",
        "proj123",
        "page_001",
        "--force",
        ...TOKEN_ARGS,
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
        "pages",
        "delete",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
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
        "pages",
        "delete",
        "proj123",
        "nonexistent",
        "--force",
        ...TOKEN_ARGS,
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

describe("pages publish", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let publishCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-publish-"));
    publishCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001\/publish$/,
        status: 200,
        body: { data: { ...MOCK_PAGE_DETAIL, isPublished: true } },
        handler: () => {
          publishCallCount++;
          return {
            status: 200,
            body: { data: { ...MOCK_PAGE_DETAIL, isPublished: true } },
          };
        },
      },
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages\/nonexistent\/publish$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Page not found" },
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

  it("should publish a page", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "publish",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("published"), "Should show success message");
    assert.equal(publishCallCount, 1, "Should make POST request");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "publish",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.isPublished, true, "Should show isPublished true");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "publish",
        "proj123",
        "nonexistent",
        ...TOKEN_ARGS,
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

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["pages", "publish", "proj123", "page_001", "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should require both projectId and pageId arguments", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "publish",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without pageId");
    assert.ok(
      stderr.includes("pageId") || stderr.includes("missing"),
      "Should mention missing argument"
    );
  });
});

describe("pages unpublish", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let unpublishCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-unpublish-"));
    unpublishCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj123\/pages\/page_001\/publish$/,
        status: 200,
        body: { data: { ...MOCK_PAGE_DETAIL, isPublished: false } },
        handler: () => {
          unpublishCallCount++;
          return {
            status: 200,
            body: { data: { ...MOCK_PAGE_DETAIL, isPublished: false } },
          };
        },
      },
      {
        method: "DELETE",
        path: /^\/api\/v1\/projects\/proj123\/pages\/nonexistent\/publish$/,
        status: 404,
        body: {
          error: { code: "not_found", message: "Page not found" },
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

  it("should unpublish a page", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "unpublish",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.ok(stderr.includes("unpublished"), "Should show success message");
    assert.equal(unpublishCallCount, 1, "Should make DELETE request");
  });

  it("should output JSON when --json flag is used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "pages",
        "unpublish",
        "proj123",
        "page_001",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.data, "Should have data field");
    assert.equal(parsed.data.isPublished, false, "Should show isPublished false");
  });

  it("should handle not found error", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "unpublish",
        "proj123",
        "nonexistent",
        ...TOKEN_ARGS,
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

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["pages", "unpublish", "proj123", "page_001", "--api-url", mockServer.url],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should show auth error"
    );
  });

  it("should handle JSON error output for API errors", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "unpublish",
        "proj123",
        "nonexistent",
        ...TOKEN_ARGS,
        "--api-url",
        mockServer.url,
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 4);
    const parsed = JSON.parse(stderr);
    assert.ok(parsed.error, "Should have error field");
    assert.equal(parsed.error.code, "not_found");
  });
});

describe("pages pull", () => {
  let tempHome: string;
  let outDir: string;

  const MOCK_FOLDERS = [
    {
      _id: "folder_001",
      name: "Getting Started",
      slug: "getting-started",
      parentId: undefined,
      position: 0,
    },
    {
      _id: "folder_002",
      name: "Advanced",
      slug: "advanced",
      parentId: "folder_001",
      position: 0,
    },
  ];

  const MOCK_PULL_PAGES = [
    {
      _id: "page_001",
      title: "Quickstart",
      slug: "quickstart",
      folderId: "folder_001",
      position: 0,
      isPublished: true,
      icon: "rocket",
      description: "Get started quickly",
      content: "# Quickstart\n\nWelcome!",
    },
    {
      _id: "page_002",
      title: "Installation",
      slug: "installation",
      folderId: "folder_001",
      position: 1,
      isPublished: true,
      content: "# Installation\n\nInstall steps.",
    },
    {
      _id: "page_003",
      title: "Deep Dive",
      slug: "deep-dive",
      folderId: "folder_002",
      position: 0,
      isPublished: false,
      content: "# Deep Dive\n\nAdvanced content.",
    },
    {
      _id: "page_004",
      title: "Overview",
      slug: "overview",
      folderId: undefined,
      position: 0,
      isPublished: true,
      content: "# Overview\n\nTop-level page.",
    },
  ];

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pull-test-"));
    outDir = join(tempHome, "output-docs");
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should pull pages and create correct directory structure", async () => {
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_FOLDERS, pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_PULL_PAGES, pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(stderr.includes("Exported 4 pages"), `Should show 4 pages exported. Got: ${stderr}`);

      // Verify files were created
      const { readFileSync, existsSync } = await import("node:fs");
      assert.ok(existsSync(join(outDir, "getting-started", "quickstart.mdx")), "Should create quickstart.mdx");
      assert.ok(existsSync(join(outDir, "getting-started", "installation.mdx")), "Should create installation.mdx");
      assert.ok(existsSync(join(outDir, "getting-started", "advanced", "deep-dive.mdx")), "Should create deep-dive.mdx in nested folder");
      assert.ok(existsSync(join(outDir, "overview.mdx")), "Should create overview.mdx at root");

      // Verify frontmatter in quickstart.mdx
      const quickstartContent = readFileSync(join(outDir, "getting-started", "quickstart.mdx"), "utf-8");
      assert.ok(quickstartContent.includes("title: Quickstart"), "Should include title");
      assert.ok(quickstartContent.includes("slug: quickstart"), "Should include slug");
      assert.ok(quickstartContent.includes("position: 0"), "Should include position");
      assert.ok(quickstartContent.includes("isPublished: true"), "Should include isPublished");
      assert.ok(quickstartContent.includes("icon: rocket"), "Should include icon");
      assert.ok(quickstartContent.includes("description: Get started quickly"), "Should include description");
      assert.ok(quickstartContent.includes("# Quickstart\n\nWelcome!"), "Should include body content");

      // Verify installation.mdx doesn't have icon (not set)
      const installContent = readFileSync(join(outDir, "getting-started", "installation.mdx"), "utf-8");
      assert.ok(!installContent.includes("icon:"), "Should not include icon field when not set");
      assert.ok(!installContent.includes("description:"), "Should not include description field when not set");
    } finally {
      mockServer.server.close();
    }
  });

  it("should filter pages with --published-only", async () => {
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_FOLDERS, pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_PULL_PAGES, pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          "--published-only",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(stderr.includes("Exported 3 pages"), `Should export only 3 published pages. Got: ${stderr}`);

      const { existsSync } = await import("node:fs");
      assert.ok(existsSync(join(outDir, "getting-started", "quickstart.mdx")), "Should create published page");
      assert.ok(existsSync(join(outDir, "overview.mdx")), "Should create published root page");
      assert.ok(!existsSync(join(outDir, "getting-started", "advanced", "deep-dive.mdx")), "Should NOT create unpublished page");
    } finally {
      mockServer.server.close();
    }
  });

  it("should pass branchId query parameter when --branch is specified", async () => {
    let foldersUrl = "";
    let pagesUrl = "";
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
        handler: (req) => {
          foldersUrl = req.url ?? "";
          return { status: 200, body: { data: [], pagination: { cursor: null, hasMore: false } } };
        },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [MOCK_PULL_PAGES[3]], pagination: { cursor: null, hasMore: false } },
        handler: (req) => {
          pagesUrl = req.url ?? "";
          return { status: 200, body: { data: [MOCK_PULL_PAGES[3]], pagination: { cursor: null, hasMore: false } } };
        },
      },
    ]);

    try {
      await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          "--branch",
          "branch_123",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.ok(foldersUrl.includes("branchId=branch_123"), `Folders request should include branchId. Got: ${foldersUrl}`);
      assert.ok(pagesUrl.includes("branchId=branch_123"), `Pages request should include branchId. Got: ${pagesUrl}`);
      assert.ok(pagesUrl.includes("includeContent=true"), `Should request content. Got: ${pagesUrl}`);
      assert.ok(pagesUrl.includes("format=mdx"), `Should request MDX format. Got: ${pagesUrl}`);
    } finally {
      mockServer.server.close();
    }
  });

  it("should output JSON with --json flag", async () => {
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_FOLDERS, pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_PULL_PAGES, pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          "--json",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.data.exported, 4, "Should report 4 exported pages");
      assert.ok(Array.isArray(parsed.data.files), "Should include file paths");
      assert.equal(parsed.data.files.length, 4, "Should list 4 files");
    } finally {
      mockServer.server.close();
    }
  });

  it("should handle empty project (no pages)", async () => {
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("No pages to export"), "Should report no pages");
    } finally {
      mockServer.server.close();
    }
  });

  it("should require --dir flag", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "pull",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        "http://localhost:0",
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --dir");
    assert.ok(
      stderr.includes("--dir") || stderr.includes("required"),
      "Should mention --dir is required"
    );
  });

  it("should abort in CI when dir is non-empty and --overwrite not set", async () => {
    // Create the output dir with existing content
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "existing.txt"), "existing content", "utf-8");

    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [MOCK_PULL_PAGES[3]], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome, CI: "true" }
      );

      assert.equal(exitCode, 1, `Should exit 1 in CI without --overwrite. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("--force") || stderr.includes("Confirmation required"),
        "Should ask for --force in non-interactive mode"
      );
    } finally {
      mockServer.server.close();
    }
  });

  it("should proceed with --overwrite when dir is non-empty", async () => {
    // Create the output dir with existing content
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "existing.txt"), "existing content", "utf-8");

    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [MOCK_PULL_PAGES[3]], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          "--overwrite",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0 with --overwrite. stderr: ${stderr}`);
      assert.ok(stderr.includes("Exported 1 page"), "Should export pages");
    } finally {
      mockServer.server.close();
    }
  });

  it("should handle pages with null content gracefully", async () => {
    const pagesWithNullContent = [
      {
        _id: "page_null",
        title: "Empty Page",
        slug: "empty-page",
        folderId: undefined,
        position: 0,
        isPublished: true,
        content: null,
      },
    ];

    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: pagesWithNullContent, pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "pull",
          "proj123",
          "--dir",
          outDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);

      const { readFileSync } = await import("node:fs");
      const content = readFileSync(join(outDir, "empty-page.mdx"), "utf-8");
      assert.ok(content.includes("title: Empty Page"), "Should have frontmatter");
      // Body should be empty string (from null content)
      assert.ok(content.includes("isPublished: true"), "Should include isPublished");
    } finally {
      mockServer.server.close();
    }
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      ["pages", "pull", "proj123", "--dir", outDir, "--api-url", "http://localhost:0"],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(stderr.includes("Not authenticated"), "Should show auth error");
  });
});

describe("pages push", () => {
  let tempHome: string;
  let docsDir: string;

  const MOCK_REMOTE_FOLDERS = [
    {
      _id: "folder_existing",
      name: "Guides",
      slug: "guides",
      parentId: undefined,
      position: 0,
    },
  ];

  const MOCK_REMOTE_PAGES = [
    {
      _id: "page_existing_1",
      title: "Quickstart",
      slug: "quickstart",
      folderId: "folder_existing",
      position: 0,
      isPublished: true,
      content: "# Quickstart\n\nOriginal content.",
    },
    {
      _id: "page_existing_2",
      title: "Overview",
      slug: "overview",
      folderId: undefined,
      position: 0,
      isPublished: true,
      content: "# Overview\n\nTop-level page.",
    },
  ];

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-push-test-"));
    docsDir = join(tempHome, "docs");
    mkdirSync(docsDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should show help text with all options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "push", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--dir"), "Should show --dir option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--delete"), "Should show --delete option");
    assert.ok(stdout.includes("--dry-run"), "Should show --dry-run option");
    assert.ok(stdout.includes("--publish"), "Should show --publish option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should perform dry-run and show diff without applying changes", async () => {
    // Create local files
    mkdirSync(join(docsDir, "guides"), { recursive: true });
    writeFileSync(
      join(docsDir, "guides", "quickstart.mdx"),
      "---\ntitle: Quickstart\nslug: quickstart\n---\n\n# Quickstart\n\nUpdated content.",
      "utf-8"
    );
    writeFileSync(
      join(docsDir, "new-page.mdx"),
      "---\ntitle: New Page\nslug: new-page\n---\n\n# New Page\n\nBrand new.",
      "utf-8"
    );

    let bulkCalled = false;
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_REMOTE_FOLDERS },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_REMOTE_PAGES },
      },
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages\/bulk/,
        status: 200,
        body: { data: { results: [], summary: { succeeded: 0, failed: 0 } } },
        handler: () => {
          bulkCalled = true;
          return {
            status: 200,
            body: { data: { results: [], summary: { succeeded: 0, failed: 0 } } },
          };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "push",
          "proj123",
          "--dir",
          docsDir,
          "--dry-run",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("Dry run"),
        `Should indicate dry run. Got: ${stderr}`
      );
      assert.ok(
        stderr.includes("CREATE") || stderr.includes("UPDATE"),
        `Should show diff operations. Got: ${stderr}`
      );
      assert.ok(
        stderr.includes("Summary"),
        `Should show summary line. Got: ${stderr}`
      );
      assert.equal(bulkCalled, false, "Should NOT make bulk API call in dry-run mode");
    } finally {
      mockServer.server.close();
    }
  });

  it("should apply changes and print summary", async () => {
    // Create local files matching remote + one new page
    mkdirSync(join(docsDir, "guides"), { recursive: true });
    writeFileSync(
      join(docsDir, "guides", "quickstart.mdx"),
      "---\ntitle: Quickstart\nslug: quickstart\n---\n\n# Quickstart\n\nUpdated content.",
      "utf-8"
    );
    writeFileSync(
      join(docsDir, "overview.mdx"),
      "---\ntitle: Overview\nslug: overview\n---\n\n# Overview\n\nTop-level page.",
      "utf-8"
    );
    writeFileSync(
      join(docsDir, "new-page.mdx"),
      "---\ntitle: New Page\nslug: new-page\n---\n\n# New Page",
      "utf-8"
    );

    let bulkBody: any = null;
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_REMOTE_FOLDERS },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_REMOTE_PAGES },
      },
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages\/bulk/,
        status: 200,
        body: { data: { results: [], summary: { succeeded: 0, failed: 0 } } },
        handler: (_req, body) => {
          bulkBody = JSON.parse(body);
          const results = bulkBody.operations.map((op: any, i: number) => ({
            index: i,
            action: op.action,
            status: "success",
            pageId: op.pageId ?? `new_${i}`,
          }));
          return {
            status: 200,
            body: {
              data: {
                results,
                summary: { succeeded: results.length, failed: 0 },
              },
            },
          };
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "push",
          "proj123",
          "--dir",
          docsDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(stderr.includes("Summary") || stderr.includes("created") || stderr.includes("updated"), `Should show summary. Got: ${stderr}`);
      assert.ok(bulkBody !== null, "Should make bulk API call");
      assert.ok(
        Array.isArray(bulkBody.operations),
        "Should send operations array"
      );
    } finally {
      mockServer.server.close();
    }
  });

  it("should output JSON in dry-run mode", async () => {
    writeFileSync(
      join(docsDir, "new-page.mdx"),
      "---\ntitle: New Page\nslug: new-page\n---\n\n# New Page",
      "utf-8"
    );

    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [] },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [] },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "pages",
          "push",
          "proj123",
          "--dir",
          docsDir,
          "--dry-run",
          "--json",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0`);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed.data, "Should have data field");
      assert.equal(parsed.data.dryRun, true, "Should indicate dry run");
      assert.ok(
        Array.isArray(parsed.data.pagesToCreate),
        "Should include pagesToCreate"
      );
      assert.equal(parsed.data.pagesToCreate.length, 1);
      assert.equal(parsed.data.pagesToCreate[0].slug, "new-page");
    } finally {
      mockServer.server.close();
    }
  });

  it("should error when directory does not exist", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "push",
        "proj123",
        "--dir",
        "/nonexistent/path",
        ...TOKEN_ARGS,
        "--api-url",
        "http://localhost:0",
      ],
      { HOME: tempHome }
    );

    assert.notEqual(exitCode, 0, "Should fail for nonexistent directory");
    assert.ok(
      stderr.includes("Directory not found") || stderr.includes("ENOENT"),
      `Should show directory error. Got: ${stderr}`
    );
  });

  it("should handle empty directory gracefully", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "push",
        "proj123",
        "--dir",
        docsDir,
        ...TOKEN_ARGS,
        "--api-url",
        "http://localhost:0",
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0, `Should exit 0 for empty dir. stderr: ${stderr}`);
    assert.ok(
      stderr.includes("No .mdx files"),
      `Should report no files found. Got: ${stderr}`
    );
  });

  it("should report no changes when local matches remote", async () => {
    // Create local files that exactly match remote
    mkdirSync(join(docsDir, "guides"), { recursive: true });
    writeFileSync(
      join(docsDir, "guides", "quickstart.mdx"),
      "---\ntitle: Quickstart\nslug: quickstart\n---\n\n# Quickstart\n\nOriginal content.",
      "utf-8"
    );
    writeFileSync(
      join(docsDir, "overview.mdx"),
      "---\ntitle: Overview\nslug: overview\n---\n\n# Overview\n\nTop-level page.",
      "utf-8"
    );

    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: MOCK_REMOTE_FOLDERS },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: MOCK_REMOTE_PAGES },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "push",
          "proj123",
          "--dir",
          docsDir,
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
      assert.ok(
        stderr.includes("No changes"),
        `Should report no changes. Got: ${stderr}`
      );
    } finally {
      mockServer.server.close();
    }
  });

  it("should require --dir flag", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "push",
        "proj123",
        ...TOKEN_ARGS,
        "--api-url",
        "http://localhost:0",
      ],
      { HOME: tempHome }
    );
    assert.notEqual(exitCode, 0, "Should fail without --dir");
    assert.ok(
      stderr.includes("--dir") || stderr.includes("required"),
      "Should mention --dir is required"
    );
  });

  it("should fail without authentication", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "pages",
        "push",
        "proj123",
        "--dir",
        docsDir,
        "--api-url",
        "http://localhost:0",
      ],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );
    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(stderr.includes("Not authenticated"), "Should show auth error");
  });

  it("should pass branchId to API calls", async () => {
    writeFileSync(
      join(docsDir, "page.mdx"),
      "---\ntitle: Page\nslug: page\n---\n\n# Page",
      "utf-8"
    );

    let foldersUrl = "";
    let pagesUrl = "";
    const mockServer = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/folders/,
        status: 200,
        body: { data: [] },
        handler: (req) => {
          foldersUrl = req.url ?? "";
          return { status: 200, body: { data: [] } };
        },
      },
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 200,
        body: { data: [] },
        handler: (req) => {
          pagesUrl = req.url ?? "";
          return { status: 200, body: { data: [] } };
        },
      },
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages\/bulk/,
        status: 200,
        body: {
          data: {
            results: [
              { index: 0, action: "create", status: "success", pageId: "p1" },
            ],
            summary: { succeeded: 1, failed: 0 },
          },
        },
      },
    ]);

    try {
      await runCli(
        [
          "pages",
          "push",
          "proj123",
          "--dir",
          docsDir,
          "--branch",
          "branch_xyz",
          ...TOKEN_ARGS,
          "--api-url",
          mockServer.url,
        ],
        { HOME: tempHome }
      );

      assert.ok(
        foldersUrl.includes("branchId=branch_xyz"),
        `Folders request should include branchId. Got: ${foldersUrl}`
      );
      assert.ok(
        pagesUrl.includes("branchId=branch_xyz"),
        `Pages request should include branchId. Got: ${pagesUrl}`
      );
    } finally {
      mockServer.server.close();
    }
  });
});

describe("pages help", () => {
  it("should show all subcommands in help", async () => {
    const { stdout, exitCode } = await runCli(["pages", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("create"), "Should show create command");
    assert.ok(stdout.includes("get"), "Should show get command");
    assert.ok(stdout.includes("update"), "Should show update command");
    assert.ok(stdout.includes("publish"), "Should show publish command");
    assert.ok(stdout.includes("unpublish"), "Should show unpublish command");
    assert.ok(stdout.includes("delete"), "Should show delete command");
    assert.ok(stdout.includes("pull"), "Should show pull command");
    assert.ok(stdout.includes("push"), "Should show push command");
  });

  it("should show list options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "list", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--folder"), "Should show --folder option");
    assert.ok(stdout.includes("--format"), "Should show --format option");
    assert.ok(stdout.includes("--include-content"), "Should show --include-content option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should show create options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "create", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--title"), "Should show --title option");
    assert.ok(stdout.includes("--file"), "Should show --file option");
    assert.ok(stdout.includes("--slug"), "Should show --slug option");
    assert.ok(stdout.includes("--folder"), "Should show --folder option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--publish"), "Should show --publish option");
  });

  it("should show get options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "get", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--format"), "Should show --format option");
    assert.ok(stdout.includes("--include-content"), "Should show --include-content option");
    assert.ok(stdout.includes("--output"), "Should show --output option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("pageId"), "Should show pageId argument");
  });

  it("should show update options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "update", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--file"), "Should show --file option");
    assert.ok(stdout.includes("--title"), "Should show --title option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("pageId"), "Should show pageId argument");
  });

  it("should show delete options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "delete", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--force"), "Should show --force option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("pageId"), "Should show pageId argument");
  });

  it("should show pull options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "pull", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--dir"), "Should show --dir option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--overwrite"), "Should show --overwrite option");
    assert.ok(stdout.includes("--published-only"), "Should show --published-only option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });

  it("should show push options", async () => {
    const { stdout, exitCode } = await runCli(["pages", "push", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("--dir"), "Should show --dir option");
    assert.ok(stdout.includes("--branch"), "Should show --branch option");
    assert.ok(stdout.includes("--delete"), "Should show --delete option");
    assert.ok(stdout.includes("--dry-run"), "Should show --dry-run option");
    assert.ok(stdout.includes("--publish"), "Should show --publish option");
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });
});

describe("pages API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-pages-err-"));
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
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "list",
          "proj123",
          ...TOKEN_ARGS,
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
        path: /^\/api\/v1\/projects\/proj123\/pages$/,
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
      const mdxFile = join(tempHome, "test.mdx");
      writeFileSync(mdxFile, "# Test", "utf-8");

      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "create",
          "proj123",
          "--title",
          "Test",
          "--file",
          mdxFile,
          ...TOKEN_ARGS,
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

  it("should handle validation error on create", async () => {
    const server = await createMockServer([
      {
        method: "POST",
        path: /^\/api\/v1\/projects\/proj123\/pages$/,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Invalid MDX content",
            details: { field: "content" },
          },
        },
      },
    ]);

    try {
      const mdxFile = join(tempHome, "bad.mdx");
      writeFileSync(mdxFile, "invalid content", "utf-8");

      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "create",
          "proj123",
          "--title",
          "Bad Page",
          "--file",
          mdxFile,
          ...TOKEN_ARGS,
          "--api-url",
          server.url,
        ],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 1, "Should exit with GENERAL code");
      assert.ok(
        stderr.includes("Invalid MDX"),
        "Should show validation error"
      );
    } finally {
      server.server.close();
    }
  });

  it("should handle JSON error output for API errors", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: /^\/api\/v1\/projects\/proj123\/pages/,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "pages",
          "list",
          "proj123",
          ...TOKEN_ARGS,
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
