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
// Deploy Switchpoint
// ---------------------------------------------------------------------------

describe("deploy switchpoint (lib/adapters/deploy.ts)", () => {
  it("exports deployAdapter", async () => {
    const mod = await import("@/lib/adapters/deploy");
    expect(mod.deployAdapter).toBeDefined();
  });

  it("exports core adapter (Build label) in core mode", async () => {
    const mod = await import("@/lib/adapters/deploy");
    expect(mod.deployAdapter.actionLabel).toBe("Build");
  });
});

// ---------------------------------------------------------------------------
// Barrel Export (core mode)
// ---------------------------------------------------------------------------

describe("barrel export (lib/adapters.ts)", () => {
  it("exports all core adapter names", async () => {
    const mod = await import("@/lib/adapters");
    expect(mod.authAdapter).toBeDefined();
    expect(mod.contextAdapter).toBeDefined();
    expect(mod.deployAdapter).toBeDefined();
  });

  it("barrel exports core adapters (Build label, single-tenant)", async () => {
    const mod = await import("@/lib/adapters");
    // Core deploy adapter has "Build" label
    expect(mod.deployAdapter.actionLabel).toBe("Build");
    // Core context adapter is single-tenant
    expect(mod.contextAdapter.isMultiTenant()).toBe(false);
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

    const user = await auth.getUser();
    expect(user).not.toBeNull();

    expect(ctx.isMultiTenant()).toBe(false);
    expect(ctx.getTenantId()).toBe("local");

    expect(deploy.actionLabel).toBe("Build");
  });

  it("DeployResult shape is valid from core adapter", async () => {
    const coreDeploy = (await import("@/lib/adapters/deploy.core")).deployAdapter;

    const opts: DeployOptions = { projectId: "test" };

    const coreResult = await coreDeploy.publish(opts);
    expect(coreResult).toHaveProperty("success");
    expect(coreResult).toHaveProperty("url");
    expect(coreResult).toHaveProperty("message");
    expect(typeof coreResult.success).toBe("boolean");
    expect(typeof coreResult.url).toBe("string");
    expect(typeof coreResult.message).toBe("string");
  });
});
