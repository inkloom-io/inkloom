/**
 * Deploy adapter switchpoint.
 *
 * In core mode, re-exports the core deploy adapter (local build).
 * In the generated dev app (apps/dev/), this file is replaced to
 * re-export the platform deploy adapter (Cloudflare Pages).
 *
 * This file exists so that client components (e.g. use-publish.ts)
 * can import deployAdapter without pulling in authAdapter (which
 * transitively imports next/headers and breaks client bundles).
 */
export { deployAdapter } from "./deploy.core";
