/**
 * Error reporting adapter switchpoint.
 *
 * In core mode, re-exports the core error reporting adapter (console logging).
 * In the generated dev app (apps/dev/), this file is replaced to
 * re-export the platform error reporting adapter (Sentry).
 *
 * This file exists so that client components (e.g. error.tsx)
 * can import errorReportingAdapter without pulling in authAdapter
 * (which transitively imports next/headers and breaks client bundles).
 */
export { errorReportingAdapter } from "./error-reporting.core";
