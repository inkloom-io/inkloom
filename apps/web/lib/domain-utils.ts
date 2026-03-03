/**
 * Core-mode domain utilities.
 *
 * In platform mode, these resolve to Cloudflare-hosted URLs.
 * In core mode, sites are built to dist/ — these return local paths.
 */

export function getProductionUrl(cfSlug?: string | null): string | null {
  if (!cfSlug) return null;
  return `file://dist/${cfSlug}`;
}

export function toVanityUrl(url: string, _cfSlug?: string | null): string {
  return url;
}
