import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DIST_DIR = resolve(PKG_ROOT, "dist");
const CLI_PATH = resolve(DIST_DIR, "cli.js");

function readPackageJson() {
  return JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf-8"));
}

function run(...args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 5000,
  }).trim();
}

describe("npm publish readiness", () => {
  describe("package.json required fields", () => {
    const pkg = readPackageJson();

    it("should have name set to @inkloom/cli", () => {
      assert.equal(pkg.name, "@inkloom/cli");
    });

    it("should have a version", () => {
      assert.ok(pkg.version, "version field is required");
      assert.match(pkg.version, /^\d+\.\d+\.\d+/, "version should be semver");
    });

    it("should have a description", () => {
      assert.ok(pkg.description, "description is required for npm");
    });

    it("should have a license", () => {
      assert.ok(pkg.license, "license is required for npm");
    });

    it("should have repository field", () => {
      assert.ok(pkg.repository, "repository field is required for npm");
      assert.equal(pkg.repository.type, "git");
      assert.ok(pkg.repository.url, "repository.url is required");
      assert.equal(pkg.repository.directory, "core/packages/cli");
    });

    it("should have bugs field", () => {
      assert.ok(pkg.bugs, "bugs field is required for npm");
      assert.ok(pkg.bugs.url, "bugs.url is required");
      assert.ok(
        pkg.bugs.url.includes("github.com"),
        "bugs URL should point to GitHub issues"
      );
    });

    it("should have publishConfig with public access", () => {
      assert.ok(pkg.publishConfig, "publishConfig is required for scoped packages");
      assert.equal(pkg.publishConfig.access, "public");
    });

    it("should NOT be marked as private", () => {
      assert.equal(pkg.private, undefined, "private must not be set for npm publishing");
    });

    it("should have homepage field", () => {
      assert.ok(pkg.homepage, "homepage field is required");
      assert.ok(pkg.homepage.startsWith("https://"), "homepage should be https URL");
    });

    it("should have keywords array", () => {
      assert.ok(Array.isArray(pkg.keywords), "keywords should be an array");
      assert.ok(pkg.keywords.length >= 3, "should have at least 3 keywords");
      assert.ok(pkg.keywords.includes("inkloom"), "should include 'inkloom' keyword");
      assert.ok(pkg.keywords.includes("cli"), "should include 'cli' keyword");
      assert.ok(pkg.keywords.includes("documentation"), "should include 'documentation' keyword");
    });

    it("should have bin entry", () => {
      assert.ok(pkg.bin, "bin field is required");
      assert.equal(pkg.bin.inkloom, "./dist/cli.js");
    });

    it("should have files array restricting to dist/", () => {
      assert.ok(Array.isArray(pkg.files), "files should be an array");
      assert.ok(pkg.files.includes("dist"), "files should include dist");
    });

    it("should have type set to module", () => {
      assert.equal(pkg.type, "module");
    });

    it("should have exports entry", () => {
      assert.ok(pkg.exports, "exports field is required");
      assert.ok(pkg.exports["."], 'exports["."] is required');
      assert.ok(pkg.exports["."].import, "exports import is required");
      assert.ok(pkg.exports["."].types, "exports types is required");
    });

    it("should have engines requirement for Node.js 20+", () => {
      assert.ok(pkg.engines, "engines field should exist");
      assert.ok(pkg.engines.node, "engines.node should be set");
      assert.ok(
        pkg.engines.node.includes("20"),
        "should require Node.js 20+"
      );
    });
  });

  describe("dist artifacts", () => {
    it("should have cli.js", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "cli.js")));
    });

    it("should have index.js", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "index.js")));
    });

    it("should have index.d.ts (TypeScript declarations)", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "index.d.ts")));
    });

    it("should have cli.d.ts", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "cli.d.ts")));
    });
  });

  describe("public API exports from index.js", () => {
    let mod: Record<string, unknown>;

    it("should dynamically import index.js without error", async () => {
      mod = await import(resolve(DIST_DIR, "index.js"));
      assert.ok(mod);
    });

    it("should export VERSION", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.VERSION, "string");
    });

    it("should export readConfig", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.readConfig, "function");
    });

    it("should export writeConfig", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.writeConfig, "function");
    });

    it("should export resolveConfig", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.resolveConfig, "function");
    });

    it("should export createClient", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.createClient, "function");
    });

    it("should export CliError class", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.CliError, "function");
      const err = new (mod.CliError as new (
        msg: string,
        code?: number
      ) => Error)("test", 1);
      assert.ok(err instanceof Error);
    });

    it("should export exit code constants", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(mod.EXIT_SUCCESS, 0);
      assert.equal(mod.EXIT_GENERAL, 1);
      assert.equal(mod.EXIT_AUTH, 2);
      assert.equal(mod.EXIT_PERMISSION, 3);
      assert.equal(mod.EXIT_NOT_FOUND, 4);
    });

    it("should export exitCodeFromApiError", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.exitCodeFromApiError, "function");
    });

    it("should export parseFrontmatter", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.parseFrontmatter, "function");
    });

    it("should export serializeFrontmatter", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.serializeFrontmatter, "function");
    });

    it("should export walkMdxFiles", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.walkMdxFiles, "function");
    });

    it("should export computeDiff", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.computeDiff, "function");
    });

    it("should export titleCase", async () => {
      mod = mod ?? (await import(resolve(DIST_DIR, "index.js")));
      assert.equal(typeof mod.titleCase, "function");
    });
  });

  describe("CLI command groups", () => {
    const helpOutput = run("--help");

    const expectedGroups = [
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
    ];

    for (const group of expectedGroups) {
      it(`should list '${group}' command group in --help`, () => {
        assert.ok(
          helpOutput.includes(group),
          `--help should include '${group}' command`
        );
      });
    }
  });

  describe("CLI version matches package.json", () => {
    it("should output the same version as package.json", () => {
      const pkg = readPackageJson();
      const cliVersion = run("--version");
      assert.equal(cliVersion, pkg.version);
    });
  });
});
