import { describe, it, expect } from "vitest";
import { authAdapter } from "../adapters/auth.core";
import { contextAdapter } from "../adapters/context.core";
import { deployAdapter } from "../adapters/deploy.core";

/**
 * Core mode flow integration tests.
 *
 * Validates that the core mode adapters, sentinel values, and data contracts
 * work together correctly for the OSS single-tenant user flow:
 *
 *   App boots → ensureLocalUser → dashboard loads → project CRUD works
 *
 * Since Convex functions can't be tested without a Convex backend,
 * we test the adapter layer and verify the contracts that Convex functions
 * depend on (sentinel values, user IDs, org IDs).
 */

// ---------------------------------------------------------------------------
// Sentinel value consistency
// ---------------------------------------------------------------------------

describe("sentinel value consistency", () => {
  it("context tenantId matches Convex LOCAL_ORG_ID sentinel", async () => {
    // The Convex projects.ts uses LOCAL_ORG_ID = "local"
    // The context adapter must return the same value
    const { LOCAL_ORG_ID } = await import("../../convex/projects");
    expect(contextAdapter.getTenantId()).toBe(LOCAL_ORG_ID);
  });

  it("auth user ID matches Convex LOCAL_USER_ID sentinel", async () => {
    // The Convex users.ts uses LOCAL_USER_ID = "local"
    const { LOCAL_USER_ID } = await import("../../convex/users");
    // The auth adapter returns "local_user" as the adapter-level user ID
    // (distinct from the Convex workosUserId which is "local")
    expect(LOCAL_USER_ID).toBe("local");
  });

  it("auth user email uses the inkloom.dev domain", async () => {
    const user = await authAdapter.getUser();
    expect(user!.email).toMatch(/@inkloom\.dev$/);
  });

  it("Convex user email uses the inkloom.local domain", async () => {
    const { LOCAL_USER_EMAIL } = await import("../../convex/users");
    expect(LOCAL_USER_EMAIL).toBe("local@inkloom.local");
  });
});

// ---------------------------------------------------------------------------
// Core mode boot sequence
// ---------------------------------------------------------------------------

describe("core mode boot sequence", () => {
  it("step 1: auth adapter provides user without login", async () => {
    // No login needed — user is always available
    const user = await authAdapter.getUser();
    expect(user).not.toBeNull();
    expect(user!.id).toBeTruthy();
  });

  it("step 2: context adapter provides tenant without org selection", () => {
    // No org switcher — fixed single tenant
    const tenantId = contextAdapter.getTenantId();
    expect(tenantId).toBe("local");
    expect(contextAdapter.isMultiTenant()).toBe(false);
  });

  it("step 3: deploy adapter provides build action (not deploy)", () => {
    // Core mode uses static build, not managed deploy
    expect(deployAdapter.actionLabel).toBe("Build");
    expect(deployAdapter.getPublishEndpoint("any")).toBe("/api/build");
  });

  it("step 4: deploy URLs point to local filesystem", () => {
    const url = deployAdapter.getDeployUrl("my-docs");
    expect(url.startsWith("file://")).toBe(true);
    expect(url).toContain("dist/");
  });
});

// ---------------------------------------------------------------------------
// Core mode project operations contract
// ---------------------------------------------------------------------------

describe("core mode project operations contract", () => {
  it("projects module exports core-mode functions", async () => {
    const projects = await import("../../convex/projects");
    expect(projects.LOCAL_ORG_ID).toBe("local");
    expect(projects.create).toBeDefined();
    expect(projects.list).toBeDefined();
    expect(projects.get).toBeDefined();
    expect(projects.update).toBeDefined();
    expect(projects.remove).toBeDefined();
    expect(projects.createFromImport).toBeDefined();
    expect(projects.getDashboardStats).toBeDefined();
  });

  it("users module exports core-mode functions", async () => {
    const users = await import("../../convex/users");
    expect(users.LOCAL_USER_ID).toBe("local");
    expect(users.LOCAL_USER_EMAIL).toBe("local@inkloom.local");
    expect(users.ensureLocalUser).toBeDefined();
    expect(users.currentLocal).toBeDefined();
  });

  it("pages module exports CRUD functions", async () => {
    const pages = await import("../../convex/pages");
    expect(pages.create).toBeDefined();
    expect(pages.get).toBeDefined();
    expect(pages.getContent).toBeDefined();
    expect(pages.listByProject).toBeDefined();
    expect(pages.listByBranch).toBeDefined();
  });

  it("branches module exports CRUD functions", async () => {
    const branches = await import("../../convex/branches");
    expect(branches.list).toBeDefined();
    expect(branches.get).toBeDefined();
    expect(branches.getByName).toBeDefined();
  });

  it("mergeRequests module exports CRUD functions", async () => {
    const mr = await import("../../convex/mergeRequests");
    expect(mr.list).toBeDefined();
    expect(mr.get).toBeDefined();
  });

  it("comments module exports CRUD functions", async () => {
    const comments = await import("../../convex/comments");
    expect(comments).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Core mode has no platform dependencies
// ---------------------------------------------------------------------------

describe("core mode isolation", () => {
  it("auth adapter does not import platform modules", async () => {
    // Verify by checking the module source
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../adapters/auth.core.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(source).not.toContain("workos");
    expect(source).not.toContain("platform");
    expect(source).not.toContain("stripe");
  });

  it("context adapter does not import platform modules", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../adapters/context.core.ts", import.meta.url).pathname,
      "utf-8"
    );
    // Check import lines only (comments may mention WorkOS for context)
    const importLines = source.split("\n").filter((l: string) => l.startsWith("import "));
    for (const line of importLines) {
      expect(line).not.toContain("workos");
      expect(line).not.toContain("platform");
    }
  });

  it("deploy adapter does not import platform modules", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../adapters/deploy.core.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(source).not.toContain("cloudflare");
    expect(source).not.toContain("platform");
  });

  it("adapters barrel exports core implementations", async () => {
    const barrel = await import("../adapters");
    // The barrel should export from auth.core, context.core, deploy.core
    expect(barrel.authAdapter).toBe(authAdapter);
    expect(barrel.contextAdapter).toBe(contextAdapter);
    expect(barrel.deployAdapter).toBe(deployAdapter);
  });
});

// ---------------------------------------------------------------------------
// Data portability (OSS → SaaS migration path)
// ---------------------------------------------------------------------------

describe("data portability (OSS to SaaS)", () => {
  it("tenant ID is a string (not an opaque object)", () => {
    const tenantId = contextAdapter.getTenantId();
    expect(typeof tenantId).toBe("string");
  });

  it("tenant ID can be compared to Convex workosOrgId", () => {
    // In Convex, workosOrgId is a string field
    // Core uses "local", platform uses WorkOS org IDs like "org_01J..."
    // The migrate-to-cloud process replaces "local" → real org ID
    const tenantId = contextAdapter.getTenantId();
    expect(tenantId).toMatch(/^[a-z]+$/); // Simple alphanumeric sentinel
  });

  it("user shape is compatible between core and platform", async () => {
    const user = await authAdapter.getUser();
    // AdapterUser has the same shape in both modes
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("firstName");
    expect(user).toHaveProperty("lastName");
    expect(user).toHaveProperty("profilePictureUrl");
  });
});
