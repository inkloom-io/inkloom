/**
 * Opt-in anonymous telemetry for InkLoom Core (web app).
 *
 * Tracks usage events (project_created, page_created, build_completed, etc.)
 * to help the InkLoom team understand OSS adoption trends.
 *
 * Telemetry is **disabled by default** and respects:
 * - Server: `DO_NOT_TRACK=1` or `INKLOOM_TELEMETRY_DISABLED=1` env vars
 * - Client: localStorage `inkloom_telemetry_disabled` key
 *
 * No personally identifiable information (PII) is ever collected.
 */

const TELEMETRY_ENDPOINT =
  (typeof process !== "undefined" && process.env?.INKLOOM_TELEMETRY_ENDPOINT) ||
  "https://telemetry.inkloom.dev/v1/events";

const TELEMETRY_TIMEOUT_MS = 3000;

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Check if telemetry is enabled.
 *
 * Server-side checks env vars; client-side checks localStorage.
 * Telemetry is opt-in (disabled by default).
 */
export function isTelemetryEnabled(): boolean {
  // Server-side checks
  if (typeof window === "undefined") {
    const dnt = process.env.DO_NOT_TRACK;
    if (dnt && isTruthy(dnt)) return false;

    const disabled = process.env.INKLOOM_TELEMETRY_DISABLED;
    if (disabled && isTruthy(disabled)) return false;

    // Server opt-in via env var
    return isTruthy(process.env.INKLOOM_TELEMETRY_ENABLED ?? "");
  }

  // Client-side checks
  try {
    const disabled = localStorage.getItem("inkloom_telemetry_disabled");
    if (disabled && isTruthy(disabled)) return false;

    const enabled = localStorage.getItem("inkloom_telemetry_enabled");
    return enabled ? isTruthy(enabled) : false;
  } catch {
    // localStorage not available (private browsing, etc.)
    return false;
  }
}

/**
 * Set telemetry opt-in/out preference (client-side, persisted to localStorage).
 */
export function setTelemetryEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("inkloom_telemetry_enabled", enabled ? "true" : "false");
    localStorage.removeItem("inkloom_telemetry_disabled");
  } catch {
    // localStorage not available
  }
}

/**
 * Send a telemetry event. Fire-and-forget — never throws, never blocks UI.
 */
export async function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (!isTelemetryEnabled()) return;

  const payload: TelemetryEvent = {
    event,
    properties: {
      ...properties,
      source: typeof window === "undefined" ? "server" : "client",
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
    // Silently ignore — telemetry must never affect app behavior
  }
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes"].includes(value.toLowerCase());
}
