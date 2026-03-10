/**
 * Analytics stub for OSS mode.
 *
 * In core standalone mode this is a complete no-op — no analytics are collected.
 * When running as part of the SaaS platform (apps/dev/), this file is replaced
 * by platform/lib/analytics.ts which provides real PostHog tracking.
 */

/** Event name type — mirrors the platform's AnalyticsEvent union but kept
 *  as a permissive string so core code compiles without knowing every event. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type AnalyticsEvent = string;

/** No-op event tracker for OSS mode. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackEvent(
  _event: AnalyticsEvent,
  _properties?: Record<string, unknown>,
): void {
  // Intentionally empty — analytics are a platform-only concern
}
