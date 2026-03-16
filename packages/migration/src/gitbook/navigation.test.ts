import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseGitbookYaml,
  parseSummaryMd,
  buildNavigationFromDirectory,
  parseGitbookNavigation,
  type GitbookNavigation,
} from "./navigation.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SIMPLE_SUMMARY = `# Summary

* [Introduction](README.md)
* [Getting Started](getting-started.md)
* [Configuration](configuration.md)
`;

const MULTI_LEVEL_SUMMARY = `# Table of Contents

## Getting Started

* [Introduction](getting-started/README.md)
  * [Installation](getting-started/installation.md)
  * [Quick Start](getting-started/quick-start.md)

## Guides

* [Authentication](guides/auth/README.md)
  * [OAuth](guides/auth/oauth.md)
  * [JWT Tokens](guides/auth/jwt.md)
    * [Token Refresh](guides/auth/jwt-refresh.md)
* [Deployment](guides/deployment.md)

## API Reference

* [REST API](api/rest.md)
* [GraphQL](api/graphql.md)
`;

const SUMMARY_WITH_SIDEBAR_TITLES = `# Summary

* [Welcome Page](README.md "Home")
* [Getting Started Guide](getting-started.md "Quick Start")
* [API Reference](api/README.md "API")
  * [Authentication](api/auth.md "Auth")
`;

const SUMMARY_WITH_SEPARATORS = `# Summary

* [Introduction](README.md)

---

## User Guide

* [Basics](guide/basics.md)
* [Advanced](guide/advanced.md)

---

## Developer Docs

* [Contributing](dev/contributing.md)
* [Architecture](dev/architecture.md)
`;

const SUMMARY_TAB_INDENTED = `# Summary

## Docs

*	[Overview](overview.md)
	*	[Sub Page](overview/sub.md)
		*	[Deep Page](overview/sub/deep.md)
`;

const SUMMARY_FOUR_SPACE_INDENT = `# Summary

* [Root Page](root.md)
    * [Child Page](child.md)
        * [Grandchild Page](grandchild.md)
`;

const GITBOOK_YAML_FULL = `root: ./docs/

structure:
  readme: intro.md
  summary: nav.md

redirects:
  old/page: new/page.md
  another/old: another/new.md
  /absolute/path: /absolute/dest
`;

const GITBOOK_YAML_MINIMAL = `root: ./
`;

const GITBOOK_YAML_EMPTY = ``;

// ---------------------------------------------------------------------------
// Tests: parseGitbookYaml
// ---------------------------------------------------------------------------

describe("parseGitbookYaml", () => {
  it("parses full .gitbook.yaml with all fields", () => {
    const config = parseGitbookYaml(GITBOOK_YAML_FULL);

    expect(config.root).toBe("./docs/");
    expect(config.structure.readme).toBe("intro.md");
    expect(config.structure.summary).toBe("nav.md");
    expect(config.redirects).toHaveLength(3);
    expect(config.redirects[0]).toEqual({
      from: "/old/page",
      to: "/new/page.md",
      status: 301,
    });
    expect(config.redirects[1]).toEqual({
      from: "/another/old",
      to: "/another/new.md",
      status: 301,
    });
    // Absolute paths should remain unchanged
    expect(config.redirects[2]).toEqual({
      from: "/absolute/path",
      to: "/absolute/dest",
      status: 301,
    });
  });

  it("applies defaults for minimal config", () => {
    const config = parseGitbookYaml(GITBOOK_YAML_MINIMAL);

    expect(config.root).toBe("./");
    expect(config.structure.readme).toBe("README.md");
    expect(config.structure.summary).toBe("SUMMARY.md");
    expect(config.redirects).toEqual([]);
  });

  it("applies all defaults for empty YAML", () => {
    const config = parseGitbookYaml(GITBOOK_YAML_EMPTY);

    expect(config.root).toBe(".");
    expect(config.structure.readme).toBe("README.md");
    expect(config.structure.summary).toBe("SUMMARY.md");
    expect(config.redirects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseSummaryMd
// ---------------------------------------------------------------------------

describe("parseSummaryMd", () => {
  it("parses a simple flat SUMMARY.md", () => {
    const nav = parseSummaryMd(SIMPLE_SUMMARY);

    expect(nav.pages).toHaveLength(3);
    expect(nav.pages[0].title).toBe("Introduction");
    expect(nav.pages[0].path).toBe("README.md");
    expect(nav.pages[0].folderPath).toBe("");
    expect(nav.pages[0].position).toBe(0);

    expect(nav.pages[1].title).toBe("Getting Started");
    expect(nav.pages[1].path).toBe("getting-started.md");
    expect(nav.pages[1].position).toBe(1);

    expect(nav.pages[2].title).toBe("Configuration");
    expect(nav.pages[2].position).toBe(2);

    expect(nav.folders).toHaveLength(0);
  });

  it("parses multi-level SUMMARY.md with heading groups and deep nesting", () => {
    const nav = parseSummaryMd(MULTI_LEVEL_SUMMARY);

    // Should have group folders: getting-started, guides, api-reference
    const groupFolders = nav.folders.filter((f) => !f.parentPath);
    const groupNames = groupFolders.map((f) => f.name);
    expect(groupNames).toContain("Getting Started");
    expect(groupNames).toContain("Guides");
    expect(groupNames).toContain("API Reference");

    // "Authentication" with children should create a nested folder
    const authFolder = nav.folders.find((f) => f.name === "Authentication");
    expect(authFolder).toBeDefined();
    if (authFolder) {
      expect(authFolder.parentPath).toBe("guides");
    }

    // JWT Tokens has a child (Token Refresh), so it should be a folder too
    const jwtFolder = nav.folders.find((f) => f.name === "JWT Tokens");
    expect(jwtFolder).toBeDefined();

    // Token Refresh is a leaf page
    const refreshPage = nav.pages.find((p) => p.title === "Token Refresh");
    expect(refreshPage).toBeDefined();
    if (refreshPage) {
      expect(refreshPage.path).toBe("guides/auth/jwt-refresh.md");
    }

    // Deployment is a leaf under Guides group
    const deployPage = nav.pages.find((p) => p.title === "Deployment");
    expect(deployPage).toBeDefined();
    if (deployPage) {
      expect(deployPage.folderPath).toBe("guides");
    }

    // REST API is a leaf under API Reference group
    const restPage = nav.pages.find((p) => p.title === "REST API");
    expect(restPage).toBeDefined();
    if (restPage) {
      expect(restPage.folderPath).toBe("api-reference");
    }
  });

  it("handles sidebar title syntax", () => {
    const nav = parseSummaryMd(SUMMARY_WITH_SIDEBAR_TITLES);

    expect(nav.pages[0].title).toBe("Welcome Page");
    expect(nav.pages[0].sidebarTitle).toBe("Home");

    expect(nav.pages[1].title).toBe("Getting Started Guide");
    expect(nav.pages[1].sidebarTitle).toBe("Quick Start");

    // API Reference has children, so it becomes a folder + landing page
    const apiPage = nav.pages.find((p) => p.title === "API Reference");
    expect(apiPage).toBeDefined();
    if (apiPage) {
      expect(apiPage.sidebarTitle).toBe("API");
    }

    const authPage = nav.pages.find((p) => p.title === "Authentication");
    expect(authPage).toBeDefined();
    if (authPage) {
      expect(authPage.sidebarTitle).toBe("Auth");
    }
  });

  it("handles separators between groups", () => {
    const nav = parseSummaryMd(SUMMARY_WITH_SEPARATORS);

    // Introduction should be at root level (no group)
    const introPage = nav.pages.find((p) => p.title === "Introduction");
    expect(introPage).toBeDefined();
    if (introPage) {
      expect(introPage.folderPath).toBe("");
    }

    // User Guide and Developer Docs groups should exist
    const userGuideFolder = nav.folders.find((f) => f.name === "User Guide");
    expect(userGuideFolder).toBeDefined();

    const devDocsFolder = nav.folders.find((f) => f.name === "Developer Docs");
    expect(devDocsFolder).toBeDefined();

    // Pages in User Guide group
    const basicsPage = nav.pages.find((p) => p.title === "Basics");
    expect(basicsPage).toBeDefined();
    if (basicsPage) {
      expect(basicsPage.folderPath).toBe("user-guide");
    }

    // Pages in Developer Docs group
    const contributingPage = nav.pages.find((p) => p.title === "Contributing");
    expect(contributingPage).toBeDefined();
    if (contributingPage) {
      expect(contributingPage.folderPath).toBe("developer-docs");
    }
  });

  it("handles tab indentation", () => {
    const nav = parseSummaryMd(SUMMARY_TAB_INDENTED);

    // Docs group folder
    const docsFolder = nav.folders.find((f) => f.name === "Docs");
    expect(docsFolder).toBeDefined();

    // Overview has children -> folder
    const overviewFolder = nav.folders.find((f) => f.name === "Overview");
    expect(overviewFolder).toBeDefined();

    // Sub Page has children -> folder
    const subFolder = nav.folders.find((f) => f.name === "Sub Page");
    expect(subFolder).toBeDefined();

    // Deep Page is a leaf
    const deepPage = nav.pages.find((p) => p.title === "Deep Page");
    expect(deepPage).toBeDefined();
  });

  it("handles 4-space indentation", () => {
    const nav = parseSummaryMd(SUMMARY_FOUR_SPACE_INDENT);

    // Root Page has children -> folder
    const rootFolder = nav.folders.find((f) => f.name === "Root Page");
    expect(rootFolder).toBeDefined();

    // Child Page has children -> folder
    const childFolder = nav.folders.find((f) => f.name === "Child Page");
    expect(childFolder).toBeDefined();

    // Grandchild is a leaf
    const grandchild = nav.pages.find((p) => p.title === "Grandchild Page");
    expect(grandchild).toBeDefined();
  });

  it("returns empty results for empty content", () => {
    const nav = parseSummaryMd("");
    expect(nav.folders).toHaveLength(0);
    expect(nav.pages).toHaveLength(0);
    expect(nav.redirects).toHaveLength(0);
  });

  it("assigns sequential positions within each folder", () => {
    const nav = parseSummaryMd(MULTI_LEVEL_SUMMARY);

    // Pages within the API Reference group should have sequential positions
    const apiPages = nav.pages.filter(
      (p) => p.folderPath === "api-reference"
    );
    const positions = apiPages.map((p) => p.position);
    // Positions should be sequential starting from 0
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBe(i);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: buildNavigationFromDirectory
// ---------------------------------------------------------------------------

describe("buildNavigationFromDirectory", () => {
  const tmpDir = path.join(process.cwd(), "__test_gitbook_nav_tmp__");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds hierarchy from directory structure", () => {
    // Create test directory structure
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Home");
    fs.mkdirSync(path.join(tmpDir, "guide"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "guide", "basics.md"), "# Basics");
    fs.writeFileSync(path.join(tmpDir, "guide", "advanced.md"), "# Advanced");
    fs.mkdirSync(path.join(tmpDir, "api"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "api", "README.md"), "# API");
    fs.writeFileSync(path.join(tmpDir, "api", "endpoints.md"), "# Endpoints");

    const nav = buildNavigationFromDirectory(tmpDir);

    // Should have folders: guide, api
    expect(nav.folders).toHaveLength(2);
    const folderPaths = nav.folders.map((f) => f.path);
    expect(folderPaths).toContain("guide");
    expect(folderPaths).toContain("api");

    // Should have all pages
    expect(nav.pages.length).toBe(5);

    // Root README should have title "Home"
    const rootReadme = nav.pages.find((p) => p.path === "README.md");
    expect(rootReadme).toBeDefined();
    if (rootReadme) {
      expect(rootReadme.title).toBe("Home");
      expect(rootReadme.folderPath).toBe("");
    }

    // api/README should use folder name as title
    const apiReadme = nav.pages.find((p) => p.path === "api/README.md");
    expect(apiReadme).toBeDefined();
    if (apiReadme) {
      expect(apiReadme.title).toBe("api");
      expect(apiReadme.folderPath).toBe("api");
    }
  });

  it("handles nested directories", () => {
    fs.mkdirSync(path.join(tmpDir, "a", "b", "c"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "a", "b", "c", "deep.md"), "# Deep");

    const nav = buildNavigationFromDirectory(tmpDir);

    // Should create folders: a, a/b, a/b/c
    expect(nav.folders).toHaveLength(3);
    const folderA = nav.folders.find((f) => f.path === "a");
    const folderB = nav.folders.find((f) => f.path === "a/b");
    const folderC = nav.folders.find((f) => f.path === "a/b/c");

    expect(folderA).toBeDefined();
    if (folderA) {
      expect(folderA.parentPath).toBeUndefined();
    }

    expect(folderB).toBeDefined();
    if (folderB) {
      expect(folderB.parentPath).toBe("a");
    }

    expect(folderC).toBeDefined();
    if (folderC) {
      expect(folderC.parentPath).toBe("a/b");
    }
  });

  it("skips hidden directories and node_modules", () => {
    fs.mkdirSync(path.join(tmpDir, ".hidden"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".hidden", "secret.md"), "# Secret");
    fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "node_modules", "package.md"),
      "# Package"
    );
    fs.writeFileSync(path.join(tmpDir, "visible.md"), "# Visible");

    const nav = buildNavigationFromDirectory(tmpDir);

    expect(nav.pages).toHaveLength(1);
    expect(nav.pages[0].title).toBe("visible");
  });

  it("returns empty results for empty directory", () => {
    const nav = buildNavigationFromDirectory(tmpDir);
    expect(nav.folders).toHaveLength(0);
    expect(nav.pages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseGitbookNavigation (integration)
// ---------------------------------------------------------------------------

describe("parseGitbookNavigation", () => {
  const tmpDir = path.join(process.cwd(), "__test_gitbook_integration_tmp__");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses SUMMARY.md when present", () => {
    fs.writeFileSync(path.join(tmpDir, "SUMMARY.md"), SIMPLE_SUMMARY);
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Home");

    const nav = parseGitbookNavigation(tmpDir);

    expect(nav.pages).toHaveLength(3);
    expect(nav.pages[0].title).toBe("Introduction");
  });

  it("falls back to directory scan when SUMMARY.md is missing", () => {
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Home");
    fs.writeFileSync(path.join(tmpDir, "guide.md"), "# Guide");

    const nav = parseGitbookNavigation(tmpDir);

    expect(nav.pages).toHaveLength(2);
  });

  it("respects .gitbook.yaml root and structure", () => {
    // Create .gitbook.yaml pointing to docs/ subdir with custom summary name
    fs.writeFileSync(
      path.join(tmpDir, ".gitbook.yaml"),
      `root: ./docs/\nstructure:\n  summary: nav.md\nredirects:\n  old: new.md\n`
    );

    // Create docs/ with custom summary
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "docs", "nav.md"),
      `# Nav\n\n* [Home](README.md)\n* [Guide](guide.md)\n`
    );

    const nav = parseGitbookNavigation(tmpDir);

    expect(nav.pages).toHaveLength(2);
    expect(nav.pages[0].title).toBe("Home");
    expect(nav.redirects).toHaveLength(1);
    expect(nav.redirects[0]).toEqual({
      from: "/old",
      to: "/new.md",
      status: 301,
    });
  });

  it("merges redirects from .gitbook.yaml with SUMMARY.md navigation", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".gitbook.yaml"),
      `redirects:\n  old/page: new/page.md\n  docs/v1: docs/v2.md\n`
    );
    fs.writeFileSync(path.join(tmpDir, "SUMMARY.md"), SIMPLE_SUMMARY);

    const nav = parseGitbookNavigation(tmpDir);

    expect(nav.redirects).toHaveLength(2);
    expect(nav.pages).toHaveLength(3);
  });
});
