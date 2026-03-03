import { describe, it, expect, beforeAll } from "vitest";
import type {
  AdapterUser,
  AuthAdapter,
  ContextAdapter,
  DeployAdapter,
  DeployOptions,
} from "@/lib/adapters/types";

// ---------------------------------------------------------------------------
// Types — verify the interfaces are structurally sound
// ---------------------------------------------------------------------------

describe("AdapterUser type", () => {
  it("should accept a minimal valid user", () => {
    const user: AdapterUser = {
      id: "u1",
      email: "test@example.com",
      firstName: null,
      lastName: null,
      profilePictureUrl: null,
    };
    expect(user.id).toBe("u1");
    expect(user.email).toBe("test@example.com");
    expect(user.firstName).toBeNull();
  });

  it("should accept a fully populated user", () => {
    const user: AdapterUser = {
      id: "u2",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      profilePictureUrl: "https://example.com/avatar.png",
    };
    expect(user.firstName).toBe("Alice");
    expect(user.profilePictureUrl).toBe("https://example.com/avatar.png");
  });
});

// ---------------------------------------------------------------------------
// Core Auth Adapter
// ---------------------------------------------------------------------------

describe("auth.core adapter", () => {
  let authAdapter: AuthAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/auth.core");
    authAdapter = mod.authAdapter;
  });

  it("getUser() returns a static local user", async () => {
    const user = await authAdapter.getUser();
    expect(user).not.toBeNull();
    expect(user!.id).toBe("local_user");
    expect(user!.email).toBe("local@inkloom.dev");
    expect(user!.firstName).toBe("Local");
    expect(user!.lastName).toBe("User");
    expect(user!.profilePictureUrl).toBeNull();
  });

  it("requireUser() returns the same local user (never throws)", async () => {
    const user = await authAdapter.requireUser();
    expect(user.id).toBe("local_user");
    expect(user.email).toBe("local@inkloom.dev");
  });

  it("signOut() is a no-op that resolves", async () => {
    // Should not throw
    await expect(authAdapter.signOut()).resolves.toBeUndefined();
  });

  it("getUser() always returns the same instance shape", async () => {
    const user1 = await authAdapter.getUser();
    const user2 = await authAdapter.getUser();
    expect(user1).toEqual(user2);
  });

  it("satisfies the AuthAdapter interface", () => {
    expect(typeof authAdapter.getUser).toBe("function");
    expect(typeof authAdapter.requireUser).toBe("function");
    expect(typeof authAdapter.signOut).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Platform Auth Adapter (structure only — WorkOS not available in test)
// ---------------------------------------------------------------------------

describe("auth.platform adapter", () => {
  let authAdapter: AuthAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/auth.platform");
    authAdapter = mod.authAdapter;
  });

  it("satisfies the AuthAdapter interface", () => {
    expect(typeof authAdapter.getUser).toBe("function");
    expect(typeof authAdapter.requireUser).toBe("function");
    expect(typeof authAdapter.signOut).toBe("function");
  });

  it("signOut() resolves without error", async () => {
    await expect(authAdapter.signOut()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Core Context Adapter
// ---------------------------------------------------------------------------

describe("context.core adapter", () => {
  let contextAdapter: ContextAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/context.core");
    contextAdapter = mod.contextAdapter;
  });

  it("getTenantId() returns 'local'", () => {
    expect(contextAdapter.getTenantId()).toBe("local");
  });

  it("getOrgName() returns 'Local'", () => {
    expect(contextAdapter.getOrgName()).toBe("Local");
  });

  it("isMultiTenant() returns false", () => {
    expect(contextAdapter.isMultiTenant()).toBe(false);
  });

  it("getTenantId() is idempotent", () => {
    expect(contextAdapter.getTenantId()).toBe(contextAdapter.getTenantId());
  });

  it("satisfies the ContextAdapter interface", () => {
    expect(typeof contextAdapter.getTenantId).toBe("function");
    expect(typeof contextAdapter.getOrgName).toBe("function");
    expect(typeof contextAdapter.isMultiTenant).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Platform Context Adapter
// ---------------------------------------------------------------------------

describe("context.platform adapter", () => {
  let contextAdapter: ContextAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/context.platform");
    contextAdapter = mod.contextAdapter;
  });

  it("isMultiTenant() returns true", () => {
    expect(contextAdapter.isMultiTenant()).toBe(true);
  });

  it("default adapter has empty tenant ID (unresolved org)", () => {
    expect(contextAdapter.getTenantId()).toBe("");
  });

  it("default adapter has empty org name", () => {
    expect(contextAdapter.getOrgName()).toBe("");
  });

  it("satisfies the ContextAdapter interface", () => {
    expect(typeof contextAdapter.getTenantId).toBe("function");
    expect(typeof contextAdapter.getOrgName).toBe("function");
    expect(typeof contextAdapter.isMultiTenant).toBe("function");
  });
});

describe("createPlatformContextAdapter()", () => {
  it("creates an adapter with the provided org values", async () => {
    const { createPlatformContextAdapter } = await import(
      "@/lib/adapters/context.platform"
    );
    const adapter = createPlatformContextAdapter({
      orgId: "org_123",
      orgName: "Acme Corp",
    });
    expect(adapter.getTenantId()).toBe("org_123");
    expect(adapter.getOrgName()).toBe("Acme Corp");
    expect(adapter.isMultiTenant()).toBe(true);
  });

  it("each call produces an independent adapter", async () => {
    const { createPlatformContextAdapter } = await import(
      "@/lib/adapters/context.platform"
    );
    const a = createPlatformContextAdapter({ orgId: "org_a", orgName: "A" });
    const b = createPlatformContextAdapter({ orgId: "org_b", orgName: "B" });
    expect(a.getTenantId()).toBe("org_a");
    expect(b.getTenantId()).toBe("org_b");
  });
});

// ---------------------------------------------------------------------------
// Core Deploy Adapter
// ---------------------------------------------------------------------------

describe("deploy.core adapter", () => {
  let deployAdapter: DeployAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/deploy.core");
    deployAdapter = mod.deployAdapter;
  });

  it("actionLabel is 'Build'", () => {
    expect(deployAdapter.actionLabel).toBe("Build");
  });

  it("publish() returns success with file:// URL", async () => {
    const result = await deployAdapter.publish({ projectId: "proj_1" });
    expect(result.success).toBe(true);
    expect(result.url).toContain("file://");
    expect(result.message).toBeTruthy();
  });

  it("getDeployUrl() returns file:// path with project slug", () => {
    const url = deployAdapter.getDeployUrl("my-docs");
    expect(url).toContain("file://");
    expect(url).toContain("my-docs");
  });

  it("satisfies the DeployAdapter interface", () => {
    expect(typeof deployAdapter.publish).toBe("function");
    expect(typeof deployAdapter.getDeployUrl).toBe("function");
    expect(typeof deployAdapter.actionLabel).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Platform Deploy Adapter
// ---------------------------------------------------------------------------

describe("deploy.platform adapter", () => {
  let deployAdapter: DeployAdapter;

  beforeAll(async () => {
    const mod = await import("@/lib/adapters/deploy.platform");
    deployAdapter = mod.deployAdapter;
  });

  it("actionLabel is 'Deploy'", () => {
    expect(deployAdapter.actionLabel).toBe("Deploy");
  });

  it("getDeployUrl() returns Cloudflare Pages URL pattern", () => {
    const url = deployAdapter.getDeployUrl("my-docs");
    expect(url).toBe("https://inkloom-my-docs.pages.dev");
  });

  it("getDeployUrl() works with different slugs", () => {
    expect(deployAdapter.getDeployUrl("api-reference")).toBe(
      "https://inkloom-api-reference.pages.dev"
    );
  });

  it("publish() returns failure (platform deploys use /api/publish)", async () => {
    const result = await deployAdapter.publish({ projectId: "proj_1" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("/api/publish");
  });

  it("satisfies the DeployAdapter interface", () => {
    expect(typeof deployAdapter.publish).toBe("function");
    expect(typeof deployAdapter.getDeployUrl).toBe("function");
    expect(typeof deployAdapter.actionLabel).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Barrel Export
// ---------------------------------------------------------------------------

describe("barrel export (lib/adapters.ts)", () => {
  it("exports all adapter types", async () => {
    const mod = await import("@/lib/adapters");
    expect(mod.authAdapter).toBeDefined();
    expect(mod.contextAdapter).toBeDefined();
    expect(mod.deployAdapter).toBeDefined();
    expect(mod.createPlatformContextAdapter).toBeDefined();
  });

  it("barrel exports platform adapters by default", async () => {
    const mod = await import("@/lib/adapters");
    // Platform deploy adapter has "Deploy" label, core has "Build"
    expect(mod.deployAdapter.actionLabel).toBe("Deploy");
    // Platform context adapter is multi-tenant
    expect(mod.contextAdapter.isMultiTenant()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property-based: adapter contract verification
// ---------------------------------------------------------------------------

describe("adapter contracts", () => {
  it("core adapters form a consistent set (single-tenant, no auth)", async () => {
    const auth = (await import("@/lib/adapters/auth.core")).authAdapter;
    const ctx = (await import("@/lib/adapters/context.core")).contextAdapter;
    const deploy = (await import("@/lib/adapters/deploy.core")).deployAdapter;

    // Auth always returns a user (single-tenant = always authenticated)
    const user = await auth.getUser();
    expect(user).not.toBeNull();

    // Context is single-tenant
    expect(ctx.isMultiTenant()).toBe(false);
    expect(ctx.getTenantId()).toBe("local");

    // Deploy is local build
    expect(deploy.actionLabel).toBe("Build");
  });

  it("platform adapters form a consistent set (multi-tenant, managed deploy)", async () => {
    const ctx = (await import("@/lib/adapters/context.platform")).contextAdapter;
    const deploy = (await import("@/lib/adapters/deploy.platform")).deployAdapter;

    // Context is multi-tenant
    expect(ctx.isMultiTenant()).toBe(true);

    // Deploy is managed
    expect(deploy.actionLabel).toBe("Deploy");
    expect(deploy.getDeployUrl("test")).toContain("pages.dev");
  });

  it("DeployResult shape is valid from both adapters", async () => {
    const coreDeploy = (await import("@/lib/adapters/deploy.core")).deployAdapter;
    const platformDeploy = (await import("@/lib/adapters/deploy.platform")).deployAdapter;

    const opts: DeployOptions = { projectId: "test" };

    const coreResult = await coreDeploy.publish(opts);
    expect(coreResult).toHaveProperty("success");
    expect(coreResult).toHaveProperty("url");
    expect(coreResult).toHaveProperty("message");
    expect(typeof coreResult.success).toBe("boolean");
    expect(typeof coreResult.url).toBe("string");
    expect(typeof coreResult.message).toBe("string");

    const platformResult = await platformDeploy.publish(opts);
    expect(platformResult).toHaveProperty("success");
    expect(platformResult).toHaveProperty("url");
    expect(platformResult).toHaveProperty("message");
    expect(typeof platformResult.success).toBe("boolean");
    expect(typeof platformResult.url).toBe("string");
    expect(typeof platformResult.message).toBe("string");
  });
});
