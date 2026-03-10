/**
 * Error reporting adapter switchpoint.
 *
 * In core mode, re-exports the core error reporting adapter (no-op).
 * In the generated dev app (apps/dev/), this file is replaced to
 * re-export the platform error reporting adapter (Sentry).
 */
export { errorReportingAdapter } from "./error-reporting.core";
