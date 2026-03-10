import * as Sentry from "@sentry/node";
import os from "node:os";

/**
 * Sentry-based error reporting for the InkLoom CLI.
 *
 * Reports unhandled errors to Sentry for triage and debugging.
 * Respects the user's telemetry preferences:
 * - `--no-telemetry` CLI flag
 * - `INKLOOM_NO_TELEMETRY=1` environment variable
 *
 * The DSN is a public (ingest-only) key — safe to embed in OSS code.
 */

/** InkLoom public Sentry DSN (ingest-only, safe to expose). */
const SENTRY_DSN =
  "https://examplePublicKey@o0.ingest.sentry.io/0";

const CLI_VERSION = "0.1.0";

let initialized = false;
let disabled = false;

/**
 * Check whether error reporting should be disabled.
 *
 * Disabled when:
 * - `--no-telemetry` flag was passed (via `flagDisabled` parameter)
 * - `INKLOOM_NO_TELEMETRY=1` environment variable is set
 * - `DO_NOT_TRACK=1` environment variable is set (standard convention)
 * - `INKLOOM_TELEMETRY_DISABLED=1` environment variable is set
 */
function isDisabled(flagDisabled?: boolean): boolean {
  if (flagDisabled) return true;

  const noTelemetry = process.env.INKLOOM_NO_TELEMETRY;
  if (noTelemetry && isTruthy(noTelemetry)) return true;

  const dnt = process.env.DO_NOT_TRACK;
  if (dnt && isTruthy(dnt)) return true;

  const inkloomDisabled = process.env.INKLOOM_TELEMETRY_DISABLED;
  if (inkloomDisabled && isTruthy(inkloomDisabled)) return true;

  return false;
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

/**
 * Initialize Sentry error reporting.
 *
 * Call once at CLI startup. When telemetry is opted-out this is a no-op.
 *
 * @param flagDisabled - true when `--no-telemetry` CLI flag is active
 */
export function initErrorReporting(flagDisabled?: boolean): void {
  if (isDisabled(flagDisabled)) {
    disabled = true;
    return;
  }

  if (initialized) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `@inkloom/cli@${CLI_VERSION}`,
    environment: process.env.NODE_ENV || "production",
    // Never send PII
    sendDefaultPii: false,
    // Keep the CLI fast — reduce max breadcrumbs
    maxBreadcrumbs: 20,
    // Tags applied to every event
    initialScope: {
      tags: {
        "cli.version": CLI_VERSION,
        "node.version": process.version,
        "os.platform": os.platform(),
        "os.arch": os.arch(),
      },
    },
  });

  initialized = true;
}

/**
 * Report an error to Sentry with optional context.
 *
 * No-op if telemetry is disabled or Sentry was not initialized.
 */
export function reportError(
  error: unknown,
  context?: {
    /** The CLI command being executed (e.g. "pages push") */
    command?: string;
    /** Additional key-value pairs attached to the Sentry event */
    extras?: Record<string, unknown>;
  },
): void {
  if (disabled || !initialized) return;

  Sentry.withScope((scope) => {
    if (context?.command) {
      scope.setTag("cli.command", context.command);
    }
    if (context?.extras) {
      scope.setExtras(context.extras);
    }
    Sentry.captureException(error);
  });
}

/**
 * Flush pending Sentry events before the CLI process exits.
 *
 * Call before `process.exit()`. No-op if telemetry is disabled.
 *
 * @param timeoutMs - max time to wait for flush (default 2000ms)
 */
export async function shutdown(timeoutMs = 2000): Promise<void> {
  if (disabled || !initialized) return;

  await Sentry.close(timeoutMs);
}
