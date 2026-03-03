/**
 * Adapter barrel export.
 *
 * This file is the single import point for all adapter implementations.
 * Consumer code always imports from here:
 *
 *   import { authAdapter, contextAdapter, deployAdapter } from '@/lib/adapters';
 *
 * Core standalone mode: exports core adapters (static local user, no-op deploy).
 * Platform dev mode (apps/dev/): generated barrel exports platform adapters.
 */

export { authAdapter } from "./adapters/auth.core";
export { contextAdapter } from "./adapters/context.core";
export { deployAdapter } from "./adapters/deploy.core";

export type {
  AuthAdapter,
  AdapterUser,
  ContextAdapter,
  DeployAdapter,
  DeployOptions,
  DeployResult,
} from "./adapters/types";
