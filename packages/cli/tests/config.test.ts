import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We test the config module by dynamically importing it with mocked homedir.
// Since the module uses os.homedir() at call time, we override HOME env var
// and use a fresh import each test to get isolated behavior.

// Store original env values for cleanup
const originalEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]) {
  for (const key of keys) {
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

describe("config module", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-test-"));
    saveEnv(
      "HOME",
      "INKLOOM_TOKEN",
      "INKLOOM_ORG_ID",
      "INKLOOM_API_URL"
    );
    // Point homedir to temp directory
    process.env.HOME = tempHome;
    // Clear env vars to ensure clean state
    delete process.env.INKLOOM_TOKEN;
    delete process.env.INKLOOM_ORG_ID;
    delete process.env.INKLOOM_API_URL;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tempHome, { recursive: true, force: true });
  });

  describe("readConfig", () => {
    it("should return empty object when config file does not exist", async () => {
      const { readConfig } = await import("../src/lib/config.ts");
      const config = readConfig();
      assert.deepEqual(config, {});
    });

    it("should return config when file exists", async () => {
      const { readConfig, writeConfig } = await import("../src/lib/config.ts");
      writeConfig({ token: "test-token", defaultOrgId: "org_123" });
      const config = readConfig();
      assert.equal(config.token, "test-token");
      assert.equal(config.defaultOrgId, "org_123");
    });

    it("should return empty object for invalid JSON", async () => {
      const { readConfig } = await import("../src/lib/config.ts");
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(join(tempHome, ".inkloom"), { recursive: true });
      writeFileSync(
        join(tempHome, ".inkloom", "config.json"),
        "not valid json"
      );
      const config = readConfig();
      assert.deepEqual(config, {});
    });
  });

  describe("writeConfig", () => {
    it("should create ~/.inkloom directory if it does not exist", async () => {
      const { writeConfig } = await import("../src/lib/config.ts");
      writeConfig({ token: "abc" });
      assert.ok(existsSync(join(tempHome, ".inkloom")));
      assert.ok(existsSync(join(tempHome, ".inkloom", "config.json")));
    });

    it("should write valid JSON with formatting", async () => {
      const { writeConfig } = await import("../src/lib/config.ts");
      writeConfig({ token: "my-token", apiBaseUrl: "https://custom.example.com" });
      const raw = readFileSync(
        join(tempHome, ".inkloom", "config.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw);
      assert.equal(parsed.token, "my-token");
      assert.equal(parsed.apiBaseUrl, "https://custom.example.com");
      // Verify pretty-printing (2-space indent)
      assert.ok(raw.includes("  "), "Should be pretty-printed with 2-space indent");
    });

    it("should overwrite existing config", async () => {
      const { writeConfig, readConfig } = await import("../src/lib/config.ts");
      writeConfig({ token: "first" });
      writeConfig({ token: "second", defaultOrgId: "org_xyz" });
      const config = readConfig();
      assert.equal(config.token, "second");
      assert.equal(config.defaultOrgId, "org_xyz");
    });
  });

  describe("resolveConfig", () => {
    it("should return defaults when no sources provide values", async () => {
      const { resolveConfig } = await import("../src/lib/config.ts");
      const resolved = resolveConfig({});
      assert.equal(resolved.token, undefined);
      assert.equal(resolved.orgId, undefined);
      assert.equal(resolved.apiBaseUrl, "https://inkloom.io");
    });

    it("should read values from config file", async () => {
      const { writeConfig, resolveConfig } = await import(
        "../src/lib/config.ts"
      );
      writeConfig({
        token: "file-token",
        defaultOrgId: "org_file",
        apiBaseUrl: "https://file.example.com",
      });
      const resolved = resolveConfig({});
      assert.equal(resolved.token, "file-token");
      assert.equal(resolved.orgId, "org_file");
      assert.equal(resolved.apiBaseUrl, "https://file.example.com");
    });

    it("should override config file with env vars", async () => {
      const { writeConfig, resolveConfig } = await import(
        "../src/lib/config.ts"
      );
      writeConfig({
        token: "file-token",
        defaultOrgId: "org_file",
        apiBaseUrl: "https://file.example.com",
      });
      process.env.INKLOOM_TOKEN = "env-token";
      process.env.INKLOOM_ORG_ID = "org_env";
      process.env.INKLOOM_API_URL = "https://env.example.com";

      const resolved = resolveConfig({});
      assert.equal(resolved.token, "env-token");
      assert.equal(resolved.orgId, "org_env");
      assert.equal(resolved.apiBaseUrl, "https://env.example.com");
    });

    it("should override env vars with CLI flags", async () => {
      const { resolveConfig } = await import("../src/lib/config.ts");
      process.env.INKLOOM_TOKEN = "env-token";
      process.env.INKLOOM_ORG_ID = "org_env";
      process.env.INKLOOM_API_URL = "https://env.example.com";

      const resolved = resolveConfig({
        token: "flag-token",
        org: "org_flag",
        apiUrl: "https://flag.example.com",
      });
      assert.equal(resolved.token, "flag-token");
      assert.equal(resolved.orgId, "org_flag");
      assert.equal(resolved.apiBaseUrl, "https://flag.example.com");
    });

    it("should allow partial flag overrides (other values fall through)", async () => {
      const { writeConfig, resolveConfig } = await import(
        "../src/lib/config.ts"
      );
      writeConfig({
        token: "file-token",
        defaultOrgId: "org_file",
      });
      process.env.INKLOOM_ORG_ID = "org_env";

      // Only override token via flag; orgId from env, apiBaseUrl from default
      const resolved = resolveConfig({ token: "flag-token" });
      assert.equal(resolved.token, "flag-token");
      assert.equal(resolved.orgId, "org_env"); // env beats file
      assert.equal(resolved.apiBaseUrl, "https://inkloom.io"); // default
    });

    it("should handle empty string env vars as valid values", async () => {
      const { resolveConfig } = await import("../src/lib/config.ts");
      process.env.INKLOOM_TOKEN = "";
      // Empty string is still a defined value and should be used
      const resolved = resolveConfig({});
      assert.equal(resolved.token, "");
    });

    it("should treat undefined flags as not set (fall through)", async () => {
      const { writeConfig, resolveConfig } = await import(
        "../src/lib/config.ts"
      );
      writeConfig({ token: "file-token" });
      const resolved = resolveConfig({
        token: undefined,
        org: undefined,
        apiUrl: undefined,
      });
      assert.equal(resolved.token, "file-token");
    });
  });
});
