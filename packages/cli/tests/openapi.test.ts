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
          let headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

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

const MOCK_OPENAPI_STATUS = {
  specUrl: "https://r2.example.com/proj_test123/openapi/uuid.json",
  specFormat: "json",
  title: "Pet Store API",
  version: "1.0.0",
  endpointCount: 12,
  tagGroups: ["pets", "store", "users"],
  updatedAt: 1707600000000,
};

const MOCK_UPLOAD_RESPONSE = {
  assetId: "asset_openapi_001",
  summary: {
    title: "Pet Store API",
    version: "1.0.0",
    endpointCount: 12,
    tagGroups: ["pets", "store", "users"],
  },
};

const SAMPLE_OPENAPI_JSON = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Pet Store API", version: "1.0.0" },
  paths: {
    "/pets": {
      get: { summary: "List pets", operationId: "listPets" },
      post: { summary: "Create pet", operationId: "createPet" },
    },
  },
});

const SAMPLE_OPENAPI_YAML = `openapi: "3.0.0"
info:
  title: Pet Store API
  version: "1.0.0"
paths:
  /pets:
    get:
      summary: List pets
      operationId: listPets
    post:
      summary: Create pet
      operationId: createPet
`;

// --- Tests ---

describe("openapi upload", () => {
  let tempHome: string;
  let tempDir: string;
  let mockServer: { server: Server; url: string };
  let receivedBody: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-openapi-upload-home-"));
    tempDir = mkdtempSync(join(tmpdir(), "inkloom-openapi-upload-"));
    receivedBody = "";
  });

  afterEach(() => {
    if (mockServer) mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("should upload a JSON OpenAPI spec file", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: MOCK_UPLOAD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_UPLOAD_RESPONSE } };
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);

    // Verify request body
    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.format, "json", "Should auto-detect JSON format");
    assert.ok(parsed.content, "Should send content");
    assert.ok(
      parsed.content.includes("Pet Store API"),
      "Should send spec content"
    );

    // Verify output
    assert.ok(
      stderr.includes("OpenAPI spec uploaded"),
      "Should show success message"
    );
    assert.ok(stderr.includes("Pet Store API"), "Should show spec title");
    assert.ok(stderr.includes("1.0.0"), "Should show spec version");
    assert.ok(stderr.includes("12"), "Should show endpoint count");
    assert.ok(stderr.includes("pets"), "Should show tag groups");
    assert.ok(stderr.includes("store"), "Should show tag groups");
  });

  it("should upload a YAML OpenAPI spec file", async () => {
    const specFile = join(tempDir, "openapi.yaml");
    writeFileSync(specFile, SAMPLE_OPENAPI_YAML);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: MOCK_UPLOAD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_UPLOAD_RESPONSE } };
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0, `Should exit 0. stderr: ${stderr}`);

    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.format, "yaml", "Should auto-detect YAML format");
    assert.ok(parsed.content.includes("Pet Store API"), "Should send content");
  });

  it("should upload a .yml file and detect YAML format", async () => {
    const specFile = join(tempDir, "spec.yml");
    writeFileSync(specFile, SAMPLE_OPENAPI_YAML);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: MOCK_UPLOAD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_UPLOAD_RESPONSE } };
        },
      },
    ]);

    const { exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.format, "yaml", "Should detect .yml as YAML");
  });

  it("should use explicit --format override", async () => {
    // File has .json extension but we force yaml format
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_YAML);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: MOCK_UPLOAD_RESPONSE },
        handler: (_req, reqBody) => {
          receivedBody = reqBody;
          return { status: 201, body: { data: MOCK_UPLOAD_RESPONSE } };
        },
      },
    ]);

    const { exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--format",
        "yaml",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.format, "yaml", "Should use explicit format override");
  });

  it("should output JSON when --json flag is used", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: MOCK_UPLOAD_RESPONSE },
      },
    ]);

    const { stdout, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
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
    assert.equal(parsed.data.assetId, "asset_openapi_001");
    assert.ok(parsed.data.summary, "Should have summary");
    assert.equal(parsed.data.summary.title, "Pet Store API");
    assert.equal(parsed.data.summary.endpointCount, 12);
  });

  it("should fail when file does not exist", async () => {
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        "/tmp/nonexistent-openapi-spec.json",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code");
    assert.ok(
      stderr.includes("File not found"),
      "Should show file not found error"
    );
  });

  it("should fail when --file is missing", async () => {
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
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

  it("should fail with invalid --format value", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--format",
        "xml",
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code");
    assert.ok(
      stderr.includes("Invalid format") || stderr.includes("json") || stderr.includes("yaml"),
      "Should mention invalid format"
    );
  });

  it("should fail with unrecognized file extension and no --format", async () => {
    const specFile = join(tempDir, "openapi.txt");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code");
    assert.ok(
      stderr.includes("Cannot detect format") || stderr.includes("--format"),
      "Should suggest using --format flag"
    );
  });

  it("should fail without authentication", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );

    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(stderr.includes("Not authenticated"), "Should show auth error");
  });

  it("should handle API validation error", async () => {
    const specFile = join(tempDir, "bad-spec.json");
    writeFileSync(specFile, '{"not": "valid openapi"}');

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Validation failed: Missing required field: openapi",
          },
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 1, "Should exit with GENERAL code for validation error");
    assert.ok(
      stderr.includes("Validation failed"),
      "Should show validation error"
    );
  });

  it("should handle project not found error", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
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

  it("should show tags when tag groups are empty", async () => {
    const specFile = join(tempDir, "openapi.json");
    writeFileSync(specFile, SAMPLE_OPENAPI_JSON);

    const noTagsResponse = {
      assetId: "asset_openapi_002",
      summary: {
        title: "Simple API",
        version: "2.0.0",
        endpointCount: 3,
        tagGroups: [],
      },
    };

    mockServer = await createMockServer([
      {
        method: "POST",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 201,
        body: { data: noTagsResponse },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "upload",
        PROJECT_ID,
        "--file",
        specFile,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Simple API"), "Should show title");
    assert.ok(stderr.includes("2.0.0"), "Should show version");
    assert.ok(stderr.includes("3"), "Should show endpoint count");
    // Tags line should NOT appear when empty
    assert.ok(!stderr.includes("Tags:"), "Should not show Tags line when empty");
  });
});

describe("openapi status", () => {
  let tempHome: string;
  let mockServer: { server: Server; url: string };

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-openapi-status-"));
  });

  afterEach(() => {
    if (mockServer) mockServer.server.close();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should display OpenAPI status", async () => {
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 200,
        body: { data: MOCK_OPENAPI_STATUS },
      },
    ]);

    const { stdout, exitCode } = await runCli(
      [
        "openapi",
        "status",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0, `Should exit 0. stdout: ${stdout}`);
    assert.ok(stdout.includes("Pet Store API"), "Should show title");
    assert.ok(stdout.includes("1.0.0"), "Should show version");
    assert.ok(stdout.includes("json"), "Should show format");
    assert.ok(stdout.includes("12"), "Should show endpoint count");
    assert.ok(stdout.includes("pets"), "Should show tag groups");
    assert.ok(stdout.includes("store"), "Should show tag groups");
    assert.ok(stdout.includes("users"), "Should show tag groups");
    assert.ok(
      stdout.includes("2024-02-11") || stdout.includes("Updated"),
      "Should show update date"
    );
  });

  it("should show 'No OpenAPI spec configured' when null", async () => {
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 200,
        body: { data: null },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "status",
        PROJECT_ID,
        "--token",
        "ik_live_user_testtoken123456789abcdef",
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome }
    );

    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("No OpenAPI spec configured"),
      "Should show 'No OpenAPI spec configured'"
    );
  });

  it("should output JSON when --json flag is used", async () => {
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 200,
        body: { data: MOCK_OPENAPI_STATUS },
      },
    ]);

    const { stdout, exitCode } = await runCli(
      [
        "openapi",
        "status",
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
    assert.equal(parsed.data.title, "Pet Store API");
    assert.equal(parsed.data.version, "1.0.0");
    assert.equal(parsed.data.endpointCount, 12);
    assert.deepEqual(parsed.data.tagGroups, ["pets", "store", "users"]);
  });

  it("should output JSON null when no spec configured and --json", async () => {
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 200,
        body: { data: null },
      },
    ]);

    const { stdout, exitCode } = await runCli(
      [
        "openapi",
        "status",
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
    assert.equal(parsed.data, null, "Should have null data");
  });

  it("should fail without authentication", async () => {
    mockServer = await createMockServer([]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "status",
        PROJECT_ID,
        "--api-url",
        mockServer.url,
      ],
      { HOME: tempHome, INKLOOM_TOKEN: "" }
    );

    assert.equal(exitCode, 2, "Should exit with AUTH code");
    assert.ok(stderr.includes("Not authenticated"), "Should show auth error");
  });

  it("should handle project not found error", async () => {
    mockServer = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 404,
        body: {
          error: { code: "not_found", message: "Project not found" },
        },
      },
    ]);

    const { stderr, exitCode } = await runCli(
      [
        "openapi",
        "status",
        PROJECT_ID,
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

describe("openapi help", () => {
  it("should show openapi in root help", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("openapi"),
      "Should show openapi command in root help"
    );
  });

  it("should show all subcommands in openapi help", async () => {
    const { stdout, exitCode } = await runCli(["openapi", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("upload"), "Should show upload command");
    assert.ok(stdout.includes("status"), "Should show status command");
  });

  it("should show upload options", async () => {
    const { stdout, exitCode } = await runCli([
      "openapi",
      "upload",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
    assert.ok(stdout.includes("--file"), "Should show --file option");
    assert.ok(stdout.includes("--format"), "Should show --format option");
  });

  it("should show status arguments", async () => {
    const { stdout, exitCode } = await runCli([
      "openapi",
      "status",
      "--help",
    ]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("projectId"), "Should show projectId argument");
  });
});

describe("openapi verbose output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-openapi-verbose-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should show debug output with --verbose on status", async () => {
    const server = await createMockServer([
      {
        method: "GET",
        path: `/api/v1/projects/${PROJECT_ID}/openapi`,
        status: 200,
        body: { data: MOCK_OPENAPI_STATUS },
      },
    ]);

    try {
      const { stderr, exitCode } = await runCli(
        [
          "openapi",
          "status",
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
