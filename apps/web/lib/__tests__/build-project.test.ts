import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { DataClient } from "@/data/client";
import { buildProject } from "@/lib/build-project";

vi.mock("@/lib/generate-site", () => ({
  generateSiteFiles: vi.fn(async () => ({
    files: [{ file: "index.html", data: "<h1>Docs</h1>" }],
    warnings: [],
  })),
}));

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function mockDataClient(project: Record<string, unknown> | null): DataClient {
  return {
    projects: {
      get: vi.fn(async () => project),
    },
    deployments: {
      create: vi.fn(async () => ({ id: "deployment-1" })),
      updateBuildPhase: vi.fn(async () => ({ updated: true })),
      updateStatus: vi.fn(async () => ({ updated: true })),
    },
    pages: {
      listByBranch: vi.fn(async () => [
        {
          id: "page-1",
          branchId: "branch-1",
          title: "Welcome",
          slug: "welcome",
          path: "/welcome",
          position: 0,
          isPublished: true,
          folderId: null,
          icon: null,
          subtitle: null,
        },
      ]),
      getContent: vi.fn(async () => ({
        id: "content-1",
        pageId: "page-1",
        content: "[]",
      })),
    },
    folders: {
      listByBranch: vi.fn(async () => []),
    },
  } as unknown as DataClient;
}

describe("buildProject", () => {
  it("fails clearly when the project does not exist", async () => {
    await expect(
      buildProject(mockDataClient(null), { projectId: "missing" }),
    ).rejects.toThrow("Project not found: missing");
  });

  it("builds published D1 pages and marks the deployment ready", async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "inkloom-build-"));
    temporaryDirectories.push(output);
    const data = mockDataClient({
      id: "project-1",
      name: "Docs",
      slug: "docs",
      defaultBranchId: "branch-1",
      settings: {},
    });

    const result = await buildProject(data, {
      projectId: "project-1",
      outDir: output,
    });

    expect(result.deploymentId).toBe("deployment-1");
    expect(result.pageCount).toBe(1);
    expect(fs.readFileSync(path.join(output, "index.html"), "utf8")).toContain(
      "Docs",
    );
    expect(data.deployments.updateStatus).toHaveBeenCalledWith(
      "deployment-1",
      expect.objectContaining({ status: "ready" }),
    );
  });
});
