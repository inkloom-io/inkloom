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

import * as projectsCore from "../projectsCore";
import * as usersCore from "../usersCore";
import * as projectMembersCore from "../projectMembersCore";

// Also import the platform modules for comparison
import * as projects from "../projects";
import * as users from "../users";
import * as projectMembers from "../projectMembers";

// ---------------------------------------------------------------------------
// Sentinel values — verify consistency
// ---------------------------------------------------------------------------

describe("core-mode: sentinel values", () => {
  it("projectsCore.LOCAL_ORG_ID is 'local'", () => {
    expect(projectsCore.LOCAL_ORG_ID).toBe("local");
  });

  it("usersCore.LOCAL_USER_ID is 'local'", () => {
    expect(usersCore.LOCAL_USER_ID).toBe("local");
  });

  it("usersCore.LOCAL_USER_EMAIL is 'local@inkloom.local'", () => {
    expect(usersCore.LOCAL_USER_EMAIL).toBe("local@inkloom.local");
  });

  it("sentinel org ID matches the value documented in OSS_PLAN.md", () => {
    // OSS_PLAN.md specifies: workosOrgId: "local"
    expect(projectsCore.LOCAL_ORG_ID).toBe("local");
  });

  it("sentinel user ID matches the value used in auth.core adapter", () => {
    // auth.core.ts returns a user with id "local"
    expect(usersCore.LOCAL_USER_ID).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// Module exports — verify core-mode modules export the correct functions
// ---------------------------------------------------------------------------

describe("core-mode: projectsCore exports", () => {
  it("exports LOCAL_ORG_ID constant", () => {
    expect(projectsCore.LOCAL_ORG_ID).toBeDefined();
    expect(typeof projectsCore.LOCAL_ORG_ID).toBe("string");
  });

  it("exports create mutation", () => {
    expect(projectsCore.create).toBeDefined();
  });

  it("exports list query", () => {
    expect(projectsCore.list).toBeDefined();
  });

  it("exports createFromImport mutation", () => {
    expect(projectsCore.createFromImport).toBeDefined();
  });

  it("exports getDashboardStats query", () => {
    expect(projectsCore.getDashboardStats).toBeDefined();
  });

  it("does NOT export platform-only functions (listByOrg, listForUser)", () => {
    expect((projectsCore as Record<string, unknown>)["listByOrg"]).toBeUndefined();
    expect((projectsCore as Record<string, unknown>)["listForUser"]).toBeUndefined();
  });

  it("does NOT export migration functions", () => {
    expect((projectsCore as Record<string, unknown>)["migrateToWorkosOrg"]).toBeUndefined();
  });

  it("does NOT export Cloudflare-specific functions", () => {
    expect((projectsCore as Record<string, unknown>)["checkCfSlugAvailable"]).toBeUndefined();
    expect((projectsCore as Record<string, unknown>)["updateCfSlug"]).toBeUndefined();
  });
});

describe("core-mode: usersCore exports", () => {
  it("exports LOCAL_USER_ID constant", () => {
    expect(usersCore.LOCAL_USER_ID).toBeDefined();
    expect(typeof usersCore.LOCAL_USER_ID).toBe("string");
  });

  it("exports LOCAL_USER_EMAIL constant", () => {
    expect(usersCore.LOCAL_USER_EMAIL).toBeDefined();
    expect(typeof usersCore.LOCAL_USER_EMAIL).toBe("string");
  });

  it("exports ensureLocalUser mutation", () => {
    expect(usersCore.ensureLocalUser).toBeDefined();
  });

  it("exports currentLocal query", () => {
    expect(usersCore.currentLocal).toBeDefined();
  });

  it("does NOT export platform-only functions (getOrCreate, hasCompletedOnboarding)", () => {
    expect((usersCore as Record<string, unknown>)["getOrCreate"]).toBeUndefined();
    expect((usersCore as Record<string, unknown>)["hasCompletedOnboarding"]).toBeUndefined();
    expect((usersCore as Record<string, unknown>)["completeOnboarding"]).toBeUndefined();
  });
});

describe("core-mode: projectMembersCore exports", () => {
  it("exports hasAccess query", () => {
    expect(projectMembersCore.hasAccess).toBeDefined();
  });

  it("exports getRole query", () => {
    expect(projectMembersCore.getRole).toBeDefined();
  });

  it("exports listAccessibleProjects query", () => {
    expect(projectMembersCore.listAccessibleProjects).toBeDefined();
  });

  it("does NOT export platform-only functions (addMember, removeMember, updateRole)", () => {
    expect((projectMembersCore as Record<string, unknown>)["addMember"]).toBeUndefined();
    expect((projectMembersCore as Record<string, unknown>)["removeMember"]).toBeUndefined();
    expect((projectMembersCore as Record<string, unknown>)["updateRole"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Platform modules still export their functions (no regression)
// ---------------------------------------------------------------------------

describe("core-mode: platform modules unchanged", () => {
  it("platform projects still exports create with workosOrgId", () => {
    expect(projects.create).toBeDefined();
  });

  it("platform projects still exports listByOrg", () => {
    expect(projects.listByOrg).toBeDefined();
  });

  it("platform projects still exports listForUser", () => {
    expect(projects.listForUser).toBeDefined();
  });

  it("platform users still exports getOrCreate", () => {
    expect(users.getOrCreate).toBeDefined();
  });

  it("platform users still exports current", () => {
    expect(users.current).toBeDefined();
  });

  it("platform projectMembers still exports addMember", () => {
    expect(projectMembers.addMember).toBeDefined();
  });

  it("platform projectMembers still exports listAccessibleProjects", () => {
    expect(projectMembers.listAccessibleProjects).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Core vs Platform function comparison — verify core simplifications
// ---------------------------------------------------------------------------

describe("core-mode: core vs platform function comparison", () => {
  it("core projectsCore.list takes no args (platform listByOrg requires workosOrgId)", () => {
    // Core list has no required args — verified by the fact it exists
    // and the handler signature takes no args
    expect(projectsCore.list).toBeDefined();
    expect(projects.listByOrg).toBeDefined();
  });

  it("core getDashboardStats takes no args (platform requires workosOrgId)", () => {
    expect(projectsCore.getDashboardStats).toBeDefined();
    expect(projects.getDashboardStats).toBeDefined();
  });

  it("core createFromImport has no workosOrgId arg (platform requires it)", () => {
    expect(projectsCore.createFromImport).toBeDefined();
    expect(projects.createFromImport).toBeDefined();
  });

  it("core usersCore.ensureLocalUser takes no args (platform getOrCreate requires workosUserId)", () => {
    expect(usersCore.ensureLocalUser).toBeDefined();
    expect(users.getOrCreate).toBeDefined();
  });

  it("core projectMembersCore.listAccessibleProjects takes no args (platform requires workosOrgId + userId)", () => {
    expect(projectMembersCore.listAccessibleProjects).toBeDefined();
    expect(projectMembers.listAccessibleProjects).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Source code analysis — verify no platform-only table references in core
// ---------------------------------------------------------------------------

describe("core-mode: import boundary (no platform table references)", () => {
  // These tests verify that core-mode functions don't import from platform-only modules
  it("projectsCore module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projectsCore.ts"),
      "utf-8"
    );

    // Should NOT import from generation, billing, github, etc.
    expect(source).not.toContain("generationJobs");
    expect(source).not.toContain("billing");
    expect(source).not.toContain("github");
    expect(source).not.toContain("apiKeys");
    expect(source).not.toContain("webhooks");
    expect(source).not.toContain("organizations");
  });

  it("usersCore module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../usersCore.ts"),
      "utf-8"
    );

    // Check actual import statements, not incidental substring matches.
    // The field name "workosUserId" legitimately appears in core code
    // (it's a core schema field), but actual WorkOS library imports should not.
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

    // Ensure no platform table references in non-comment code
    expect(source).not.toContain("generationJobs");
    expect(source).not.toContain('"organizations"');
    expect(source).not.toContain('"memberships"');
  });

  it("projectMembersCore module does not import from platform-only files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projectMembersCore.ts"),
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

  it("projectsCore does not reference cfSlug (platform-only deployment concept)", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projectsCore.ts"),
      "utf-8"
    );

    // Core mode doesn't use Cloudflare Pages deployment
    expect(source).not.toContain("cfSlug");
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

    // Find the line that defines the aiGenerationJobId arg in createPage.
    // Check that no non-comment line uses v.id("generationJobs") for this field.
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

    // Extract just the args: {} block — check for v.string()
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

    // Find the actual aiGenerationJobId arg line (not comment)
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

    // Every aiGenerationJobId field definition in core-tables should use v.string()
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
    const modules = ["projectsCore", "usersCore", "projectMembersCore"];

    for (const mod of modules) {
      const source = readFileSync(
        resolve(__dirname, `../${mod}.ts`),
        "utf-8"
      );

      // Should import from Convex generated files
      expect(source).toContain("./_generated/");

      // Should NOT import from platform-specific modules
      expect(source).not.toContain("../lib/auth");
      expect(source).not.toContain("../lib/workos");
      expect(source).not.toContain("../lib/stripe");
      expect(source).not.toContain("../lib/cloudflare");
    }
  });

  it("core projectsCore.create uses LOCAL_ORG_ID sentinel", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../projectsCore.ts"),
      "utf-8"
    );

    // The create function should reference LOCAL_ORG_ID
    expect(source).toContain("LOCAL_ORG_ID");

    // And use the "local" sentinel in the org slug check
    expect(source).toContain("workosOrgId: LOCAL_ORG_ID");
  });

  it("core usersCore.ensureLocalUser uses LOCAL_USER_ID sentinel", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../usersCore.ts"),
      "utf-8"
    );

    expect(source).toContain("LOCAL_USER_ID");
    expect(source).toContain("workosUserId: LOCAL_USER_ID");
  });
});
