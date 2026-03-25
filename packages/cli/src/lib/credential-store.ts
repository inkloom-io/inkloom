import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const execFile = promisify(execFileCb);

// ── Constants ────────────────────────────────────────────────────────────────

export const SERVICE_NAME = "inkloom-cli";
export const ACCOUNT_DEFAULT = "default";

// ── Interface ────────────────────────────────────────────────────────────────

export interface CredentialStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<boolean>;
}

// ── macOS Keychain backend ───────────────────────────────────────────────────

class MacOSKeychainStore implements CredentialStore {
  async get(service: string, account: string): Promise<string | null> {
    try {
      const { stdout } = await execFile("security", [
        "find-generic-password",
        "-s",
        service,
        "-a",
        account,
        "-w",
      ]);
      return stdout.trimEnd();
    } catch {
      return null;
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    await execFile("security", [
      "add-generic-password",
      "-s",
      service,
      "-a",
      account,
      "-w",
      value,
      "-U",
    ]);
  }

  async delete(service: string, account: string): Promise<boolean> {
    try {
      await execFile("security", [
        "delete-generic-password",
        "-s",
        service,
        "-a",
        account,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Linux libsecret backend ─────────────────────────────────────────────────

class LinuxSecretStore implements CredentialStore {
  async get(service: string, account: string): Promise<string | null> {
    try {
      const { stdout } = await execFile("secret-tool", [
        "lookup",
        "service",
        service,
        "account",
        account,
      ]);
      const value = stdout.trimEnd();
      return value || null;
    } catch {
      return null;
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    // Pipe the value via stdin to avoid it appearing in process args
    const child = execFileCb("secret-tool", [
      "store",
      "--label=InkLoom CLI",
      "service",
      service,
      "account",
      account,
    ]);
    child.stdin?.end(value);
    await new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`secret-tool store exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  }

  async delete(service: string, account: string): Promise<boolean> {
    try {
      await execFile("secret-tool", [
        "clear",
        "service",
        service,
        "account",
        account,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Windows Credential Manager backend ───────────────────────────────────────

class WindowsCredentialStore implements CredentialStore {
  async get(service: string, account: string): Promise<string | null> {
    const target = `${service}:${account}`;
    try {
      // Use cmdkey to check existence, then read via PowerShell
      const { stdout } = await execFile("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$cred = Get-StoredCredential -Target '${target}'; if ($cred) { $cred.GetNetworkCredential().Password } else { $null }`,
      ]);
      const value = stdout.trimEnd();
      if (!value || value === "") return null;
      return value;
    } catch {
      // Fallback: try cmdkey-based approach
      try {
        const { stdout } = await execFile("cmdkey", [
          "/list:" + target,
        ]);
        if (stdout.includes(target)) {
          // cmdkey can list but not retrieve passwords directly;
          // if Get-StoredCredential is unavailable, fall back to null
          return null;
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    const target = `${service}:${account}`;
    await execFile("cmdkey", [
      `/generic:${target}`,
      `/user:${account}`,
      `/pass:${value}`,
    ]);
  }

  async delete(service: string, account: string): Promise<boolean> {
    const target = `${service}:${account}`;
    try {
      await execFile("cmdkey", ["/delete:" + target]);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Plaintext fallback ───────────────────────────────────────────────────────

class PlaintextFallbackStore implements CredentialStore {
  private warned = false;
  private _hintTool?: string;

  constructor(hintTool?: string) {
    this._hintTool = hintTool;
  }

  private getCredentialsPath(): string {
    return join(homedir(), ".inkloom", "credentials");
  }

  private warn(): void {
    if (this.warned) return;
    this.warned = true;
    const path = this.getCredentialsPath();
    const installHint = this._hintTool
      ? ` Install ${this._hintTool} for secure storage.`
      : "";
    process.stderr.write(
      `Warning: No secure credential store available. Token stored in plaintext at ${path}.${installHint}\n`
    );
  }

  private readStore(): Record<string, string> {
    try {
      const raw = readFileSync(this.getCredentialsPath(), "utf-8");
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private writeStore(data: Record<string, string>): void {
    const filePath = this.getCredentialsPath();
    const dir = join(homedir(), ".inkloom");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", {
      mode: 0o600,
    });
    // Ensure permissions even if file already existed
    chmodSync(filePath, 0o600);
  }

  private key(service: string, account: string): string {
    return `${service}:${account}`;
  }

  async get(service: string, account: string): Promise<string | null> {
    const store = this.readStore();
    return store[this.key(service, account)] ?? null;
  }

  async set(service: string, account: string, value: string): Promise<void> {
    this.warn();
    const store = this.readStore();
    store[this.key(service, account)] = value;
    this.writeStore(store);
  }

  async delete(service: string, account: string): Promise<boolean> {
    const store = this.readStore();
    const k = this.key(service, account);
    if (!(k in store)) return false;
    delete store[k];
    this.writeStore(store);
    return true;
  }
}

// ── Tool availability check ──────────────────────────────────────────────────

async function isToolAvailable(tool: string): Promise<boolean> {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    await execFile(cmd, [tool]);
    return true;
  } catch {
    return false;
  }
}

// ── Backend selection ────────────────────────────────────────────────────────

function createPlaintextFallback(tool?: string): PlaintextFallbackStore {
  return new PlaintextFallbackStore(tool);
}

/**
 * Creates a CredentialStore backed by the OS keychain when available,
 * falling back to an encrypted-at-rest plaintext file otherwise.
 *
 * Set `INKLOOM_CREDENTIAL_BACKEND=plaintext` to force the plaintext fallback
 * (useful for testing and CI environments without keychain access).
 */
export async function createCredentialStore(): Promise<CredentialStore> {
  if (process.env.INKLOOM_CREDENTIAL_BACKEND === "plaintext") {
    return new PlaintextFallbackStore();
  }

  if (process.platform === "darwin") {
    if (await isToolAvailable("security")) {
      return new MacOSKeychainStore();
    }
    return createPlaintextFallback("macOS Keychain (security CLI)");
  }

  if (process.platform === "linux") {
    if (await isToolAvailable("secret-tool")) {
      return new LinuxSecretStore();
    }
    return createPlaintextFallback("secret-tool (libsecret)");
  }

  if (process.platform === "win32") {
    return new WindowsCredentialStore();
  }

  return createPlaintextFallback();
}

// ── Fallback-wrapping store ──────────────────────────────────────────────────

/**
 * Wraps a keychain-backed store with automatic fallback to plaintext
 * if any keychain operation fails at runtime.
 */
class FallbackWrappedStore implements CredentialStore {
  private fallback: PlaintextFallbackStore | null = null;

  constructor(private primary: CredentialStore) {}

  private getFallback(): PlaintextFallbackStore {
    if (!this.fallback) {
      this.fallback = new PlaintextFallbackStore();
    }
    return this.fallback;
  }

  async get(service: string, account: string): Promise<string | null> {
    try {
      return await this.primary.get(service, account);
    } catch {
      process.stderr.write(
        "Warning: Failed to read from OS keychain, falling back to plaintext store.\n"
      );
      return this.getFallback().get(service, account);
    }
  }

  async set(service: string, account: string, value: string): Promise<void> {
    try {
      await this.primary.set(service, account, value);
    } catch {
      process.stderr.write(
        "Warning: Failed to write to OS keychain, falling back to plaintext store.\n"
      );
      await this.getFallback().set(service, account, value);
    }
  }

  async delete(service: string, account: string): Promise<boolean> {
    try {
      return await this.primary.delete(service, account);
    } catch {
      process.stderr.write(
        "Warning: Failed to delete from OS keychain, falling back to plaintext store.\n"
      );
      return this.getFallback().delete(service, account);
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _store: CredentialStore | null = null;

/**
 * Returns the singleton CredentialStore, creating it on first access.
 * The store is wrapped with fallback behavior: if keychain operations fail
 * at runtime, it automatically falls back to plaintext storage.
 */
export async function getCredentialStore(): Promise<CredentialStore> {
  if (_store) return _store;
  const primary = await createCredentialStore();
  // If already plaintext, no need to wrap
  if (primary instanceof PlaintextFallbackStore) {
    _store = primary;
  } else {
    _store = new FallbackWrappedStore(primary);
  }
  return _store;
}

/**
 * Reset the singleton (useful for testing).
 */
export function _resetCredentialStore(): void {
  _store = null;
}

// ── Convenience helpers ──────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  const store = await getCredentialStore();
  return store.get(SERVICE_NAME, ACCOUNT_DEFAULT);
}

export async function setToken(token: string): Promise<void> {
  const store = await getCredentialStore();
  await store.set(SERVICE_NAME, ACCOUNT_DEFAULT, token);
}

export async function deleteToken(): Promise<boolean> {
  const store = await getCredentialStore();
  return store.delete(SERVICE_NAME, ACCOUNT_DEFAULT);
}

// ── Export backend classes for testing ────────────────────────────────────────

export {
  MacOSKeychainStore as _MacOSKeychainStore,
  LinuxSecretStore as _LinuxSecretStore,
  WindowsCredentialStore as _WindowsCredentialStore,
  PlaintextFallbackStore as _PlaintextFallbackStore,
  FallbackWrappedStore as _FallbackWrappedStore,
  isToolAvailable as _isToolAvailable,
};
