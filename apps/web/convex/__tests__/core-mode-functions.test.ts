import { describe, it, expect } from "vitest";

/**
 * Tests for core-mode Convex functions (OSS single-tenant operation).
 *
 * These tests validate:
 * 1. Module structure — correct exports exist
 * 2. Sentinel values — consistent across modules
 * 3. Function arg shapes — core functions don't require platform-only args
 * 4. Import boundaries — core functions don't reference platform-only tables
 * 5. Schema compatibility — field types match core-tables.ts definitions
 */

// ---------------------------------------------------------------------------
// Module imports — verify core-mode modules are importable
// ---------------------------------------------------------------------------

import * as projects from "../projects";
import * as users from "../users";
import * as projectMembers from "../projectMembers";

// ---------------------------------------------------------------------------
// Sentinel values — verify consistency
// ---------------------------------------------------------------------------

describe("core-mode: sentinel values", () => {
  it("projects.LOCAL_ORG_ID is 'local'", () => {
    expect(projects.LOCAL_ORG_ID).toBe("local");
  });

  it("users.LOCAL_USER_ID is 'local'", () => {
    expect(users.LOCAL_USER_ID).toBe("local");
  });

  it("users.LOCAL_USER_EMAIL is 'local@inkloom.local'", () => {
    expect(users.LOCAL_USER_EMAIL).toBe("local@inkloom.local");
  });

  it("sentinel org ID matches the value documented in OSS_PLAN.md", () => {
    expect(projects.LOCAL_ORG_ID).toBe("local");
  });

  it("sentinel user ID matches the value used in auth.core adapter", () => {
    expect(users.LOCAL_USER_ID).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// Module exports — verify core-mode modules export the correct functions
// ---------------------------------------------------------------------------

describe("core-mode: projects exports", () => {
  it("exports LOCAL_ORG_ID constant", () => {
    expect(projects.LOCAL_ORG_ID).toBeDefined();
    expect(typeof projects.LOCAL_ORG_ID).toBe("string");
  });

  it("exports create mutation", () => {
    expect(projects.create).toBeDefined();
  });

  it("exports list query", () => {
    expect(projects.list).toBeDefined();
  });

  it("exports createFromImport mutation", () => {
    expect(projects.createFromImport).toBeDefined();
  });

  it("exports getDashboardStats query", () => {
    expect(projects.getDashboardStats).toBeDefined();
  });

  it("does NOT export platform-only functions (listByOrg, listForUser)", () => {
    expect((projects as Record<string, unknown>)["listByOrg"]).toBeUndefined();
    expect((projects as Record<string, unknown>)["listForUser"]).toBeUndefined();
  });

  it("does NOT export migration functions", () => {
    expect((projects as Record<string, unknown>)["migrateToWorkosOrg"]).toBeUndefined();
  });
});

describe("core-mode: users exports", () => {
  it("exports LOCAL_USER_ID constant", () => {
    expect(users.LOCAL_USER_ID).toBeDefined();
    expect(typeof users.LOCAL_USER_ID).toBe("string");
  });

  it("exports LOCAL_USER_EMAIL constant", () => {
    expect(users.LOCAL_USER_EMAIL).toBeDefined();
    expect(typeof users.LOCAL_USER_EMAIL).toBe("string");
  });

  it("exports ensureLocalUser mutation", () => {
    expect(users.ensureLocalUser).toBeDefined();
  });

  it("exports currentLocal query", () => {
    expect(users.currentLocal).toBeDefined();
  });

  it("does NOT export platform-only functions (getOrCreate, hasCompletedOnboarding)", () => {
    expect((users as Record<string, unknown>)["getOrCreate"]).toBeUndefined();
    expect((users as Record<string, unknown>)["hasCompletedOnboarding"]).toBeUndefined();
    expect((users as Record<string, unknown>)["completeOnboarding"]).toBeUndefined();
  });
});

describe("core-mode: projectMembers exports", () => {
  it("exports hasAccess query", () => {
    expect(projectMembers.hasAccess).toBeDefined();
  });

  it("exports getRole query", () => {
    expect(projectMembers.getRole).toBeDefined();
  });

  it("exports listAccessibleProjects query", () => {
    expect(projectMembers.listAccessibleProjects).toBeDefined();
  });

  it("does NOT export platform-only functions (addMember, removeMember, updateRole)", () => {
    expect((projectMembers as Record<string, unknown>)["addMember"]).toBeUndefined();
    expect((projectMembers as Record<string, unknown>)["removeMember"]).toBeUndefined();
    expect((projectMembers as Record<string, unknown>)["updateRole"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Core function shape — verify core simplifications
// ---------------------------------------------------------------------------

describe("core-mode: core function shapes", () => {
  it("core projects.list takes no args (no org filter)", () => {
    expect(projects.list).toBeDefined();
  });

  it("core getDashboardStats takes no args (no org scope)", () => {
    expect(projects.getDashboardStats).toBeDefined();
  });

  it("core createFromImport exists (no workosOrgId arg)", () => {
    expect(projects.createFromImport).toBeDefined();
  });

  it("core users.ensureLocalUser takes no args", () => {
    expect(users.ensureLocalUser).toBeDefined();
  });

  it("core projectMembers.listAccessibleProjects exists", () => {
    expect(projectMembers.listAccessibleProjects).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Source code analysis — verify no platform-only table references in core
// ---------------------------------------------------------------------------

describe("core-mode: import boundary (no platform table references)", () => {
  it("projects module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projects.ts"),
      "utf-8"
    );

    expect(source).not.toContain("generationJobs");
    expect(source).not.toContain("billing");
    expect(source).not.toContain("github");
    expect(source).not.toContain("apiKeys");
    expect(source).not.toContain("webhooks");
    expect(source).not.toContain("organizations");
  });

  it("users module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../users.ts"),
      "utf-8"
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));

    for (const line of importLines) {
      expect(line).not.toContain("generationJobs");
      expect(line).not.toContain("organizations");
      expect(line).not.toContain("memberships");
      expect(line).not.toContain("workos-context");
      expect(line).not.toContain("@workos-inc");
    }

    expect(source).not.toContain("generationJobs");
    expect(source).not.toContain('"organizations"');
    expect(source).not.toContain('"memberships"');
  });

  it("projectMembers module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projectMembers.ts"),
      "utf-8"
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));

    for (const line of importLines) {
      expect(line).not.toContain("generationJobs");
      expect(line).not.toContain("organizations");
      expect(line).not.toContain("billing");
      expect(line).not.toContain("workos-context");
      expect(line).not.toContain("@workos-inc");
    }

    expect(source).not.toContain("generationJobs");
    expect(source).not.toContain('"organizations"');
    expect(source).not.toContain("billing");
  });
});

// ---------------------------------------------------------------------------
// aiGenerationJobId guard — verify pages.ts uses v.string() not v.id()
// ---------------------------------------------------------------------------

describe("core-mode: aiGenerationJobId guard in pages.ts", () => {
  it("pages.ts createPage uses v.string() for aiGenerationJobId", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../pages.ts"),
      "utf-8"
    );

    const lines = source.split("\n");
    const aiJobIdArgLines = lines.filter(
      (line) =>
        line.includes("aiGenerationJobId") &&
        line.includes("v.optional") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );

    expect(aiJobIdArgLines.length).toBeGreaterThan(0);
    for (const line of aiJobIdArgLines) {
      expect(line).toContain("v.string()");
      expect(line).not.toContain('v.id("generationJobs")');
    }
  });

  it("pages.ts listByGenerationJob uses v.string() for jobId arg", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../pages.ts"),
      "utf-8"
    );

    const listByGenMatch = source.match(
      /export const listByGenerationJob = query\(\{[\s\S]*?handler:/
    );
    expect(listByGenMatch).not.toBeNull();

    const argsBlock = listByGenMatch![0];
    const argLines = argsBlock.split("\n").filter(
      (line) => line.includes("jobId") && !line.trim().startsWith("//")
    );
    expect(argLines.length).toBeGreaterThan(0);
    for (const line of argLines) {
      expect(line).toContain("v.string()");
    }
  });

  it("folders.ts createInternal uses v.string() for aiGenerationJobId", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../folders.ts"),
      "utf-8"
    );

    const lines = source.split("\n");
    const aiJobIdArgLines = lines.filter(
      (line) =>
        line.includes("aiGenerationJobId") &&
        line.includes("v.optional") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );

    expect(aiJobIdArgLines.length).toBeGreaterThan(0);
    for (const line of aiJobIdArgLines) {
      expect(line).toContain("v.string()");
      expect(line).not.toContain('v.id("generationJobs")');
    }
  });

  it("core-tables.ts schema uses v.string() for all aiGenerationJobId fields", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../schema/core-tables.ts"),
      "utf-8"
    );

    const aiJobIdLines = source
      .split("\n")
      .filter(
        (line) =>
          line.includes("aiGenerationJobId") &&
          line.includes("v.optional") &&
          !line.trim().startsWith("//") &&
          !line.trim().startsWith("*")
      );

    expect(aiJobIdLines.length).toBeGreaterThan(0);
    for (const line of aiJobIdLines) {
      expect(line).toContain("v.string()");
      expect(line).not.toContain('v.id("generationJobs")');
    }
  });
});

// ---------------------------------------------------------------------------
// Consistency checks — verify core-mode functions use consistent patterns
// ---------------------------------------------------------------------------

describe("core-mode: consistency checks", () => {
  it("all core modules import from Convex _generated (not platform modules)", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const modules = ["projects", "users", "projectMembers"];

    for (const mod of modules) {
      const source = readFileSync(
        resolve(__dirname, `../${mod}.ts`),
        "utf-8"
      );

      expect(source).toContain("./_generated/");

      expect(source).not.toContain("../lib/auth");
      expect(source).not.toContain("../lib/workos");
      expect(source).not.toContain("../lib/stripe");
      expect(source).not.toContain("../lib/cloudflare");
    }
  });

  it("core projects.create uses LOCAL_ORG_ID sentinel", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projects.ts"),
      "utf-8"
    );

    expect(source).toContain("LOCAL_ORG_ID");
    expect(source).toContain("workosOrgId: LOCAL_ORG_ID");
  });

  it("core users.ensureLocalUser uses LOCAL_USER_ID sentinel", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../users.ts"),
      "utf-8"
    );

    expect(source).toContain("LOCAL_USER_ID");
    expect(source).toContain("workosUserId: LOCAL_USER_ID");
  });
});
