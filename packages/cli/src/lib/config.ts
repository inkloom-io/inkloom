import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

/**
 * Fully resolved config with all sources merged (flags > env > file).
 */
export interface ResolvedConfig {
  token: string | undefined;
  orgId: string | undefined;
  apiBaseUrl: string;
}

const DEFAULT_API_URL = "https://app.inkloom.io";

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
 * Resolve config from all sources with precedence:
 * CLI flags > environment variables > config file.
 */
export function resolveConfig(flags: {
  token?: string;
  org?: string;
  apiUrl?: string;
}): ResolvedConfig {
  const file = readConfig();

  const token =
    flags.token ?? process.env.INKLOOM_TOKEN ?? file.token ?? undefined;

  const orgId =
    flags.org ?? process.env.INKLOOM_ORG_ID ?? file.defaultOrgId ?? undefined;

  const apiBaseUrl =
    flags.apiUrl ??
    process.env.INKLOOM_API_URL ??
    file.apiBaseUrl ??
    DEFAULT_API_URL;

  return { token, orgId, apiBaseUrl };
}
