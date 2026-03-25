import "./ensure-build.js";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");

function runCli(
  args: string[],
  env?: Record<string, string>
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 5000,
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("CLI global flags", () => {
  it("should show --json in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(stdout.includes("--json"), "Help should show --json flag");
  });

  it("should show --token in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(stdout.includes("--token <key>"), "Help should show --token flag");
  });

  it("should show --org in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(stdout.includes("--org <orgId>"), "Help should show --org flag");
  });

  it("should show --api-url in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(
      stdout.includes("--api-url <url>"),
      "Help should show --api-url flag"
    );
  });

  it("should show -v/--verbose in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(
      stdout.includes("-v, --verbose"),
      "Help should show -v/--verbose flag"
    );
  });

  it("should show auth command in help output", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(stdout.includes("auth"), "Help should list auth command");
  });
});

describe("auth status command", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-cli-wiring-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should print 'Not authenticated' when no token is configured", () => {
    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
      INKLOOM_TOKEN: "",
    });
    assert.equal(exitCode, 2, "Should exit with auth error code");
    assert.ok(
      stderr.includes("Not authenticated"),
      "Should print not-authenticated message"
    );
  });

  it("should show masked token when authenticated via --token flag", () => {
    const token = "ik_live_user_abcdef1234567890abcdef1234567890";
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", token],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, "Should exit successfully");
    assert.ok(stderr.includes("Authenticated"), "Should show Authenticated");
    assert.ok(
      stderr.includes("ik_live_user_abc..."),
      "Should show masked token (first 16 chars + ...)"
    );
    assert.ok(!stderr.includes(token), "Should NOT show full token");
  });

  it("should show token from config file", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "ik_live_user_config_token_here_1234567890" })
    );

    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Authenticated"));
    assert.ok(stderr.includes("ik_live_user_con..."));
  });

  it("should show token from INKLOOM_TOKEN env var", () => {
    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
      INKLOOM_TOKEN: "ik_live_user_env_token_here_1234567890aabbcc",
    });
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Authenticated"));
    assert.ok(stderr.includes("ik_live_user_env..."));
  });

  it("should show organization when --org flag is provided", () => {
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", "ik_live_user_abcdef1234567890abcdef1234567890", "--org", "org_01ABC"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("Organization: org_01ABC"),
      "Should show org ID"
    );
  });

  it("should show API base URL", () => {
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", "ik_live_user_abcdef1234567890abcdef1234567890"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("API: https://inkloom.io"),
      "Should show default API URL"
    );
  });

  it("should show custom API URL when --api-url is provided", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth", "status",
        "--token", "ik_live_user_abcdef1234567890abcdef1234567890",
        "--api-url", "https://custom.example.com",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("API: https://custom.example.com"),
      "Should show custom API URL"
    );
  });

  it("should not show Organization line when no org is set", () => {
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", "ik_live_user_abcdef1234567890abcdef1234567890"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      !stderr.includes("Organization:"),
      "Should not show Organization when not set"
    );
  });

  it("should output JSON when --json flag is used", () => {
    const { stdout, exitCode } = runCli(
      ["auth", "status", "--token", "ik_live_user_abcdef1234567890abcdef1234567890", "--org", "org_01XYZ", "--json"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.authenticated, true);
    assert.equal(parsed.token, "ik_live_user_abc...");
    assert.equal(parsed.orgId, "org_01XYZ");
    assert.equal(parsed.apiBaseUrl, "https://inkloom.io");
  });

  it("should mask short tokens correctly", () => {
    // Token shorter than 16 chars should still be shown as-is + "..."
    const shortToken = "short";
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", shortToken],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes(`Token: ${shortToken}`),
      "Short tokens should be shown without truncation"
    );
  });

  it("should prefer --token flag over INKLOOM_TOKEN env var", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth", "status",
        "--token", "ik_live_user_from_flag_1234567890abcdef",
      ],
      {
        HOME: tempHome,
        INKLOOM_TOKEN: "ik_live_user_from_envv_1234567890abcdef",
      }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("ik_live_user_fro..."),
      "Should use flag token"
    );
  });
});

describe("auth help", () => {
  it("should show auth subcommands in auth --help", () => {
    const { stdout, exitCode } = runCli(["auth", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("status"), "Should show status subcommand");
  });

  it("should show description for auth status in help", () => {
    const { stdout, exitCode } = runCli(["auth", "status", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("Show current authentication status"),
      "Should show status description"
    );
  });
});

describe("index.ts public exports", () => {
  it("should export VERSION", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));
    assert.equal(mod.VERSION, pkg.version);
  });

  it("should export createClient function", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.createClient, "function");
  });

  it("should export resolveConfig function", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.resolveConfig, "function");
  });

  it("should export readConfig function", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.readConfig, "function");
  });

  it("should export writeConfig function", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.writeConfig, "function");
  });

  it("should export CliError class", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.CliError, "function");
    const err = new mod.CliError("test");
    assert.ok(err instanceof Error);
  });

  it("should export all exit code constants", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(mod.EXIT_SUCCESS, 0);
    assert.equal(mod.EXIT_GENERAL, 1);
    assert.equal(mod.EXIT_AUTH, 2);
    assert.equal(mod.EXIT_PERMISSION, 3);
    assert.equal(mod.EXIT_NOT_FOUND, 4);
  });

  it("should export exitCodeFromApiError function", async () => {
    const mod = await import(resolve(__dirname, "../dist/index.js"));
    assert.equal(typeof mod.exitCodeFromApiError, "function");
    assert.equal(mod.exitCodeFromApiError("unauthorized"), 2);
    assert.equal(mod.exitCodeFromApiError("not_found"), 4);
  });
});
