import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseGitbook } from "./index.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURE_DIR = path.join(
  process.cwd(),
  "__test_gitbook_orchestrator_fixture__",
);

function writeFixture(relPath: string, content: string): void {
  const fullPath = path.join(FIXTURE_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

function writeBinaryFixture(relPath: string, data: Buffer): void {
  const fullPath = path.join(FIXTURE_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, data);
}

// ---------------------------------------------------------------------------
// Fixtures: .gitbook.yaml
// ---------------------------------------------------------------------------

const GITBOOK_YAML = `root: ./

structure:
  readme: README.md
  summary: SUMMARY.md

redirects:
  old/getting-started: getting-started.md
  deprecated/api: api/rest.md
`;

// ---------------------------------------------------------------------------
// Fixtures: SUMMARY.md with multi-level navigation
// ---------------------------------------------------------------------------

const SUMMARY_MD = `# Table of Contents

## Getting Started

* [Introduction](README.md)
* [Installation](getting-started/installation.md)
* [Quick Start](getting-started/quick-start.md)

## Guides

* [Authentication](guides/auth/README.md)
  * [OAuth Setup](guides/auth/oauth.md)
  * [JWT Tokens](guides/auth/jwt.md)

## API Reference

* [REST API](api/rest.md)
* [GraphQL](api/graphql.md)
`;

// ---------------------------------------------------------------------------
// Fixtures: Markdown pages with various Gitbook block types
// ---------------------------------------------------------------------------

const README_MD = `---
title: Welcome to Our Docs
description: Getting started with the platform
---

# Welcome

This is the main documentation page.

![logo](.gitbook/assets/logo.png)
`;

const INSTALLATION_MD = `# Installation

{% hint style="info" %}
You need Node.js 18 or later to use this tool.
{% endhint %}

\`\`\`bash
npm install our-tool
\`\`\`
`;

const QUICK_START_MD = `# Quick Start

{% tabs %}
{% tab title="npm" %}
\`\`\`bash
npm run start
\`\`\`
{% endtab %}
{% tab title="yarn" %}
\`\`\`bash
yarn start
\`\`\`
{% endtab %}
{% endtabs %}
`;

const AUTH_README_MD = `# Authentication

Learn about authentication methods.

{% hint style="warning" %}
Always use HTTPS in production.
{% endhint %}
`;

const OAUTH_MD = `# OAuth Setup

{% embed url="https://oauth.net/2/" %}

Follow these steps to configure OAuth.
`;

const JWT_MD = `---
title: JWT Tokens
sidebar_label: JWT
---

# JWT Authentication

<details>
<summary>How JWT works</summary>

JSON Web Tokens encode claims as a JSON object.

</details>

{% hint style="danger" %}
Never expose your JWT secret key.
{% endhint %}
`;

const REST_API_MD = `# REST API

{% swagger method="get" path="/users" summary="List all users" %}
{% swagger-description %}
Returns a paginated list of users.
{% endswagger-description %}
{% endswagger %}

![api diagram](.gitbook/assets/api-diagram.svg)
`;

const GRAPHQL_MD = `# GraphQL API

{% code title="query.graphql" %}
\`\`\`graphql
query {
  users {
    id
    name
  }
}
\`\`\`
{% endcode %}
`;

// A page NOT referenced in SUMMARY.md (should be included with warning)
const UNREFERENCED_MD = `# Changelog

This page is not in SUMMARY.md.
`;

// ---------------------------------------------------------------------------
// Setup and teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  // Config
  writeFixture(".gitbook.yaml", GITBOOK_YAML);
  writeFixture("SUMMARY.md", SUMMARY_MD);

  // Pages
  writeFixture("README.md", README_MD);
  writeFixture("getting-started/installation.md", INSTALLATION_MD);
  writeFixture("getting-started/quick-start.md", QUICK_START_MD);
  writeFixture("guides/auth/README.md", AUTH_README_MD);
  writeFixture("guides/auth/oauth.md", OAUTH_MD);
  writeFixture("guides/auth/jwt.md", JWT_MD);
  writeFixture("api/rest.md", REST_API_MD);
  writeFixture("api/graphql.md", GRAPHQL_MD);

  // Unreferenced page
  writeFixture("changelog.md", UNREFERENCED_MD);

  // .gitbook/assets/ directory with images
  writeBinaryFixture(
    ".gitbook/assets/logo.png",
    Buffer.from("fake-png-data"),
  );
  writeBinaryFixture(
    ".gitbook/assets/api-diagram.svg",
    Buffer.from("<svg>fake</svg>"),
  );
});

afterEach(() => {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseGitbook orchestrator", () => {
  it("returns a complete MigrationResult", async () => {
    const result = await parseGitbook(FIXTURE_DIR);

    expect(result.pages).toBeDefined();
    expect(result.folders).toBeDefined();
    expect(result.redirects).toBeDefined();
    expect(result.assets).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.urlMap).toBeInstanceOf(Map);
  });

  // ─── Pages ──────────────────────────────────────────────────────

  describe("pages", () => {
    it("includes all SUMMARY.md-referenced pages", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const paths = result.pages.map((p) => p.path);

      expect(paths).toContain("README.md");
      expect(paths).toContain("getting-started/installation.md");
      expect(paths).toContain("getting-started/quick-start.md");
      expect(paths).toContain("guides/auth/README.md");
      expect(paths).toContain("guides/auth/oauth.md");
      expect(paths).toContain("guides/auth/jwt.md");
      expect(paths).toContain("api/rest.md");
      expect(paths).toContain("api/graphql.md");
    });

    it("includes unreferenced pages with a warning", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const paths = result.pages.map((p) => p.path);

      expect(paths).toContain("changelog.md");

      const changelogWarning = result.warnings.find((w) =>
        w.includes("changelog.md") && w.includes("not in SUMMARY.md"),
      );
      expect(changelogWarning).toBeDefined();
    });

    it("extracts frontmatter metadata", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const readme = result.pages.find((p) => p.path === "README.md");

      expect(readme).toBeDefined();
      if (readme) {
        expect(readme.title).toBe("Welcome to Our Docs");
        expect(readme.metadata.description).toBe(
          "Getting started with the platform",
        );
      }
    });

    it("uses frontmatter title when available, SUMMARY.md title otherwise", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // JWT has frontmatter title
      const jwt = result.pages.find((p) => p.path === "guides/auth/jwt.md");
      expect(jwt).toBeDefined();
      if (jwt) {
        expect(jwt.title).toBe("JWT Tokens");
      }

      // Installation has no frontmatter title - uses SUMMARY.md title
      const install = result.pages.find(
        (p) => p.path === "getting-started/installation.md",
      );
      expect(install).toBeDefined();
      if (install) {
        expect(install.title).toBe("Installation");
      }
    });

    it("assigns correct slugs to pages", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const readme = result.pages.find((p) => p.path === "README.md");
      expect(readme).toBeDefined();
      if (readme) {
        expect(readme.slug).toBe("index");
      }

      const install = result.pages.find(
        (p) => p.path === "getting-started/installation.md",
      );
      expect(install).toBeDefined();
      if (install) {
        expect(install.slug).toBe("installation");
      }

      // README in subdirectory uses parent dir name as slug
      const authReadme = result.pages.find(
        (p) => p.path === "guides/auth/README.md",
      );
      expect(authReadme).toBeDefined();
      if (authReadme) {
        expect(authReadme.slug).toBe("auth");
      }
    });

    it("assigns correct folder paths and positions", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const install = result.pages.find(
        (p) => p.path === "getting-started/installation.md",
      );
      expect(install).toBeDefined();
      if (install) {
        expect(install.folderPath).toBe("getting-started");
      }

      const rest = result.pages.find((p) => p.path === "api/rest.md");
      expect(rest).toBeDefined();
      if (rest) {
        expect(rest.folderPath).toBe("api-reference");
      }
    });
  });

  // ─── Block syntax transforms ──────────────────────────────────

  describe("block syntax transforms", () => {
    it("converts hint blocks to Callout components", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const install = result.pages.find(
        (p) => p.path === "getting-started/installation.md",
      );

      expect(install).toBeDefined();
      if (install) {
        expect(install.mdxContent).toContain('<Callout type="info">');
        expect(install.mdxContent).toContain("Node.js 18");
        expect(install.mdxContent).not.toContain("{% hint");
      }
    });

    it("converts all-code tabs blocks to CodeGroup", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const quickStart = result.pages.find(
        (p) => p.path === "getting-started/quick-start.md",
      );

      expect(quickStart).toBeDefined();
      if (quickStart) {
        expect(quickStart.mdxContent).toContain("<CodeGroup>");
        expect(quickStart.mdxContent).toContain("</CodeGroup>");
        expect(quickStart.mdxContent).toContain('```bash title="npm"');
        expect(quickStart.mdxContent).toContain('```bash title="yarn"');
        expect(quickStart.mdxContent).not.toContain("<Tabs>");
        expect(quickStart.mdxContent).not.toContain("<Tab");
        expect(quickStart.mdxContent).not.toContain("{% tabs");
      }
    });

    it("converts embed blocks to markdown links", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const oauth = result.pages.find(
        (p) => p.path === "guides/auth/oauth.md",
      );

      expect(oauth).toBeDefined();
      if (oauth) {
        expect(oauth.mdxContent).toContain(
          "[https://oauth.net/2/](https://oauth.net/2/)",
        );
        expect(oauth.mdxContent).not.toContain("{% embed");
      }
    });

    it("converts details blocks to Accordion components", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const jwt = result.pages.find((p) => p.path === "guides/auth/jwt.md");

      expect(jwt).toBeDefined();
      if (jwt) {
        expect(jwt.mdxContent).toContain('<Accordion title="How JWT works">');
        expect(jwt.mdxContent).not.toContain("<details>");
      }
    });

    it("converts swagger blocks and flags OpenAPI presence", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const rest = result.pages.find((p) => p.path === "api/rest.md");

      expect(rest).toBeDefined();
      if (rest) {
        expect(rest.mdxContent).toContain("`GET /users`");
        expect(rest.mdxContent).toContain("OpenAPI");
        expect(rest.mdxContent).not.toContain("{% swagger");
      }
    });

    it("converts code wrapper blocks", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const graphql = result.pages.find(
        (p) => p.path === "api/graphql.md",
      );

      expect(graphql).toBeDefined();
      if (graphql) {
        expect(graphql.mdxContent).toContain('title="query.graphql"');
        expect(graphql.mdxContent).not.toContain("{% code");
      }
    });
  });

  // ─── Folders ──────────────────────────────────────────────────

  describe("folders", () => {
    it("creates folder hierarchy from SUMMARY.md groups", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const folderNames = result.folders.map((f) => f.name);

      expect(folderNames).toContain("Getting Started");
      expect(folderNames).toContain("Guides");
      expect(folderNames).toContain("API Reference");
    });

    it("creates nested folders from SUMMARY.md nesting", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // Authentication has child pages, so it should be a folder
      const authFolder = result.folders.find(
        (f) => f.name === "Authentication",
      );
      expect(authFolder).toBeDefined();
      if (authFolder) {
        expect(authFolder.parentPath).toBe("guides");
      }
    });

    it("assigns sequential positions to folders", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const topLevelFolders = result.folders
        .filter((f) => !f.parentPath)
        .sort((a, b) => a.position - b.position);

      // Positions should be sequential
      for (let i = 0; i < topLevelFolders.length; i++) {
        expect(topLevelFolders[i].position).toBe(i);
      }
    });
  });

  // ─── URL map ──────────────────────────────────────────────────

  describe("URL map", () => {
    it("maps source file paths to InkLoom URL paths", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // Root README maps to /
      expect(result.urlMap.get("/README")).toBeDefined();

      // Regular pages map correctly
      const installUrl = result.urlMap.get("/getting-started/installation");
      expect(installUrl).toBeDefined();
      if (installUrl) {
        expect(installUrl).toContain("installation");
      }
    });

    it("maps README.md in subdirectories correctly", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // guides/auth/README.md -> /guides/auth or similar
      const authUrl = result.urlMap.get("/guides/auth");
      expect(authUrl).toBeDefined();
    });
  });

  // ─── Redirects ────────────────────────────────────────────────

  describe("redirects", () => {
    it("includes redirects from .gitbook.yaml", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const yamlRedirect = result.redirects.find(
        (r) => r.from === "/old/getting-started",
      );
      expect(yamlRedirect).toBeDefined();
      if (yamlRedirect) {
        expect(yamlRedirect.to).toBe("/getting-started.md");
        expect(yamlRedirect.status).toBe(301);
      }
    });

    it("includes structural redirects for URL changes", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // There should be some structural redirects where source != target
      expect(result.redirects.length).toBeGreaterThan(0);
    });

    it("deduplicates redirect rules", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const fromPaths = result.redirects.map((r) => r.from);
      const uniqueFromPaths = new Set(fromPaths);
      expect(fromPaths.length).toBe(uniqueFromPaths.size);
    });
  });

  // ─── Assets ───────────────────────────────────────────────────

  describe("assets", () => {
    it("collects images from .gitbook/assets/ directory", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const assetUrls = result.assets.map((a) => a.originalUrl);

      expect(assetUrls).toContain(".gitbook/assets/logo.png");
      expect(assetUrls).toContain(".gitbook/assets/api-diagram.svg");
    });

    it("collects image references from page content", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      // README.md references .gitbook/assets/logo.png
      // api/rest.md references .gitbook/assets/api-diagram.svg
      const assetUrls = result.assets.map((a) => a.originalUrl);

      // These should be found via content scanning or gitbook assets dir scan
      expect(assetUrls.some((u) => u.includes("logo.png"))).toBe(true);
      expect(assetUrls.some((u) => u.includes("api-diagram.svg"))).toBe(true);
    });

    it("assigns correct MIME types to assets", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const pngAsset = result.assets.find((a) =>
        a.originalUrl.includes("logo.png"),
      );
      expect(pngAsset).toBeDefined();
      if (pngAsset) {
        expect(pngAsset.mimeType).toBe("image/png");
      }

      const svgAsset = result.assets.find((a) =>
        a.originalUrl.includes("api-diagram.svg"),
      );
      expect(svgAsset).toBeDefined();
      if (svgAsset) {
        expect(svgAsset.mimeType).toBe("image/svg+xml");
      }
    });

    it("reads local asset file buffers", async () => {
      const result = await parseGitbook(FIXTURE_DIR);

      const pngAsset = result.assets.find((a) =>
        a.originalUrl.includes("logo.png"),
      );
      expect(pngAsset).toBeDefined();
      if (pngAsset) {
        expect(pngAsset.buffer).toBeDefined();
        if (pngAsset.buffer) {
          expect(pngAsset.buffer.toString()).toBe("fake-png-data");
        }
      }
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles README.md as index page", async () => {
      const result = await parseGitbook(FIXTURE_DIR);
      const readme = result.pages.find((p) => p.path === "README.md");

      expect(readme).toBeDefined();
      if (readme) {
        expect(readme.slug).toBe("index");
      }
    });

    it("handles missing .gitbook.yaml gracefully", async () => {
      // Remove .gitbook.yaml
      fs.unlinkSync(path.join(FIXTURE_DIR, ".gitbook.yaml"));

      const result = await parseGitbook(FIXTURE_DIR);

      // Should still work using defaults
      expect(result.pages.length).toBeGreaterThan(0);
      // No yaml redirects
      const yamlRedirect = result.redirects.find(
        (r) => r.from === "/old/getting-started",
      );
      expect(yamlRedirect).toBeUndefined();
    });

    it("handles missing page files with warning", async () => {
      // Add a reference to a non-existent file in SUMMARY.md
      const summaryWithMissing = SUMMARY_MD + "\n* [Missing](missing.md)\n";
      writeFixture("SUMMARY.md", summaryWithMissing);

      const result = await parseGitbook(FIXTURE_DIR);

      const missingWarning = result.warnings.find((w) =>
        w.includes("missing.md"),
      );
      expect(missingWarning).toBeDefined();

      // The missing page should NOT be in pages
      const missingPage = result.pages.find((p) => p.path === "missing.md");
      expect(missingPage).toBeUndefined();
    });

    it("handles directory without SUMMARY.md (fallback to directory scan)", async () => {
      // Remove SUMMARY.md
      fs.unlinkSync(path.join(FIXTURE_DIR, "SUMMARY.md"));

      const result = await parseGitbook(FIXTURE_DIR);

      // Should still find pages by scanning the directory
      expect(result.pages.length).toBeGreaterThan(0);
      const paths = result.pages.map((p) => p.path);
      expect(paths).toContain("README.md");
    });

    it("handles page with no frontmatter and no heading", async () => {
      writeFixture("bare.md", "Just some plain content without a heading.");
      // Also need to re-add SUMMARY.md that doesn't reference bare.md
      // so it's discovered as an extra file

      const result = await parseGitbook(FIXTURE_DIR);
      const bare = result.pages.find((p) => p.path === "bare.md");

      expect(bare).toBeDefined();
      if (bare) {
        // Should derive title from filename
        expect(bare.title).toBe("bare");
      }
    });
  });
});
