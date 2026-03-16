import type { RedirectRule } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single source→target path mapping produced during migration. */
export interface UrlMapping {
  /** Original URL path in the source docs. */
  sourcePath: string;
  /** Corresponding URL path in InkLoom. */
  targetPath: string;
}

/** Tab configuration used for SPA fallback rules. */
export interface TabConfig {
  slug: string;
}

/** Result of the redirect generation pipeline. */
export interface RedirectsResult {
  /** Cloudflare `_redirects` file content (301 rules + SPA fallback). */
  redirectsFileContent: string;
  /** Ordered list of all redirect rules (for programmatic use). */
  rules: RedirectRule[];
  /** Full URL mapping table (source path → target path). */
  urlMap: Record<string, string>;
  /** Subpath hosting guidance (undefined when no subpath detected). */
  subpathGuidance?: SubpathGuidance;
}

/** Guidance for users whose docs are hosted at a subpath. */
export interface SubpathGuidance {
  /** Detected subpath (e.g. "/docs"). */
  subpath: string;
  /** Original hostname. */
  originalHost: string;
  /** Recommended subdomain (e.g. "docs.company.com"). */
  recommendedSubdomain: string;
  /** Platform-specific redirect snippets. */
  snippets: PlatformSnippets;
}

/** Redirect configuration snippets for each supported platform. */
export interface PlatformSnippets {
  vercel: string;
  netlify: string;
  nginx: string;
  cloudflare: string;
  apache: string;
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Ensure a path starts with "/" and has no trailing slash (except root). */
function normalizePath(p: string): string {
  let path = p.trim();
  if (!path.startsWith("/")) {
    path = "/" + path;
  }
  // Remove trailing slash unless root
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path;
}

// ---------------------------------------------------------------------------
// Mintlify config redirect ingestion
// ---------------------------------------------------------------------------

/**
 * Parse redirects from a Mintlify `mint.json` / `docs.json` configuration.
 *
 * Mintlify stores redirects as an array of `{ source, destination }` objects.
 */
export function parseMintlifyRedirects(
  mintConfig: Record<string, unknown>
): RedirectRule[] {
  const raw = mintConfig["redirects"];
  if (!Array.isArray(raw)) return [];

  const rules: RedirectRule[] = [];
  for (const entry of raw) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>)["source"] === "string" &&
      typeof (entry as Record<string, unknown>)["destination"] === "string"
    ) {
      rules.push({
        from: normalizePath(
          (entry as Record<string, unknown>)["source"] as string
        ),
        to: normalizePath(
          (entry as Record<string, unknown>)["destination"] as string
        ),
        status: 301,
      });
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Gitbook config redirect ingestion
// ---------------------------------------------------------------------------

/**
 * Parse redirects from a Gitbook `.gitbook.yaml` configuration.
 *
 * Gitbook stores redirects as an object map: `{ redirects: { oldPath: newPath } }`.
 */
export function parseGitbookRedirects(
  gitbookConfig: Record<string, unknown>
): RedirectRule[] {
  const raw = gitbookConfig["redirects"];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];

  const rules: RedirectRule[] = [];
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof to === "string") {
      rules.push({
        from: normalizePath(from),
        to: normalizePath(to),
        status: 301,
      });
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// URL mapping → Redirect rules
// ---------------------------------------------------------------------------

/**
 * Convert an array of URL mappings into 301 redirect rules.
 *
 * Only creates a redirect when source and target differ.
 */
export function mappingsToRedirects(mappings: UrlMapping[]): RedirectRule[] {
  const rules: RedirectRule[] = [];
  for (const { sourcePath, targetPath } of mappings) {
    const from = normalizePath(sourcePath);
    const to = normalizePath(targetPath);
    if (from !== to) {
      rules.push({ from, to, status: 301 });
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// SPA fallback rules (mirrors platform/lib/deploy.ts:854-864)
// ---------------------------------------------------------------------------

/**
 * Generate SPA fallback rules matching the existing deploy.ts pattern.
 *
 * For each tab, a `/<tab>/*  /<tab>/index.html  200` rule is produced,
 * followed by a catch-all `/*  /index.html  200`.
 */
export function generateSpaFallbackRules(tabs: TabConfig[]): string[] {
  const lines: string[] = [];
  for (const tab of tabs) {
    lines.push(`/${tab.slug}/*  /${tab.slug}/index.html  200`);
  }
  lines.push("/*  /index.html  200");
  return lines;
}

// ---------------------------------------------------------------------------
// Merge & produce final _redirects content
// ---------------------------------------------------------------------------

/**
 * De-duplicate redirect rules, keeping the first occurrence of each `from`.
 */
function deduplicateRules(rules: RedirectRule[]): RedirectRule[] {
  const seen = new Set<string>();
  const result: RedirectRule[] = [];
  for (const rule of rules) {
    if (!seen.has(rule.from)) {
      seen.add(rule.from);
      result.push(rule);
    }
  }
  return result;
}

/**
 * Format a `RedirectRule` as a Cloudflare `_redirects` line.
 */
function formatRedirectLine(rule: RedirectRule): string {
  return `${rule.from}  ${rule.to}  ${rule.status}`;
}

/**
 * Merge all redirect sources and SPA fallback rules into a single `_redirects`
 * file content string.
 *
 * Order:
 *   1. Migration redirects (URL structure changes)
 *   2. Source config redirects (from mint.json / .gitbook.yaml)
 *   3. SPA fallback rules (200 rewrites for client-side routing)
 */
export function mergeRedirects(opts: {
  migrationRedirects: RedirectRule[];
  sourceConfigRedirects: RedirectRule[];
  tabs: TabConfig[];
}): { content: string; rules: RedirectRule[] } {
  const allRules = deduplicateRules([
    ...opts.migrationRedirects,
    ...opts.sourceConfigRedirects,
  ]);

  const spaLines = generateSpaFallbackRules(opts.tabs);

  const lines = [
    ...allRules.map(formatRedirectLine),
    ...spaLines,
  ];

  return {
    content: lines.join("\n") + "\n",
    rules: allRules,
  };
}

// ---------------------------------------------------------------------------
// Subpath detection & guidance
// ---------------------------------------------------------------------------

/**
 * Detect whether a URL has a path component beyond the root.
 *
 * Returns the subpath and hostname if detected, or `undefined` otherwise.
 */
export function detectSubpath(
  sourceUrl: string
): { subpath: string; host: string } | undefined {
  try {
    // Add protocol if missing so URL parses correctly
    let urlStr = sourceUrl.trim();
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = "https://" + urlStr;
    }
    const url = new URL(urlStr);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname && pathname !== "/") {
      return { subpath: pathname, host: url.hostname };
    }
  } catch {
    // Invalid URL — no subpath
  }
  return undefined;
}

/**
 * Generate platform-specific redirect snippets to redirect
 * `originalHost/subpath/*` → `subdomain/*`.
 */
export function generateSubpathSnippets(
  originalHost: string,
  subpath: string,
  subdomain: string
): PlatformSnippets {
  return {
    vercel: generateVercelSnippet(subpath, subdomain),
    netlify: generateNetlifySnippet(subpath, subdomain),
    nginx: generateNginxSnippet(originalHost, subpath, subdomain),
    cloudflare: generateCloudflareSnippet(originalHost, subpath, subdomain),
    apache: generateApacheSnippet(subpath, subdomain),
  };
}

function generateVercelSnippet(subpath: string, subdomain: string): string {
  return JSON.stringify(
    {
      rewrites: [
        {
          source: `${subpath}/:path*`,
          destination: `https://${subdomain}/:path*`,
        },
      ],
    },
    null,
    2
  );
}

function generateNetlifySnippet(subpath: string, subdomain: string): string {
  return `${subpath}/*  https://${subdomain}/:splat  301`;
}

function generateNginxSnippet(
  originalHost: string,
  subpath: string,
  subdomain: string
): string {
  return [
    `server {`,
    `    server_name ${originalHost};`,
    ``,
    `    location ${subpath}/ {`,
    `        return 301 https://${subdomain}$request_uri;`,
    `    }`,
    `}`,
  ].join("\n");
}

function generateCloudflareSnippet(
  originalHost: string,
  subpath: string,
  subdomain: string
): string {
  return [
    `# Cloudflare Redirect Rule`,
    `# When: URI Path starts with "${subpath}/"`,
    `# Then: Dynamic Redirect to https://${subdomain}\${http.request.uri.path} (301)`,
    `# Hostname equals "${originalHost}" AND URI Path starts with "${subpath}/"`,
  ].join("\n");
}

function generateApacheSnippet(subpath: string, subdomain: string): string {
  // Escape dots in subpath for regex
  const escapedSubpath = subpath.replace(/\./g, "\\.");
  return [
    `RewriteEngine On`,
    `RewriteRule ^${escapedSubpath}/(.*)$ https://${subdomain}/$1 [R=301,L]`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate the complete redirects output for a migration.
 *
 * @param mappings   - Source→target URL mappings from the migration.
 * @param sourceConfig - Raw config from the source platform (mint.json or .gitbook.yaml).
 * @param source     - Which platform the config is from ("mintlify" | "gitbook").
 * @param tabs       - Tab configurations for SPA fallback rules.
 * @param sourceUrl  - Optional live docs URL (for subpath detection).
 */
export function generateRedirects(opts: {
  mappings: UrlMapping[];
  sourceConfig?: Record<string, unknown>;
  source?: "mintlify" | "gitbook";
  tabs?: TabConfig[];
  sourceUrl?: string;
}): RedirectsResult {
  // 1. Convert mappings to redirect rules
  const migrationRedirects = mappingsToRedirects(opts.mappings);

  // 2. Parse source config redirects
  let sourceConfigRedirects: RedirectRule[] = [];
  if (opts.sourceConfig && opts.source) {
    sourceConfigRedirects =
      opts.source === "mintlify"
        ? parseMintlifyRedirects(opts.sourceConfig)
        : parseGitbookRedirects(opts.sourceConfig);
  }

  // 3. Merge everything
  const merged = mergeRedirects({
    migrationRedirects,
    sourceConfigRedirects,
    tabs: opts.tabs ?? [],
  });

  // 4. Build URL map
  const urlMap: Record<string, string> = {};
  for (const { sourcePath, targetPath } of opts.mappings) {
    urlMap[normalizePath(sourcePath)] = normalizePath(targetPath);
  }

  // 5. Detect subpath hosting
  let subpathGuidance: SubpathGuidance | undefined;
  if (opts.sourceUrl) {
    const detected = detectSubpath(opts.sourceUrl);
    if (detected) {
      // Derive recommended subdomain from the first path segment
      const subpathSegment = detected.subpath.split("/").filter(Boolean)[0];
      const recommendedSubdomain = subpathSegment
        ? `${subpathSegment}.${detected.host}`
        : `docs.${detected.host}`;

      subpathGuidance = {
        subpath: detected.subpath,
        originalHost: detected.host,
        recommendedSubdomain,
        snippets: generateSubpathSnippets(
          detected.host,
          detected.subpath,
          recommendedSubdomain
        ),
      };
    }
  }

  return {
    redirectsFileContent: merged.content,
    rules: merged.rules,
    urlMap,
    subpathGuidance,
  };
}
