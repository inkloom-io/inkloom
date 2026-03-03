/**
 * Adapter barrel export.
 *
 * This file is the single import point for all adapter implementations.
 * Consumer code always imports from here:
 *
 *   import { authAdapter, contextAdapter, deployAdapter } from '@/lib/adapters';
 *
 * In the existing platform codebase (pre-restructure), this exports
 * platform adapters. After the restructure:
 * - `core/apps/web/lib/adapters.ts` exports core adapters
 * - `apps/dev/lib/adapters.ts` (generated) exports platform adapters
 */

export { authAdapter } from "./adapters/auth.platform";
export { contextAdapter } from "./adapters/context.platform";
export { deployAdapter } from "./adapters/deploy.platform";

export { createPlatformContextAdapter } from "./adapters/context.platform";

export type {
  AuthAdapter,
  AdapterUser,
  ContextAdapter,
  DeployAdapter,
  DeployOptions,
  DeployResult,
} from "./adapters/types";
