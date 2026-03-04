/**
 * Core CLI Boundary Tests
 *
 * Verifies that the core CLI only includes OSS-appropriate commands
 * and excludes platform-only commands (AI docs, etc.).
 *
 * See OSS_PLAN.md Section 9 for the OSS CLI command scope.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");
const COMMANDS_DIR = resolve(__dirname, "../src/commands");

function runCli(
  args: string[],
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 5000,
    env: { ...process.env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// ── Core commands that MUST be present ───────────────────────────

const EXPECTED_CORE_COMMANDS = [
  "auth",
  "projects",
  "pages",
  "folders",
  "branches",
  "deploy",
  "deployments",
  "domains",
  "assets",
  "openapi",
  "webhooks",
  "llms-txt",
  "build",
  "export",
  "migrate",
];

// ── Platform-only commands that MUST NOT be present ──────────────

const EXCLUDED_PLATFORM_COMMANDS = [
  "docs",           // AI-powered doc generation (imports @inkloom/ai)
];

describe("Core CLI command boundary", () => {
  it("should include all expected core commands in help output", () => {
    const { stdout } = runCli(["--help"]);
    for (const cmd of EXPECTED_CORE_COMMANDS) {
      assert.ok(
        stdout.includes(cmd),
        `Core CLI should include '${cmd}' command in help output`,
      );
    }
  });

  it("should NOT include platform-only commands in help output", () => {
    const { stdout } = runCli(["--help"]);
    // Check that 'docs' does not appear as a standalone command
    // (it might appear in text like "Documentation:" footer, so check for command listing pattern)
    const commandLines = stdout
      .split("\n")
      .filter((line) => /^\s{2,}\w/.test(line))  // indented command lines
      .map((line) => line.trim().split(/\s+/)[0]); // first word = command name

    for (const cmd of EXCLUDED_PLATFORM_COMMANDS) {
      assert.ok(
        !commandLines.includes(cmd),
        `Core CLI should NOT include '${cmd}' command (platform-only)`,
      );
    }
  });

  it("should not show 'docs' in the Commands listing", () => {
    const { stdout } = runCli(["--help"]);
    // Extract lines in the Commands section (indented with 2+ spaces, start with a word)
    const lines = stdout.split("\n");
    const commandNames = lines
      .filter((line) => /^\s{2,}\S/.test(line))
      .map((line) => line.trim().split(/\s+/)[0]);

    assert.ok(
      !commandNames.includes("docs"),
      `'docs' should not appear as a registered command. Found commands: ${commandNames.join(", ")}`,
    );
  });

  it("should not have a 'docs' subcommand with help text", () => {
    // When calling 'docs --help', Commander shows root help (no docs subcommand)
    const { stdout: docsHelp } = runCli(["docs", "--help"]);
    const { stdout: rootHelp } = runCli(["--help"]);
    // If docs were registered, its help would differ from root help
    assert.equal(
      docsHelp.trim(),
      rootHelp.trim(),
      "'docs --help' should show root help (command not registered)",
    );
  });
});

describe("Core CLI source files: no platform imports", () => {
  it("should not contain @inkloom/ai imports in any command file", () => {
    const commandFiles = readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith(".ts"));

    for (const file of commandFiles) {
      const content = readFileSync(resolve(COMMANDS_DIR, file), "utf-8");
      assert.ok(
        !content.includes("@inkloom/ai"),
        `${file} should not import from @inkloom/ai (platform package)`,
      );
    }
  });

  it("should not contain platform/ path imports in any command file", () => {
    const commandFiles = readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith(".ts"));

    for (const file of commandFiles) {
      const content = readFileSync(resolve(COMMANDS_DIR, file), "utf-8");
      assert.ok(
        !content.includes("from \"platform/") &&
          !content.includes("from '@platform/") &&
          !content.includes("from \"@platform/"),
        `${file} should not import from platform/ (import boundary violation)`,
      );
    }
  });

  it("should not have docs.ts in core commands directory", () => {
    const commandFiles = readdirSync(COMMANDS_DIR);
    assert.ok(
      !commandFiles.includes("docs.ts"),
      "docs.ts should not exist in core/packages/cli/src/commands/ (moved to platform/cli/commands/)",
    );
  });
});

describe("Core CLI entry point: command registration", () => {
  it("cli.ts should not import registerDocsCommands", () => {
    const cliSource = readFileSync(
      resolve(__dirname, "../src/cli.ts"),
      "utf-8",
    );
    assert.ok(
      !cliSource.includes("registerDocsCommands"),
      "cli.ts should not import or call registerDocsCommands",
    );
  });

  it("cli.ts should not import from @inkloom/ai", () => {
    const cliSource = readFileSync(
      resolve(__dirname, "../src/cli.ts"),
      "utf-8",
    );
    assert.ok(
      !cliSource.includes("@inkloom/ai"),
      "cli.ts should not import from @inkloom/ai",
    );
  });

  it("cli.ts should register all expected core commands", () => {
    const cliSource = readFileSync(
      resolve(__dirname, "../src/cli.ts"),
      "utf-8",
    );

    const expectedRegistrations = [
      "registerAuthCommands",
      "registerProjectsCommands",
      "registerPagesCommands",
      "registerFoldersCommands",
      "registerBranchesCommands",
      "registerDeployCommand",
      "registerDeploymentsCommands",
      "registerDomainsCommands",
      "registerAssetsCommands",
      "registerOpenApiCommands",
      "registerWebhooksCommands",
      "registerLlmsTxtCommands",
      "registerBuildCommand",
      "registerExportCommand",
      "registerMigrateCommand",
    ];

    for (const reg of expectedRegistrations) {
      assert.ok(
        cliSource.includes(reg),
        `cli.ts should call ${reg}()`,
      );
    }
  });
});

describe("Platform CLI docs command: properly separated", () => {
  it("docs.ts should exist in platform/cli/commands/", () => {
    const platformDocsPath = resolve(
      __dirname,
      "../../../../platform/cli/commands/docs.ts",
    );
    const content = readFileSync(platformDocsPath, "utf-8");
    assert.ok(
      content.includes("registerDocsCommands"),
      "Platform docs.ts should export registerDocsCommands",
    );
  });

  it("platform docs.ts should import from @inkloom/ai", () => {
    const platformDocsPath = resolve(
      __dirname,
      "../../../../platform/cli/commands/docs.ts",
    );
    const content = readFileSync(platformDocsPath, "utf-8");
    assert.ok(
      content.includes("@inkloom/ai"),
      "Platform docs.ts should import from @inkloom/ai (legitimate platform dependency)",
    );
  });

  it("platform docs.test.ts should exist in platform/cli/tests/", () => {
    const platformTestPath = resolve(
      __dirname,
      "../../../../platform/cli/tests/docs.test.ts",
    );
    const content = readFileSync(platformTestPath, "utf-8");
    assert.ok(
      content.includes("docs"),
      "Platform docs.test.ts should test docs commands",
    );
  });
});

describe("Core CLI: package.json has no platform dependencies", () => {
  it("should not list @inkloom/ai as a dependency", () => {
    const pkgPath = resolve(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    assert.ok(
      !("@inkloom/ai" in allDeps),
      "Core CLI package.json should not depend on @inkloom/ai",
    );
  });

  it("should not list any platform/* packages as dependencies", () => {
    const pkgPath = resolve(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    });

    const platformDeps = allDeps.filter(
      (dep) =>
        dep.includes("partykit") ||
        dep.includes("api-proxy") ||
        dep.includes("domain-router") ||
        dep.includes("docs-action"),
    );

    assert.equal(
      platformDeps.length,
      0,
      `Core CLI should not depend on platform packages: ${platformDeps.join(", ")}`,
    );
  });
});
