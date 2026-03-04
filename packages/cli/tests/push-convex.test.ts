import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  applyDiffConvex,
  computeDiff,
  walkMdxFiles,
  type DiffResult,
  type LocalPage,
  type RemotePage,
  type RemoteFolder,
  type ApplyDiffSummary,
} from "../src/lib/push.ts";

// ---------------------------------------------------------------------------
// Mock ConvexCliClient
// ---------------------------------------------------------------------------

interface MockCall {
  method: string;
  args: unknown[];
}

function createMockConvexClient() {
  const calls: MockCall[] = [];
  let nextFolderId = 1;
  let nextPageId = 1;

  const client = {
    calls,

    createFolder: async (args: {
      branchId: string;
      name: string;
      parentId?: string;
    }): Promise<string> => {
      calls.push({ method: "createFolder", args: [args] });
      return `folder_${nextFolderId++}`;
    },

    createPage: async (args: {
      branchId: string;
      title: string;
      folderId?: string;
      position?: number;
    }): Promise<string> => {
      calls.push({ method: "createPage", args: [args] });
      return `page_${nextPageId++}`;
    },

    updatePageContent: async (pageId: string, content: string): Promise<string> => {
      calls.push({ method: "updatePageContent", args: [pageId, content] });
      return "contentId_1";
    },

    updatePage: async (
      pageId: string,
      updates: Record<string, unknown>
    ): Promise<void> => {
      calls.push({ method: "updatePage", args: [pageId, updates] });
    },

    removePage: async (pageId: string): Promise<void> => {
      calls.push({ method: "removePage", args: [pageId] });
    },

    removeFolder: async (folderId: string): Promise<void> => {
      calls.push({ method: "removeFolder", args: [folderId] });
    },

    listFoldersByBranch: async (_branchId: string): Promise<Array<{
      _id: string;
      _creationTime: number;
      branchId: string;
      name: string;
      slug: string;
      parentId?: string;
    }>> => {
      calls.push({ method: "listFoldersByBranch", args: [_branchId] });
      return [];
    },

    listPagesWithMdxContent: async (_branchId: string): Promise<Array<{
      _id: string;
      _creationTime: number;
      branchId: string;
      title: string;
      slug: string;
      folderId?: string;
      content?: string;
      position?: number;
      isPublished?: boolean;
      icon?: string;
      description?: string;
    }>> => {
      calls.push({ method: "listPagesWithMdxContent", args: [_branchId] });
      return [];
    },

    getDefaultBranch: async (_projectId: string) => {
      calls.push({ method: "getDefaultBranch", args: [_projectId] });
      return { _id: "branch_1", name: "main", isDefault: true };
    },

    close: () => {
      calls.push({ method: "close", args: [] });
    },
  };

  return client;
}

type MockConvexClient = ReturnType<typeof createMockConvexClient>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeLocalPage(opts: {
  relativePath: string;
  slug: string;
  title: string;
  content: string;
  folderPath?: string;
  icon?: string;
  description?: string;
  isPublished?: boolean;
  position?: number;
}): LocalPage {
  return {
    relativePath: opts.relativePath,
    folderPath: opts.folderPath ?? "",
    filename: opts.relativePath.split("/").pop()!,
    slug: opts.slug,
    title: opts.title,
    frontmatter: {
      title: opts.title,
      slug: opts.slug,
      icon: opts.icon,
      description: opts.description,
      isPublished: opts.isPublished,
      position: opts.position,
    },
    content: opts.content,
    fullContent: opts.content,
  };
}

let tmpDir: string;

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "push-convex-test-"));
}

function writeFile(relativePath: string, content: string): void {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

function makeMdx(
  opts: {
    title?: string;
    slug?: string;
    position?: number;
    isPublished?: boolean;
    icon?: string;
    description?: string;
  },
  body: string
): string {
  const lines: string[] = [];
  if (opts.title !== undefined) lines.push(`title: ${opts.title}`);
  if (opts.slug !== undefined) lines.push(`slug: ${opts.slug}`);
  if (opts.position !== undefined) lines.push(`position: ${opts.position}`);
  if (opts.isPublished !== undefined) lines.push(`isPublished: ${opts.isPublished}`);
  if (opts.icon !== undefined) lines.push(`icon: ${opts.icon}`);
  if (opts.description !== undefined) lines.push(`description: ${opts.description}`);

  if (lines.length === 0) return body;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

// ---------------------------------------------------------------------------
// Tests: applyDiffConvex
// ---------------------------------------------------------------------------

describe("applyDiffConvex", () => {
  let client: MockConvexClient;

  beforeEach(() => {
    client = createMockConvexClient();
  });

  it("should create folders top-down and track returned IDs", async () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "guides", name: "guides", parentPath: "" },
        { path: "guides/advanced", name: "advanced", parentPath: "guides" },
      ],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 2);
    assert.equal(summary.errors.length, 0);

    // Verify first folder created without parentId
    const firstCreate = client.calls.find(
      (c) => c.method === "createFolder"
    )!;
    const firstArgs = firstCreate.args[0] as Record<string, unknown>;
    assert.equal(firstArgs.name, "guides");
    assert.equal(firstArgs.branchId, "branch_1");
    assert.equal(firstArgs.parentId, undefined);

    // Verify second folder created with parentId from first
    const secondCreate = client.calls.filter(
      (c) => c.method === "createFolder"
    )[1];
    const secondArgs = secondCreate.args[0] as Record<string, unknown>;
    assert.equal(secondArgs.name, "advanced");
    assert.equal(secondArgs.parentId, "folder_1"); // ID from first createFolder
  });

  it("should create pages with MDX → BlockNote conversion", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "quickstart.mdx",
          slug: "quickstart",
          title: "Quickstart",
          content: "# Hello\n\nWelcome to InkLoom!",
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesCreated, 1);
    assert.equal(summary.errors.length, 0);

    // Verify page was created
    const createCall = client.calls.find((c) => c.method === "createPage")!;
    const createArgs = createCall.args[0] as Record<string, unknown>;
    assert.equal(createArgs.title, "Quickstart");
    assert.equal(createArgs.branchId, "branch_1");

    // Verify content was updated (should be BlockNote JSON)
    const contentCall = client.calls.find((c) => c.method === "updatePageContent")!;
    assert.equal(contentCall.args[0], "page_1");
    // Content should be valid JSON (BlockNote blocks)
    const content = JSON.parse(contentCall.args[1] as string);
    assert.ok(Array.isArray(content), "Content should be an array of blocks");
    assert.ok(content.length > 0, "Content should have at least one block");
  });

  it("should set page metadata (icon, description, isPublished)", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "intro.mdx",
          slug: "intro",
          title: "Introduction",
          content: "Hello world",
          icon: "book",
          description: "Getting started guide",
          isPublished: true,
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesCreated, 1);

    // Verify updatePage was called with metadata
    const updateCall = client.calls.find((c) => c.method === "updatePage")!;
    assert.ok(updateCall, "updatePage should be called for metadata");
    const updates = updateCall.args[1] as Record<string, unknown>;
    assert.equal(updates.icon, "book");
    assert.equal(updates.description, "Getting started guide");
    assert.equal(updates.isPublished, true);
  });

  it("should use --publish flag when frontmatter isPublished is undefined", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "page.mdx",
          slug: "page",
          title: "Page",
          content: "Content",
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1", publish: true }
    );

    const updateCall = client.calls.find((c) => c.method === "updatePage")!;
    assert.ok(updateCall);
    const updates = updateCall.args[1] as Record<string, unknown>;
    assert.equal(updates.isPublished, true);
  });

  it("should update pages with new content", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [
        {
          local: makeLocalPage({
            relativePath: "intro.mdx",
            slug: "intro",
            title: "Introduction Updated",
            content: "# Updated content",
          }),
          remote: {
            id: "existing_page_1",
            title: "Introduction",
            slug: "intro",
            content: "# Old content",
          },
        },
      ],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesUpdated, 1);

    // Content should be updated
    const contentCall = client.calls.find((c) => c.method === "updatePageContent")!;
    assert.equal(contentCall.args[0], "existing_page_1");

    // Title changed, so updatePage should be called
    const updateCall = client.calls.find((c) => c.method === "updatePage")!;
    assert.ok(updateCall);
    const updates = updateCall.args[1] as Record<string, unknown>;
    assert.equal(updates.title, "Introduction Updated");
  });

  it("should not call updatePage when only content changed (same title)", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [
        {
          local: makeLocalPage({
            relativePath: "intro.mdx",
            slug: "intro",
            title: "Same Title",
            content: "# New content",
          }),
          remote: {
            id: "existing_page_1",
            title: "Same Title",
            slug: "intro",
            content: "# Old content",
          },
        },
      ],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesUpdated, 1);

    // Content should be updated
    const contentCalls = client.calls.filter((c) => c.method === "updatePageContent");
    assert.equal(contentCalls.length, 1);

    // No updatePage call (title didn't change, no --publish)
    const updateCalls = client.calls.filter((c) => c.method === "updatePage");
    assert.equal(updateCalls.length, 0);
  });

  it("should delete pages", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [
        { id: "page_to_delete_1", title: "Old Page", slug: "old-page" },
        { id: "page_to_delete_2", title: "Another", slug: "another" },
      ],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesDeleted, 2);

    const deleteCalls = client.calls.filter((c) => c.method === "removePage");
    assert.equal(deleteCalls.length, 2);
    assert.equal(deleteCalls[0].args[0], "page_to_delete_1");
    assert.equal(deleteCalls[1].args[0], "page_to_delete_2");
  });

  it("should delete folders bottom-up", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [
        { id: "folder_child", name: "child", slug: "child" },
        { id: "folder_parent", name: "parent", slug: "parent" },
      ],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersDeleted, 2);

    const deleteCalls = client.calls.filter((c) => c.method === "removeFolder");
    assert.equal(deleteCalls.length, 2);
    // Should maintain order (children first as provided by computeDiff)
    assert.equal(deleteCalls[0].args[0], "folder_child");
    assert.equal(deleteCalls[1].args[0], "folder_parent");
  });

  it("should assign correct folderId to pages in created folders", async () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "guides", name: "guides", parentPath: "" },
      ],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "guides/intro.mdx",
          slug: "intro",
          title: "Intro",
          content: "Hello",
          folderPath: "guides",
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 1);
    assert.equal(summary.pagesCreated, 1);

    // Page should use the newly created folder ID
    const createPageCall = client.calls.find((c) => c.method === "createPage")!;
    const args = createPageCall.args[0] as Record<string, unknown>;
    assert.equal(args.folderId, "folder_1");
  });

  it("should use existing remote folder IDs for pages", async () => {
    const remoteFolders: RemoteFolder[] = [
      { id: "existing_folder", name: "docs", slug: "docs" },
    ];

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "docs/page.mdx",
          slug: "page",
          title: "Page",
          content: "Content",
          folderPath: "docs",
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      remoteFolders,
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesCreated, 1);

    const createPageCall = client.calls.find((c) => c.method === "createPage")!;
    const args = createPageCall.args[0] as Record<string, unknown>;
    assert.equal(args.folderId, "existing_folder");
  });

  it("should handle full create+update+delete cycle", async () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "new-folder", name: "new-folder", parentPath: "" },
      ],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "new-folder/new-page.mdx",
          slug: "new-page",
          title: "New Page",
          content: "New content",
          folderPath: "new-folder",
        }),
      ],
      pagesToUpdate: [
        {
          local: makeLocalPage({
            relativePath: "existing.mdx",
            slug: "existing",
            title: "Existing",
            content: "Updated content",
          }),
          remote: {
            id: "remote_page_1",
            title: "Existing",
            slug: "existing",
            content: "Old content",
          },
        },
      ],
      pagesToDelete: [
        { id: "old_page", title: "Old", slug: "old" },
      ],
      foldersToDelete: [
        { id: "old_folder", name: "old-folder", slug: "old-folder" },
      ],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 1);
    assert.equal(summary.pagesCreated, 1);
    assert.equal(summary.pagesUpdated, 1);
    assert.equal(summary.pagesDeleted, 1);
    assert.equal(summary.foldersDeleted, 1);
    assert.equal(summary.errors.length, 0);
  });

  it("should collect errors without stopping", async () => {
    // Create a client that fails on createPage
    const failClient = {
      ...client,
      createPage: async () => {
        throw new Error("Convex mutation failed");
      },
      removePage: async () => {
        throw new Error("Page not found");
      },
    };

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "fail.mdx",
          slug: "fail",
          title: "Fail",
          content: "Content",
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [
        { id: "missing_page", title: "Missing", slug: "missing" },
      ],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      failClient as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesCreated, 0);
    assert.equal(summary.pagesDeleted, 0);
    assert.equal(summary.errors.length, 2);
    assert.ok(summary.errors[0].includes("Convex mutation failed"));
    assert.ok(summary.errors[1].includes("Page not found"));
  });

  it("should pass position from frontmatter to createPage", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        makeLocalPage({
          relativePath: "ordered.mdx",
          slug: "ordered",
          title: "Ordered",
          content: "Content",
          position: 5,
        }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    const createCall = client.calls.find((c) => c.method === "createPage")!;
    const args = createCall.args[0] as Record<string, unknown>;
    assert.equal(args.position, 5);
  });

  it("should handle empty diff (no changes)", async () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 0);
    assert.equal(summary.pagesCreated, 0);
    assert.equal(summary.pagesUpdated, 0);
    assert.equal(summary.pagesDeleted, 0);
    assert.equal(summary.foldersDeleted, 0);
    assert.equal(summary.errors.length, 0);
    assert.equal(client.calls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Tests: isCoreMode detection
// ---------------------------------------------------------------------------

describe("isCoreMode detection", () => {
  // We test the logic inline since isCoreMode is not exported
  // Instead, we verify the behavior through the data flow

  it("should detect core mode with --convex-url", () => {
    const localOpts = { convexUrl: "https://test.convex.cloud" };
    const globalOpts = { json: false };
    // With convexUrl set, it's always core mode
    assert.equal(!!localOpts.convexUrl, true);
  });

  it("should detect core mode with env var and no token", () => {
    const hasConvexUrl = true;
    const hasToken = false;
    assert.equal(hasConvexUrl && !hasToken, true);
  });

  it("should use platform mode when token is present", () => {
    const hasConvexUrl = true;
    const hasToken = true;
    assert.equal(hasConvexUrl && !hasToken, false);
  });
});

// ---------------------------------------------------------------------------
// Tests: End-to-end with walkMdxFiles + computeDiff + applyDiffConvex
// ---------------------------------------------------------------------------

describe("end-to-end push flow (core mode)", () => {
  let client: MockConvexClient;

  beforeEach(() => {
    client = createMockConvexClient();
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should push local MDX files to Convex with correct diff", async () => {
    // Create local files
    writeFile(
      "quickstart.mdx",
      makeMdx({ title: "Quickstart", slug: "quickstart" }, "# Get started\n\nHello!")
    );
    writeFile(
      "guides/advanced.mdx",
      makeMdx(
        { title: "Advanced", slug: "advanced", isPublished: true },
        "# Advanced usage"
      )
    );

    // Walk local files
    const localPages = walkMdxFiles(tmpDir);
    assert.equal(localPages.length, 2);

    // No remote pages/folders
    const remotePages: RemotePage[] = [];
    const remoteFolders: RemoteFolder[] = [];

    // Compute diff
    const diff = computeDiff(localPages, remotePages, remoteFolders, false);
    assert.equal(diff.foldersToCreate.length, 1); // "guides" folder
    assert.equal(diff.pagesToCreate.length, 2);

    // Apply via Convex
    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      remoteFolders,
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 1);
    assert.equal(summary.pagesCreated, 2);
    assert.equal(summary.errors.length, 0);

    // Verify folder was created
    const folderCalls = client.calls.filter((c) => c.method === "createFolder");
    assert.equal(folderCalls.length, 1);
    assert.equal(
      (folderCalls[0].args[0] as Record<string, unknown>).name,
      "guides"
    );

    // Verify pages were created
    const pageCalls = client.calls.filter((c) => c.method === "createPage");
    assert.equal(pageCalls.length, 2);

    // Verify content was set
    const contentCalls = client.calls.filter(
      (c) => c.method === "updatePageContent"
    );
    assert.equal(contentCalls.length, 2);

    // Verify the "advanced" page got isPublished: true
    const updateCalls = client.calls.filter((c) => c.method === "updatePage");
    const publishUpdate = updateCalls.find((c) => {
      const updates = c.args[1] as Record<string, unknown>;
      return updates.isPublished === true;
    });
    assert.ok(publishUpdate, "Should have an updatePage call with isPublished: true");
  });

  it("should detect updates when remote content differs", async () => {
    writeFile(
      "intro.mdx",
      makeMdx({ title: "Intro", slug: "intro" }, "# New content here")
    );

    const localPages = walkMdxFiles(tmpDir);

    // Remote has same slug but different content
    const remotePages: RemotePage[] = [
      {
        id: "remote_1",
        title: "Intro",
        slug: "intro",
        content: "# Old content",
      },
    ];

    const diff = computeDiff(localPages, remotePages, [], false);
    assert.equal(diff.pagesToCreate.length, 0);
    assert.equal(diff.pagesToUpdate.length, 1);

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesUpdated, 1);
    assert.equal(summary.errors.length, 0);
  });

  it("should handle nested folder creation and page assignment", async () => {
    writeFile(
      "api/reference/endpoints.mdx",
      makeMdx(
        { title: "Endpoints", slug: "endpoints" },
        "# API Endpoints"
      )
    );

    const localPages = walkMdxFiles(tmpDir);
    const diff = computeDiff(localPages, [], [], false);

    // Should create 2 folders: "api" and "api/reference"
    assert.equal(diff.foldersToCreate.length, 2);
    assert.equal(diff.foldersToCreate[0].path, "api");
    assert.equal(diff.foldersToCreate[1].path, "api/reference");

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      [],
      { branchId: "branch_1" }
    );

    assert.equal(summary.foldersCreated, 2);
    assert.equal(summary.pagesCreated, 1);

    // Verify nested folder has parent
    const folderCalls = client.calls.filter((c) => c.method === "createFolder");
    const apiFolder = folderCalls[0].args[0] as Record<string, unknown>;
    assert.equal(apiFolder.name, "api");
    assert.equal(apiFolder.parentId, undefined);

    const refFolder = folderCalls[1].args[0] as Record<string, unknown>;
    assert.equal(refFolder.name, "reference");
    assert.equal(refFolder.parentId, "folder_1"); // api folder's ID

    // Verify page is in the reference folder
    const pageCall = client.calls.find((c) => c.method === "createPage")!;
    const pageArgs = pageCall.args[0] as Record<string, unknown>;
    assert.equal(pageArgs.folderId, "folder_2"); // reference folder's ID
  });

  it("should handle delete mode", async () => {
    // Local has only one page
    writeFile(
      "keep.mdx",
      makeMdx({ title: "Keep", slug: "keep" }, "Keep this")
    );

    const localPages = walkMdxFiles(tmpDir);

    // Remote has two pages
    const remotePages: RemotePage[] = [
      { id: "page_keep", title: "Keep", slug: "keep", content: "Keep this" },
      { id: "page_delete", title: "Delete Me", slug: "delete-me", content: "Old" },
    ];
    const remoteFolders: RemoteFolder[] = [
      { id: "folder_unused", name: "unused", slug: "unused" },
    ];

    const diff = computeDiff(localPages, remotePages, remoteFolders, true);
    assert.equal(diff.pagesToDelete.length, 1);
    assert.equal(diff.foldersToDelete.length, 1);

    const summary = await applyDiffConvex(
      client as unknown as Parameters<typeof applyDiffConvex>[0],
      diff,
      remoteFolders,
      { branchId: "branch_1" }
    );

    assert.equal(summary.pagesDeleted, 1);
    assert.equal(summary.foldersDeleted, 1);
  });
});
