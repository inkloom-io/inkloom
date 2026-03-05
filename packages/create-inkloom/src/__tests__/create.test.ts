import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { create } from "../create";

// Use a temp directory for all scaffold tests
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "create-inkloom-test-"));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

describe("create (core template)", () => {
  it("scaffolds a project with the core template", async () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("test-project", {
        template: "core",
        packageManager: "pnpm",
        skipInstall: true,
      });

      const projectPath = path.join(tmpDir, "test-project");
      expect(await fs.pathExists(projectPath)).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, "package.json"))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, "convex/schema.ts"))).toBe(true);
    } finally {
      process.chdir(origCwd);
    }
  });

  it("creates all required files for the core template", async () => {
    const projectPath = path.join(tmpDir, "core-files-test");

    // We need to call create from the right cwd context
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("core-files-test", {
        template: "core",
        packageManager: "pnpm",
        skipInstall: true,
      });

      // Check essential files exist
      const requiredFiles = [
        "package.json",
        "next.config.ts",
        "tsconfig.json",
        "postcss.config.mjs",
        ".env.example",
        ".gitignore",
        "README.md",
        "convex.config.ts",
        "convex/schema.ts",
        "convex/schema/core-tables.ts",
        "convex/users.ts",
        "convex/projects.ts",
        "app/layout.tsx",
        "app/page.tsx",
        "app/globals.css",
        "components/providers.tsx",
      ];

      for (const file of requiredFiles) {
        const exists = await fs.pathExists(path.join(projectPath, file));
        expect(exists, `Missing file: ${file}`).toBe(true);
      }
    } finally {
      process.chdir(origCwd);
    }
  });

  it("renames gitignore to .gitignore", async () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("gitignore-test", {
        template: "core",
        packageManager: "pnpm",
        skipInstall: true,
      });

      const projectPath = path.join(tmpDir, "gitignore-test");
      expect(await fs.pathExists(path.join(projectPath, ".gitignore"))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, "gitignore"))).toBe(false);
    } finally {
      process.chdir(origCwd);
    }
  });

  it("renames env.example to .env.example", async () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("env-test", {
        template: "core",
        packageManager: "pnpm",
        skipInstall: true,
      });

      const projectPath = path.join(tmpDir, "env-test");
      expect(await fs.pathExists(path.join(projectPath, ".env.example"))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, "env.example"))).toBe(false);
    } finally {
      process.chdir(origCwd);
    }
  });

  it("sets project name in package.json", async () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("custom-name", {
        template: "core",
        packageManager: "pnpm",
        skipInstall: true,
      });

      const pkg = await fs.readJson(path.join(tmpDir, "custom-name", "package.json"));
      expect(pkg.name).toBe("custom-name");
    } finally {
      process.chdir(origCwd);
    }
  });
});

describe("create (default template)", () => {
  it("scaffolds a project with the default template", async () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      await create("default-test", {
        template: "default",
        packageManager: "pnpm",
        skipInstall: true,
      });

      const projectPath = path.join(tmpDir, "default-test");
      expect(await fs.pathExists(path.join(projectPath, "package.json"))).toBe(true);
      // Default template has vite.config.ts instead of next.config.ts
      expect(await fs.pathExists(path.join(projectPath, "vite.config.ts"))).toBe(true);
    } finally {
      process.chdir(origCwd);
    }
  });
});

describe("create (error cases)", () => {
  it("exits for unknown template", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await create("bad-template", {
        template: "nonexistent",
        packageManager: "pnpm",
        skipInstall: true,
      });
    } catch (e) {
      // expected — process.exit mock throws
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
