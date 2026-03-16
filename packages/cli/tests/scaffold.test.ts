import "./ensure-build.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");
const DIST_DIR = resolve(__dirname, "../dist");

function run(...args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 5000,
  }).trim();
}

function runWithStderr(
  ...args: string[]
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? "").trim(),
      exitCode: e.status ?? 1,
    };
  }
}

describe("CLI scaffold", () => {
  describe("dist output files", () => {
    it("should produce cli.js in dist/", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "cli.js")));
    });

    it("should produce index.js in dist/", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "index.js")));
    });

    it("should produce index.d.ts in dist/", () => {
      assert.ok(existsSync(resolve(DIST_DIR, "index.d.ts")));
    });

    it("should have shebang in cli.js", () => {
      const content = readFileSync(resolve(DIST_DIR, "cli.js"), "utf-8");
      assert.ok(
        content.startsWith("#!/usr/bin/env node"),
        "cli.js should start with node shebang"
      );
    });
  });

  describe("--version flag", () => {
    it("should print the correct version", () => {
      const output = run("--version");
      assert.equal(output, "0.1.0");
    });
  });

  describe("--help flag", () => {
    it("should show the program name", () => {
      const output = run("--help");
      assert.ok(output.includes("inkloom"), "Help should mention 'inkloom'");
    });

    it("should show the description", () => {
      const output = run("--help");
      assert.ok(
        output.includes("manage documentation sites from the command line"),
        "Help should include description"
      );
    });

    it("should show --version flag", () => {
      const output = run("--help");
      assert.ok(
        output.includes("--version"),
        "Help should mention --version flag"
      );
    });
  });

  describe("no arguments", () => {
    it("should exit cleanly with no arguments", () => {
      const { exitCode } = runWithStderr();
      assert.equal(exitCode, 0);
    });
  });

  describe("library export", () => {
    it("should export VERSION from index.js", async () => {
      const mod = await import(resolve(DIST_DIR, "index.js"));
      assert.equal(mod.VERSION, "0.1.0");
    });
  });
});
