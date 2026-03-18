/**
 * Adapter interfaces for decoupling core behavior from platform implementations.
 *
 * Core mode (OSS): single-tenant, no auth, static build output
 * Platform mode (SaaS): WorkOS auth, multi-tenant orgs, Cloudflare Pages deploy
 *
 * Consumer code imports from `@/lib/adapters` barrel — never directly from
 * these implementations. The barrel exports core adapters in the standalone
 * core app, and platform adapters in the generated dev app.
 */

// ---------------------------------------------------------------------------
// Auth Adapter
// ---------------------------------------------------------------------------

/** Minimal user shape shared across core and platform modes. */
export interface AdapterUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

/**
 * Server-side authentication adapter.
 *
 * - Core: returns a static local user, no-op signout.
 * - Platform: WorkOS AuthKit session via iron-session cookies.
 */
export interface AuthAdapter {
  /** Get the current user, or `null` if unauthenticated. */
  getUser(): Promise<AdapterUser | null>;

  /** Get the current user, or redirect to login if unauthenticated. */
  requireUser(): Promise<AdapterUser>;

  /** Sign out the current user. No-op in core mode. */
  signOut(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Context Adapter
// ---------------------------------------------------------------------------

/**
 * Tenant/organization context adapter.
 *
 * - Core: fixed `tenantId: "local"`, single-tenant.
 * - Platform: WorkOS org context with multi-tenancy.
 */
export interface ContextAdapter {
  /** Tenant identifier. `"local"` in core mode, WorkOS org ID in platform. */
  getTenantId(): string;

  /** Human-readable org/tenant name. */
  getOrgName(): string;

  /** Whether multi-tenancy is active. Always `false` in core mode. */
  isMultiTenant(): boolean;
}

// ---------------------------------------------------------------------------
// Deploy Adapter
// ---------------------------------------------------------------------------

export interface DeployOptions {
  projectId: string;
  branchId?: string;
}

export interface DeployResult {
  /** Whether the deploy/build succeeded. */
  success: boolean;
  /** URL where the deployed/built site can be accessed. */
  url: string;
  /** Human-readable status message. */
  message: string;
}

/**
 * Deployment adapter.
 *
 * - Core: static build to `dist/` via `generateSiteFiles()`.
 * - Platform: Cloudflare Pages Direct Upload.
 */
export interface DeployAdapter {
  /** Deploy or build the project. */
  publish(opts: DeployOptions): Promise<DeployResult>;

  /** Get the base URL where deployed sites are accessible. */
  getDeployUrl(projectSlug: string): string;

  /** Get the API endpoint to POST to for triggering a deploy/build. */
  getPublishEndpoint(projectId: string): string;

  /** Human-readable label for the deploy action (e.g., "Build" or "Deploy"). */
  actionLabel: string;
}

// ---------------------------------------------------------------------------
// Error Reporting Adapter
// ---------------------------------------------------------------------------

/**
 * Error reporting adapter for decoupling error tracking from the UI.
 *
 * - Core: no-op (no external error tracking).
 * - Platform: Sentry integration with user feedback dialog.
 */
export interface ErrorReportingAdapter {
  /** Report an error to the error tracking service. Returns an event ID if available. */
  captureError(
    error: Error,
    context?: Record<string, unknown>,
  ): string | undefined;

  /** Flush queued error events to the network. Call before serverless termination. */
  flush?(timeout?: number): Promise<void>;

  /** Submit user feedback to the error tracking service. Rejects on failure. */
  submitFeedback?(feedback: {
    name?: string;
    email?: string;
    message: string;
    category?: "bug" | "feature" | "question";
    screenshot?: string; // base64 data URL
    associatedEventId?: string; // Sentry event ID from error boundary
    /** Automatic diagnostic context — hidden from the user in the modal UI. */
    context?: {
      userAgent?: string;
      viewport?: string;
      screenResolution?: string;
      route?: string;
      userId?: string;
      userEmail?: string;
      orgId?: string;
      orgName?: string;
      projectId?: string;
      projectSlug?: string;
      recentErrorEventIds?: string[];
      appVersion?: string;
    };
  }): Promise<void>;
}
