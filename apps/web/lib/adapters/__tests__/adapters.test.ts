import { describe, it, expect } from "vitest";
import { authAdapter } from "../auth.core";
import { contextAdapter } from "../context.core";
import { deployAdapter } from "../deploy.core";
import type {
  AuthAdapter,
  ContextAdapter,
  DeployAdapter,
  DeployOptions,
  DeployResult,
} from "../types";

// ---------------------------------------------------------------------------
// Auth Adapter
// ---------------------------------------------------------------------------

describe("authAdapter (core mode)", () => {
  it("satisfies the AuthAdapter interface", () => {
    const adapter: AuthAdapter = authAdapter;
    expect(adapter).toBeDefined();
    expect(typeof adapter.getUser).toBe("function");
    expect(typeof adapter.requireUser).toBe("function");
    expect(typeof adapter.signOut).toBe("function");
  });

  describe("getUser()", () => {
    it("returns a valid AdapterUser", async () => {
      const user = await authAdapter.getUser();
      expect(user).not.toBeNull();
      expect(user!.id).toBe("local_user");
      expect(user!.email).toBe("local@inkloom.dev");
      expect(user!.firstName).toBe("Local");
      expect(user!.lastName).toBe("User");
      expect(user!.profilePictureUrl).toBeNull();
    });

    it("is idempotent — returns the same user on repeated calls", async () => {
      const user1 = await authAdapter.getUser();
      const user2 = await authAdapter.getUser();
      expect(user1).toBe(user2); // Same reference, not just equal
    });

    it("never returns null in core mode", async () => {
      const user = await authAdapter.getUser();
      expect(user).not.toBeNull();
    });
  });

  describe("requireUser()", () => {
    it("returns the same local user", async () => {
      const user = await authAdapter.requireUser();
      expect(user.id).toBe("local_user");
      expect(user.email).toBe("local@inkloom.dev");
    });

    it("never throws in core mode", async () => {
      await expect(authAdapter.requireUser()).resolves.toBeDefined();
    });

    it("returns the same reference as getUser()", async () => {
      const fromGet = await authAdapter.getUser();
      const fromRequire = await authAdapter.requireUser();
      expect(fromGet).toBe(fromRequire);
    });
  });

  describe("signOut()", () => {
    it("is a no-op that resolves without error", async () => {
      await expect(authAdapter.signOut()).resolves.toBeUndefined();
    });

    it("does not affect subsequent getUser() calls", async () => {
      await authAdapter.signOut();
      const user = await authAdapter.getUser();
      expect(user).not.toBeNull();
      expect(user!.id).toBe("local_user");
    });
  });

  describe("AdapterUser shape", () => {
    it("has all required fields with correct types", async () => {
      const user = await authAdapter.getUser();
      expect(typeof user!.id).toBe("string");
      expect(typeof user!.email).toBe("string");
      expect(user!.firstName === null || typeof user!.firstName === "string").toBe(true);
      expect(user!.lastName === null || typeof user!.lastName === "string").toBe(true);
      expect(
        user!.profilePictureUrl === null ||
          typeof user!.profilePictureUrl === "string"
      ).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Context Adapter
// ---------------------------------------------------------------------------

describe("contextAdapter (core mode)", () => {
  it("satisfies the ContextAdapter interface", () => {
    const adapter: ContextAdapter = contextAdapter;
    expect(adapter).toBeDefined();
    expect(typeof adapter.getTenantId).toBe("function");
    expect(typeof adapter.getOrgName).toBe("function");
    expect(typeof adapter.isMultiTenant).toBe("function");
  });

  describe("getTenantId()", () => {
    it("returns the 'local' sentinel value", () => {
      expect(contextAdapter.getTenantId()).toBe("local");
    });

    it("matches the Convex projects LOCAL_ORG_ID sentinel", () => {
      // This is critical for data portability — core data uses
      // workosOrgId: "local" which must match the context adapter
      expect(contextAdapter.getTenantId()).toBe("local");
    });

    it("is deterministic", () => {
      const first = contextAdapter.getTenantId();
      const second = contextAdapter.getTenantId();
      expect(first).toBe(second);
    });
  });

  describe("getOrgName()", () => {
    it("returns 'Local'", () => {
      expect(contextAdapter.getOrgName()).toBe("Local");
    });

    it("returns a non-empty string", () => {
      expect(contextAdapter.getOrgName().length).toBeGreaterThan(0);
    });
  });

  describe("isMultiTenant()", () => {
    it("returns false in core mode", () => {
      expect(contextAdapter.isMultiTenant()).toBe(false);
    });

    it("always returns exactly false (not falsy)", () => {
      expect(contextAdapter.isMultiTenant()).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Deploy Adapter
// ---------------------------------------------------------------------------

describe("deployAdapter (core mode)", () => {
  it("satisfies the DeployAdapter interface", () => {
    const adapter: DeployAdapter = deployAdapter;
    expect(adapter).toBeDefined();
    expect(typeof adapter.publish).toBe("function");
    expect(typeof adapter.getDeployUrl).toBe("function");
    expect(typeof adapter.getPublishEndpoint).toBe("function");
    expect(typeof adapter.actionLabel).toBe("string");
  });

  describe("publish()", () => {
    it("returns a successful DeployResult", async () => {
      const opts: DeployOptions = { projectId: "test-project-123" };
      const result = await deployAdapter.publish(opts);

      expect(result.success).toBe(true);
      expect(typeof result.url).toBe("string");
      expect(typeof result.message).toBe("string");
    });

    it("result URL points to local file system", async () => {
      const result = await deployAdapter.publish({ projectId: "test" });
      expect(result.url).toContain("file://");
    });

    it("result message mentions inkloom build", async () => {
      const result = await deployAdapter.publish({ projectId: "test" });
      expect(result.message).toContain("inkloom build");
    });

    it("satisfies DeployResult type contract", async () => {
      const result: DeployResult = await deployAdapter.publish({
        projectId: "test",
      });
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("message");
    });

    it("ignores branchId in options (no branch-specific builds in core)", async () => {
      const result = await deployAdapter.publish({
        projectId: "test",
        branchId: "some-branch-id",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getDeployUrl()", () => {
    it("returns a file:// URL with the project slug", () => {
      expect(deployAdapter.getDeployUrl("my-docs")).toBe("file://dist/my-docs");
    });

    it("includes the project slug in the path", () => {
      const slug = "api-reference";
      const url = deployAdapter.getDeployUrl(slug);
      expect(url).toContain(slug);
    });

    it("uses file:// protocol (local, not cloud)", () => {
      const url = deployAdapter.getDeployUrl("test");
      expect(url.startsWith("file://")).toBe(true);
    });
  });

  describe("getPublishEndpoint()", () => {
    it("returns the /api/build endpoint", () => {
      expect(deployAdapter.getPublishEndpoint("any-project")).toBe("/api/build");
    });

    it("returns the same endpoint regardless of projectId", () => {
      const ep1 = deployAdapter.getPublishEndpoint("project-1");
      const ep2 = deployAdapter.getPublishEndpoint("project-2");
      expect(ep1).toBe(ep2);
    });
  });

  describe("actionLabel", () => {
    it("is 'Build' (not 'Deploy')", () => {
      expect(deployAdapter.actionLabel).toBe("Build");
    });
  });
});

// ---------------------------------------------------------------------------
// Barrel Export
// ---------------------------------------------------------------------------

describe("adapters barrel export", () => {
  it("exports all three adapters from the barrel", async () => {
    const barrel = await import("../../adapters");
    expect(barrel.authAdapter).toBeDefined();
    expect(barrel.contextAdapter).toBeDefined();
    expect(barrel.deployAdapter).toBeDefined();
  });

  it("exports type-compatible adapters", async () => {
    const barrel = await import("../../adapters");
    const auth: AuthAdapter = barrel.authAdapter;
    const ctx: ContextAdapter = barrel.contextAdapter;
    const deploy: DeployAdapter = barrel.deployAdapter;
    expect(auth).toBe(authAdapter);
    expect(ctx).toBe(contextAdapter);
    expect(deploy).toBe(deployAdapter);
  });
});

// ---------------------------------------------------------------------------
// Cross-adapter consistency
// ---------------------------------------------------------------------------

describe("cross-adapter consistency", () => {
  it("auth user email domain matches core mode expectations", async () => {
    const user = await authAdapter.getUser();
    expect(user!.email).toMatch(/@inkloom\./);
  });

  it("context tenant ID matches Convex sentinel pattern", () => {
    // Critical: this must stay in sync with core/apps/web/convex/projects.ts LOCAL_ORG_ID
    expect(contextAdapter.getTenantId()).toBe("local");
  });

  it("deploy adapter uses Build terminology (not Deploy)", () => {
    expect(deployAdapter.actionLabel).toBe("Build");
    expect(deployAdapter.getPublishEndpoint("x")).toContain("build");
  });

  it("all adapters are sync-accessible (no lazy initialization)", () => {
    // Verify adapters can be accessed without awaiting initialization
    expect(contextAdapter.getTenantId()).toBe("local");
    expect(contextAdapter.getOrgName()).toBe("Local");
    expect(contextAdapter.isMultiTenant()).toBe(false);
    expect(deployAdapter.actionLabel).toBe("Build");
  });
});
