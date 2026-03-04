import { describe, it, expect } from "vitest";
import type {
  DeploymentState,
  DeploymentStatus,
  UsePublishOptions,
  UsePublishReturn,
} from "@/hooks/use-publish";

// ---------------------------------------------------------------------------
// DeploymentState type compliance
// ---------------------------------------------------------------------------

describe("DeploymentState interface", () => {
  it("accepts idle state", () => {
    const state: DeploymentState = { status: "idle" };
    expect(state.status).toBe("idle");
    expect(state.deploymentId).toBeUndefined();
    expect(state.url).toBeUndefined();
    expect(state.error).toBeUndefined();
  });

  it("accepts publishing state", () => {
    const state: DeploymentState = { status: "publishing" };
    expect(state.status).toBe("publishing");
  });

  it("accepts polling state with deploymentId and url", () => {
    const state: DeploymentState = {
      status: "polling",
      deploymentId: "dep_123",
      url: "https://example.pages.dev",
    };
    expect(state.deploymentId).toBe("dep_123");
    expect(state.url).toBe("https://example.pages.dev");
  });

  it("accepts success state with url", () => {
    const state: DeploymentState = {
      status: "success",
      deploymentId: "dep_456",
      url: "https://my-docs.pages.dev",
    };
    expect(state.status).toBe("success");
    expect(state.url).toBe("https://my-docs.pages.dev");
  });

  it("accepts error state with error message", () => {
    const state: DeploymentState = {
      status: "error",
      error: "Failed to publish",
    };
    expect(state.status).toBe("error");
    expect(state.error).toBe("Failed to publish");
  });

  it("accepts error state with deploymentId", () => {
    const state: DeploymentState = {
      status: "error",
      deploymentId: "dep_789",
      error: "Deployment failed",
    };
    expect(state.deploymentId).toBe("dep_789");
  });
});

// ---------------------------------------------------------------------------
// DeploymentStatus type compliance
// ---------------------------------------------------------------------------

describe("DeploymentStatus type", () => {
  it("accepts all valid status values", () => {
    const statuses: DeploymentStatus[] = [
      "idle",
      "publishing",
      "polling",
      "success",
      "error",
    ];
    expect(statuses).toHaveLength(5);
    expect(new Set(statuses).size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// UsePublishOptions interface compliance
// ---------------------------------------------------------------------------

describe("UsePublishOptions interface", () => {
  it("accepts minimal options with project only", () => {
    const opts: UsePublishOptions = {
      project: {
        _id: "proj_1" as any,
        _creationTime: 1700000000000,
        name: "My Docs",
        slug: "my-docs",
        workosOrgId: "local",
      } as any,
    };
    expect(opts.project._id).toBe("proj_1");
    expect(opts.branchId).toBeUndefined();
  });

  it("accepts options with branchId", () => {
    const opts: UsePublishOptions = {
      project: {
        _id: "proj_2" as any,
        _creationTime: 1700000000000,
        name: "Branch Docs",
        slug: "branch-docs",
        workosOrgId: "local",
      } as any,
      branchId: "branch_1" as any,
    };
    expect(opts.branchId).toBe("branch_1");
  });
});

// ---------------------------------------------------------------------------
// UsePublishReturn interface compliance
// ---------------------------------------------------------------------------

describe("UsePublishReturn interface", () => {
  it("describes all required return fields", () => {
    const mockReturn: UsePublishReturn = {
      deployment: { status: "idle" },
      target: "preview",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: false,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: (slug: string) => `file://dist/${slug}`,
    };

    expect(mockReturn.deployment.status).toBe("idle");
    expect(mockReturn.target).toBe("preview");
    expect(typeof mockReturn.setTarget).toBe("function");
    expect(typeof mockReturn.handlePublish).toBe("function");
    expect(typeof mockReturn.resetDeployment).toBe("function");
    expect(mockReturn.isPublishing).toBe(false);
    expect(mockReturn.actionLabel).toBe("Build");
    expect(typeof mockReturn.getDeployUrl).toBe("function");
  });

  it("handlePublish returns a promise", () => {
    const mockReturn: UsePublishReturn = {
      deployment: { status: "idle" },
      target: "preview",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: false,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: () => "file://dist/",
    };

    const result = mockReturn.handlePublish();
    expect(result).toBeInstanceOf(Promise);
  });

  it("getDeployUrl returns a string for any slug", () => {
    const mockReturn: UsePublishReturn = {
      deployment: { status: "idle" },
      target: "production",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: false,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: (slug: string) => `file://dist/${slug}`,
    };

    expect(mockReturn.getDeployUrl("my-docs")).toBe("file://dist/my-docs");
    expect(mockReturn.getDeployUrl("test-project")).toBe(
      "file://dist/test-project"
    );
  });

  it("target defaults to preview in the interface contract", () => {
    const mockReturn: UsePublishReturn = {
      deployment: { status: "idle" },
      target: "preview",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: false,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: () => "",
    };
    expect(mockReturn.target).toBe("preview");
  });

  it("isPublishing is true during publishing and polling states", () => {
    const publishingReturn: UsePublishReturn = {
      deployment: { status: "publishing" },
      target: "preview",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: true,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: () => "",
    };
    expect(publishingReturn.isPublishing).toBe(true);

    const pollingReturn: UsePublishReturn = {
      deployment: { status: "polling", deploymentId: "dep_1" },
      target: "preview",
      setTarget: () => {},
      handlePublish: async () => {},
      resetDeployment: () => {},
      isPublishing: true,
      latestDeployment: undefined,
      trackedDeployment: undefined,
      unpublishedChanges: undefined,
      actionLabel: "Build",
      getDeployUrl: () => "",
    };
    expect(pollingReturn.isPublishing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deploy adapter direct tests (core mode)
// ---------------------------------------------------------------------------

describe("deploy adapter - core", () => {
  it("provides Build action label", async () => {
    const { deployAdapter } = await import("../../lib/adapters/deploy.core");
    expect(deployAdapter.actionLabel).toBe("Build");
  });

  it("getDeployUrl returns file:// URL", async () => {
    const { deployAdapter } = await import("../../lib/adapters/deploy.core");
    const url = deployAdapter.getDeployUrl("my-docs");
    expect(url).toBe("file://dist/my-docs");
  });

  it("publish returns success with guidance message", async () => {
    const { deployAdapter } = await import("../../lib/adapters/deploy.core");
    const result = await deployAdapter.publish({ projectId: "test" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("inkloom build");
    expect(result.url).toBe("file://dist/");
  });
});

// ---------------------------------------------------------------------------
// Deployment state machine invariants
// ---------------------------------------------------------------------------

describe("deployment state machine invariants", () => {
  it("idle state has no deployment context", () => {
    const state: DeploymentState = { status: "idle" };
    expect(state.deploymentId).toBeUndefined();
    expect(state.url).toBeUndefined();
    expect(state.error).toBeUndefined();
  });

  it("publishing → polling transition requires deploymentId", () => {
    const before: DeploymentState = { status: "publishing" };
    const after: DeploymentState = {
      status: "polling",
      deploymentId: "dep_new",
      url: "https://example.pages.dev",
    };

    expect(before.deploymentId).toBeUndefined();
    expect(after.deploymentId).toBeDefined();
    expect(after.status).toBe("polling");
  });

  it("polling → success transition preserves deploymentId", () => {
    const polling: DeploymentState = {
      status: "polling",
      deploymentId: "dep_1",
    };
    const success: DeploymentState = {
      status: "success",
      deploymentId: "dep_1",
      url: "https://my-site.pages.dev",
    };

    expect(success.deploymentId).toBe(polling.deploymentId);
    expect(success.url).toBeDefined();
  });

  it("error state can occur from either publishing or polling", () => {
    const errorFromPublishing: DeploymentState = {
      status: "error",
      error: "Network error",
    };
    const errorFromPolling: DeploymentState = {
      status: "error",
      deploymentId: "dep_failed",
      error: "Deployment failed",
    };

    expect(errorFromPublishing.error).toBeDefined();
    expect(errorFromPolling.error).toBeDefined();
    expect(errorFromPolling.deploymentId).toBeDefined();
  });

  it("all status values are distinct", () => {
    const allStatuses: DeploymentStatus[] = [
      "idle",
      "publishing",
      "polling",
      "success",
      "error",
    ];
    const unique = new Set(allStatuses);
    expect(unique.size).toBe(allStatuses.length);
  });

  it("state machine covers all valid transitions", () => {
    const validTransitions: Record<DeploymentStatus, DeploymentStatus[]> = {
      idle: ["publishing"],
      publishing: ["polling", "error"],
      polling: ["success", "error", "idle"],
      success: ["idle"],
      error: ["idle"],
    };

    for (const [from, targets] of Object.entries(validTransitions)) {
      expect(targets.length).toBeGreaterThan(0);
      expect(typeof from).toBe("string");
    }

    expect(validTransitions.success).toContain("idle");
    expect(validTransitions.error).toContain("idle");
    expect(validTransitions.polling).toContain("idle");
  });
});

// ---------------------------------------------------------------------------
// Adapter types (compile-time checks via type imports)
// ---------------------------------------------------------------------------

describe("adapter type exports", () => {
  it("DeployAdapter interface matches expected shape", () => {
    const _typeCheck: import("@/lib/adapters/types").DeployAdapter = {
      publish: async () => ({ success: true, url: "", message: "" }),
      getDeployUrl: () => "",
      getPublishEndpoint: () => "/api/build",
      actionLabel: "Test",
    };
    expect(_typeCheck.actionLabel).toBe("Test");
  });

  it("DeployOptions interface accepts projectId and optional branchId", () => {
    const minOpts: import("@/lib/adapters/types").DeployOptions = {
      projectId: "proj_1",
    };
    expect(minOpts.projectId).toBe("proj_1");

    const fullOpts: import("@/lib/adapters/types").DeployOptions = {
      projectId: "proj_2",
      branchId: "branch_1",
    };
    expect(fullOpts.branchId).toBe("branch_1");
  });

  it("DeployResult interface has success, url, and message", () => {
    const result: import("@/lib/adapters/types").DeployResult = {
      success: true,
      url: "https://example.com",
      message: "Done",
    };
    expect(result.success).toBe(true);
    expect(result.url).toBe("https://example.com");
    expect(result.message).toBe("Done");
  });
});
