import { describe, it, expect } from "vitest";
import {
  generateShellHtml,
  generatePageHtml,
  generateBrandingBadge,
  generateAnalyticsSnippets,
  generateSitemapXml,
  generateRobotsTxt,
  generateJsonLd,
  sanitizeCustomCss,
  buildCustomFontsUrl,
  buildCustomFontsCss,
} from "@/lib/generate-html";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const minimalSiteConfig = { title: "Test Docs", description: "A test site" };
const minimalAssetManifest = {
  js: ["assets/index-abc123.js"],
  css: ["assets/index-xyz789.css"],
};
const minimalSiteData = {
  config: { title: "Test Docs", description: "A test site" },
  navigation: [],
};

// ---------------------------------------------------------------------------
// generateBrandingBadge
// ---------------------------------------------------------------------------

describe("generateBrandingBadge", () => {
  it("should return HTML containing 'Built with' text", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain("Built with");
    expect(badge).toContain("InkLoom");
  });

  it("should contain a link to InkLoom GitHub", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain("https://github.com/inkloom/inkloom");
  });

  it("should have target=_blank and rel=noopener", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain('target="_blank"');
    expect(badge).toContain('rel="noopener noreferrer"');
  });

  it("should contain an SVG icon", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain("<svg");
    expect(badge).toContain("</svg>");
  });

  it("should include hover interactivity script", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain("onmouseenter");
    expect(badge).toContain("onmouseleave");
  });

  it("should use the inkloom-badge element id", () => {
    const badge = generateBrandingBadge();
    expect(badge).toContain('id="inkloom-badge"');
  });
});

// ---------------------------------------------------------------------------
// generateShellHtml — branding badge integration
// ---------------------------------------------------------------------------

describe("generateShellHtml", () => {
  const baseOptions = {
    siteConfig: minimalSiteConfig,
    assetManifest: minimalAssetManifest,
    siteData: minimalSiteData,
    themeCss: ":root { --color-primary: #2dd4ac; }",
  };

  it("should include branding badge by default (showBranding undefined)", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain("inkloom-badge");
    expect(html).toContain("Built with");
  });

  it("should include branding badge when showBranding is true", () => {
    const html = generateShellHtml({ ...baseOptions, showBranding: true });
    expect(html).toContain("inkloom-badge");
  });

  it("should NOT include branding badge when showBranding is false", () => {
    const html = generateShellHtml({ ...baseOptions, showBranding: false });
    expect(html).not.toContain("inkloom-badge");
    expect(html).not.toContain("Built with");
  });

  it("should produce valid HTML structure", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("__INKLOOM_DATA__");
  });

  it("should include CSS and JS asset references", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain("assets/index-abc123.js");
    expect(html).toContain("assets/index-xyz789.css");
  });

  it("should include site title in the page title", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain("<title>Test Docs Documentation</title>");
  });

  it("should embed site data as JSON", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain(JSON.stringify(minimalSiteData));
  });

  it("should include theme CSS", () => {
    const html = generateShellHtml(baseOptions);
    expect(html).toContain("--color-primary: #2dd4ac");
  });

  it("should include theme fonts link when provided", () => {
    const html = generateShellHtml({
      ...baseOptions,
      themeFontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    });
    expect(html).toContain("https://fonts.googleapis.com/css2?family=Inter");
  });

  it("should include custom body scripts", () => {
    const html = generateShellHtml({
      ...baseOptions,
      customBodyScripts: '<script>console.log("hello")</script>',
    });
    expect(html).toContain('<script>console.log("hello")</script>');
  });

  it("should place badge after custom body scripts", () => {
    const html = generateShellHtml({
      ...baseOptions,
      customBodyScripts: '<script id="custom"></script>',
    });
    const customScriptIndex = html.indexOf('id="custom"');
    const badgeIndex = html.indexOf("inkloom-badge");
    expect(customScriptIndex).toBeLessThan(badgeIndex);
  });

  it("should place badge inside body, before closing tag", () => {
    const html = generateShellHtml(baseOptions);
    const badgeIndex = html.indexOf("inkloom-badge");
    const bodyCloseIndex = html.indexOf("</body>");
    expect(badgeIndex).toBeGreaterThan(0);
    expect(badgeIndex).toBeLessThan(bodyCloseIndex);
  });
});

// ---------------------------------------------------------------------------
// generatePageHtml — branding badge integration
// ---------------------------------------------------------------------------

describe("generatePageHtml", () => {
  const basePageOptions = {
    siteConfig: minimalSiteConfig,
    assetManifest: minimalAssetManifest,
    pageTitle: "Getting Started",
    pageContent: "# Getting Started\n\nWelcome to the docs.",
    pagePath: "/getting-started",
    siteData: minimalSiteData,
    themeCss: ":root {}",
  };

  it("should include branding badge by default", () => {
    const html = generatePageHtml(basePageOptions);
    expect(html).toContain("inkloom-badge");
    expect(html).toContain("Built with");
  });

  it("should include branding badge when showBranding is true", () => {
    const html = generatePageHtml({ ...basePageOptions, showBranding: true });
    expect(html).toContain("inkloom-badge");
  });

  it("should NOT include branding badge when showBranding is false", () => {
    const html = generatePageHtml({ ...basePageOptions, showBranding: false });
    expect(html).not.toContain("inkloom-badge");
  });

  it("should produce valid HTML with page content", () => {
    const html = generatePageHtml(basePageOptions);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("__INKLOOM_DATA__");
    expect(html).toContain("__PAGE_DATA__");
  });

  it("should include pre-rendered page content for SEO", () => {
    const html = generatePageHtml(basePageOptions);
    expect(html).toContain("<h1>Getting Started</h1>");
    expect(html).toContain("Welcome to the docs.");
  });

  it("should format title with folder trail", () => {
    const html = generatePageHtml({
      ...basePageOptions,
      folderTrail: ["Guides", "API"],
    });
    expect(html).toContain("Getting Started | Guides | API | Test Docs Documentation");
  });

  it("should escape HTML in title and description", () => {
    const html = generatePageHtml({
      ...basePageOptions,
      siteConfig: { title: "Test <Docs>", description: 'A "test" site' },
      pageTitle: 'Page & "Title"',
    });
    expect(html).toContain("Page &amp; &quot;Title&quot;");
    expect(html).toContain("Test &lt;Docs&gt;");
  });
});

// ---------------------------------------------------------------------------
// generateAnalyticsSnippets
// ---------------------------------------------------------------------------

describe("generateAnalyticsSnippets", () => {
  it("should return empty string when no analytics configured", () => {
    expect(generateAnalyticsSnippets({})).toBe("");
  });

  it("should generate GA4 snippet for valid measurement ID", () => {
    const result = generateAnalyticsSnippets({ ga4MeasurementId: "G-ABC123" });
    expect(result).toContain("googletagmanager.com");
    expect(result).toContain("G-ABC123");
  });

  it("should reject invalid GA4 measurement ID", () => {
    const result = generateAnalyticsSnippets({ ga4MeasurementId: "invalid" });
    expect(result).not.toContain("googletagmanager.com");
  });

  it("should generate PostHog snippet for valid API key", () => {
    const result = generateAnalyticsSnippets({ posthogApiKey: "phc_abc123" });
    expect(result).toContain("posthog");
    expect(result).toContain("phc_abc123");
  });

  it("should reject invalid PostHog API key", () => {
    const result = generateAnalyticsSnippets({ posthogApiKey: "invalid" });
    expect(result).not.toContain("posthog");
  });
});

// ---------------------------------------------------------------------------
// generateSitemapXml
// ---------------------------------------------------------------------------

describe("generateSitemapXml", () => {
  it("should produce valid XML with URLs", () => {
    const xml = generateSitemapXml("https://docs.example.com", [
      { path: "/getting-started" },
      { path: "/api-reference", lastmod: "2026-03-04" },
    ]);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("https://docs.example.com/getting-started");
    expect(xml).toContain("https://docs.example.com/api-reference");
    expect(xml).toContain("<lastmod>2026-03-04</lastmod>");
  });

  it("should escape XML special characters in URLs", () => {
    const xml = generateSitemapXml("https://docs.example.com", [
      { path: "/page?a=1&b=2" },
    ]);
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("?a=1&b=2</loc>");
  });
});

// ---------------------------------------------------------------------------
// generateRobotsTxt
// ---------------------------------------------------------------------------

describe("generateRobotsTxt", () => {
  it("should produce standard robots.txt", () => {
    const txt = generateRobotsTxt("https://docs.example.com");
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Sitemap: https://docs.example.com/sitemap.xml");
  });

  it("should include custom additions", () => {
    const txt = generateRobotsTxt("https://docs.example.com", "Disallow: /private/");
    expect(txt).toContain("Disallow: /private/");
  });
});

// ---------------------------------------------------------------------------
// generateJsonLd
// ---------------------------------------------------------------------------

describe("generateJsonLd", () => {
  it("should produce valid JSON-LD structure", () => {
    const ld = generateJsonLd({
      title: "Test",
      description: "A test page",
      url: "https://docs.example.com/test",
      siteName: "Test Docs",
    });
    expect(ld).toHaveProperty("@context", "https://schema.org");
    expect(ld).toHaveProperty("@type", "TechArticle");
    expect(ld).toHaveProperty("headline", "Test");
  });

  it("should include dateModified when provided", () => {
    const ld = generateJsonLd({
      title: "Test",
      description: "A test page",
      url: "https://docs.example.com/test",
      siteName: "Test Docs",
      dateModified: "2026-03-04",
    });
    expect(ld).toHaveProperty("dateModified", "2026-03-04");
  });
});

// ---------------------------------------------------------------------------
// sanitizeCustomCss
// ---------------------------------------------------------------------------

describe("sanitizeCustomCss", () => {
  it("should preserve safe CSS", () => {
    const css = ".my-class { color: red; font-size: 14px; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("should strip @import rules", () => {
    expect(sanitizeCustomCss('@import url("evil.css");')).not.toContain("@import");
  });

  it("should strip javascript: URLs", () => {
    expect(sanitizeCustomCss("background: javascript:alert(1)")).not.toContain("javascript:");
  });

  it("should strip expression()", () => {
    expect(sanitizeCustomCss("width: expression(alert(1))")).not.toContain("expression(");
  });

  it("should strip behavior:", () => {
    expect(sanitizeCustomCss("behavior: url(evil.htc)")).not.toContain("behavior:");
  });

  it("should strip -moz-binding:", () => {
    expect(sanitizeCustomCss("-moz-binding: url(evil.xml)")).not.toContain("-moz-binding:");
  });
});

// ---------------------------------------------------------------------------
// buildCustomFontsUrl
// ---------------------------------------------------------------------------

describe("buildCustomFontsUrl", () => {
  it("should return undefined when no fonts specified", () => {
    expect(buildCustomFontsUrl({})).toBeUndefined();
  });

  it("should build URL for single font", () => {
    const url = buildCustomFontsUrl({ body: "Inter" });
    expect(url).toContain("fonts.googleapis.com");
    expect(url).toContain("Inter");
  });

  it("should deduplicate identical font families", () => {
    const url = buildCustomFontsUrl({ heading: "Inter", body: "Inter" });
    expect(url).toBeDefined();
    const matches = url!.match(/Inter/g);
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFontsCss
// ---------------------------------------------------------------------------

describe("buildCustomFontsCss", () => {
  it("should return undefined when no fonts specified", () => {
    expect(buildCustomFontsCss({})).toBeUndefined();
  });

  it("should generate CSS for body font", () => {
    const css = buildCustomFontsCss({ body: "Inter" });
    expect(css).toContain("--font-sans");
    expect(css).toContain("Inter");
  });

  it("should generate CSS for heading font", () => {
    const css = buildCustomFontsCss({ heading: "Poppins" });
    expect(css).toContain("--font-display");
    expect(css).toContain("Poppins");
  });

  it("should generate CSS for code font", () => {
    const css = buildCustomFontsCss({ code: "Fira Code" });
    expect(css).toContain("--font-mono");
    expect(css).toContain("Fira Code");
  });
});
