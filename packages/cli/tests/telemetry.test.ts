import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Store original env values for cleanup
const originalEnv: Record<string, string | undefined> = {};
const envKeys = [
  "HOME",
  "DO_NOT_TRACK",
  "INKLOOM_TELEMETRY_DISABLED",
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

describe("telemetry module", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-telemetry-test-"));
    saveEnv();
    process.env.HOME = tempHome;
    // Ensure clean env for each test
    delete process.env.DO_NOT_TRACK;
    delete process.env.INKLOOM_TELEMETRY_DISABLED;
    delete process.env.INKLOOM_TELEMETRY_ENDPOINT;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tempHome, { recursive: true, force: true });
  });

  describe("isTelemetryEnabled", () => {
    it("should return false by default (opt-in)", async () => {
      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return false when flagDisabled is true", async () => {
      // Even if config says enabled, flag takes priority
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(true), false);
    });

    it("should return false when DO_NOT_TRACK=1", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );
      process.env.DO_NOT_TRACK = "1";

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return false when DO_NOT_TRACK=true", async () => {
      process.env.DO_NOT_TRACK = "true";
      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return false when DO_NOT_TRACK=yes", async () => {
      process.env.DO_NOT_TRACK = "yes";
      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should ignore DO_NOT_TRACK with non-truthy values", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );
      process.env.DO_NOT_TRACK = "0";

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), true);
    });

    it("should return false when INKLOOM_TELEMETRY_DISABLED=1", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );
      process.env.INKLOOM_TELEMETRY_DISABLED = "1";

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should return true when config has telemetryEnabled: true", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), true);
    });

    it("should return false when config has telemetryEnabled: false", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: false })
      );

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      assert.equal(isTelemetryEnabled(), false);
    });

    it("should respect precedence: flag > env > config", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      const { isTelemetryEnabled } = await import("../src/lib/telemetry.ts");

      // Config says enabled → true
      assert.equal(isTelemetryEnabled(), true);

      // DO_NOT_TRACK overrides config → false
      process.env.DO_NOT_TRACK = "1";
      assert.equal(isTelemetryEnabled(), false);

      // Flag overrides everything → false
      delete process.env.DO_NOT_TRACK;
      assert.equal(isTelemetryEnabled(true), false);
    });
  });

  describe("setTelemetryEnabled", () => {
    it("should persist telemetry preference to config", async () => {
      const { setTelemetryEnabled, isTelemetryEnabled } = await import(
        "../src/lib/telemetry.ts"
      );

      // Initially disabled
      assert.equal(isTelemetryEnabled(), false);

      // Enable
      setTelemetryEnabled(true);
      assert.equal(isTelemetryEnabled(), true);

      // Verify persisted to file
      const raw = readFileSync(
        join(tempHome, ".inkloom", "config.json"),
        "utf-8"
      );
      const config = JSON.parse(raw);
      assert.equal(config.telemetryEnabled, true);

      // Disable
      setTelemetryEnabled(false);
      assert.equal(isTelemetryEnabled(), false);

      const raw2 = readFileSync(
        join(tempHome, ".inkloom", "config.json"),
        "utf-8"
      );
      const config2 = JSON.parse(raw2);
      assert.equal(config2.telemetryEnabled, false);
    });

    it("should preserve other config fields", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ token: "my-token", defaultOrgId: "org_123" })
      );

      const { setTelemetryEnabled } = await import("../src/lib/telemetry.ts");
      setTelemetryEnabled(true);

      const raw = readFileSync(join(configDir, "config.json"), "utf-8");
      const config = JSON.parse(raw);
      assert.equal(config.token, "my-token");
      assert.equal(config.defaultOrgId, "org_123");
      assert.equal(config.telemetryEnabled, true);
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
        const { trackEvent } = await import("../src/lib/telemetry.ts");
        await trackEvent("test_event", { key: "value" });
        assert.equal(fetchCalled, false, "fetch should not be called when telemetry is disabled");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should send event when telemetry is enabled", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      let capturedBody: string | undefined;
      let capturedUrl: string | undefined;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        return new Response("ok");
      };

      try {
        const { trackEvent } = await import("../src/lib/telemetry.ts");
        await trackEvent("build_completed", { pageCount: 5 });

        assert.ok(capturedUrl, "fetch should be called");
        assert.ok(capturedUrl!.includes("telemetry"), "should hit telemetry endpoint");

        const parsed = JSON.parse(capturedBody!);
        assert.equal(parsed.event, "build_completed");
        assert.equal(parsed.properties.pageCount, 5);
        assert.equal(parsed.properties.platform, process.platform);
        assert.ok(parsed.timestamp > 0, "should have timestamp");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should not send when flagDisabled is true even if config enabled", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response("ok");
      };

      try {
        const { trackEvent } = await import("../src/lib/telemetry.ts");
        await trackEvent("test_event", {}, true);
        assert.equal(fetchCalled, false, "fetch should not be called when flag is set");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should silently swallow fetch errors", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error("Network error");
      };

      try {
        const { trackEvent } = await import("../src/lib/telemetry.ts");
        // Should not throw
        await trackEvent("test_event", { key: "value" });
        assert.ok(true, "Should not throw on fetch error");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should include standard properties in every event", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      let capturedBody: string | undefined;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response("ok");
      };

      try {
        const { trackEvent } = await import("../src/lib/telemetry.ts");
        await trackEvent("cli_command", { command: "build" });

        const parsed = JSON.parse(capturedBody!);
        assert.ok(parsed.properties.cliVersion, "should include CLI version");
        assert.ok(parsed.properties.nodeVersion, "should include Node version");
        assert.ok(parsed.properties.platform, "should include platform");
        assert.ok(parsed.properties.arch, "should include architecture");
        assert.equal(parsed.properties.command, "build", "should include custom properties");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("trackCommand", () => {
    it("should send cli_command event with command name", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      let capturedBody: string | undefined;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response("ok");
      };

      try {
        const { trackCommand } = await import("../src/lib/telemetry.ts");
        await trackCommand("build", { projectId: "proj_123" });

        const parsed = JSON.parse(capturedBody!);
        assert.equal(parsed.event, "cli_command");
        assert.equal(parsed.properties.command, "build");
        assert.equal(parsed.properties.projectId, "proj_123");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should respect flagDisabled parameter", async () => {
      const configDir = join(tempHome, ".inkloom");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ telemetryEnabled: true })
      );

      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response("ok");
      };

      try {
        const { trackCommand } = await import("../src/lib/telemetry.ts");
        await trackCommand("build", {}, true);
        assert.equal(fetchCalled, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

describe("telemetry CLI flag integration", () => {
  it("--no-telemetry flag should be parsed by Commander", async () => {
    const { Command } = await import("commander");
    const { getGlobalOpts } = await import("../src/lib/handler.ts");

    const root = new Command();
    root
      .option("--json")
      .option("--token <key>")
      .option("--org <orgId>")
      .option("--api-url <url>")
      .option("-v, --verbose")
      .option("--no-telemetry");

    const sub = root.command("test-cmd");

    root.exitOverride();
    root.configureOutput({ writeErr: () => {}, writeOut: () => {} });
    sub.exitOverride();

    try {
      root.parse(["node", "test-script", "--no-telemetry", "test-cmd"]);
    } catch {
      // Commander throws for exitOverride
    }

    const opts = getGlobalOpts(sub);
    assert.equal(opts.noTelemetry, true, "--no-telemetry should set noTelemetry to true");
  });

  it("without --no-telemetry flag, noTelemetry should be false", async () => {
    const { Command } = await import("commander");
    const { getGlobalOpts } = await import("../src/lib/handler.ts");

    const root = new Command();
    root
      .option("--json")
      .option("--token <key>")
      .option("--org <orgId>")
      .option("--api-url <url>")
      .option("-v, --verbose")
      .option("--no-telemetry");

    const sub = root.command("test-cmd");

    root.exitOverride();
    root.configureOutput({ writeErr: () => {}, writeOut: () => {} });
    sub.exitOverride();

    try {
      root.parse(["node", "test-script", "test-cmd"]);
    } catch {
      // Commander throws for exitOverride
    }

    const opts = getGlobalOpts(sub);
    assert.equal(opts.noTelemetry, false, "noTelemetry should be false when flag not passed");
  });
});
