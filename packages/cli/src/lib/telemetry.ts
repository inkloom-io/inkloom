import { readConfig, writeConfig } from "./config.js";

/**
 * Opt-in anonymous telemetry for InkLoom OSS.
 *
 * Tracks usage events (project_created, build_completed, cli_command, etc.)
 * to help the InkLoom team understand OSS adoption trends.
 *
 * Telemetry is **disabled by default** and can be disabled at any time via:
 * - `DO_NOT_TRACK=1` environment variable (standard convention)
 * - `INKLOOM_TELEMETRY_DISABLED=1` environment variable
 * - `--no-telemetry` CLI flag
 * - `inkloom config set telemetry false`
 *
 * No personally identifiable information (PII) is ever collected.
 */

const TELEMETRY_ENDPOINT =
  process.env.INKLOOM_TELEMETRY_ENDPOINT ||
  "https://telemetry.inkloom.dev/v1/events";

/** Timeout for telemetry requests (ms). Fire-and-forget, should never block CLI. */
const TELEMETRY_TIMEOUT_MS = 3000;

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Check whether telemetry is enabled.
 *
 * Precedence (first match wins):
 * 1. `--no-telemetry` flag (passed via `flagDisabled` parameter)
 * 2. `DO_NOT_TRACK` env var (any truthy value: "1", "true", "yes")
 * 3. `INKLOOM_TELEMETRY_DISABLED` env var (any truthy value)
 * 4. Config file `~/.inkloom/config.json` → `telemetryEnabled` field
 * 5. Default: disabled (opt-in)
 */
export function isTelemetryEnabled(flagDisabled?: boolean): boolean {
  // CLI flag takes highest priority
  if (flagDisabled) return false;

  // Standard DO_NOT_TRACK convention
  const dnt = process.env.DO_NOT_TRACK;
  if (dnt && isTruthy(dnt)) return false;

  // InkLoom-specific disable
  const inkloomDisabled = process.env.INKLOOM_TELEMETRY_DISABLED;
  if (inkloomDisabled && isTruthy(inkloomDisabled)) return false;

  // Check config file
  const config = readConfig();
  if (config.telemetryEnabled !== undefined) {
    return config.telemetryEnabled;
  }

  // Default: disabled (opt-in)
  return false;
}

/**
 * Persist telemetry opt-in/out preference to `~/.inkloom/config.json`.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  const config = readConfig();
  writeConfig({ ...config, telemetryEnabled: enabled });
}

/**
 * Send a telemetry event. Fire-and-forget — never throws, never blocks.
 *
 * If telemetry is disabled, this is a no-op.
 */
export async function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
  flagDisabled?: boolean
): Promise<void> {
  if (!isTelemetryEnabled(flagDisabled)) return;

  const payload: TelemetryEvent = {
    event,
    properties: {
      ...properties,
      cliVersion: getCLIVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    timestamp: Date.now(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TELEMETRY_TIMEOUT_MS
    );

    await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // Silently ignore — telemetry must never affect CLI behavior
  }
}

/**
 * Track a CLI command invocation. Convenience wrapper around `trackEvent`.
 */
export async function trackCommand(
  command: string,
  args?: Record<string, unknown>,
  flagDisabled?: boolean
): Promise<void> {
  return trackEvent("cli_command", { command, ...args }, flagDisabled);
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

let _cliVersion: string | undefined;
function getCLIVersion(): string {
  if (_cliVersion) return _cliVersion;
  try {
    // Read from package.json at build time
    _cliVersion = "0.1.0";
  } catch {
    _cliVersion = "unknown";
  }
  return _cliVersion;
}
