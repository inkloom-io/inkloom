/**
 * Sentry utilities switchpoint for core mode.
 *
 * In core mode, these are no-ops — errors are logged to console but not
 * reported to any external service. In the generated dev app (apps/dev/),
 * this file is replaced via symlink to re-export the platform Sentry
 * implementation.
 */

/**
 * Capture an exception (no-op in core mode).
 * Returns undefined since there is no Sentry event.
 */
export async function captureException(
  error: unknown,
  _context?: Record<string, unknown>
): Promise<string | undefined> {
  console.error("[sentry] captureException (core mode, no-op):", error);
  return undefined;
}

/**
 * Capture a message (no-op in core mode).
 */
export async function captureMessage(
  message: string,
  _extra?: Record<string, unknown>,
  _level: string = "info"
): Promise<string | undefined> {
  console.info("[sentry] captureMessage (core mode, no-op):", message);
  return undefined;
}

/**
 * Set the current user (no-op in core mode).
 */
export async function setUser(
  _user: { id: string; email?: string } | null
): Promise<void> {
  // No-op
}

/**
 * Add a breadcrumb (no-op in core mode).
 */
export async function addBreadcrumb(
  _message: string,
  _data?: Record<string, unknown>,
  _category?: string
): Promise<void> {
  // No-op
}
