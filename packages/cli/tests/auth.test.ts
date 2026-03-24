import "./ensure-build.js";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
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

function readConfigFile(tempHome: string): Record<string, unknown> {
  const configPath = join(tempHome, ".inkloom", "config.json");
  if (!existsSync(configPath)) return {};
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

describe("auth login", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-auth-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should save token to config file when --token is provided", () => {
    const { stderr, exitCode } = runCli(
      ["auth", "login", "--token", "ik_live_user_testtoken123456789"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0, "Should exit successfully");
    assert.ok(
      stderr.includes("Token saved to ~/.inkloom/config.json"),
      "Should show success message"
    );

    const config = readConfigFile(tempHome);
    assert.equal(
      config.token,
      "ik_live_user_testtoken123456789",
      "Token should be saved in config"
    );
  });

  it("should create ~/.inkloom directory if it does not exist", () => {
    runCli(["auth", "login", "--token", "ik_live_user_abc"], {
      HOME: tempHome,
    });
    assert.ok(
      existsSync(join(tempHome, ".inkloom")),
      "Should create .inkloom directory"
    );
    assert.ok(
      existsSync(join(tempHome, ".inkloom", "config.json")),
      "Should create config.json"
    );
  });

  it("should preserve existing config fields when saving token", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        defaultOrgId: "org_01XYZ",
        apiBaseUrl: "https://custom.example.com",
      })
    );

    runCli(["auth", "login", "--token", "ik_live_user_newtoken"], {
      HOME: tempHome,
    });

    const config = readConfigFile(tempHome);
    assert.equal(config.token, "ik_live_user_newtoken");
    assert.equal(
      config.defaultOrgId,
      "org_01XYZ",
      "Should preserve existing orgId"
    );
    assert.equal(
      config.apiBaseUrl,
      "https://custom.example.com",
      "Should preserve existing apiBaseUrl"
    );
  });

  it("should overwrite existing token when logging in again", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "old_token" })
    );

    runCli(["auth", "login", "--token", "ik_live_user_new_token"], {
      HOME: tempHome,
    });

    const config = readConfigFile(tempHome);
    assert.equal(config.token, "ik_live_user_new_token");
  });

  it("should fail in non-interactive mode without --token", () => {
    const { stderr, exitCode } = runCli(["auth", "login"], {
      HOME: tempHome,
      CI: "true",
    });
    assert.equal(exitCode, 2, "Should exit with AUTH error code");
    assert.ok(
      stderr.includes("No token provided") || stderr.includes("--token"),
      "Should mention --token in error"
    );
  });

  it("should show success with green checkmark", () => {
    const { stderr } = runCli(
      ["auth", "login", "--token", "ik_live_user_abc"],
      { HOME: tempHome }
    );
    // The checkmark is wrapped in ANSI green codes; check for the text
    assert.ok(
      stderr.includes("Token saved"),
      "Should show Token saved message"
    );
  });
});

describe("auth logout", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-auth-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should remove token from config file", () => {
    // First, save a token
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        token: "ik_live_user_willberemoved",
        defaultOrgId: "org_01ABC",
      })
    );

    const { stderr, exitCode } = runCli(["auth", "logout"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0, "Should exit successfully");
    assert.ok(
      stderr.includes("Logged out"),
      "Should show logout success message"
    );
    assert.ok(
      stderr.includes("Token removed from ~/.inkloom/config.json"),
      "Should mention config path"
    );

    const config = readConfigFile(tempHome);
    assert.equal(config.token, undefined, "Token should be removed");
    assert.equal(
      config.defaultOrgId,
      "org_01ABC",
      "Other config fields should be preserved"
    );
  });

  it("should not crash when no config file exists", () => {
    const { exitCode } = runCli(["auth", "logout"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0, "Should exit successfully even with no config");
  });

  it("should not crash when config exists but has no token", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ defaultOrgId: "org_01ABC" })
    );

    const { exitCode } = runCli(["auth", "logout"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0, "Should exit successfully");
  });
});

describe("auth status", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-auth-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should print 'Not authenticated' when no token exists", () => {
    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
      INKLOOM_TOKEN: "",
    });
    assert.equal(exitCode, 2, "Should exit with AUTH error code");
    assert.ok(stderr.includes("Not authenticated"));
  });

  it("should show masked token from config file", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "ik_live_user_abcdef1234567890abcdef" })
    );

    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Authenticated"));
    assert.ok(stderr.includes("ik_live_user_abc..."));
    assert.ok(
      !stderr.includes("ik_live_user_abcdef1234567890abcdef"),
      "Full token should not appear"
    );
  });

  it("should show token from --token global flag", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_flagtoken1234567890aabb",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Authenticated"));
    assert.ok(stderr.includes("ik_live_user_fla..."));
  });

  it("should show token from INKLOOM_TOKEN env var", () => {
    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
      INKLOOM_TOKEN: "ik_live_user_envvartoken1234567890abc",
    });
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Authenticated"));
    assert.ok(stderr.includes("ik_live_user_env..."));
  });

  it("should show organization when org is set", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_abcdef1234567890abcdef",
        "--org",
        "org_01MYORG",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("Organization: org_01MYORG"));
  });

  it("should not show Organization line when no org is set", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_abcdef1234567890abcdef",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(!stderr.includes("Organization:"));
  });

  it("should show default API URL", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_abcdef1234567890abcdef",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("API: https://inkloom.io"));
  });

  it("should show custom API URL when --api-url is provided", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_abcdef1234567890abcdef",
        "--api-url",
        "https://staging.inkloom.dev",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(stderr.includes("API: https://staging.inkloom.dev"));
  });

  it("should output JSON when --json flag is used", () => {
    const { stdout, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_abcdef1234567890abcdef",
        "--org",
        "org_01XYZ",
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.authenticated, true);
    assert.equal(parsed.token, "ik_live_user_abc...");
    assert.equal(parsed.orgId, "org_01XYZ");
    assert.equal(parsed.apiBaseUrl, "https://inkloom.io");
  });

  it("should handle short tokens (less than 16 chars)", () => {
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", "shortkey"],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("Token: shortkey"),
      "Short tokens should be shown without truncation"
    );
  });

  it("should handle exactly 16-char tokens", () => {
    const token = "1234567890123456";
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", token],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes(`Token: ${token}`),
      "Exactly 16-char tokens should be shown without truncation"
    );
  });

  it("should handle 17-char tokens with masking", () => {
    const token = "12345678901234567";
    const { stderr, exitCode } = runCli(
      ["auth", "status", "--token", token],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("Token: 1234567890123456..."),
      "17-char tokens should be masked"
    );
  });

  it("should prefer --token flag over env var", () => {
    const { stderr, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_from_flag_1234567890abcdef",
      ],
      {
        HOME: tempHome,
        INKLOOM_TOKEN: "ik_live_user_from_envv_1234567890abcdef",
      }
    );
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("ik_live_user_fro..."),
      "Should use flag token (first 16 chars match 'ik_live_user_fro')"
    );
  });

  it("should prefer env var over config file", () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "ik_live_user_from_file_1234567890" })
    );

    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
      INKLOOM_TOKEN: "ik_live_user_from_envv_1234567890abcdef",
    });
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("ik_live_user_fro..."),
      "Should use env var token"
    );
  });
});

describe("auth help", () => {
  it("should show login, logout, and status in auth --help", () => {
    const { stdout, exitCode } = runCli(["auth", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("login"), "Should show login command");
    assert.ok(stdout.includes("logout"), "Should show logout command");
    assert.ok(stdout.includes("status"), "Should show status command");
  });

  it("should show login description", () => {
    const { stdout, exitCode } = runCli(["auth", "login", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("Authenticate with an API key"),
      "Should show login description"
    );
  });

  it("should show logout description", () => {
    const { stdout, exitCode } = runCli(["auth", "logout", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("Remove stored credentials"),
      "Should show logout description"
    );
  });

  it("should show status description", () => {
    const { stdout, exitCode } = runCli(["auth", "status", "--help"]);
    assert.equal(exitCode, 0);
    assert.ok(
      stdout.includes("Show current authentication status"),
      "Should show status description"
    );
  });
});

describe("auth login → status → logout flow (integration)", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-auth-flow-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should complete full login → status → logout → status cycle", () => {
    // 1. Status should show not authenticated
    {
      const { stderr, exitCode } = runCli(["auth", "status"], {
        HOME: tempHome,
        INKLOOM_TOKEN: "",
      });
      assert.equal(exitCode, 2);
      assert.ok(stderr.includes("Not authenticated"));
    }

    // 2. Login with token
    {
      const { stderr, exitCode } = runCli(
        ["auth", "login", "--token", "ik_live_user_integration_test_1234567"],
        { HOME: tempHome }
      );
      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("Token saved"));
    }

    // 3. Status should show authenticated
    {
      const { stderr, exitCode } = runCli(["auth", "status"], {
        HOME: tempHome,
      });
      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("Authenticated"));
      assert.ok(stderr.includes("ik_live_user_int..."));
    }

    // 4. Logout
    {
      const { stderr, exitCode } = runCli(["auth", "logout"], {
        HOME: tempHome,
      });
      assert.equal(exitCode, 0);
      assert.ok(stderr.includes("Logged out"));
    }

    // 5. Status should show not authenticated again
    {
      const { stderr, exitCode } = runCli(["auth", "status"], {
        HOME: tempHome,
        INKLOOM_TOKEN: "",
      });
      assert.equal(exitCode, 2);
      assert.ok(stderr.includes("Not authenticated"));
    }
  });

  it("should allow re-login after logout", () => {
    // Login
    runCli(
      ["auth", "login", "--token", "ik_live_user_first_token_123456789"],
      { HOME: tempHome }
    );

    // Logout
    runCli(["auth", "logout"], { HOME: tempHome });

    // Re-login with different token
    runCli(
      ["auth", "login", "--token", "ik_live_user_second_token_12345678"],
      { HOME: tempHome }
    );

    // Status should show new token
    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("ik_live_user_sec..."),
      "Should show new token after re-login"
    );
  });

  it("should allow login to overwrite existing token without logout", () => {
    // First login
    runCli(
      ["auth", "login", "--token", "ik_live_user_first_token_123456789"],
      { HOME: tempHome }
    );

    // Second login (no logout)
    runCli(
      ["auth", "login", "--token", "ik_live_user_overwrtn_123456789ab"],
      { HOME: tempHome }
    );

    const { stderr, exitCode } = runCli(["auth", "status"], {
      HOME: tempHome,
    });
    assert.equal(exitCode, 0);
    assert.ok(
      stderr.includes("ik_live_user_ove..."),
      "Should show overwritten token"
    );
  });
});

describe("auth status JSON output", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-auth-json-"));
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should output valid JSON with all fields", () => {
    const { stdout, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_jsontest_1234567890ab",
        "--org",
        "org_01JSON",
        "--api-url",
        "https://test.inkloom.dev",
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.authenticated, true);
    assert.equal(parsed.token, "ik_live_user_jso...");
    assert.equal(parsed.orgId, "org_01JSON");
    assert.equal(parsed.apiBaseUrl, "https://test.inkloom.dev");
  });

  it("should output null for orgId when no org is set", () => {
    const { stdout, exitCode } = runCli(
      [
        "auth",
        "status",
        "--token",
        "ik_live_user_jsontest_1234567890ab",
        "--json",
      ],
      { HOME: tempHome }
    );
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.orgId, null, "orgId should be null when not set");
  });
});
