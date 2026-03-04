import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for the web telemetry module (server-side code paths).
 *
 * In Node.js test context, `typeof window === "undefined"` is true,
 * so these tests exercise the server-side telemetry logic.
 */

const originalEnv: Record<string, string | undefined> = {};
const envKeys = [
  "DO_NOT_TRACK",
  "INKLOOM_TELEMETRY_DISABLED",
  "INKLOOM_TELEMETRY_ENABLED",
  "INKLOOM_TELEMETRY_ENDPOINT",
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

describe("web telemetry module (server-side)", () => {
  beforeEach(() => {
    saveEnv();
    delete process.env.DO_NOT_TRACK;
    delete process.env.INKLOOM_TELEMETRY_DISABLED;
    delete process.env.INKLOOM_TELEMETRY_ENABLED;
    delete process.env.INKLOOM_TELEMETRY_ENDPOINT;
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("isTelemetryEnabled", () => {
    it("should return false by default (opt-in)", async () => {
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return false when DO_NOT_TRACK=1", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";
      process.env.DO_NOT_TRACK = "1";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return false when INKLOOM_TELEMETRY_DISABLED=1", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";
      process.env.INKLOOM_TELEMETRY_DISABLED = "1";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return true when INKLOOM_TELEMETRY_ENABLED=true", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), true);
    });

    it("should return true when INKLOOM_TELEMETRY_ENABLED=1", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "1";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), true);
    });

    it("should return false when INKLOOM_TELEMETRY_ENABLED=false", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "false";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should prioritize DO_NOT_TRACK over INKLOOM_TELEMETRY_ENABLED", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";
      process.env.DO_NOT_TRACK = "true";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should prioritize INKLOOM_TELEMETRY_DISABLED over INKLOOM_TELEMETRY_ENABLED", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";
      process.env.INKLOOM_TELEMETRY_DISABLED = "yes";
      const { isTelemetryEnabled } = await import("../telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });
  });

  describe("trackEvent", () => {
    it("should be a no-op when telemetry is disabled", async () => {
      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response("ok");
      };

      try {
        const { trackEvent } = await import("../telemetry.ts");
        await trackEvent("test_event");
        assert.equal(fetchCalled, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should send event when telemetry is enabled", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";

      let capturedBody: string | undefined;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response("ok");
      };

      try {
        const { trackEvent } = await import("../telemetry.ts");
        await trackEvent("page_created", { projectId: "proj_123" });

        assert.ok(capturedBody, "fetch should be called");
        const parsed = JSON.parse(capturedBody!);
        assert.equal(parsed.event, "page_created");
        assert.equal(parsed.properties.projectId, "proj_123");
        assert.equal(parsed.properties.source, "server");
        assert.ok(parsed.timestamp > 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should silently swallow fetch errors", async () => {
      process.env.INKLOOM_TELEMETRY_ENABLED = "true";

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error("Network error");
      };

      try {
        const { trackEvent } = await import("../telemetry.ts");
        // Should not throw
        await trackEvent("test_event");
        assert.ok(true, "Should not throw on network error");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("setTelemetryEnabled (server-side)", () => {
    it("should be a no-op on server (no localStorage)", async () => {
      const { setTelemetryEnabled } = await import("../telemetry.ts");
      // Should not throw
      setTelemetryEnabled(true);
      assert.ok(true, "setTelemetryEnabled should be a no-op on server");
    });
  });
});
