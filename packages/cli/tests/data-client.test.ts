import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CoreDataClient,
  createCoreDataClient,
} from "../src/lib/data-client.ts";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.INKLOOM_DATA_API_URL;
const originalToken = process.env.INKLOOM_DATA_API_TOKEN;
const originalFallbackUrl = process.env.DATA_API_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.INKLOOM_DATA_API_URL;
  else process.env.INKLOOM_DATA_API_URL = originalUrl;
  if (originalToken === undefined) delete process.env.INKLOOM_DATA_API_TOKEN;
  else process.env.INKLOOM_DATA_API_TOKEN = originalToken;
  if (originalFallbackUrl === undefined) delete process.env.DATA_API_URL;
  else process.env.DATA_API_URL = originalFallbackUrl;
});

function mockFetch(
  handler: (url: string, init: RequestInit) => unknown,
) {
  globalThis.fetch = (async (input, init = {}) => {
    const payload = handler(String(input), init);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("CoreDataClient", () => {
  it("uses the versioned Worker route and compatibility aliases", async () => {
    mockFetch((url, init) => {
      assert.equal(url, "https://data.example/v1/projects");
      assert.equal(init.method, undefined);
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        "Bearer secret",
      );
      return [
        {
          id: "project-1",
          name: "Docs",
          slug: "docs",
          createdAt: 1_700_000_000_000,
          settings: { theme: "forest" },
        },
      ];
    });

    const client = new CoreDataClient({
      dataApiUrl: "https://data.example/",
      token: "secret",
    });
    const [project] = await client.listProjects();

    assert.equal(project.id, "project-1");
    assert.equal(project._id, "project-1");
    assert.equal(project._creationTime, 1_700_000_000_000);
    assert.equal(project.theme, "forest");
  });

  it("serializes mutations as JSON", async () => {
    mockFetch((url, init) => {
      assert.equal(url, "https://data.example/v1/projects");
      assert.equal(init.method, "POST");
      assert.equal(init.body, JSON.stringify({ name: "API Docs" }));
      assert.equal(
        (init.headers as Record<string, string>)["Content-Type"],
        "application/json",
      );
      return { id: "project-2" };
    });

    const client = new CoreDataClient({
      dataApiUrl: "https://data.example",
    });
    assert.equal(
      await client.createProject({ name: "API Docs" }),
      "project-2",
    );
  });

  it("surfaces structured Worker errors", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { code: "not_found", message: "Project not found." },
        }),
        { status: 404 },
      )) as typeof fetch;

    const client = new CoreDataClient({
      dataApiUrl: "https://data.example",
    });
    await assert.rejects(
      () => client.getProject("missing"),
      /Project not found/,
    );
  });

  it("uses CLI environment configuration", async () => {
    process.env.INKLOOM_DATA_API_URL = "https://env.example";
    process.env.INKLOOM_DATA_API_TOKEN = "env-token";
    mockFetch((url, init) => {
      assert.equal(url, "https://env.example/v1/users/ensure-local");
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        "Bearer env-token",
      );
      return { id: "local-user" };
    });

    const client = createCoreDataClient();
    assert.equal(await client.ensureLocalUser(), "local-user");
  });

  it("defaults to the local Wrangler Worker", async () => {
    delete process.env.INKLOOM_DATA_API_URL;
    delete process.env.DATA_API_URL;
    mockFetch((url) => {
      assert.equal(url, "http://127.0.0.1:8787/v1/projects");
      return [];
    });

    const client = createCoreDataClient();
    assert.deepEqual(await client.listProjects(), []);
  });

  it("exports project relationships from D1 API routes", async () => {
    mockFetch((url) => {
      const path = new URL(url).pathname;
      const responses: Record<string, unknown> = {
        "/v1/projects/project-1": {
          id: "project-1",
          name: "Docs",
          slug: "docs",
          defaultBranchId: "branch-1",
        },
        "/v1/branches/project/project-1": [
          {
            id: "branch-1",
            projectId: "project-1",
            name: "main",
            isDefault: true,
            isLocked: false,
          },
        ],
        "/v1/assets/project/project-1": [],
        "/v1/deployments/project/project-1/list": [],
        "/v1/merge-requests/project/project-1": [],
        "/v1/pages/branch/branch-1": [
          {
            id: "page-1",
            branchId: "branch-1",
            title: "Welcome",
            slug: "welcome",
          },
        ],
        "/v1/folders/branch/branch-1": [],
        "/v1/pages/page-1/content": {
          id: "content-1",
          pageId: "page-1",
          content: "[]",
        },
      };
      assert.ok(path in responses, `unexpected request ${path}`);
      return responses[path];
    });

    const data = await new CoreDataClient({
      dataApiUrl: "https://data.example",
    }).exportProject("project-1");

    assert.equal(data.projects.length, 1);
    assert.equal(data.branches.length, 1);
    assert.equal(data.pages[0].content, "[]");
  });
});
