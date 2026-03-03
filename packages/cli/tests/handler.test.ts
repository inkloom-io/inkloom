import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import {
  getGlobalOpts,
  handleAction,
  handleActionNoClient,
} from "../src/lib/handler.ts";
import { CliError, EXIT_AUTH, EXIT_NOT_FOUND, EXIT_GENERAL } from "../src/lib/errors.ts";

// Env save/restore helpers
const originalEnv: Record<string, string | undefined> = {};
const envKeys = ["HOME", "INKLOOM_TOKEN", "INKLOOM_ORG_ID", "INKLOOM_API_URL"];

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

// Capture stderr for error message assertions
let stderrOutput: string;
let origStderrWrite: typeof process.stderr.write;

function captureStderr() {
  stderrOutput = "";
  origStderrWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrOutput += String(chunk);
    return true;
  }) as typeof process.stderr.write;
}

function restoreStderr() {
  process.stderr.write = origStderrWrite;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

/**
 * Create a mock Command object that simulates optsWithGlobals() output.
 * This avoids actually parsing Commander argv.
 */
function mockCommand(globalOpts: Record<string, unknown> = {}): Command {
  const root = new Command();
  root
    .option("--json")
    .option("--token <key>")
    .option("--org <orgId>")
    .option("--api-url <url>")
    .option("-v, --verbose");

  const sub = root.command("test-cmd");

  // Build argv for Commander. Using { from: "node" } means the first two
  // elements are treated as node binary + script path (and skipped).
  const argv = ["node", "test-script"];
  if (globalOpts.json) argv.push("--json");
  if (globalOpts.token) argv.push("--token", String(globalOpts.token));
  if (globalOpts.org) argv.push("--org", String(globalOpts.org));
  if (globalOpts.apiUrl) argv.push("--api-url", String(globalOpts.apiUrl));
  if (globalOpts.verbose) argv.push("--verbose");
  argv.push("test-cmd");

  // Prevent Commander from calling process.exit or writing to stderr
  root.exitOverride();
  root.configureOutput({ writeErr: () => {}, writeOut: () => {} });
  sub.exitOverride();

  try {
    root.parse(argv);
  } catch {
    // Commander throws for exitOverride; we just want opts parsed
  }

  return sub;
}

describe("getGlobalOpts", () => {
  it("should extract all global options from a command", () => {
    const cmd = mockCommand({
      json: true,
      token: "test-token",
      org: "org-123",
      apiUrl: "https://custom.example.com",
      verbose: true,
    });
    const opts = getGlobalOpts(cmd);
    assert.equal(opts.json, true);
    assert.equal(opts.token, "test-token");
    assert.equal(opts.org, "org-123");
    assert.equal(opts.apiUrl, "https://custom.example.com");
    assert.equal(opts.verbose, true);
  });

  it("should return undefined for unset options", () => {
    const cmd = mockCommand({});
    const opts = getGlobalOpts(cmd);
    assert.equal(opts.json, undefined);
    assert.equal(opts.token, undefined);
    assert.equal(opts.org, undefined);
    assert.equal(opts.apiUrl, undefined);
    assert.equal(opts.verbose, undefined);
  });

  it("should handle partial options", () => {
    const cmd = mockCommand({ token: "abc", verbose: true });
    const opts = getGlobalOpts(cmd);
    assert.equal(opts.token, "abc");
    assert.equal(opts.verbose, true);
    assert.equal(opts.json, undefined);
    assert.equal(opts.org, undefined);
  });
});

describe("handleAction", () => {
  let tempHome: string;
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-handler-test-"));
    saveEnv();
    process.env.HOME = tempHome;
    delete process.env.INKLOOM_TOKEN;
    delete process.env.INKLOOM_ORG_ID;
    delete process.env.INKLOOM_API_URL;

    // Mock process.exit to capture exit code instead of actually exiting
    exitCode = undefined;
    originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      // Throw a sentinel error to stop execution flow (like real process.exit)
      throw new Error(`__TEST_EXIT_${code}__`);
    }) as typeof process.exit;

    originalFetch = globalThis.fetch;
    captureStderr();
  });

  afterEach(() => {
    restoreEnv();
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    restoreStderr();
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("should create a client and call the action function", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    let actionCalled = false;
    let receivedClient: unknown;

    const wrapped = handleAction(async (client, _opts) => {
      actionCalled = true;
      receivedClient = client;
    });

    const cmd = mockCommand({});
    await wrapped({}, cmd);

    assert.equal(actionCalled, true, "Action function should be called");
    assert.ok(receivedClient, "Client should be passed to action");
    assert.ok(
      typeof (receivedClient as Record<string, unknown>).get === "function",
      "Client should have get method"
    );
  });

  it("should catch CliError and exit with the correct code", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    const wrapped = handleAction(async () => {
      throw new CliError("Page not found", EXIT_NOT_FOUND);
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected: our mocked process.exit throws
    }

    assert.equal(exitCode, EXIT_NOT_FOUND, "Should exit with NOT_FOUND code");
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Error:"), "Should print error prefix");
    assert.ok(plain.includes("Page not found"), "Should print error message");
  });

  it("should catch unexpected errors and exit with EXIT_GENERAL", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    const wrapped = handleAction(async () => {
      throw new TypeError("Cannot read properties of undefined");
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_GENERAL, "Should exit with GENERAL code");
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Cannot read properties of undefined"));
  });

  it("should catch non-Error throws and exit with EXIT_GENERAL", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    const wrapped = handleAction(async () => {
      throw "string error"; // eslint-disable-line no-throw-literal
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_GENERAL);
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("string error"));
  });

  it("should exit with EXIT_AUTH when no token is configured", async () => {
    // No config file, no env, no flags → no token
    const wrapped = handleAction(async () => {
      assert.fail("Action should not be called without auth");
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_AUTH, "Should exit with AUTH code");
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Not authenticated"), "Should show auth error");
  });

  it("should use token from --token flag when provided", async () => {
    let receivedConfig: unknown;

    const wrapped = handleAction(async (client) => {
      receivedConfig = client.config;
    });

    const cmd = mockCommand({ token: "flag-token-abc" });
    await wrapped({}, cmd);

    assert.ok(receivedConfig, "Config should be accessible");
    assert.equal(
      (receivedConfig as Record<string, unknown>).token,
      "flag-token-abc"
    );
  });

  it("should pass positional args through to the action function", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    let receivedArgs: unknown[];

    const wrapped = handleAction(async (_client, _opts, ...args) => {
      receivedArgs = args;
    });

    const cmd = mockCommand({});
    // Commander passes: positional args, options object, Command instance
    // handleAction slices off the last arg (Command) and passes the rest
    await wrapped("proj-id", { force: true }, cmd);

    assert.equal(receivedArgs![0], "proj-id");
    assert.deepEqual(receivedArgs![1], { force: true });
  });

  it("should format error as JSON when --json flag is set", async () => {
    const configDir = join(tempHome, ".inkloom");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ token: "test-token-123" })
    );

    const wrapped = handleAction(async () => {
      throw new CliError("Conflict", EXIT_GENERAL, {
        code: "conflict",
        message: "Conflict",
      });
    });

    const cmd = mockCommand({ json: true });
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_GENERAL);
    const parsed = JSON.parse(stderrOutput);
    assert.ok(parsed.error, "Should output JSON error");
    assert.equal(parsed.error.code, "conflict");
  });

  it("should not call action when client creation fails (no token)", async () => {
    let actionCalled = false;

    const wrapped = handleAction(async () => {
      actionCalled = true;
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected: process.exit called
    }

    assert.equal(actionCalled, false, "Action should never be called");
    assert.equal(exitCode, EXIT_AUTH);
  });
});

describe("handleActionNoClient", () => {
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    exitCode = undefined;
    originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`__TEST_EXIT_${code}__`);
    }) as typeof process.exit;
    captureStderr();
  });

  afterEach(() => {
    process.exit = originalExit;
    restoreStderr();
  });

  it("should call the action function without creating a client", async () => {
    let actionCalled = false;
    let receivedOpts: unknown;

    const wrapped = handleActionNoClient(async (opts) => {
      actionCalled = true;
      receivedOpts = opts;
    });

    const cmd = mockCommand({ json: true });
    await wrapped({}, cmd);

    assert.equal(actionCalled, true);
    assert.ok(receivedOpts, "Opts should be passed");
    assert.equal((receivedOpts as Record<string, unknown>).json, true);
  });

  it("should work without a token (unlike handleAction)", async () => {
    let actionCalled = false;

    const wrapped = handleActionNoClient(async () => {
      actionCalled = true;
    });

    const cmd = mockCommand({});
    await wrapped({}, cmd);

    assert.equal(actionCalled, true, "Should not require auth");
    assert.equal(exitCode, undefined, "Should not exit with error");
  });

  it("should catch CliError and exit with correct code", async () => {
    const wrapped = handleActionNoClient(async () => {
      throw new CliError("Custom error", EXIT_AUTH);
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_AUTH);
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Custom error"));
  });

  it("should catch unexpected errors and exit with EXIT_GENERAL", async () => {
    const wrapped = handleActionNoClient(async () => {
      throw new RangeError("Out of range");
    });

    const cmd = mockCommand({});
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_GENERAL);
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Out of range"));
  });

  it("should pass positional args through to the action function", async () => {
    let receivedArgs: unknown[];

    const wrapped = handleActionNoClient(async (_opts, ...args) => {
      receivedArgs = args;
    });

    const cmd = mockCommand({});
    await wrapped("arg1", "arg2", { localOpt: true }, cmd);

    assert.equal(receivedArgs![0], "arg1");
    assert.equal(receivedArgs![1], "arg2");
    assert.deepEqual(receivedArgs![2], { localOpt: true });
  });

  it("should format error as JSON when --json flag is set", async () => {
    const wrapped = handleActionNoClient(async () => {
      throw new CliError("Validation failed", EXIT_GENERAL, {
        code: "validation_error",
        message: "Validation failed",
        details: { field: "name" },
      });
    });

    const cmd = mockCommand({ json: true });
    try {
      await wrapped({}, cmd);
    } catch {
      // Expected
    }

    assert.equal(exitCode, EXIT_GENERAL);
    const parsed = JSON.parse(stderrOutput);
    assert.equal(parsed.error.code, "validation_error");
    assert.deepEqual(parsed.error.details, { field: "name" });
  });
});
