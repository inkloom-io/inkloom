import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

// ── Plaintext fallback tests (always runnable) ──────────────────────────────

describe("PlaintextFallbackStore", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-cred-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  async function getFreshModule() {
    // Dynamic import to pick up the mocked HOME env
    const mod = await import("../src/lib/credential-store.js");
    mod._resetCredentialStore();
    return mod;
  }

  it("returns null for non-existent credential", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    const result = await store.get("test-service", "test-account");
    assert.equal(result, null);
  });

  it("stores and retrieves a credential", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    await store.set("test-service", "test-account", "my-secret-token");
    const result = await store.get("test-service", "test-account");
    assert.equal(result, "my-secret-token");
  });

  it("deletes a credential", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    await store.set("test-service", "test-account", "my-secret-token");
    const deleted = await store.delete("test-service", "test-account");
    assert.equal(deleted, true);
    const result = await store.get("test-service", "test-account");
    assert.equal(result, null);
  });

  it("returns false when deleting non-existent credential", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    const deleted = await store.delete("test-service", "nonexistent");
    assert.equal(deleted, false);
  });

  it("creates credentials file with restrictive permissions", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    await store.set("test-service", "test-account", "secret");
    const credPath = join(tempHome, ".inkloom", "credentials");
    assert.ok(existsSync(credPath), "credentials file should exist");
    const stats = statSync(credPath);
    // 0o600 = owner read/write only
    const mode = stats.mode & 0o777;
    assert.equal(mode, 0o600, `Expected mode 0600, got ${mode.toString(8)}`);
  });

  it("stores credentials in JSON format with service:account key", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    await store.set("my-svc", "my-acct", "tok123");
    const credPath = join(tempHome, ".inkloom", "credentials");
    const raw = readFileSync(credPath, "utf-8");
    const data = JSON.parse(raw);
    assert.equal(data["my-svc:my-acct"], "tok123");
  });

  it("handles multiple credentials", async () => {
    const { _PlaintextFallbackStore } = await getFreshModule();
    const store = new _PlaintextFallbackStore();
    await store.set("svc1", "acct1", "token1");
    await store.set("svc2", "acct2", "token2");
    assert.equal(await store.get("svc1", "acct1"), "token1");
    assert.equal(await store.get("svc2", "acct2"), "token2");
  });
});

// ── createCredentialStore backend selection tests ────────────────────────────

describe("createCredentialStore", () => {
  it("exports the expected constants", async () => {
    const { SERVICE_NAME, ACCOUNT_DEFAULT } = await import(
      "../src/lib/credential-store.js"
    );
    assert.equal(SERVICE_NAME, "inkloom-cli");
    assert.equal(ACCOUNT_DEFAULT, "default");
  });

  it("exports convenience helper functions", async () => {
    const { getToken, setToken, deleteToken } = await import(
      "../src/lib/credential-store.js"
    );
    assert.equal(typeof getToken, "function");
    assert.equal(typeof setToken, "function");
    assert.equal(typeof deleteToken, "function");
  });
});

// ── macOS Keychain command generation tests ──────────────────────────────────

describe("MacOSKeychainStore", () => {
  it("calls security find-generic-password for get", async () => {
    const { _MacOSKeychainStore } = await import(
      "../src/lib/credential-store.js"
    );
    const store = new _MacOSKeychainStore();
    // We can't actually run security in CI, but we can verify the store
    // is instantiable and has the right methods
    assert.equal(typeof store.get, "function");
    assert.equal(typeof store.set, "function");
    assert.equal(typeof store.delete, "function");
  });
});

describe("LinuxSecretStore", () => {
  it("is instantiable with correct interface", async () => {
    const { _LinuxSecretStore } = await import(
      "../src/lib/credential-store.js"
    );
    const store = new _LinuxSecretStore();
    assert.equal(typeof store.get, "function");
    assert.equal(typeof store.set, "function");
    assert.equal(typeof store.delete, "function");
  });
});

describe("WindowsCredentialStore", () => {
  it("is instantiable with correct interface", async () => {
    const { _WindowsCredentialStore } = await import(
      "../src/lib/credential-store.js"
    );
    const store = new _WindowsCredentialStore();
    assert.equal(typeof store.get, "function");
    assert.equal(typeof store.set, "function");
    assert.equal(typeof store.delete, "function");
  });
});

// ── FallbackWrappedStore tests ───────────────────────────────────────────────

describe("FallbackWrappedStore", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "inkloom-cred-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("delegates to primary store on success", async () => {
    const { _FallbackWrappedStore } = await import(
      "../src/lib/credential-store.js"
    );

    const mockPrimary = {
      get: async () => "from-primary",
      set: async () => {},
      delete: async () => true,
    };

    const wrapped = new _FallbackWrappedStore(mockPrimary);
    const result = await wrapped.get("svc", "acct");
    assert.equal(result, "from-primary");
  });

  it("falls back to plaintext on primary failure for get", async () => {
    const { _FallbackWrappedStore, _PlaintextFallbackStore } = await import(
      "../src/lib/credential-store.js"
    );

    const failingPrimary = {
      get: async () => {
        throw new Error("keychain locked");
      },
      set: async () => {
        throw new Error("keychain locked");
      },
      delete: async () => {
        throw new Error("keychain locked");
      },
    };

    const wrapped = new _FallbackWrappedStore(failingPrimary);
    // Should not throw, returns null since plaintext store is empty
    const result = await wrapped.get("svc", "acct");
    assert.equal(result, null);
  });

  it("falls back to plaintext on primary failure for set", async () => {
    const { _FallbackWrappedStore } = await import(
      "../src/lib/credential-store.js"
    );

    const failingPrimary = {
      get: async () => {
        throw new Error("keychain locked");
      },
      set: async () => {
        throw new Error("keychain locked");
      },
      delete: async () => {
        throw new Error("keychain locked");
      },
    };

    const wrapped = new _FallbackWrappedStore(failingPrimary);
    // Should not throw
    await wrapped.set("svc", "acct", "secret");
    // Verify it was stored in plaintext
    const credPath = join(tempHome, ".inkloom", "credentials");
    assert.ok(existsSync(credPath), "plaintext file should be created");
  });

  it("falls back to plaintext on primary failure for delete", async () => {
    const { _FallbackWrappedStore } = await import(
      "../src/lib/credential-store.js"
    );

    const failingPrimary = {
      get: async () => {
        throw new Error("keychain locked");
      },
      set: async () => {
        throw new Error("keychain locked");
      },
      delete: async () => {
        throw new Error("keychain locked");
      },
    };

    const wrapped = new _FallbackWrappedStore(failingPrimary);
    const result = await wrapped.delete("svc", "acct");
    assert.equal(result, false);
  });
});

// ── isToolAvailable tests ────────────────────────────────────────────────────

describe("isToolAvailable", () => {
  it("returns true for a tool that exists (node)", async () => {
    const { _isToolAvailable } = await import(
      "../src/lib/credential-store.js"
    );
    const result = await _isToolAvailable("node");
    assert.equal(result, true);
  });

  it("returns false for a tool that does not exist", async () => {
    const { _isToolAvailable } = await import(
      "../src/lib/credential-store.js"
    );
    const result = await _isToolAvailable(
      "nonexistent-tool-that-should-not-exist-12345"
    );
    assert.equal(result, false);
  });
});
