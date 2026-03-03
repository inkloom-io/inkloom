"use client";

/**
 * Provider barrel for core standalone mode.
 *
 * In platform dev mode (apps/dev/), a generated providers.tsx wraps
 * WorkOSProvider instead. Core mode uses CoreProviders (local user, no auth).
 */
export { CoreProviders as Providers } from "./providers.core";
