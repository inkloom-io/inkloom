import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getToken } from "./credential-store.js";

/**
 * Config file fields stored in ~/.inkloom/config.json
 */
export interface CliConfig {
  token?: string;
  defaultOrgId?: string;
  apiBaseUrl?: string;
  /** Opt-in anonymous telemetry. Default: undefined (disabled). */
  telemetryEnabled?: boolean;
}

/** Where the active token was resolved from. */
export type TokenSource = "flag" | "environment" | "keychain" | "config" | null;

/**
 * Fully resolved config with all sources merged (flags > env > keychain > file).
 */
export interface ResolvedConfig {
  token: string | undefined;
  tokenSource: TokenSource;
  orgId: string | undefined;
  apiBaseUrl: string;
}

const DEFAULT_API_URL = "https://inkloom.io";

function getConfigDir(): string {
  return join(homedir(), ".inkloom");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Read ~/.inkloom/config.json. Returns empty object if file doesn't exist.
 */
export function readConfig(): CliConfig {
  try {
    const raw = readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

/**
 * Write config to ~/.inkloom/config.json. Creates ~/.inkloom/ if needed.
 */
export function writeConfig(config: CliConfig): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}

/**
 * Resolve non-token config synchronously (orgId, apiBaseUrl).
 * Token resolution requires async keychain access — use `resolveConfig()`.
 */
export function resolveConfigSync(flags: {
  org?: string;
  apiUrl?: string;
}): Omit<ResolvedConfig, "token" | "tokenSource"> & { fileToken: string | undefined } {
  const file = readConfig();

  const orgId =
    flags.org ?? process.env.INKLOOM_ORG_ID ?? file.defaultOrgId ?? undefined;

  const apiBaseUrl =
    flags.apiUrl ??
    process.env.INKLOOM_API_URL ??
    file.apiBaseUrl ??
    DEFAULT_API_URL;

  return { orgId, apiBaseUrl, fileToken: file.token };
}

/**
 * Resolve config from all sources with precedence:
 * 1. CLI flags (--token)
 * 2. Environment variables (INKLOOM_TOKEN)
 * 3. OS keychain (credential store)
 * 4. Config file (~/.inkloom/config.json — legacy)
 */
export async function resolveConfig(flags: {
  token?: string;
  org?: string;
  apiUrl?: string;
}): Promise<ResolvedConfig> {
  const { orgId, apiBaseUrl, fileToken } = resolveConfigSync(flags);

  // Resolve token with source tracking
  let token: string | undefined;
  let tokenSource: TokenSource = null;

  if (flags.token) {
    token = flags.token;
    tokenSource = "flag";
  } else if (process.env.INKLOOM_TOKEN) {
    token = process.env.INKLOOM_TOKEN;
    tokenSource = "environment";
  } else {
    const keychainToken = await getToken();
    if (keychainToken) {
      token = keychainToken;
      tokenSource = "keychain";
    } else if (fileToken) {
      token = fileToken;
      tokenSource = "config";
    }
  }

  return { token, tokenSource, orgId, apiBaseUrl };
}
