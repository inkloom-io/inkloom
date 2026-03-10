import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Store original env values for cleanup
const originalEnv: Record<string, string | undefined> = {};
const envKeys = [
  "INKLOOM_NO_TELEMETRY",
  "DO_NOT_TRACK",
  "INKLOOM_TELEMETRY_DISABLED",
  "NODE_ENV",
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

describe("error-reporting module", () => {
  beforeEach(() => {
    saveEnv();
    // Ensure clean env for each test
    delete process.env.INKLOOM_NO_TELEMETRY;
    delete process.env.DO_NOT_TRACK;
    delete process.env.INKLOOM_TELEMETRY_DISABLED;
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("initErrorReporting", () => {
    it("should be a no-op when flagDisabled is true", async () => {
      const { initErrorReporting, reportError, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      // Should not throw
      initErrorReporting(true);
      reportError(new Error("test"));
      await shutdown();
    });

    it("should be a no-op when INKLOOM_NO_TELEMETRY=1", async () => {
      process.env.INKLOOM_NO_TELEMETRY = "1";

      const { initErrorReporting, reportError, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      // Should not throw
      initErrorReporting();
      reportError(new Error("test"));
      await shutdown();
    });

    it("should be a no-op when DO_NOT_TRACK=1", async () => {
      process.env.DO_NOT_TRACK = "1";

      const { initErrorReporting, reportError, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      // Should not throw
      initErrorReporting();
      reportError(new Error("test"));
      await shutdown();
    });

    it("should be a no-op when INKLOOM_TELEMETRY_DISABLED=1", async () => {
      process.env.INKLOOM_TELEMETRY_DISABLED = "1";

      const { initErrorReporting, reportError, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      // Should not throw
      initErrorReporting();
      reportError(new Error("test"));
      await shutdown();
    });
  });

  describe("reportError", () => {
    it("should accept error with context", async () => {
      const { initErrorReporting, reportError, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      // Disabled, so all calls are no-ops
      initErrorReporting(true);

      // Should not throw with various inputs
      reportError(new Error("test error"), { command: "pages push" });
      reportError(new Error("test error"), {
        command: "build",
        extras: { projectId: "proj_123" },
      });
      reportError("string error");
      reportError(null);

      await shutdown();
    });
  });

  describe("shutdown", () => {
    it("should be safe to call multiple times", async () => {
      const { initErrorReporting, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      initErrorReporting(true);

      // Multiple calls should not throw
      await shutdown();
      await shutdown();
      await shutdown();
    });

    it("should accept custom timeout", async () => {
      const { initErrorReporting, shutdown } = await import(
        "../src/lib/error-reporting.ts"
      );

      initErrorReporting(true);
      await shutdown(500);
    });
  });
});
