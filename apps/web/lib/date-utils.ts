/**
 * Date formatting utilities with locale support.
 *
 * `formatDistanceToNow` returns a translation key + params so callers can
 * render the localized string via next-intl's `t()`.
 *
 * `formatDate` and `formatDateTime` accept an optional locale (defaults to the
 * browser locale or "en-US") and delegate to `Intl.DateTimeFormat`.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Returns a translation key (in the "common.time" namespace) and a params
 * object for relative time formatting.
 *
 * Usage:
 * ```ts
 * const t = useTranslations("common");
 * const { key, params } = getRelativeTimeKeyAndParams(ts);
 * const label = t(key, params);
 * ```
 */
export function getRelativeTimeKeyAndParams(timestamp: number): {
  key: string;
  params?: Record<string, number>;
} {
  const diff = Date.now() - timestamp;

  if (diff < MINUTE) return { key: "time.justNow" };
  if (diff < HOUR)
    return {
      key: "time.minutesAgo",
      params: { count: Math.floor(diff / MINUTE) },
    };
  if (diff < DAY)
    return {
      key: "time.hoursAgo",
      params: { count: Math.floor(diff / HOUR) },
    };
  if (diff < WEEK)
    return {
      key: "time.daysAgo",
      params: { count: Math.floor(diff / DAY) },
    };
  if (diff < MONTH)
    return {
      key: "time.weeksAgo",
      params: { count: Math.floor(diff / WEEK) },
    };
  if (diff < YEAR)
    return {
      key: "time.monthsAgo",
      params: { count: Math.floor(diff / MONTH) },
    };
  return {
    key: "time.yearsAgo",
    params: { count: Math.floor(diff / YEAR) },
  };
}

/**
 * Formats a timestamp as a relative time string (e.g., "2h ago").
 *
 * Kept for backward compatibility — components that have not migrated to
 * `getRelativeTimeKeyAndParams` can still call this directly.
 */
export function formatDistanceToNow(timestamp: number): string {
  const { key, params } = getRelativeTimeKeyAndParams(timestamp);
  // Fallback non-localized rendering
  const map: Record<string, string> = {
    "time.justNow": "just now",
    "time.minutesAgo": `${params?.count}m ago`,
    "time.hoursAgo": `${params?.count}h ago`,
    "time.daysAgo": `${params?.count}d ago`,
    "time.weeksAgo": `${params?.count}w ago`,
    "time.monthsAgo": `${params?.count}mo ago`,
    "time.yearsAgo": `${params?.count}y ago`,
  };
  return map[key] ?? "just now";
}

/**
 * Formats a timestamp as a full date string.
 * Uses the provided locale or falls back to the browser default.
 */
export function formatDate(timestamp: number, locale?: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale ?? undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a timestamp as date and time.
 * Uses the provided locale or falls back to the browser default.
 */
export function formatDateTime(timestamp: number, locale?: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale ?? undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
