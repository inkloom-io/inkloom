interface AssetManifest {
  js: string[];
  css: string[];
}

interface SiteConfig {
  title: string;
  description: string;
  logo?: string;
}

interface OgMeta {
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogUrl: string;
  ogSiteName: string;
  ogType: string;
  twitterCard: string;
}

interface PageHtmlOptions {
  siteConfig: SiteConfig;
  assetManifest: AssetManifest;
  pageTitle: string;
  pageDescription?: string;
  pageContent: string;
  pagePath: string;
  siteData: object;
  themeCss: string;
  themeFontsUrl?: string;
  pageIcon?: string;
  pageSubtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
  /** Folder names from innermost to outermost for the breadcrumb title */
  folderTrail?: string[];
  faviconPath?: string;
  ogMeta?: OgMeta;
  noindex?: boolean;
  jsonLd?: object;
  customCss?: string;
  customFontsUrl?: string;
  customFontsCss?: string;
  analyticsSnippets?: string;
  customHeadScripts?: string;
  customBodyScripts?: string;
  /** Show "Built with InkLoom" badge. Defaults to true. */
  showBranding?: boolean;
}

interface ShellHtmlOptions {
  siteConfig: SiteConfig;
  assetManifest: AssetManifest;
  siteData: object;
  themeCss: string;
  themeFontsUrl?: string;
  faviconPath?: string;
  ogMeta?: OgMeta;
  jsonLd?: object;
  customCss?: string;
  customFontsUrl?: string;
  customFontsCss?: string;
  analyticsSnippets?: string;
  customHeadScripts?: string;
  customBodyScripts?: string;
  /** Show "Built with InkLoom" badge. Defaults to true. */
  showBranding?: boolean;
}

/**
 * Strip JSX component tags from MDX content, leaving plain markdown
 * for pre-rendering in HTML (SEO purposes).
 */
function stripJsxTags(content: string): string {
  // Remove self-closing JSX tags: <Component ... />
  let stripped = content.replace(/<[A-Z]\w*[^>]*\/>/g, "");
  // Remove JSX opening + closing tags but keep inner content
  stripped = stripped.replace(/<[A-Z]\w*[^>]*>([\s\S]*?)<\/[A-Z]\w*>/g, "$1");
  // Remove any remaining JSX-only tags
  stripped = stripped.replace(/<\/?[A-Z]\w*[^>]*>/g, "");
  return stripped.trim();
}

/**
 * Simple markdown to HTML conversion for pre-rendered content.
 * Only handles basic markdown for SEO - the SPA handles full rendering.
 */
function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs (wrap non-tag lines)
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed;
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return html;
}

function generateHeadExtras(opts: {
  faviconPath?: string;
  ogMeta?: OgMeta;
  noindex?: boolean;
  jsonLd?: object;
  customFontsUrl?: string;
  customFontsCss?: string;
  customCss?: string;
  analyticsSnippets?: string;
  customHeadScripts?: string;
}): string {
  const parts: string[] = [];

  // Favicon
  if (opts.faviconPath) {
    parts.push(`<link rel="icon" href="${opts.faviconPath}" />`);
  }

  // OG meta tags
  if (opts.ogMeta) {
    const og = opts.ogMeta;
    parts.push(`<meta property="og:title" content="${escapeHtml(og.ogTitle)}" />`);
    parts.push(`<meta property="og:description" content="${escapeHtml(og.ogDescription)}" />`);
    parts.push(`<meta property="og:url" content="${escapeHtml(og.ogUrl)}" />`);
    parts.push(`<meta property="og:site_name" content="${escapeHtml(og.ogSiteName)}" />`);
    parts.push(`<meta property="og:type" content="${og.ogType}" />`);
    if (og.ogImage) {
      parts.push(`<meta property="og:image" content="${escapeHtml(og.ogImage)}" />`);
    }
    parts.push(`<meta name="twitter:card" content="${og.twitterCard}" />`);
    parts.push(`<meta name="twitter:title" content="${escapeHtml(og.ogTitle)}" />`);
    parts.push(`<meta name="twitter:description" content="${escapeHtml(og.ogDescription)}" />`);
    if (og.ogImage) {
      parts.push(`<meta name="twitter:image" content="${escapeHtml(og.ogImage)}" />`);
    }
  }

  // Noindex
  if (opts.noindex) {
    parts.push(`<meta name="robots" content="noindex" />`);
  }

  // JSON-LD
  if (opts.jsonLd) {
    parts.push(`<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`);
  }

  // Custom Google Fonts
  if (opts.customFontsUrl) {
    parts.push(`<link rel="preconnect" href="https://fonts.googleapis.com" />`);
    parts.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`);
    parts.push(`<link rel="stylesheet" href="${opts.customFontsUrl}" />`);
  }

  // Custom fonts CSS overrides
  if (opts.customFontsCss) {
    parts.push(`<style>${opts.customFontsCss}</style>`);
  }

  // Custom CSS
  if (opts.customCss) {
    parts.push(`<style>${opts.customCss}</style>`);
  }

  // Analytics snippets (template-generated, not raw user input)
  if (opts.analyticsSnippets) {
    parts.push(opts.analyticsSnippets);
  }

  // Custom head scripts
  if (opts.customHeadScripts) {
    parts.push(opts.customHeadScripts);
  }

  return parts.join("\n    ");
}

export function generatePageHtml(options: PageHtmlOptions): string {
  const {
    siteConfig,
    assetManifest,
    pageTitle,
    pageDescription,
    pageContent,
    pagePath,
    siteData,
    themeCss,
    themeFontsUrl,
    pageIcon,
    pageSubtitle,
    titleSectionHidden,
    titleIconHidden,
    folderTrail,
    faviconPath,
    ogMeta,
    noindex,
    jsonLd,
    customCss,
    customFontsUrl,
    customFontsCss,
    analyticsSnippets,
    customHeadScripts,
    customBodyScripts,
    showBranding,
  } = options;

  const brandingHtml = showBranding !== false ? generateBrandingBadge() : "";

  // Title format: pageTitle | innerFolder | ... | outerFolder | projectName Documentation
  let fullTitle: string;
  if (pageTitle) {
    const parts = [pageTitle, ...(folderTrail || []), `${siteConfig.title} Documentation`];
    fullTitle = parts.join(" | ");
  } else {
    fullTitle = `${siteConfig.title} Documentation`;
  }
  const description = pageDescription || siteConfig.description;

  // Pre-render content for SEO
  const strippedContent = stripJsxTags(pageContent);
  const preRenderedHtml = simpleMarkdownToHtml(strippedContent);

  const cssLinks = assetManifest.css
    .map((href) => `<link rel="stylesheet" href="/${href}" />`)
    .join("\n    ");

  const jsScripts = assetManifest.js
    .map((src) => `<script type="module" src="/${src}"></script>`)
    .join("\n    ");

  const pageData = JSON.stringify({
    title: pageTitle,
    description: pageDescription,
    content: pageContent,
    ...(pageIcon ? { icon: pageIcon } : {}),
    ...(pageSubtitle ? { subtitle: pageSubtitle } : {}),
    ...(titleSectionHidden ? { titleSectionHidden } : {}),
    ...(titleIconHidden ? { titleIconHidden } : {}),
  });

  const fontsLink = themeFontsUrl
    ? `<link rel="stylesheet" href="${themeFontsUrl}" />`
    : "";

  const headExtras = generateHeadExtras({
    faviconPath,
    ogMeta,
    noindex,
    jsonLd,
    customFontsUrl,
    customFontsCss,
    customCss,
    analyticsSnippets,
    customHeadScripts,
  });

  const bodyEnd = customBodyScripts || "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="system">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>(function(){var t=localStorage.getItem('inkloom-theme');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t)})()</script>
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${pagePath}" />
    ${fontsLink}
    ${cssLinks}
    <style>${themeCss}</style>
    <style>#root:not(.hydrated){visibility:hidden}</style>
    ${headExtras}
  </head>
  <body class="antialiased">
    <div id="root">
      <article>${preRenderedHtml}</article>
    </div>
    <script type="application/json" id="__INKLOOM_DATA__">${JSON.stringify(siteData)}</script>
    <script type="application/json" id="__PAGE_DATA__">${pageData}</script>
    ${jsScripts}
    ${bodyEnd}
    ${brandingHtml}
  </body>
</html>`;
}

export function generateShellHtml(options: ShellHtmlOptions): string {
  const {
    siteConfig,
    assetManifest,
    siteData,
    themeCss,
    themeFontsUrl,
    faviconPath,
    ogMeta,
    jsonLd,
    customCss,
    customFontsUrl,
    customFontsCss,
    analyticsSnippets,
    customHeadScripts,
    customBodyScripts,
    showBranding,
  } = options;

  const brandingHtml = showBranding !== false ? generateBrandingBadge() : "";

  const cssLinks = assetManifest.css
    .map((href) => `<link rel="stylesheet" href="/${href}" />`)
    .join("\n    ");

  const jsScripts = assetManifest.js
    .map((src) => `<script type="module" src="/${src}"></script>`)
    .join("\n    ");

  const fontsLink = themeFontsUrl
    ? `<link rel="stylesheet" href="${themeFontsUrl}" />`
    : "";

  const headExtras = generateHeadExtras({
    faviconPath,
    ogMeta,
    jsonLd,
    customFontsUrl,
    customFontsCss,
    customCss,
    analyticsSnippets,
    customHeadScripts,
  });

  const bodyEnd = customBodyScripts || "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="system">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>(function(){var t=localStorage.getItem('inkloom-theme');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t)})()</script>
    <title>${escapeHtml(siteConfig.title)} Documentation</title>
    <meta name="description" content="${escapeHtml(siteConfig.description)}" />
    ${fontsLink}
    ${cssLinks}
    <style>${themeCss}</style>
    <style>#root:not(.hydrated){visibility:hidden}</style>
    ${headExtras}
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="application/json" id="__INKLOOM_DATA__">${JSON.stringify(siteData)}</script>
    ${jsScripts}
    ${bodyEnd}
    ${brandingHtml}
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Generator functions for analytics, sitemap, robots.txt, and JSON-LD
// ---------------------------------------------------------------------------

const GA4_ID_RE = /^G-[A-Z0-9]+$/;
const POSTHOG_KEY_RE = /^phc_[a-zA-Z0-9]+$/;

export function generateAnalyticsSnippets(analytics: {
  ga4MeasurementId?: string;
  posthogApiKey?: string;
  posthogHost?: string;
}): string {
  const parts: string[] = [];

  if (analytics.ga4MeasurementId && GA4_ID_RE.test(analytics.ga4MeasurementId)) {
    const id = analytics.ga4MeasurementId;
    parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`);
    parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`);
  }

  if (analytics.posthogApiKey && POSTHOG_KEY_RE.test(analytics.posthogApiKey)) {
    const key = analytics.posthogApiKey;
    const host = analytics.posthogHost || "https://us.i.posthog.com";
    parts.push(`<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group setPersonProperties resetPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupProperties".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${key}',{api_host:'${host}',person_profiles:'identified_only'})</script>`);
  }

  return parts.join("\n    ");
}

export function generateJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  siteName: string;
  dateModified?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    publisher: {
      "@type": "Organization",
      name: opts.siteName,
    },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

export function generateSitemapXml(
  baseUrl: string,
  pages: { path: string; lastmod?: string }[]
): string {
  const urls = pages
    .map((page) => {
      const loc = `${baseUrl}${page.path}`;
      const lastmod = page.lastmod ? `\n    <lastmod>${page.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function generateRobotsTxt(baseUrl: string, customAdditions?: string): string {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ];

  if (customAdditions?.trim()) {
    lines.push("", customAdditions.trim());
  }

  return lines.join("\n") + "\n";
}

/**
 * Sanitize custom CSS: strip dangerous patterns.
 */
export function sanitizeCustomCss(css: string): string {
  let sanitized = css;
  // Strip @import rules
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, "");
  // Strip javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "");
  // Strip expression()
  sanitized = sanitized.replace(/expression\s*\(/gi, "");
  // Strip behavior:
  sanitized = sanitized.replace(/behavior\s*:/gi, "");
  // Strip -moz-binding
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, "");
  return sanitized;
}

/**
 * Build a Google Fonts URL for custom font families.
 */
export function buildCustomFontsUrl(fonts: {
  heading?: string;
  body?: string;
  code?: string;
}): string | undefined {
  const families = new Set<string>();
  if (fonts.heading) families.add(fonts.heading);
  if (fonts.body) families.add(fonts.body);
  if (fonts.code) families.add(fonts.code);

  if (families.size === 0) return undefined;

  const params = Array.from(families)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/**
 * Build CSS to override font variables based on custom font config.
 */
export function buildCustomFontsCss(fonts: {
  heading?: string;
  body?: string;
  code?: string;
}): string | undefined {
  const rules: string[] = [];
  if (fonts.body) {
    rules.push(`--font-sans: '${fonts.body}', system-ui, sans-serif;`);
  }
  if (fonts.heading) {
    rules.push(`--font-display: '${fonts.heading}', system-ui, sans-serif;`);
  }
  if (fonts.code) {
    rules.push(`--font-mono: '${fonts.code}', ui-monospace, monospace;`);
  }

  if (rules.length === 0) return undefined;

  return `:root { ${rules.join(" ")} }`;
}

/**
 * Generate the "Built with InkLoom" badge HTML snippet.
 * Renders a small, fixed-position badge at the bottom-right of the page.
 */
export function generateBrandingBadge(): string {
  return `<div id="inkloom-badge" style="position:fixed;bottom:12px;right:12px;z-index:50;opacity:0.7;transition:opacity 0.2s">
      <a href="https://github.com/inkloom/inkloom" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.06);color:#555;font-size:11px;font-family:system-ui,sans-serif;text-decoration:none;backdrop-filter:blur(4px);border:1px solid rgba(0,0,0,0.08)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L4 7v10l8 4 8-4V7l-8-4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 7v10" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 4 8-4" stroke="currentColor" stroke-width="2"/></svg>
        Built with <strong style="color:#2dd4ac;font-weight:600">InkLoom</strong>
      </a>
    </div>
    <script>document.getElementById('inkloom-badge').onmouseenter=function(){this.style.opacity='1'};document.getElementById('inkloom-badge').onmouseleave=function(){this.style.opacity='0.7'}</script>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
