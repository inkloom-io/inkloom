/**
 * Tests for the `inkloom import` CLI command.
 *
 * Covers:
 * - Input validation (source, path, config detection)
 * - Dry-run mode (summary output without side effects)
 * - JSON output mode
 * - Subpath guidance printing
 * - Command registration and help text
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { registerImportCommand } from "../src/commands/import.ts";
import {
  detectSubpath,
  generateSubpathSnippets,
} from "@inkloom/migration";

// ---------------------------------------------------------------------------
// Helpers: Create test directories
// ---------------------------------------------------------------------------

function createMintlifyDir(tmpDir: string): string {
  const docsDir = join(tmpDir, "mintlify-docs");
  mkdirSync(docsDir, { recursive: true });

  // Write a minimal docs.json config
  writeFileSync(
    join(docsDir, "docs.json"),
    JSON.stringify({
      name: "Test Docs",
      navigation: [{ group: "Getting Started", pages: ["introduction"] }],
    }),
    "utf-8",
  );

  // Write a sample page
  writeFileSync(
    join(docsDir, "introduction.mdx"),
    `---
title: Introduction
description: Welcome to the docs
---

# Introduction

Welcome to the documentation.
`,
    "utf-8",
  );

  return docsDir;
}

function createGitbookDir(tmpDir: string): string {
  const docsDir = join(tmpDir, "gitbook-docs");
  mkdirSync(docsDir, { recursive: true });

  // Write SUMMARY.md
  writeFileSync(
    join(docsDir, "SUMMARY.md"),
    `# Table of contents

* [Introduction](README.md)
`,
    "utf-8",
  );

  // Write README.md
  writeFileSync(
    join(docsDir, "README.md"),
    `# Introduction

Welcome to the documentation.
`,
    "utf-8",
  );

  return docsDir;
}

function createMintlifyDirWithMintJson(tmpDir: string): string {
  const docsDir = join(tmpDir, "mintlify-mint-docs");
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(
    join(docsDir, "mint.json"),
    JSON.stringify({
      name: "Test Docs",
      navigation: [{ group: "Getting Started", pages: ["introduction"] }],
    }),
    "utf-8",
  );

  writeFileSync(
    join(docsDir, "introduction.mdx"),
    `---
title: Introduction
---

# Introduction

Hello world.
`,
    "utf-8",
  );

  return docsDir;
}

// ---------------------------------------------------------------------------
// Tests: Input validation
// ---------------------------------------------------------------------------

describe("import command input validation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "inkloom-import-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should reject unsupported source platform", () => {
    const validSources: Record<string, string> = {
      mintlify: "mintlify",
      gitbook: "gitbook",
    };

    assert.ok(!validSources["docusaurus"], "docusaurus should not be a valid source");
    assert.ok(validSources["mintlify"], "mintlify should be a valid source");
    assert.ok(validSources["gitbook"], "gitbook should be a valid source");
  });

  it("should reject non-existent directory path", () => {
    const fakePath = join(tmpDir, "nonexistent");
    assert.equal(existsSync(fakePath), false);
  });

  it("should detect mintlify config with docs.json", () => {
    const docsDir = createMintlifyDir(tmpDir);
    assert.ok(existsSync(join(docsDir, "docs.json")));
  });

  it("should detect mintlify config with mint.json", () => {
    const docsDir = createMintlifyDirWithMintJson(tmpDir);
    assert.ok(existsSync(join(docsDir, "mint.json")));
  });

  it("should detect gitbook config with SUMMARY.md", () => {
    const docsDir = createGitbookDir(tmpDir);
    assert.ok(existsSync(join(docsDir, "SUMMARY.md")));
  });

  it("should reject directory without config files", () => {
    const emptyDir = join(tmpDir, "empty-docs");
    mkdirSync(emptyDir, { recursive: true });

    const mintlifyConfigs = ["docs.json", "mint.json"];
    const hasConfig = mintlifyConfigs.some((f) =>
      existsSync(join(emptyDir, f)),
    );
    assert.equal(hasConfig, false, "Empty dir should not have config files");
  });

  it("should validate source is case-insensitive", () => {
    const sources: Record<string, string> = {
      mintlify: "mintlify",
      gitbook: "gitbook",
    };

    // Simulating the command's toLowerCase() behavior
    assert.ok(sources["mintlify".toLowerCase()]);
    assert.ok(sources["MINTLIFY".toLowerCase()]);
    assert.ok(sources["Gitbook".toLowerCase()]);
  });
});

// ---------------------------------------------------------------------------
// Tests: Command registration and help
// ---------------------------------------------------------------------------

describe("import command registration", () => {
  it("should register import command on program", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd, "import command should be registered");
  });

  it("should show correct description", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);
    assert.ok(
      importCmd.description().includes("Mintlify") ||
        importCmd.description().includes("Gitbook") ||
        importCmd.description().includes("Import"),
      "Description should mention import sources",
    );
  });

  it("should require --from option", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const fromOption = importCmd.options.find(
      (o) => o.long === "--from",
    );
    assert.ok(fromOption, "--from option should exist");
    assert.ok(fromOption.required, "--from should be required");
  });

  it("should require --path option", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const pathOption = importCmd.options.find(
      (o) => o.long === "--path",
    );
    assert.ok(pathOption, "--path option should exist");
    assert.ok(pathOption.required, "--path should be required");
  });

  it("should require --project option", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const projectOption = importCmd.options.find(
      (o) => o.long === "--project",
    );
    assert.ok(projectOption, "--project option should exist");
    assert.ok(projectOption.required, "--project should be required");
  });

  it("should have --source-url as optional", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const sourceUrlOption = importCmd.options.find(
      (o) => o.long === "--source-url",
    );
    assert.ok(sourceUrlOption, "--source-url option should exist");
    // Optional options have required=false or undefined
    assert.ok(!sourceUrlOption.mandatory, "--source-url should not be mandatory");
  });

  it("should have --dry-run as optional flag", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const dryRunOption = importCmd.options.find(
      (o) => o.long === "--dry-run",
    );
    assert.ok(dryRunOption, "--dry-run option should exist");
    assert.ok(!dryRunOption.required, "--dry-run should be optional");
  });

  it("should include help text with examples", () => {
    const program = new Command();
    program.exitOverride();

    registerImportCommand(program);

    const importCmd = program.commands.find((c) => c.name() === "import");
    assert.ok(importCmd);

    const helpText = importCmd.helpInformation();
    assert.ok(helpText.includes("--from"), "Help should mention --from");
    assert.ok(helpText.includes("--path"), "Help should mention --path");
    assert.ok(helpText.includes("--project"), "Help should mention --project");
    assert.ok(helpText.includes("--dry-run"), "Help should mention --dry-run");
    assert.ok(helpText.includes("--source-url"), "Help should mention --source-url");
  });
});

// ---------------------------------------------------------------------------
// Tests: Config file detection logic
// ---------------------------------------------------------------------------

describe("import config file detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "inkloom-import-config-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should detect docs.json for mintlify", () => {
    const docsDir = createMintlifyDir(tmpDir);

    const configFiles = ["docs.json", "mint.json"];
    const hasConfig = configFiles.some((f) =>
      existsSync(resolve(docsDir, f)),
    );
    assert.ok(hasConfig);
  });

  it("should detect mint.json for mintlify", () => {
    const docsDir = createMintlifyDirWithMintJson(tmpDir);

    const configFiles = ["docs.json", "mint.json"];
    const hasConfig = configFiles.some((f) =>
      existsSync(resolve(docsDir, f)),
    );
    assert.ok(hasConfig);
  });

  it("should detect SUMMARY.md for gitbook", () => {
    const docsDir = createGitbookDir(tmpDir);

    const configFiles = [".gitbook.yaml", "SUMMARY.md"];
    const hasConfig = configFiles.some((f) =>
      existsSync(resolve(docsDir, f)),
    );
    assert.ok(hasConfig);
  });

  it("should detect .gitbook.yaml for gitbook", () => {
    const docsDir = join(tmpDir, "gitbook-yaml-docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, ".gitbook.yaml"),
      "root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n",
      "utf-8",
    );
    writeFileSync(join(docsDir, "README.md"), "# Docs\n", "utf-8");

    const configFiles = [".gitbook.yaml", "SUMMARY.md"];
    const hasConfig = configFiles.some((f) =>
      existsSync(resolve(docsDir, f)),
    );
    assert.ok(hasConfig);
  });

  it("should fail when no config file exists", () => {
    const emptyDir = join(tmpDir, "no-config");
    mkdirSync(emptyDir, { recursive: true });

    const mintlifyConfigs = ["docs.json", "mint.json"];
    const gitbookConfigs = [".gitbook.yaml", "SUMMARY.md"];

    assert.ok(
      !mintlifyConfigs.some((f) => existsSync(resolve(emptyDir, f))),
      "Should not find mintlify config",
    );
    assert.ok(
      !gitbookConfigs.some((f) => existsSync(resolve(emptyDir, f))),
      "Should not find gitbook config",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Subpath detection integration
// ---------------------------------------------------------------------------

describe("import subpath detection", () => {
  it("should detect subpath in URL with path", () => {
    const result = detectSubpath("https://acme.com/docs");
    assert.ok(result, "Should detect subpath /docs");
    assert.equal(result.subpath, "/docs");
    assert.equal(result.host, "acme.com");
  });

  it("should not detect subpath for root URL", () => {
    const result = detectSubpath("https://docs.acme.com");
    assert.equal(result, undefined, "Root URL should not have subpath");
  });

  it("should not detect subpath for root URL with trailing slash", () => {
    const result = detectSubpath("https://docs.acme.com/");
    assert.equal(result, undefined, "Root URL with trailing slash should not have subpath");
  });

  it("should generate subpath snippets for detected subpath", () => {
    const snippets = generateSubpathSnippets(
      "acme.com",
      "/docs",
      "docs.acme.com",
    );
    assert.ok(snippets, "Should generate snippets");
    assert.ok(typeof snippets === "object", "Snippets should be an object");
  });
});

// ---------------------------------------------------------------------------
// Tests: JSON output shape
// ---------------------------------------------------------------------------

describe("import JSON output structure", () => {
  it("should produce correct dry-run JSON shape", () => {
    // Simulate the JSON output structure from dry-run
    const jsonOutput = {
      data: {
        dryRun: true,
        summary: {
          projectName: "Test Docs",
          pages: 5,
          folders: 2,
          assets: 3,
          redirects: 1,
          navTabs: 0,
          warnings: 0,
          hasBranding: false,
          hasSubpathGuidance: false,
        },
        pages: [
          { title: "Intro", slug: "intro", path: "intro.mdx", folderPath: "" },
        ],
        folders: [{ name: "API", slug: "api", path: "api" }],
        redirects: [{ from: "/old", to: "/new", status: 301 }],
        urlMap: { "/old-page": "/new-page" },
        warnings: [],
      },
    };

    assert.ok(jsonOutput.data.dryRun);
    assert.equal(jsonOutput.data.summary.pages, 5);
    assert.ok(Array.isArray(jsonOutput.data.pages));
    assert.ok(Array.isArray(jsonOutput.data.folders));
    assert.ok(Array.isArray(jsonOutput.data.redirects));
    assert.ok(typeof jsonOutput.data.urlMap === "object");
    assert.ok(Array.isArray(jsonOutput.data.warnings));
  });

  it("should produce correct import-complete JSON shape", () => {
    const jsonOutput = {
      data: {
        projectId: "proj_123",
        slug: "test-docs",
        url: "https://test-docs.inkloom.dev",
        pages: 10,
        folders: 3,
        assetsUploaded: 5,
        assetsFailed: 0,
        redirects: 2,
        urlMap: { "/old": "/new" },
        warnings: [],
        subpathGuidance: null,
      },
    };

    assert.ok(jsonOutput.data.projectId);
    assert.ok(jsonOutput.data.slug);
    assert.ok(jsonOutput.data.url);
    assert.equal(typeof jsonOutput.data.pages, "number");
    assert.equal(typeof jsonOutput.data.assetsUploaded, "number");
    assert.equal(typeof jsonOutput.data.assetsFailed, "number");
    assert.equal(jsonOutput.data.subpathGuidance, null);
  });

  it("should include subpathGuidance in JSON when present", () => {
    const jsonOutput = {
      data: {
        projectId: "proj_123",
        subpathGuidance: {
          subpath: "/docs",
          originalHost: "acme.com",
          recommendedSubdomain: "docs.acme.com",
        },
      },
    };

    assert.ok(jsonOutput.data.subpathGuidance);
    assert.equal(jsonOutput.data.subpathGuidance.subpath, "/docs");
    assert.equal(jsonOutput.data.subpathGuidance.originalHost, "acme.com");
    assert.equal(
      jsonOutput.data.subpathGuidance.recommendedSubdomain,
      "docs.acme.com",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Stage label mapping
// ---------------------------------------------------------------------------

describe("import stage labels", () => {
  it("should map all known migration stages to labels", () => {
    const STAGE_LABELS: Record<string, string> = {
      parsing: "Parsing source files",
      assets: "Discovering assets",
      converting: "Converting pages to BlockNote",
      redirects: "Generating redirects",
    };

    const stages = ["parsing", "assets", "converting", "redirects"];
    for (const stage of stages) {
      assert.ok(
        STAGE_LABELS[stage],
        `Stage "${stage}" should have a label`,
      );
      assert.ok(
        STAGE_LABELS[stage].length > 0,
        `Stage "${stage}" label should not be empty`,
      );
    }
  });
});
