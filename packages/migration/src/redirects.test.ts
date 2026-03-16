import { describe, it, expect } from "vitest";
import {
  generateRedirects,
  parseMintlifyRedirects,
  parseGitbookRedirects,
  mappingsToRedirects,
  mergeRedirects,
  generateSpaFallbackRules,
  detectSubpath,
  generateSubpathSnippets,
  type UrlMapping,
} from "./redirects.js";

// ===========================================================================
// Mintlify URL patterns (file-path based with tab prefixes)
// ===========================================================================

describe("Mintlify URL patterns", () => {
  it("preserves simple file-path based URLs", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/introduction", targetPath: "/introduction" },
      { sourcePath: "/quickstart", targetPath: "/quickstart" },
      { sourcePath: "/api-reference/create-user", targetPath: "/api-reference/create-user" },
    ];

    const result = generateRedirects({ mappings, source: "mintlify" });

    // No redirects needed when paths match exactly
    expect(result.rules).toHaveLength(0);
    expect(result.urlMap["/introduction"]).toBe("/introduction");
    expect(result.urlMap["/quickstart"]).toBe("/quickstart");
    expect(result.urlMap["/api-reference/create-user"]).toBe("/api-reference/create-user");
  });

  it("generates 301 redirects for tab-prefixed paths that change", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/api-reference/users/get", targetPath: "/api/users/get" },
      { sourcePath: "/api-reference/users/create", targetPath: "/api/users/create" },
      { sourcePath: "/guides/getting-started", targetPath: "/guides/getting-started" },
    ];

    const result = generateRedirects({ mappings, source: "mintlify" });

    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toEqual({
      from: "/api-reference/users/get",
      to: "/api/users/get",
      status: 301,
    });
    expect(result.rules[1]).toEqual({
      from: "/api-reference/users/create",
      to: "/api/users/create",
      status: 301,
    });
  });

  it("parses Mintlify config redirects from mint.json", () => {
    const mintConfig = {
      redirects: [
        { source: "/old-page", destination: "/new-page" },
        { source: "/docs/v1/api", destination: "/api-reference" },
      ],
    };

    const rules = parseMintlifyRedirects(mintConfig);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ from: "/old-page", to: "/new-page", status: 301 });
    expect(rules[1]).toEqual({ from: "/docs/v1/api", to: "/api-reference", status: 301 });
  });

  it("handles missing or invalid redirects in mint.json gracefully", () => {
    expect(parseMintlifyRedirects({})).toEqual([]);
    expect(parseMintlifyRedirects({ redirects: "not-an-array" })).toEqual([]);
    expect(parseMintlifyRedirects({ redirects: [{ source: 123 }] })).toEqual([]);
  });

  it("merges Mintlify migration + config redirects with tabs", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/old-intro", targetPath: "/introduction" },
    ];
    const sourceConfig = {
      redirects: [
        { source: "/legacy/page", destination: "/new/page" },
      ],
    };

    const result = generateRedirects({
      mappings,
      sourceConfig,
      source: "mintlify",
      tabs: [{ slug: "api" }, { slug: "guides" }],
    });

    expect(result.redirectsFileContent).toContain("/old-intro  /introduction  301");
    expect(result.redirectsFileContent).toContain("/legacy/page  /new/page  301");
    expect(result.redirectsFileContent).toContain("/api/*  /api/index.html  200");
    expect(result.redirectsFileContent).toContain("/guides/*  /guides/index.html  200");
    expect(result.redirectsFileContent).toContain("/*  /index.html  200");
  });

  it("normalizes paths without leading slashes", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "introduction", targetPath: "getting-started" },
    ];

    const result = generateRedirects({ mappings, source: "mintlify" });

    expect(result.rules[0]).toEqual({
      from: "/introduction",
      to: "/getting-started",
      status: 301,
    });
    expect(result.urlMap["/introduction"]).toBe("/getting-started");
  });

  it("removes trailing slashes during normalization", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/old-page/", targetPath: "/new-page/" },
    ];

    const result = generateRedirects({ mappings, source: "mintlify" });

    // After normalization both become the same — no redirect
    expect(result.urlMap["/old-page"]).toBe("/new-page");
  });
});

// ===========================================================================
// Gitbook URL patterns (SUMMARY.md hierarchy based)
// ===========================================================================

describe("Gitbook URL patterns", () => {
  it("preserves SUMMARY.md hierarchy-based URLs", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/getting-started/installation", targetPath: "/getting-started/installation" },
      { sourcePath: "/getting-started/quick-start", targetPath: "/getting-started/quick-start" },
      { sourcePath: "/advanced/configuration", targetPath: "/advanced/configuration" },
    ];

    const result = generateRedirects({ mappings, source: "gitbook" });

    expect(result.rules).toHaveLength(0);
    expect(result.urlMap["/getting-started/installation"]).toBe("/getting-started/installation");
  });

  it("generates redirects for restructured Gitbook paths", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/group-1/page-a", targetPath: "/guides/page-a" },
      { sourcePath: "/group-1/page-b", targetPath: "/guides/page-b" },
      { sourcePath: "/group-2/nested/deep", targetPath: "/reference/deep" },
    ];

    const result = generateRedirects({ mappings, source: "gitbook" });

    expect(result.rules).toHaveLength(3);
    expect(result.rules[0]).toEqual({
      from: "/group-1/page-a",
      to: "/guides/page-a",
      status: 301,
    });
    expect(result.rules[2]).toEqual({
      from: "/group-2/nested/deep",
      to: "/reference/deep",
      status: 301,
    });
  });

  it("parses Gitbook config redirects from .gitbook.yaml", () => {
    const gitbookConfig = {
      redirects: {
        "old/path": "new/path",
        "another/old": "another/new",
      },
    };

    const rules = parseGitbookRedirects(gitbookConfig);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ from: "/old/path", to: "/new/path", status: 301 });
    expect(rules[1]).toEqual({ from: "/another/old", to: "/another/new", status: 301 });
  });

  it("handles missing or invalid redirects in .gitbook.yaml gracefully", () => {
    expect(parseGitbookRedirects({})).toEqual([]);
    expect(parseGitbookRedirects({ redirects: "string" })).toEqual([]);
    expect(parseGitbookRedirects({ redirects: [] })).toEqual([]);
    expect(parseGitbookRedirects({ redirects: null as unknown as Record<string, unknown> })).toEqual([]);
  });

  it("merges Gitbook migration + config redirects", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/old-section/page", targetPath: "/new-section/page" },
    ];
    const sourceConfig = {
      redirects: {
        "legacy/api": "api-reference",
      },
    };

    const result = generateRedirects({
      mappings,
      sourceConfig,
      source: "gitbook",
      tabs: [],
    });

    expect(result.redirectsFileContent).toContain("/old-section/page  /new-section/page  301");
    expect(result.redirectsFileContent).toContain("/legacy/api  /api-reference  301");
    expect(result.redirectsFileContent).toContain("/*  /index.html  200");
  });

  it("de-duplicates redirect rules keeping the first occurrence", () => {
    const mappings: UrlMapping[] = [
      { sourcePath: "/duplicate", targetPath: "/target-a" },
    ];
    const sourceConfig = {
      redirects: {
        "/duplicate": "target-b",
      },
    };

    const result = generateRedirects({
      mappings,
      sourceConfig,
      source: "gitbook",
    });

    // Migration redirect takes priority (comes first)
    const duplicateRules = result.rules.filter((r) => r.from === "/duplicate");
    expect(duplicateRules).toHaveLength(1);
    expect(duplicateRules[0].to).toBe("/target-a");
  });
});

// ===========================================================================
// Subpath detection and redirect snippet generation
// ===========================================================================

describe("Subpath detection", () => {
  it("detects subpath in URL with path component", () => {
    const result = detectSubpath("https://company.com/docs");
    expect(result).toEqual({ subpath: "/docs", host: "company.com" });
  });

  it("detects subpath without protocol prefix", () => {
    const result = detectSubpath("company.com/docs");
    expect(result).toEqual({ subpath: "/docs", host: "company.com" });
  });

  it("detects multi-segment subpath", () => {
    const result = detectSubpath("https://company.com/docs/v2");
    expect(result).toEqual({ subpath: "/docs/v2", host: "company.com" });
  });

  it("returns undefined for root-only URLs", () => {
    expect(detectSubpath("https://docs.company.com")).toBeUndefined();
    expect(detectSubpath("https://docs.company.com/")).toBeUndefined();
    expect(detectSubpath("docs.company.com")).toBeUndefined();
  });

  it("returns undefined for invalid URLs", () => {
    expect(detectSubpath("")).toBeUndefined();
    expect(detectSubpath("not a url at all")).toBeUndefined();
  });

  it("strips trailing slashes from subpath", () => {
    const result = detectSubpath("https://company.com/docs/");
    expect(result).toEqual({ subpath: "/docs", host: "company.com" });
  });
});

describe("Subpath redirect snippet generation", () => {
  const snippets = generateSubpathSnippets("company.com", "/docs", "docs.company.com");

  it("generates Vercel rewrites JSON", () => {
    const parsed = JSON.parse(snippets.vercel);
    expect(parsed.rewrites).toHaveLength(1);
    expect(parsed.rewrites[0].source).toBe("/docs/:path*");
    expect(parsed.rewrites[0].destination).toBe("https://docs.company.com/:path*");
  });

  it("generates Netlify _redirects line", () => {
    expect(snippets.netlify).toBe("/docs/*  https://docs.company.com/:splat  301");
  });

  it("generates Nginx location block", () => {
    expect(snippets.nginx).toContain("server_name company.com");
    expect(snippets.nginx).toContain("location /docs/");
    expect(snippets.nginx).toContain("return 301 https://docs.company.com$request_uri");
  });

  it("generates Cloudflare redirect rule description", () => {
    expect(snippets.cloudflare).toContain('starts with "/docs/"');
    expect(snippets.cloudflare).toContain("docs.company.com");
    expect(snippets.cloudflare).toContain("company.com");
  });

  it("generates Apache .htaccess rewrite rule", () => {
    expect(snippets.apache).toContain("RewriteEngine On");
    expect(snippets.apache).toContain("RewriteRule ^/docs/(.*)$ https://docs.company.com/$1 [R=301,L]");
  });
});

describe("Subpath guidance in generateRedirects", () => {
  it("includes subpath guidance when sourceUrl has path", () => {
    const result = generateRedirects({
      mappings: [],
      sourceUrl: "https://company.com/docs",
    });

    expect(result.subpathGuidance).toBeDefined();
    expect(result.subpathGuidance?.subpath).toBe("/docs");
    expect(result.subpathGuidance?.originalHost).toBe("company.com");
    expect(result.subpathGuidance?.recommendedSubdomain).toBe("docs.company.com");
    expect(result.subpathGuidance?.snippets.vercel).toBeTruthy();
    expect(result.subpathGuidance?.snippets.netlify).toBeTruthy();
    expect(result.subpathGuidance?.snippets.nginx).toBeTruthy();
    expect(result.subpathGuidance?.snippets.cloudflare).toBeTruthy();
    expect(result.subpathGuidance?.snippets.apache).toBeTruthy();
  });

  it("does not include subpath guidance for root URLs", () => {
    const result = generateRedirects({
      mappings: [],
      sourceUrl: "https://docs.company.com",
    });

    expect(result.subpathGuidance).toBeUndefined();
  });

  it("does not include subpath guidance when no sourceUrl", () => {
    const result = generateRedirects({
      mappings: [],
    });

    expect(result.subpathGuidance).toBeUndefined();
  });
});

// ===========================================================================
// Merge function correctness
// ===========================================================================

describe("mergeRedirects", () => {
  it("produces correct combined output with all sources", () => {
    const merged = mergeRedirects({
      migrationRedirects: [
        { from: "/old-a", to: "/new-a", status: 301 },
        { from: "/old-b", to: "/new-b", status: 301 },
      ],
      sourceConfigRedirects: [
        { from: "/legacy", to: "/modern", status: 301 },
      ],
      tabs: [{ slug: "api" }],
    });

    const lines = merged.content.trim().split("\n");

    // 301 redirects come first
    expect(lines[0]).toBe("/old-a  /new-a  301");
    expect(lines[1]).toBe("/old-b  /new-b  301");
    expect(lines[2]).toBe("/legacy  /modern  301");
    // SPA fallback rules come last
    expect(lines[3]).toBe("/api/*  /api/index.html  200");
    expect(lines[4]).toBe("/*  /index.html  200");
  });

  it("produces output with only SPA fallback when no redirects", () => {
    const merged = mergeRedirects({
      migrationRedirects: [],
      sourceConfigRedirects: [],
      tabs: [{ slug: "docs" }, { slug: "api" }],
    });

    const lines = merged.content.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("/docs/*  /docs/index.html  200");
    expect(lines[1]).toBe("/api/*  /api/index.html  200");
    expect(lines[2]).toBe("/*  /index.html  200");
  });

  it("produces output with just catch-all when no tabs or redirects", () => {
    const merged = mergeRedirects({
      migrationRedirects: [],
      sourceConfigRedirects: [],
      tabs: [],
    });

    expect(merged.content.trim()).toBe("/*  /index.html  200");
  });

  it("de-duplicates rules by 'from' path", () => {
    const merged = mergeRedirects({
      migrationRedirects: [
        { from: "/same", to: "/target-1", status: 301 },
      ],
      sourceConfigRedirects: [
        { from: "/same", to: "/target-2", status: 301 },
      ],
      tabs: [],
    });

    expect(merged.rules).toHaveLength(1);
    expect(merged.rules[0].to).toBe("/target-1"); // Migration takes priority
  });
});

// ===========================================================================
// SPA fallback rules
// ===========================================================================

describe("generateSpaFallbackRules", () => {
  it("matches the pattern in platform/lib/deploy.ts", () => {
    const rules = generateSpaFallbackRules([
      { slug: "api-reference" },
      { slug: "guides" },
    ]);

    expect(rules).toEqual([
      "/api-reference/*  /api-reference/index.html  200",
      "/guides/*  /guides/index.html  200",
      "/*  /index.html  200",
    ]);
  });

  it("includes only catch-all when no tabs", () => {
    const rules = generateSpaFallbackRules([]);
    expect(rules).toEqual(["/*  /index.html  200"]);
  });
});

// ===========================================================================
// mappingsToRedirects
// ===========================================================================

describe("mappingsToRedirects", () => {
  it("skips identical source/target after normalization", () => {
    const rules = mappingsToRedirects([
      { sourcePath: "/same", targetPath: "/same" },
      { sourcePath: "same", targetPath: "/same" },
      { sourcePath: "/same/", targetPath: "/same" },
    ]);

    expect(rules).toHaveLength(0);
  });

  it("creates 301 rules for differing paths", () => {
    const rules = mappingsToRedirects([
      { sourcePath: "/a", targetPath: "/b" },
    ]);

    expect(rules).toEqual([{ from: "/a", to: "/b", status: 301 }]);
  });
});
