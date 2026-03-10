/**
 * Core-mode adapter barrel export.
 *
 * This file is the core-mode counterpart to `lib/adapters.ts`.
 * After the Phase 1 restructure, `core/apps/web/lib/adapters.ts`
 * will contain these core exports. The generated `apps/dev/lib/adapters.ts`
 * will export platform adapters instead.
 *
 * Consumer code always imports from `@/lib/adapters` — never from this
 * file directly. This file exists to prove the barrel swap works
 * (Phase 0.30 verification).
 */

export { authAdapter } from "./adapters/auth.core";
export { contextAdapter } from "./adapters/context.core";
export { deployAdapter } from "./adapters/deploy.core";
export { errorReportingAdapter } from "./adapters/error-reporting.core";

export type {
  AuthAdapter,
  AdapterUser,
  ContextAdapter,
  DeployAdapter,
  DeployOptions,
  DeployResult,
  ErrorReportingAdapter,
} from "./adapters/types";
