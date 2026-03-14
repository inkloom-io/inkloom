import type { ErrorReportingAdapter } from "./types";

/**
 * Core-mode error reporting adapter.
 *
 * No-op — errors are displayed in the UI but not reported to
 * any external service. In platform mode this is replaced with
 * the Sentry-backed implementation.
 */
export const errorReportingAdapter: ErrorReportingAdapter = {
  captureError(_error: Error, _context?: Record<string, unknown>) {
    // No-op in core mode — no external error tracking service.
  },

  submitFeedback() {
    // No-op in core mode.
  },
};
