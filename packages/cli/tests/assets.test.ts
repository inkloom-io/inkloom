import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  ) => { status: number; body: unknown; headers?: Record<string, string> };
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
          let headers: Record<string, string> = { "Content-Type": "application/json" };

          if (matchedRoute.handler) {
            const result = matchedRoute.handler(req, reqBody);
            status = result.status;
            body = result.body;
            if (result.headers) {
              headers = { ...headers, ...result.headers };
            }
          }

          res.writeHead(status, headers);
          res.end(typeof body === "string" ? body : JSON.stringify(body));
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
const ASSET_ID = "asset_abc123";

const MOCK_ASSETS = [
  {
    id: "asset_001",
    projectId: PROJECT_ID,
    filename: "logo.png",
    mimeType: "image/png",
    size: 12345,
    url: "https://r2.example.com/proj_test123/abc.png",
    createdAt: 1707600000000,
  },
  {
    id: "asset_002",
    projectId: PROJECT_ID,
    filename: "guide.pdf",
    mimeType: "application/pdf",
    size: 2048576,
    url: "https://r2.example.com/proj_test123/def.pdf",
    createdAt: 1707500000000,
  },
  {
    id: "asset_003",
    projectId: PROJECT_ID,
    filename: "icon.svg",
    mimeType: "image/svg+xml",
    size: 512,
    url: "https://r2.example.com/proj_test123/ghi.svg",
    createdAt: 1707400000000,
  },
];

// --- Tests ---

describe("assets list", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-assets-list-"));
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 200,
        body: {
          data: MOCK_ASSETS,
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

  it("should list assets in table format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "assets",
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
    assert.ok(stdout.includes("FILENAME"), "Should have FILENAME column header");
    assert.ok(stdout.includes("TYPE"), "Should have TYPE column header");
    assert.ok(stdout.includes("SIZE"), "Should have SIZE column header");
    assert.ok(stdout.includes("URL"), "Should have URL column header");
    assert.ok(stdout.includes("logo.png"), "Should show first asset filename");
    assert.ok(stdout.includes("guide.pdf"), "Should show second asset filename");
    assert.ok(stdout.includes("icon.svg"), "Should show third asset filename");
  });

  it("should format file sizes in human-readable form", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "assets",
        "list",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("12.1 KB"), "Should show 12345 as ~12.1 KB");
    assert.ok(stdout.includes("512 B"), "Should show 512 as 512 B");
    assert.ok(stdout.includes("2.0 MB"), "Should show ~2MB size");
  });

  it("should list assets in JSON format", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "assets",
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
    assert.equal(parsed.data.length, 3, "Should have 3 assets");
    assert.equal(parsed.data[0].filename, "logo.png");
    assert.equal(parsed.data[1].filename, "guide.pdf");
    assert.ok(parsed.pagination, "Should include pagination");
  });

  it("should show empty list message when no assets", async () => {
    const emptyServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 200,
        body: { data: [], pagination: { cursor: null, hasMore: false } },
      },
    ]);

    try {
      const { stdout, exitCode } = await runCli(
        [
          "assets",
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
        "assets",
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

describe("assets upload", () => {
  let tempHome: string;
  let tempDir: string;
  let mockServer: { server: Server; url: string };
  let presignCallCount: number;
  let confirmCallCount: number;
  let uploadCallCount: number;
  let receivedPresignBody: string;
  let receivedConfirmBody: string;
  let receivedUploadContentType: string;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-assets-upload-home-"));
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-assets-upload-"));
    presignCallCount = 0;
    confirmCallCount = 0;
    uploadCallCount = 0;
    receivedPresignBody = "";
    receivedConfirmBody = "";
    receivedUploadContentType = "";
  });

  afterEach(() => {
    if (mockServer) mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("should upload a PNG file through the 3-step flow", async () => {
    // Create test file
    const testFile = join(tempDir, "test-image.png");
    const testContent = Buffer.from("fake-png-content");
    writeFileSync(testFile, testContent);

    // We need the mock server to serve both the API routes and the "R2" presigned URL
    // The presigned URL will point back to the same mock server
    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {},
        handler: (_req, reqBody) => {
          presignCallCount++;
          receivedPresignBody = reqBody;
          // Return presigned URL pointing to our mock server
          return {
            status: 201,
            body: {
              data: {
                presignedUrl: `${mockServer.url}/mock-r2-upload`,
                r2Key: `${PROJECT_ID}/uuid123.png`,
                publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid123.png`,
              },
            },
          };
        },
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 200,
        body: "",
        handler: (req, _reqBody) => {
          uploadCallCount++;
          receivedUploadContentType = req.headers["content-type"] ?? "";
          return { status: 200, body: "" };
        },
      },
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets/confirm`,
        status: 201,
        body: {},
        handler: (_req, reqBody) => {
          confirmCallCount++;
          receivedConfirmBody = reqBody;
          return {
            status: 201,
            body: {
              data: {
                id: "asset_new123",
                url: `https://r2.example.com/${PROJECT_ID}/uuid123.png`,
                filename: "test-image.png",
                mimeType: "image/png",
                size: testContent.length,
              },
            },
          };
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);
    assert.equal(presignCallCount, 1, "Should call presign API once");
    assert.equal(uploadCallCount, 1, "Should upload to R2 once");
    assert.equal(confirmCallCount, 1, "Should confirm upload once");

    // Verify presign request body
    const presignBody = JSON.parse(receivedPresignBody);
    assert.equal(presignBody.filename, "test-image.png");
    assert.equal(presignBody.mimeType, "image/png");

    // Verify R2 upload content type
    assert.equal(receivedUploadContentType, "image/png");

    // Verify confirm request body
    const confirmBody = JSON.parse(receivedConfirmBody);
    assert.equal(confirmBody.r2Key, `${PROJECT_ID}/uuid123.png`);
    assert.equal(confirmBody.filename, "test-image.png");
    assert.equal(confirmBody.mimeType, "image/png");
    assert.equal(confirmBody.size, testContent.length);

    // Verify output
    assert.ok(stderr.includes("Uploaded"), "Should show upload success");
    assert.ok(stderr.includes("test-image.png"), "Should show filename");
    assert.ok(stderr.includes("asset_new123"), "Should show asset ID");
    assert.ok(stderr.includes("r2.example.com"), "Should show URL");
  });

  it("should upload a JPEG file with correct MIME type", async () => {
    const testFile = join(tempDir, "photo.jpg");
    writeFileSync(testFile, Buffer.from("fake-jpeg"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {},
        handler: (_req, reqBody) => {
          receivedPresignBody = reqBody;
          return {
            status: 201,
            body: {
              data: {
                presignedUrl: `${mockServer.url}/mock-r2-upload`,
                r2Key: `${PROJECT_ID}/uuid.jpg`,
                publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.jpg`,
              },
            },
          };
        },
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 200,
        body: "",
        handler: (req) => {
          receivedUploadContentType = req.headers["content-type"] ?? "";
          return { status: 200, body: "" };
        },
      },
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets/confirm`,
        status: 201,
        body: {
          data: {
            id: "asset_jpg",
            url: `https://r2.example.com/${PROJECT_ID}/uuid.jpg`,
            filename: "photo.jpg",
            mimeType: "image/jpeg",
            size: 9,
          },
        },
      },
    ]);

    const { exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    const presignBody = JSON.parse(receivedPresignBody);
    assert.equal(presignBody.mimeType, "image/jpeg", "Should detect JPEG MIME type");
    assert.equal(receivedUploadContentType, "image/jpeg");
  });

  it("should upload a SVG file with correct MIME type", async () => {
    const testFile = join(tempDir, "icon.svg");
    writeFileSync(testFile, Buffer.from("<svg></svg>"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {},
        handler: (_req, reqBody) => {
          receivedPresignBody = reqBody;
          return {
            status: 201,
            body: {
              data: {
                presignedUrl: `${mockServer.url}/mock-r2-upload`,
                r2Key: `${PROJECT_ID}/uuid.svg`,
                publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.svg`,
              },
            },
          };
        },
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 200,
        body: "",
      },
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets/confirm`,
        status: 201,
        body: {
          data: {
            id: "asset_svg",
            url: `https://r2.example.com/${PROJECT_ID}/uuid.svg`,
            filename: "icon.svg",
            mimeType: "image/svg+xml",
            size: 11,
          },
        },
      },
    ]);

    const { exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    const presignBody = JSON.parse(receivedPresignBody);
    assert.equal(presignBody.mimeType, "image/svg+xml", "Should detect SVG MIME type");
  });

  it("should use application/octet-stream for unknown extensions", async () => {
    const testFile = join(tempDir, "data.bin");
    writeFileSync(testFile, Buffer.from("binary-data"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {},
        handler: (_req, reqBody) => {
          receivedPresignBody = reqBody;
          return {
            status: 201,
            body: {
              data: {
                presignedUrl: `${mockServer.url}/mock-r2-upload`,
                r2Key: `${PROJECT_ID}/uuid.bin`,
                publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.bin`,
              },
            },
          };
        },
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 200,
        body: "",
      },
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets/confirm`,
        status: 201,
        body: {
          data: {
            id: "asset_bin",
            url: `https://r2.example.com/${PROJECT_ID}/uuid.bin`,
            filename: "data.bin",
            mimeType: "application/octet-stream",
            size: 11,
          },
        },
      },
    ]);

    const { exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    const presignBody = JSON.parse(receivedPresignBody);
    assert.equal(
      presignBody.mimeType,
      "application/octet-stream",
      "Should fall back to application/octet-stream"
    );
  });

  it("should output JSON when --json flag is used", async () => {
    const testFile = join(tempDir, "test.png");
    writeFileSync(testFile, Buffer.from("content"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {
          data: {
            presignedUrl: "will-be-replaced",
            r2Key: `${PROJECT_ID}/uuid.png`,
            publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.png`,
          },
        },
        handler: () => ({
          status: 201,
          body: {
            data: {
              presignedUrl: `${mockServer.url}/mock-r2-upload`,
              r2Key: `${PROJECT_ID}/uuid.png`,
              publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.png`,
            },
          },
        }),
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 200,
        body: "",
      },
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets/confirm`,
        status: 201,
        body: {
          data: {
            id: "asset_json",
            url: `https://r2.example.com/${PROJECT_ID}/uuid.png`,
            filename: "test.png",
            mimeType: "image/png",
            size: 7,
          },
        },
      },
    ]);

    const { stdout, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
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
    assert.equal(parsed.data.id, "asset_json");
    assert.equal(parsed.data.filename, "test.png");
    assert.equal(parsed.data.mimeType, "image/png");
  });

  it("should fail when file does not exist", async () => {
    // No mock server needed — error occurs before any API call
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        "/tmp/nonexistent-file-xyz.png",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code");
    assert.ok(
      stderr.includes("File not found") || stderr.includes("not found"),
      "Should show file not found error"
    );
  });

  it("should fail when --file is missing", async () => {
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.notEqual(exitCode, 0, "Should fail without --file");
    assert.ok(
      stderr.includes("file") || stderr.includes("required"),
      "Should mention missing file option"
    );
  });

  it("should fail when R2 upload returns error", async () => {
    const testFile = join(tempDir, "test-fail.png");
    writeFileSync(testFile, Buffer.from("content"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 201,
        body: {},
        handler: () => ({
          status: 201,
          body: {
            data: {
              presignedUrl: `${mockServer.url}/mock-r2-upload`,
              r2Key: `${PROJECT_ID}/uuid.png`,
              publicUrl: `https://r2.example.com/${PROJECT_ID}/uuid.png`,
            },
          },
        }),
      },
      {
        method: "PUT",
        path: "/mock-r2-upload",
        status: 403,
        body: "Forbidden",
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code on R2 error");
    assert.ok(
      stderr.includes("Upload to storage failed") || stderr.includes("403"),
      "Should show R2 upload error"
    );
  });

  it("should fail without authentication", async () => {
    const testFile = join(tempDir, "test-auth.png");
    writeFileSync(testFile, Buffer.from("content"));
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
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

  it("should handle presign API error", async () => {
    const testFile = join(tempDir, "test-presign-err.png");
    writeFileSync(testFile, Buffer.from("content"));

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "upload",
        PROJECT_ID,
        "--file",
        testFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 4, "Should exit with NOT_FOUND code");
    assert.ok(
      stderr.includes("Project not found"),
      "Should show project not found error"
    );
  });
});

describe("assets delete", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };
  let deleteCallCount: number;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-assets-delete-"));
    deleteCallCount = 0;
    mockServer = await createMockServer([
      {
        method: "DELETE",
        path: `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}`,
        status: 200,
        body: { data: { success: true } },
        handler: () => {
          deleteCallCount++;
          return { status: 200, body: { data: { success: true } } };
        },
      },
      {
        method: "DELETE",
        path: `/api/v1/projects/${PROJECT_ID}/assets/asset_nonexistent`,
        status: 404,
        body: {
          error: { code: "not_found", message: "Asset not found" },
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

  it("should delete asset with --force", async () => {
    const { stderr, exitCode } = await runCli(
      [
        "assets",
        "delete",
        PROJECT_ID,
        ASSET_ID,
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
      stderr.includes("deleted"),
      "Should show deletion confirmation"
    );
    assert.ok(
      stderr.includes(ASSET_ID),
      "Should mention the asset ID"
    );
    assert.equal(deleteCallCount, 1, "Should make DELETE request");
  });

  it("should output JSON when --json and --force flags are used", async () => {
    const { stdout, exitCode } = await runCli(
      [
        "assets",
        "delete",
        PROJECT_ID,
        ASSET_ID,
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
        "assets",
        "delete",
        PROJECT_ID,
        ASSET_ID,
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
        "assets",
        "delete",
        PROJECT_ID,
        "asset_nonexistent",
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
        path: `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}`,
        status: 403,
        body: {
          error: {
            code: "forbidden",
            message: "Insufficient permissions to delete asset",
          },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "assets",
          "delete",
          PROJECT_ID,
          ASSET_ID,
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
        "assets",
        "delete",
        PROJECT_ID,
        ASSET_ID,
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

describe("assets help", () => {
  it("should show assets in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("assets"),
      "Should show assets command in root help"
    );
  });

  it("should show all subcommands in assets help", async () => {
    const { stdout, exitCode } = await runCli(["assets", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("list"), "Should show list command");
    assert.ok(stdout.includes("upload"), "Should show upload command");
    assert.ok(stdout.includes("delete"), "Should show delete command");
  });

  it("should show upload options", async () => {
    const { stdout, exitCode } = await runCli([
      "assets",
      "upload",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--file"), "Should show --file option");
  });

  it("should show delete arguments and options", async () => {
    const { stdout, exitCode } = await runCli([
      "assets",
      "delete",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("assetId"), "Should show assetId argument");
    assert.ok(stdout.includes("--force"), "Should show --force option");
  });
});

describe("assets API error handling", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-assets-err-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "assets",
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
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 401,
        body: {
          error: { code: "unauthorized", message: "Invalid API key" },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "assets",
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
        "assets",
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
});

describe("assets verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-assets-verbose-"));
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
        path: `/api/v1/projects/${PROJECT_ID}/assets`,
        status: 200,
        body: {
          data: MOCK_ASSETS,
          pagination: { cursor: null, hasMore: false },
        },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "assets",
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
