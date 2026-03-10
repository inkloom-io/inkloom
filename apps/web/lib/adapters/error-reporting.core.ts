/**
 * Core (OSS) error reporting adapter — no-op implementation.
 *
 * In standalone core mode there is no external error tracking service.
 * Errors are logged to the console for local debugging.
 */

import type { ErrorReportingAdapter } from "./types";

export const errorReportingAdapter: ErrorReportingAdapter = {
  captureError(error: Error, context?: Record<string, unknown>): void {
    // In core mode, just log to console for local debugging
    console.error("[ErrorReporting]", error, context);
  },

  // No feedback dialog in core mode
  showFeedbackDialog: undefined,
};
