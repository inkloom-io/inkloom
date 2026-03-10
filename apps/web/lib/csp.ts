/**
 * Content Security Policy (CSP) configuration.
 *
 * Deployed in **report-only** mode so violations are logged but never block
 * functionality. Flip to enforcing once reports confirm no false positives.
 *
 * TODO: Switch from Content-Security-Policy-Report-Only to Content-Security-Policy
 *       after monitoring reports and confirming no false positives.
 */

/**
 * Build the CSP directive string for the core web application.
 *
 * The policy intentionally uses `'unsafe-inline'` for styles because:
 *  - BlockNote / ProseMirror / Tiptap inject inline styles for editor content
 *  - Mantine UI components rely on inline styles and CSS-in-JS
 *  - Removing it would break the editor and most UI components
 *
 * `'unsafe-inline'` for scripts is NOT included — all first-party scripts
 * should be served from `'self'`. When a nonce-based approach is needed for
 * inline scripts, generate a per-request nonce and pass it into this function.
 */
export function buildCspDirectives(options?: {
  /** Optional nonce for inline scripts. Include the raw value (no base64 wrapping). */
  nonce?: string;
  /** Additional connect-src domains (e.g., project-specific Convex URL). */
  extraConnectSrc?: string[];
  /** Additional script-src domains. */
  extraScriptSrc?: string[];
}): string {
  const nonce = options?.nonce;

  // -- script-src --------------------------------------------------------
  const scriptSrc = [
    "'self'",
    // Google Analytics
    "https://www.googletagmanager.com",
    // PostHog analytics
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
    // Stripe.js
    "https://js.stripe.com",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    ...(options?.extraScriptSrc ?? []),
  ];

  // -- style-src ---------------------------------------------------------
  const styleSrc = [
    "'self'",
    // BlockNote, Mantine, ProseMirror all use inline styles
    "'unsafe-inline'",
    // Google Fonts stylesheets
    "https://fonts.googleapis.com",
  ];

  // -- connect-src -------------------------------------------------------
  const connectSrc = [
    "'self'",
    // Convex backend (wildcard — actual domain comes from env)
    "https://*.convex.cloud",
    "wss://*.convex.cloud",
    // PostHog
    "https://us.i.posthog.com",
    "https://eu.i.posthog.com",
    // Google Analytics
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    // Stripe API
    "https://api.stripe.com",
    // Cloudflare API & R2
    "https://api.cloudflare.com",
    "https://*.r2.cloudflarestorage.com",
    // PartyKit collaboration (wildcard — host comes from env)
    "wss://*.partykit.dev",
    "https://*.partykit.dev",
    // GitHub API (for GitHub App integration)
    "https://api.github.com",
    ...(options?.extraConnectSrc ?? []),
  ];

  // -- font-src ----------------------------------------------------------
  const fontSrc = [
    "'self'",
    // Google Fonts static files
    "https://fonts.gstatic.com",
  ];

  // -- img-src -----------------------------------------------------------
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    // Allow images from any HTTPS source (user-uploaded, remote patterns in next.config)
    "https:",
  ];

  // -- frame-src ---------------------------------------------------------
  const frameSrc = [
    "'self'",
    // Stripe checkout iframe
    "https://js.stripe.com",
    "https://hooks.stripe.com",
  ];

  // -- worker-src --------------------------------------------------------
  const workerSrc = ["'self'", "blob:"];

  // -- media-src ---------------------------------------------------------
  const mediaSrc = ["'self'", "blob:", "https:"];

  // -- object-src --------------------------------------------------------
  const objectSrc = ["'none'"];

  // -- base-uri ----------------------------------------------------------
  const baseUri = ["'self'"];

  // -- form-action -------------------------------------------------------
  const formAction = [
    "'self'",
    // WorkOS auth redirects
    "https://api.workos.com",
    "https://authkit.workos.com",
  ];

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `font-src ${fontSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    `worker-src ${workerSrc.join(" ")}`,
    `media-src ${mediaSrc.join(" ")}`,
    `object-src ${objectSrc.join(" ")}`,
    `base-uri ${baseUri.join(" ")}`,
    `form-action ${formAction.join(" ")}`,
  ];

  return directives.join("; ");
}

/** The header name — report-only until we're confident the policy is correct. */
export const CSP_HEADER = "Content-Security-Policy-Report-Only" as const;
