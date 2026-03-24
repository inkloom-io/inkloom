import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Store original env values for cleanup
const originalEnv: Record<string, string | undefined> = {};
const envKeys = [
  "HOME",
  "INKLOOM_TOKEN",
  "INKLOOM_ORG_ID",
  "INKLOOM_API_URL",
];

function saveEnv() {
  for (const key of envKeys) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const [key, val] of Object.entries(originalEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

describe("createClient", () => {
  let tempHome: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-client-test-"));
    saveEnv();
    process.env.HOME = tempHome;
    delete process.env.INKLOOM_TOKEN;
    delete process.env.INKLOOM_ORG_ID;
    delete process.env.INKLOOM_API_URL;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tempHome, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it("should throw CliError with EXIT_AUTH when no token is available", async () => {
    const { createClient } = await import("../src/lib/client.ts");
    try {
      createClient({});
      assert.fail("Should have thrown");
    } catch (err: unknown) {
      const { CliError, EXIT_AUTH } = await import("../src/lib/errors.ts");
      assert.ok(err instanceof CliError);
      assert.equal(err.exitCode, EXIT_AUTH);
      assert.ok(err.message.includes("Not authenticated"));
    }
  });

  it("should create client successfully when token is provided via options", async () => {
    const { createClient } = await import("../src/lib/client.ts");
    const client = createClient({ token: "test-token" });
    assert.equal(client.config.token, "test-token");
    assert.equal(client.config.apiBaseUrl, "https://inkloom.io");
  });

  it("should create client with token from env var", async () => {
    process.env.INKLOOM_TOKEN = "env-token";
    const { createClient } = await import("../src/lib/client.ts");
    const client = createClient({});
    assert.equal(client.config.token, "env-token");
  });

  it("should use custom API URL from options", async () => {
    const { createClient } = await import("../src/lib/client.ts");
    const client = createClient({
      token: "test-token",
      apiUrl: "https://custom.example.com",
    });
    assert.equal(client.config.apiBaseUrl, "https://custom.example.com");
  });

  describe("HTTP methods", () => {
    it("should make GET request with auth header", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { id: "123" } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      const result = await client.get<{ id: string }>("/api/v1/projects");

      assert.equal(result.data.id, "123");
      assert.equal(fetchMock.mock.calls.length, 1);

      const [url, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(url, "https://inkloom.io/api/v1/projects");
      assert.equal(opts?.method, "GET");
      assert.equal(
        (opts?.headers as Record<string, string>)["Authorization"],
        "Bearer my-token"
      );
    });

    it("should make POST request with JSON body", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { id: "new-123", name: "Test" } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      const result = await client.post<{ id: string; name: string }>(
        "/api/v1/projects",
        { name: "Test" }
      );

      assert.equal(result.data.name, "Test");
      const [, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(opts?.method, "POST");
      assert.equal(opts?.body, JSON.stringify({ name: "Test" }));
      assert.equal(
        (opts?.headers as Record<string, string>)["Content-Type"],
        "application/json"
      );
    });

    it("should make PUT request with JSON body", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { updated: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.put("/api/v1/projects/123/content", {
        content: "# Hello",
      });

      const [, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(opts?.method, "PUT");
    });

    it("should make PATCH request with JSON body", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { patched: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.patch("/api/v1/projects/123", { name: "New Name" });

      const [, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(opts?.method, "PATCH");
    });

    it("should make DELETE request", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { deleted: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.delete("/api/v1/projects/123");

      const [, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(opts?.method, "DELETE");
    });

    it("should omit body from request when not provided", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: [] })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.get("/api/v1/projects");

      const [, opts] = fetchMock.mock.calls[0].arguments;
      assert.equal(opts?.body, undefined);
    });
  });

  describe("response with pagination", () => {
    it("should return pagination info from response", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(200, {
          data: [{ id: "1" }, { id: "2" }],
          pagination: { cursor: "abc123", hasMore: true },
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      const result = await client.get<unknown[]>("/api/v1/projects");

      assert.ok(result.pagination);
      assert.equal(result.pagination.cursor, "abc123");
      assert.equal(result.pagination.hasMore, true);
    });
  });

  describe("error handling", () => {
    it("should throw CliError with mapped exit code on API error response", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(404, {
          error: { code: "not_found", message: "Project not found" },
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError, EXIT_NOT_FOUND } = await import(
        "../src/lib/errors.ts"
      );
      const client = createClient({ token: "my-token" });

      try {
        await client.get("/api/v1/projects/nonexistent");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_NOT_FOUND);
        assert.ok(err.message.includes("Project not found"));
        assert.ok(err.message.includes("not_found"));
        assert.equal(err.apiError?.code, "not_found");
      }
    });

    it("should throw CliError with EXIT_AUTH on 401", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(401, {
          error: { code: "unauthorized", message: "Invalid API key" },
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError, EXIT_AUTH } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "bad-token" });

      try {
        await client.get("/api/v1/projects");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_AUTH);
      }
    });

    it("should throw CliError with EXIT_PERMISSION on 403", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(403, {
          error: { code: "forbidden", message: "Insufficient permissions" },
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError, EXIT_PERMISSION } = await import(
        "../src/lib/errors.ts"
      );
      const client = createClient({ token: "my-token" });

      try {
        await client.delete("/api/v1/projects/123");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_PERMISSION);
      }
    });

    it("should throw CliError with EXIT_GENERAL on validation error", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(400, {
          error: {
            code: "validation_error",
            message: "Name is required",
            details: { field: "name" },
          },
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError, EXIT_GENERAL } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "my-token" });

      try {
        await client.post("/api/v1/projects", {});
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_GENERAL);
        assert.equal(err.apiError?.details?.field, "name");
      }
    });

    it("should handle non-JSON error response gracefully", async () => {
      const fetchMock = mock.fn(async () => ({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new Error("not JSON");
        },
      }));
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "my-token" });

      try {
        await client.get("/api/v1/projects");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes("500"));
      }
    });

    it("should handle network errors", async () => {
      const fetchMock = mock.fn(async () => {
        throw new Error("ECONNREFUSED");
      });
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "my-token" });

      try {
        await client.get("/api/v1/projects");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes("Network error"));
        assert.ok(err.message.includes("ECONNREFUSED"));
      }
    });

    it("should handle error response without error field", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(502, { message: "Bad Gateway" })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "my-token" });

      try {
        await client.get("/api/v1/projects");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes("502"));
      }
    });

    it("should map status code to exit code when no API error body", async () => {
      // 401 without API error structure should still map to EXIT_AUTH
      const fetchMock = mock.fn(async () => ({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => {
          throw new Error("not JSON");
        },
      }));
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const { CliError, EXIT_AUTH } = await import("../src/lib/errors.ts");
      const client = createClient({ token: "my-token" });

      try {
        await client.get("/api/v1/projects");
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_AUTH);
      }
    });
  });

  describe("verbose mode", () => {
    it("should log debug info to stderr when verbose is true", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(200, { data: [] }, {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": "58",
        })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const stderrOutput: string[] = [];
      const originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const { createClient } = await import("../src/lib/client.ts");
        const client = createClient({ token: "my-token", verbose: true });
        await client.get("/api/v1/projects");

        const output = stderrOutput.join("");
        assert.ok(output.includes("[debug]"));
        assert.ok(output.includes("GET"));
        assert.ok(output.includes("200"));
        assert.ok(output.includes("X-RateLimit-Remaining: 58/60"));
      } finally {
        process.stderr.write = originalWrite;
      }
    });

    it("should not log debug info when verbose is false", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(200, { data: [] })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const stderrOutput: string[] = [];
      const originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const { createClient } = await import("../src/lib/client.ts");
        const client = createClient({ token: "my-token", verbose: false });
        await client.get("/api/v1/projects");

        const output = stderrOutput.join("");
        assert.ok(!output.includes("[debug]"));
      } finally {
        process.stderr.write = originalWrite;
      }
    });

    it("should skip rate limit log when headers are absent", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(200, { data: [] })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const stderrOutput: string[] = [];
      const originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const { createClient } = await import("../src/lib/client.ts");
        const client = createClient({ token: "my-token", verbose: true });
        await client.get("/api/v1/projects");

        const output = stderrOutput.join("");
        assert.ok(output.includes("[debug]"));
        assert.ok(!output.includes("X-RateLimit-Remaining"));
      } finally {
        process.stderr.write = originalWrite;
      }
    });
  });

  describe("URL construction", () => {
    it("should construct full URL from base URL and path", async () => {
      const fetchMock = mock.fn(async () =>
        mockResponse(200, { data: [] })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({
        token: "my-token",
        apiUrl: "https://custom.example.com",
      });
      await client.get("/api/v1/projects?orgId=org_123");

      const [url] = fetchMock.mock.calls[0].arguments;
      assert.equal(
        url,
        "https://custom.example.com/api/v1/projects?orgId=org_123"
      );
    });
  });

  describe("Idempotency-Key header", () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    it("should include Idempotency-Key header on POST requests", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { id: "123" } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.post("/api/v1/projects", { name: "Test" });

      const [, opts] = fetchMock.mock.calls[0].arguments;
      const key = (opts?.headers as Record<string, string>)["Idempotency-Key"];
      assert.ok(key, "Idempotency-Key header should be present");
      assert.match(key, UUID_REGEX, "Idempotency-Key should be a valid UUID");
    });

    it("should include Idempotency-Key header on PUT requests", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { updated: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.put("/api/v1/projects/123/content", { content: "# Hi" });

      const [, opts] = fetchMock.mock.calls[0].arguments;
      const key = (opts?.headers as Record<string, string>)["Idempotency-Key"];
      assert.ok(key, "Idempotency-Key header should be present");
      assert.match(key, UUID_REGEX);
    });

    it("should include Idempotency-Key header on PATCH requests", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { patched: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.patch("/api/v1/projects/123", { name: "New Name" });

      const [, opts] = fetchMock.mock.calls[0].arguments;
      const key = (opts?.headers as Record<string, string>)["Idempotency-Key"];
      assert.ok(key, "Idempotency-Key header should be present");
      assert.match(key, UUID_REGEX);
    });

    it("should NOT include Idempotency-Key header on GET requests", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: [] })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.get("/api/v1/projects");

      const [, opts] = fetchMock.mock.calls[0].arguments;
      const key = (opts?.headers as Record<string, string>)["Idempotency-Key"];
      assert.equal(key, undefined, "GET requests should not have Idempotency-Key");
    });

    it("should NOT include Idempotency-Key header on DELETE requests", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { deleted: true } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.delete("/api/v1/projects/123");

      const [, opts] = fetchMock.mock.calls[0].arguments;
      const key = (opts?.headers as Record<string, string>)["Idempotency-Key"];
      assert.equal(key, undefined, "DELETE requests should not have Idempotency-Key");
    });

    it("should generate unique keys for each request", async () => {
      const fetchMock = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
        mockResponse(200, { data: { id: "123" } })
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const { createClient } = await import("../src/lib/client.ts");
      const client = createClient({ token: "my-token" });
      await client.post("/api/v1/projects", { name: "Test1" });
      await client.post("/api/v1/projects", { name: "Test2" });

      const key1 = (fetchMock.mock.calls[0].arguments[1]?.headers as Record<string, string>)["Idempotency-Key"];
      const key2 = (fetchMock.mock.calls[1].arguments[1]?.headers as Record<string, string>)["Idempotency-Key"];
      assert.notEqual(key1, key2, "Each request should have a unique idempotency key");
    });
  });
});
