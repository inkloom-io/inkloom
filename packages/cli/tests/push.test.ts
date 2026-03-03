import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  walkMdxFiles,
  computeDiff,
  titleCase,
  formatDiffLines,
  formatDiffSummary,
  formatSummary,
  applyDiff,
  type LocalPage,
  type RemotePage,
  type RemoteFolder,
  type DiffResult,
  type ApplyDiffSummary,
} from "../src/lib/push.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "push-test-"));
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
  if (opts.isPublished !== undefined)
    lines.push(`isPublished: ${opts.isPublished}`);
  if (opts.icon !== undefined) lines.push(`icon: ${opts.icon}`);
  if (opts.description !== undefined)
    lines.push(`description: ${opts.description}`);

  if (lines.length === 0) return body;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

// ── titleCase ────────────────────────────────────────────────────────────────

describe("titleCase", () => {
  it("should convert hyphenated names to title case", () => {
    assert.equal(titleCase("getting-started"), "Getting Started");
  });

  it("should convert underscored names to title case", () => {
    assert.equal(titleCase("api_reference"), "Api Reference");
  });

  it("should handle single word", () => {
    assert.equal(titleCase("introduction"), "Introduction");
  });

  it("should handle already capitalized words", () => {
    assert.equal(titleCase("Quick-Start"), "Quick Start");
  });

  it("should handle mixed separators", () => {
    assert.equal(titleCase("my-api_docs"), "My Api Docs");
  });

  it("should handle empty string", () => {
    assert.equal(titleCase(""), "");
  });
});

// ── walkMdxFiles ─────────────────────────────────────────────────────────────

describe("walkMdxFiles", () => {
  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should collect .mdx files from root directory", () => {
    writeFile("intro.mdx", makeMdx({ title: "Introduction" }, "Hello"));
    writeFile("setup.mdx", makeMdx({ title: "Setup" }, "Setup guide"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 2);
    const slugs = pages.map((p) => p.slug).sort();
    assert.deepEqual(slugs, ["intro", "setup"]);
  });

  it("should collect .mdx files from nested directories", () => {
    writeFile(
      "getting-started/quickstart.mdx",
      makeMdx({ title: "Quickstart" }, "Quick!")
    );
    writeFile(
      "getting-started/installation.mdx",
      makeMdx({ title: "Installation" }, "Install...")
    );
    writeFile(
      "api-reference/endpoints.mdx",
      makeMdx({ title: "Endpoints" }, "API endpoints")
    );

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 3);

    const quickstart = pages.find((p) => p.slug === "quickstart")!;
    assert.ok(quickstart, "quickstart page should exist");
    assert.equal(quickstart.folderPath, "getting-started");
    assert.equal(quickstart.filename, "quickstart.mdx");
    assert.equal(quickstart.relativePath, "getting-started/quickstart.mdx");

    const endpoints = pages.find((p) => p.slug === "endpoints")!;
    assert.ok(endpoints, "endpoints page should exist");
    assert.equal(endpoints.folderPath, "api-reference");
  });

  it("should handle deeply nested directories", () => {
    writeFile(
      "guides/advanced/performance/caching.mdx",
      makeMdx({ title: "Caching" }, "Cache content")
    );

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].folderPath, "guides/advanced/performance");
    assert.equal(
      pages[0].relativePath,
      "guides/advanced/performance/caching.mdx"
    );
  });

  it("should use slug from frontmatter when available", () => {
    writeFile(
      "my-file.mdx",
      makeMdx({ title: "Custom", slug: "custom-slug" }, "Content")
    );

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, "custom-slug");
  });

  it("should derive slug from filename when frontmatter slug is absent", () => {
    writeFile("my-page.mdx", makeMdx({ title: "Page" }, "Content"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, "my-page");
  });

  it("should use title from frontmatter when available", () => {
    writeFile(
      "page.mdx",
      makeMdx({ title: "Custom Title" }, "Content")
    );

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, "Custom Title");
  });

  it("should derive title from filename when frontmatter title is absent", () => {
    writeFile("getting-started.mdx", "# Content only, no frontmatter");

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, "Getting Started");
  });

  it("should skip dot-prefixed directories", () => {
    writeFile(".hidden/secret.mdx", makeMdx({ title: "Hidden" }, "Secret"));
    writeFile("visible.mdx", makeMdx({ title: "Visible" }, "Public"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, "visible");
  });

  it("should skip node_modules directory", () => {
    writeFile(
      "node_modules/pkg/doc.mdx",
      makeMdx({ title: "Package" }, "Doc")
    );
    writeFile("real.mdx", makeMdx({ title: "Real" }, "Real content"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, "real");
  });

  it("should skip non-.mdx files", () => {
    writeFile("readme.md", "# Not MDX");
    writeFile("data.json", "{}");
    writeFile("page.mdx", makeMdx({ title: "Page" }, "Content"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, "page");
  });

  it("should return empty array for empty directory", () => {
    const pages = walkMdxFiles(tmpDir);
    assert.equal(pages.length, 0);
  });

  it("should parse frontmatter fields correctly", () => {
    writeFile(
      "page.mdx",
      makeMdx(
        {
          title: "My Page",
          slug: "my-page",
          position: 3,
          isPublished: true,
          icon: "star",
          description: "A great page",
        },
        "# Content"
      )
    );

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    const page = pages[0];
    assert.equal(page.frontmatter.title, "My Page");
    assert.equal(page.frontmatter.slug, "my-page");
    assert.equal(page.frontmatter.position, 3);
    assert.equal(page.frontmatter.isPublished, true);
    assert.equal(page.frontmatter.icon, "star");
    assert.equal(page.frontmatter.description, "A great page");
    assert.equal(page.content, "# Content");
  });

  it("should handle files without frontmatter", () => {
    writeFile("plain.mdx", "# Just content, no frontmatter");

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].frontmatter, {});
    assert.equal(pages[0].content, "# Just content, no frontmatter");
    assert.equal(pages[0].title, "Plain"); // derived from filename
    assert.equal(pages[0].slug, "plain"); // derived from filename
  });

  it("should store fullContent including frontmatter", () => {
    const fullContent = makeMdx({ title: "Full" }, "Body text");
    writeFile("full.mdx", fullContent);

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].fullContent, fullContent);
  });

  it("should set folderPath to empty string for root-level files", () => {
    writeFile("root.mdx", makeMdx({ title: "Root" }, "At root"));

    const pages = walkMdxFiles(tmpDir);

    assert.equal(pages.length, 1);
    assert.equal(pages[0].folderPath, "");
  });
});

// ── computeDiff ──────────────────────────────────────────────────────────────

describe("computeDiff", () => {
  // Helper to create a LocalPage
  function localPage(opts: {
    folderPath?: string;
    slug: string;
    title?: string;
    content?: string;
  }): LocalPage {
    const folderPath = opts.folderPath ?? "";
    const slug = opts.slug;
    const filename = `${slug}.mdx`;
    const relativePath = folderPath
      ? `${folderPath}/${filename}`
      : filename;
    const content = opts.content ?? `# ${opts.title ?? slug}`;
    const title = opts.title ?? titleCase(slug);

    return {
      relativePath,
      folderPath,
      filename,
      slug,
      title,
      frontmatter: { title, slug },
      content,
      fullContent: makeMdx({ title, slug }, content),
    };
  }

  // Helper to create a RemotePage
  function remotePage(opts: {
    id: string;
    slug: string;
    title?: string;
    folderId?: string;
    content?: string;
    isPublished?: boolean;
  }): RemotePage {
    return {
      id: opts.id,
      title: opts.title ?? titleCase(opts.slug),
      slug: opts.slug,
      folderId: opts.folderId,
      content: opts.content ?? `# ${opts.title ?? opts.slug}`,
      isPublished: opts.isPublished,
    };
  }

  // Helper to create a RemoteFolder
  function remoteFolder(opts: {
    id: string;
    name: string;
    slug: string;
    parentId?: string;
  }): RemoteFolder {
    return {
      id: opts.id,
      name: opts.name,
      slug: opts.slug,
      parentId: opts.parentId,
    };
  }

  describe("page creation", () => {
    it("should identify new pages to create when remote is empty", () => {
      const local = [
        localPage({ slug: "intro", content: "Intro content" }),
        localPage({ slug: "setup", content: "Setup content" }),
      ];

      const diff = computeDiff(local, [], [], false);

      assert.equal(diff.pagesToCreate.length, 2);
      assert.equal(diff.pagesToUpdate.length, 0);
      assert.equal(diff.pagesToDelete.length, 0);
    });

    it("should identify new pages in new folders", () => {
      const local = [
        localPage({
          folderPath: "guides",
          slug: "quickstart",
          content: "Quick",
        }),
      ];

      const diff = computeDiff(local, [], [], false);

      assert.equal(diff.pagesToCreate.length, 1);
      assert.equal(diff.foldersToCreate.length, 1);
      assert.equal(diff.foldersToCreate[0].path, "guides");
      assert.equal(diff.foldersToCreate[0].name, "guides");
      assert.equal(diff.foldersToCreate[0].parentPath, "");
    });

    it("should create nested folders parent-first", () => {
      const local = [
        localPage({
          folderPath: "guides/advanced",
          slug: "deep-page",
          content: "Deep",
        }),
      ];

      const diff = computeDiff(local, [], [], false);

      assert.equal(diff.foldersToCreate.length, 2);
      assert.equal(diff.foldersToCreate[0].path, "guides");
      assert.equal(diff.foldersToCreate[0].parentPath, "");
      assert.equal(diff.foldersToCreate[1].path, "guides/advanced");
      assert.equal(diff.foldersToCreate[1].parentPath, "guides");
    });
  });

  describe("page matching and updates", () => {
    it("should match pages by folderPath/slug key", () => {
      const local = [
        localPage({ slug: "intro", content: "New content" }),
      ];
      const remote = [
        remotePage({ id: "p1", slug: "intro", content: "Old content" }),
      ];

      const diff = computeDiff(local, remote, [], false);

      assert.equal(diff.pagesToCreate.length, 0);
      assert.equal(diff.pagesToUpdate.length, 1);
      assert.equal(diff.pagesToUpdate[0].remote.id, "p1");
      assert.equal(diff.pagesToUpdate[0].local.slug, "intro");
    });

    it("should not mark unchanged pages for update", () => {
      const content = "Same content";
      const local = [localPage({ slug: "intro", content })];
      const remote = [remotePage({ id: "p1", slug: "intro", content })];

      const diff = computeDiff(local, remote, [], false);

      assert.equal(diff.pagesToCreate.length, 0);
      assert.equal(diff.pagesToUpdate.length, 0);
    });

    it("should trim whitespace when comparing content", () => {
      const local = [localPage({ slug: "intro", content: "  Content  " })];
      const remote = [
        remotePage({ id: "p1", slug: "intro", content: "Content" }),
      ];

      const diff = computeDiff(local, remote, [], false);

      assert.equal(diff.pagesToUpdate.length, 0);
    });

    it("should match pages in folders correctly", () => {
      const folders = [
        remoteFolder({
          id: "f1",
          name: "Guides",
          slug: "guides",
        }),
      ];
      const local = [
        localPage({
          folderPath: "guides",
          slug: "quickstart",
          content: "Updated",
        }),
      ];
      const remote = [
        remotePage({
          id: "p1",
          slug: "quickstart",
          folderId: "f1",
          content: "Original",
        }),
      ];

      const diff = computeDiff(local, remote, folders, false);

      assert.equal(diff.pagesToCreate.length, 0);
      assert.equal(diff.pagesToUpdate.length, 1);
      assert.equal(diff.pagesToUpdate[0].remote.id, "p1");
    });

    it("should not match pages in different folders", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
      ];
      const local = [
        localPage({
          folderPath: "api",
          slug: "quickstart",
          content: "API quickstart",
        }),
      ];
      const remote = [
        remotePage({
          id: "p1",
          slug: "quickstart",
          folderId: "f1",
          content: "Guides quickstart",
        }),
      ];

      const diff = computeDiff(local, remote, folders, false);

      // The local page is in "api" folder but remote is in "guides" → create
      assert.equal(diff.pagesToCreate.length, 1);
      assert.equal(diff.pagesToUpdate.length, 0);
    });

    it("should handle root page vs folder page with same slug", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
      ];
      const local = [
        localPage({ slug: "intro", content: "Root intro" }),
      ];
      const remote = [
        remotePage({
          id: "p1",
          slug: "intro",
          folderId: "f1",
          content: "Guides intro",
        }),
      ];

      const diff = computeDiff(local, remote, folders, false);

      // Root "intro" doesn't match "guides/intro" → create new, no update
      assert.equal(diff.pagesToCreate.length, 1);
      assert.equal(diff.pagesToUpdate.length, 0);
    });
  });

  describe("deletion with --delete flag", () => {
    it("should mark unmatched remote pages for deletion when deleteRemoved is true", () => {
      const local = [localPage({ slug: "intro", content: "Intro" })];
      const remote = [
        remotePage({ id: "p1", slug: "intro", content: "Intro" }),
        remotePage({ id: "p2", slug: "old-page", content: "Old" }),
      ];

      const diff = computeDiff(local, remote, [], true);

      assert.equal(diff.pagesToDelete.length, 1);
      assert.equal(diff.pagesToDelete[0].id, "p2");
      assert.equal(diff.pagesToDelete[0].slug, "old-page");
    });

    it("should not delete pages when deleteRemoved is false", () => {
      const local = [localPage({ slug: "intro", content: "Intro" })];
      const remote = [
        remotePage({ id: "p1", slug: "intro", content: "Intro" }),
        remotePage({ id: "p2", slug: "old-page", content: "Old" }),
      ];

      const diff = computeDiff(local, remote, [], false);

      assert.equal(diff.pagesToDelete.length, 0);
    });

    it("should mark unused remote folders for deletion (children first)", () => {
      const folders = [
        remoteFolder({
          id: "f1",
          name: "Old Section",
          slug: "old-section",
        }),
        remoteFolder({
          id: "f2",
          name: "Nested",
          slug: "nested",
          parentId: "f1",
        }),
      ];
      const local: LocalPage[] = [];
      const remote = [
        remotePage({
          id: "p1",
          slug: "old-page",
          folderId: "f1",
          content: "Old",
        }),
      ];

      const diff = computeDiff(local, remote, folders, true);

      assert.equal(diff.foldersToDelete.length, 2);
      // Children first (deepest path first)
      assert.equal(diff.foldersToDelete[0].id, "f2"); // "old-section/nested" is deeper
      assert.equal(diff.foldersToDelete[1].id, "f1"); // "old-section" is parent
    });

    it("should not delete folders that are still referenced by local pages", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
        remoteFolder({
          id: "f2",
          name: "Old Section",
          slug: "old-section",
        }),
      ];
      const local = [
        localPage({
          folderPath: "guides",
          slug: "quickstart",
          content: "Quick",
        }),
      ];
      const remote = [
        remotePage({
          id: "p1",
          slug: "quickstart",
          folderId: "f1",
          content: "Quick",
        }),
      ];

      const diff = computeDiff(local, remote, folders, true);

      assert.equal(diff.foldersToDelete.length, 1);
      assert.equal(diff.foldersToDelete[0].id, "f2");
    });
  });

  describe("folder creation", () => {
    it("should not create folders that already exist remotely", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
      ];
      const local = [
        localPage({
          folderPath: "guides",
          slug: "new-page",
          content: "New",
        }),
      ];

      const diff = computeDiff(local, [], folders, false);

      assert.equal(diff.foldersToCreate.length, 0);
    });

    it("should create only missing folders in a nested hierarchy", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
      ];
      const local = [
        localPage({
          folderPath: "guides/advanced",
          slug: "deep",
          content: "Deep content",
        }),
      ];

      const diff = computeDiff(local, [], folders, false);

      // "guides" exists, only "guides/advanced" needs creation
      assert.equal(diff.foldersToCreate.length, 1);
      assert.equal(diff.foldersToCreate[0].path, "guides/advanced");
      assert.equal(diff.foldersToCreate[0].name, "advanced");
      assert.equal(diff.foldersToCreate[0].parentPath, "guides");
    });

    it("should deduplicate folder creation when multiple pages share a folder", () => {
      const local = [
        localPage({
          folderPath: "guides",
          slug: "page1",
          content: "One",
        }),
        localPage({
          folderPath: "guides",
          slug: "page2",
          content: "Two",
        }),
      ];

      const diff = computeDiff(local, [], [], false);

      assert.equal(diff.foldersToCreate.length, 1);
      assert.equal(diff.foldersToCreate[0].path, "guides");
    });
  });

  describe("complex scenarios", () => {
    it("should handle full sync scenario with creates, updates, and deletes", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Guides", slug: "guides" }),
        remoteFolder({
          id: "f2",
          name: "Deprecated",
          slug: "deprecated",
        }),
      ];

      const local = [
        // Matches remote, content changed → update
        localPage({ slug: "intro", content: "Updated intro" }),
        // Matches remote in folder, content unchanged → no-op
        localPage({
          folderPath: "guides",
          slug: "quickstart",
          content: "Quick",
        }),
        // New page in new folder → create page + create folder
        localPage({
          folderPath: "api-ref",
          slug: "endpoints",
          content: "API docs",
        }),
      ];

      const remote = [
        remotePage({ id: "p1", slug: "intro", content: "Old intro" }),
        remotePage({
          id: "p2",
          slug: "quickstart",
          folderId: "f1",
          content: "Quick",
        }),
        // This page only exists remotely → delete
        remotePage({
          id: "p3",
          slug: "old-guide",
          folderId: "f2",
          content: "Old",
        }),
      ];

      const diff = computeDiff(local, remote, folders, true);

      // One folder to create: "api-ref"
      assert.equal(diff.foldersToCreate.length, 1);
      assert.equal(diff.foldersToCreate[0].path, "api-ref");

      // One page to create: endpoints
      assert.equal(diff.pagesToCreate.length, 1);
      assert.equal(diff.pagesToCreate[0].slug, "endpoints");

      // One page to update: intro
      assert.equal(diff.pagesToUpdate.length, 1);
      assert.equal(diff.pagesToUpdate[0].remote.id, "p1");

      // One page to delete: old-guide
      assert.equal(diff.pagesToDelete.length, 1);
      assert.equal(diff.pagesToDelete[0].id, "p3");

      // One folder to delete: deprecated
      assert.equal(diff.foldersToDelete.length, 1);
      assert.equal(diff.foldersToDelete[0].id, "f2");
    });

    it("should handle deeply nested folder hierarchies", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "A", slug: "a" }),
        remoteFolder({ id: "f2", name: "B", slug: "b", parentId: "f1" }),
      ];

      const local = [
        localPage({
          folderPath: "a/b/c",
          slug: "deep",
          content: "Deep",
        }),
      ];

      const diff = computeDiff(local, [], folders, false);

      // "a" and "a/b" exist; only "a/b/c" needs creation
      assert.equal(diff.foldersToCreate.length, 1);
      assert.equal(diff.foldersToCreate[0].path, "a/b/c");
      assert.equal(diff.foldersToCreate[0].parentPath, "a/b");
    });

    it("should handle empty local and empty remote", () => {
      const diff = computeDiff([], [], [], false);

      assert.equal(diff.foldersToCreate.length, 0);
      assert.equal(diff.pagesToCreate.length, 0);
      assert.equal(diff.pagesToUpdate.length, 0);
      assert.equal(diff.pagesToDelete.length, 0);
      assert.equal(diff.foldersToDelete.length, 0);
    });

    it("should handle empty local with remote content and deleteRemoved", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "Docs", slug: "docs" }),
      ];
      const remote = [
        remotePage({
          id: "p1",
          slug: "intro",
          folderId: "f1",
          content: "Hi",
        }),
        remotePage({ id: "p2", slug: "root-page", content: "Root" }),
      ];

      const diff = computeDiff([], remote, folders, true);

      assert.equal(diff.pagesToCreate.length, 0);
      assert.equal(diff.pagesToUpdate.length, 0);
      assert.equal(diff.pagesToDelete.length, 2);
      assert.equal(diff.foldersToDelete.length, 1);
    });

    it("should handle remote page with undefined content as empty string", () => {
      const content = "Some content";
      const local = [localPage({ slug: "page", content })];

      // Simulate a remote page where content is undefined (null from API)
      const remote: RemotePage[] = [
        { id: "p1", title: "Page", slug: "page", content: undefined },
      ];

      const diff = computeDiff(local, remote, [], false);

      // Local has content, remote is undefined → should update
      assert.equal(diff.pagesToUpdate.length, 1);

      // Also test when both are empty
      const localEmpty = [localPage({ slug: "page2", content: "" })];
      const remoteEmpty: RemotePage[] = [
        { id: "p2", title: "Page2", slug: "page2", content: undefined },
      ];

      const diff2 = computeDiff(localEmpty, remoteEmpty, [], false);
      // Both effectively empty → no update
      assert.equal(diff2.pagesToUpdate.length, 0);
    });

    it("should preserve ancestor folders when child pages still reference them", () => {
      const folders = [
        remoteFolder({ id: "f1", name: "A", slug: "a" }),
        remoteFolder({ id: "f2", name: "B", slug: "b", parentId: "f1" }),
        remoteFolder({ id: "f3", name: "C", slug: "c", parentId: "f2" }),
      ];

      // Local has page only in "a/b", not in "a/b/c"
      const local = [
        localPage({
          folderPath: "a/b",
          slug: "page",
          content: "Content",
        }),
      ];

      const diff = computeDiff(local, [], folders, true);

      // "a/b/c" is unused, but "a" and "a/b" are ancestors of the local page's folder
      assert.equal(diff.foldersToDelete.length, 1);
      assert.equal(diff.foldersToDelete[0].id, "f3");
    });
  });
});

// ── formatDiffLines ─────────────────────────────────────────────────────────

describe("formatDiffLines", () => {
  function localPage(opts: {
    folderPath?: string;
    slug: string;
    title?: string;
    content?: string;
  }): LocalPage {
    const folderPath = opts.folderPath ?? "";
    const slug = opts.slug;
    const filename = `${slug}.mdx`;
    const relativePath = folderPath
      ? `${folderPath}/${filename}`
      : filename;
    const content = opts.content ?? `# ${opts.title ?? slug}`;
    const title = opts.title ?? titleCase(slug);

    return {
      relativePath,
      folderPath,
      filename,
      slug,
      title,
      frontmatter: { title, slug },
      content,
      fullContent: makeMdx({ title, slug }, content),
    };
  }

  it("should format CREATE folder lines", () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "getting-started", name: "getting-started", parentPath: "" },
      ],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("CREATE"));
    assert.ok(lines[0].includes("folder"));
    assert.ok(lines[0].includes("getting-started/"));
  });

  it("should format CREATE page lines", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        localPage({ folderPath: "guides", slug: "quickstart" }),
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("CREATE"));
    assert.ok(lines[0].includes("page"));
    assert.ok(lines[0].includes("guides/quickstart.mdx"));
  });

  it("should format UPDATE page lines", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [
        {
          local: localPage({ slug: "intro", content: "New" }),
          remote: { id: "p1", title: "Intro", slug: "intro", content: "Old" },
        },
      ],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("UPDATE"));
    assert.ok(lines[0].includes("page"));
    assert.ok(lines[0].includes("intro.mdx"));
    assert.ok(lines[0].includes("content changed"));
  });

  it("should format DELETE page lines", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [{ id: "p1", title: "Old", slug: "old-page" }],
      foldersToDelete: [],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("DELETE"));
    assert.ok(lines[0].includes("page"));
    assert.ok(lines[0].includes("old-page.mdx"));
  });

  it("should format DELETE folder lines", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [{ id: "f1", name: "deprecated", slug: "deprecated" }],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes("DELETE"));
    assert.ok(lines[0].includes("folder"));
    assert.ok(lines[0].includes("deprecated/"));
  });

  it("should return empty array when no changes", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 0);
  });

  it("should format all operations in correct order", () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "new-folder", name: "new-folder", parentPath: "" },
      ],
      pagesToCreate: [localPage({ slug: "new-page" })],
      pagesToUpdate: [
        {
          local: localPage({ slug: "updated" }),
          remote: { id: "p1", title: "Updated", slug: "updated", content: "Old" },
        },
      ],
      pagesToDelete: [{ id: "p2", title: "Removed", slug: "removed" }],
      foldersToDelete: [{ id: "f1", name: "old-folder", slug: "old-folder" }],
    };
    const lines = formatDiffLines(diff);
    assert.equal(lines.length, 5);
    // Order: folders create, pages create, pages update, pages delete, folders delete
    assert.ok(lines[0].includes("CREATE") && lines[0].includes("folder"));
    assert.ok(lines[1].includes("CREATE") && lines[1].includes("page"));
    assert.ok(lines[2].includes("UPDATE") && lines[2].includes("page"));
    assert.ok(lines[3].includes("DELETE") && lines[3].includes("page"));
    assert.ok(lines[4].includes("DELETE") && lines[4].includes("folder"));
  });
});

// ── formatDiffSummary ───────────────────────────────────────────────────────

describe("formatDiffSummary", () => {
  it("should format summary with all change types", () => {
    const diff: DiffResult = {
      foldersToCreate: [
        { path: "a", name: "a", parentPath: "" },
        { path: "b", name: "b", parentPath: "" },
      ],
      pagesToCreate: [
        { relativePath: "p.mdx", folderPath: "", filename: "p.mdx", slug: "p", title: "P", frontmatter: {}, content: "", fullContent: "" },
      ],
      pagesToUpdate: [
        {
          local: { relativePath: "u.mdx", folderPath: "", filename: "u.mdx", slug: "u", title: "U", frontmatter: {}, content: "", fullContent: "" },
          remote: { id: "r1", title: "U", slug: "u" },
        },
      ],
      pagesToDelete: [{ id: "d1", title: "D", slug: "d" }],
      foldersToDelete: [{ id: "fd1", name: "x", slug: "x" }],
    };
    const summary = formatDiffSummary(diff);
    assert.ok(summary.includes("2 folders created"));
    assert.ok(summary.includes("1 page created"));
    assert.ok(summary.includes("1 page updated"));
    assert.ok(summary.includes("1 page deleted"));
    assert.ok(summary.includes("1 folder deleted"));
  });

  it("should handle singular forms", () => {
    const diff: DiffResult = {
      foldersToCreate: [{ path: "a", name: "a", parentPath: "" }],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const summary = formatDiffSummary(diff);
    assert.ok(summary.includes("1 folder created"));
    assert.ok(!summary.includes("folders created"));
  });

  it("should return 'no changes' for empty diff", () => {
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };
    const summary = formatDiffSummary(diff);
    assert.ok(summary.includes("no changes"));
  });
});

// ── formatSummary (ApplyDiffSummary) ────────────────────────────────────────

describe("formatSummary", () => {
  it("should format summary with all change types", () => {
    const summary: ApplyDiffSummary = {
      foldersCreated: 2,
      pagesCreated: 3,
      pagesUpdated: 1,
      pagesDeleted: 1,
      foldersDeleted: 1,
      errors: [],
    };
    const result = formatSummary(summary);
    assert.ok(result.includes("2 folders created"));
    assert.ok(result.includes("3 pages created"));
    assert.ok(result.includes("1 page updated"));
    assert.ok(result.includes("1 page deleted"));
    assert.ok(result.includes("1 folder deleted"));
  });

  it("should handle singular forms", () => {
    const summary: ApplyDiffSummary = {
      foldersCreated: 1,
      pagesCreated: 1,
      pagesUpdated: 0,
      pagesDeleted: 0,
      foldersDeleted: 0,
      errors: [],
    };
    const result = formatSummary(summary);
    assert.ok(result.includes("1 folder created"));
    assert.ok(result.includes("1 page created"));
    assert.ok(!result.includes("pages created"));
  });

  it("should omit zero-count categories", () => {
    const summary: ApplyDiffSummary = {
      foldersCreated: 0,
      pagesCreated: 5,
      pagesUpdated: 0,
      pagesDeleted: 0,
      foldersDeleted: 0,
      errors: [],
    };
    const result = formatSummary(summary);
    assert.ok(result.includes("5 pages created"));
    assert.ok(!result.includes("folder"));
    assert.ok(!result.includes("updated"));
    assert.ok(!result.includes("deleted"));
  });

  it("should return 'no changes' for empty summary", () => {
    const summary: ApplyDiffSummary = {
      foldersCreated: 0,
      pagesCreated: 0,
      pagesUpdated: 0,
      pagesDeleted: 0,
      foldersDeleted: 0,
      errors: [],
    };
    const result = formatSummary(summary);
    assert.ok(result.includes("no changes"));
  });
});

// ── applyDiff ───────────────────────────────────────────────────────────────

describe("applyDiff", () => {
  // Mock client factory
  function createMockClient(handlers: {
    post?: (path: string, body?: unknown) => { data: any };
    delete?: (path: string) => { data: any };
  }) {
    return {
      get: async () => ({ data: {} }),
      post: async <T>(path: string, body?: unknown) =>
        (handlers.post?.(path, body) ?? { data: {} }) as { data: T },
      put: async () => ({ data: {} }),
      patch: async () => ({ data: {} }),
      delete: async <T>(path: string) =>
        (handlers.delete?.(path) ?? { data: {} }) as { data: T },
      config: {
        token: "test",
        orgId: undefined,
        apiBaseUrl: "http://localhost",
      },
    };
  }

  it("should create folders and track returned IDs", async () => {
    const createdFolders: Array<{ path: string; body: any }> = [];
    let folderCounter = 0;

    const client = createMockClient({
      post: (path, body) => {
        if (path.includes("/folders")) {
          folderCounter++;
          createdFolders.push({ path, body });
          return { data: { _id: `new_folder_${folderCounter}` } };
        }
        return {
          data: {
            results: [{ index: 0, action: "create", status: "success", pageId: "p1" }],
            summary: { succeeded: 1, failed: 0 },
          },
        };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [
        { path: "guides", name: "guides", parentPath: "" },
        { path: "guides/advanced", name: "advanced", parentPath: "guides" },
      ],
      pagesToCreate: [
        {
          relativePath: "guides/advanced/deep.mdx",
          folderPath: "guides/advanced",
          filename: "deep.mdx",
          slug: "deep",
          title: "Deep",
          frontmatter: { title: "Deep", slug: "deep" },
          content: "# Deep",
          fullContent: "---\ntitle: Deep\nslug: deep\n---\n\n# Deep",
        },
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiff(client, diff, [], {
      projectId: "proj123",
    });

    assert.equal(summary.foldersCreated, 2);
    assert.equal(summary.pagesCreated, 1);
    assert.equal(createdFolders.length, 2);

    // Second folder should reference first folder's ID as parentId
    assert.equal(createdFolders[0].body.name, "guides");
    assert.equal(createdFolders[1].body.name, "advanced");
    assert.equal(createdFolders[1].body.parentId, "new_folder_1");
  });

  it("should batch bulk operations and tally results", async () => {
    const bulkCalls: Array<{ operations: any[] }> = [];

    const client = createMockClient({
      post: (path, body: any) => {
        if (path.includes("/pages/bulk")) {
          bulkCalls.push(body);
          return {
            data: {
              results: body.operations.map((op: any, i: number) => ({
                index: i,
                action: op.action,
                status: "success",
                pageId: op.pageId ?? `new_${i}`,
              })),
              summary: {
                succeeded: body.operations.length,
                failed: 0,
              },
            },
          };
        }
        return { data: { _id: "f1" } };
      },
    });

    // Create 3 pages, update 2, delete 1
    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: Array.from({ length: 3 }, (_, i) => ({
        relativePath: `page${i}.mdx`,
        folderPath: "",
        filename: `page${i}.mdx`,
        slug: `page${i}`,
        title: `Page ${i}`,
        frontmatter: { title: `Page ${i}` },
        content: `# Page ${i}`,
        fullContent: `# Page ${i}`,
      })),
      pagesToUpdate: Array.from({ length: 2 }, (_, i) => ({
        local: {
          relativePath: `update${i}.mdx`,
          folderPath: "",
          filename: `update${i}.mdx`,
          slug: `update${i}`,
          title: `Update ${i}`,
          frontmatter: { title: `Update ${i}` },
          content: `# Updated ${i}`,
          fullContent: `# Updated ${i}`,
        },
        remote: { id: `rp${i}`, title: `Old ${i}`, slug: `update${i}` },
      })),
      pagesToDelete: [{ id: "del1", title: "Delete Me", slug: "delete-me" }],
      foldersToDelete: [],
    };

    const summary = await applyDiff(client, diff, [], {
      projectId: "proj123",
    });

    assert.equal(summary.pagesCreated, 3);
    assert.equal(summary.pagesUpdated, 2);
    assert.equal(summary.pagesDeleted, 1);
    assert.equal(summary.errors.length, 0);

    // All 6 operations should fit in a single batch (< 50)
    assert.equal(bulkCalls.length, 1);
    assert.equal(bulkCalls[0].operations.length, 6);
  });

  it("should delete folders bottom-up", async () => {
    const deletedFolders: string[] = [];

    const client = createMockClient({
      delete: (path) => {
        deletedFolders.push(path);
        return { data: { success: true } };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [
        { id: "f2", name: "child", slug: "child", parentId: "f1" },
        { id: "f1", name: "parent", slug: "parent" },
      ],
    };

    const summary = await applyDiff(client, diff, [], {
      projectId: "proj123",
    });

    assert.equal(summary.foldersDeleted, 2);
    assert.equal(deletedFolders.length, 2);
    // Child should be deleted first
    assert.ok(deletedFolders[0].includes("f2"));
    assert.ok(deletedFolders[1].includes("f1"));
  });

  it("should set isPublished when --publish is used", async () => {
    let capturedOperations: any[] = [];

    const client = createMockClient({
      post: (path, body: any) => {
        if (path.includes("/pages/bulk")) {
          capturedOperations = body.operations;
          return {
            data: {
              results: body.operations.map((op: any, i: number) => ({
                index: i,
                action: op.action,
                status: "success",
              })),
              summary: { succeeded: body.operations.length, failed: 0 },
            },
          };
        }
        return { data: { _id: "f1" } };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        {
          relativePath: "page.mdx",
          folderPath: "",
          filename: "page.mdx",
          slug: "page",
          title: "Page",
          frontmatter: { title: "Page" },
          content: "# Page",
          fullContent: "# Page",
        },
      ],
      pagesToUpdate: [
        {
          local: {
            relativePath: "existing.mdx",
            folderPath: "",
            filename: "existing.mdx",
            slug: "existing",
            title: "Existing",
            frontmatter: { title: "Existing" },
            content: "# Updated",
            fullContent: "# Updated",
          },
          remote: { id: "rp1", title: "Existing", slug: "existing" },
        },
      ],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiff(client, diff, [], {
      projectId: "proj123",
      publish: true,
    });

    // Create operation should have isPublished: true
    const createOp = capturedOperations.find((op: any) => op.action === "create");
    assert.equal(createOp.isPublished, true);

    // Update operation should also have isPublished: true
    const updateOp = capturedOperations.find((op: any) => op.action === "update");
    assert.equal(updateOp.isPublished, true);
  });

  it("should respect frontmatter isPublished over --publish flag", async () => {
    let capturedOperations: any[] = [];

    const client = createMockClient({
      post: (path, body: any) => {
        if (path.includes("/pages/bulk")) {
          capturedOperations = body.operations;
          return {
            data: {
              results: body.operations.map((op: any, i: number) => ({
                index: i,
                action: op.action,
                status: "success",
              })),
              summary: { succeeded: body.operations.length, failed: 0 },
            },
          };
        }
        return { data: { _id: "f1" } };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        {
          relativePath: "draft.mdx",
          folderPath: "",
          filename: "draft.mdx",
          slug: "draft",
          title: "Draft",
          frontmatter: { title: "Draft", isPublished: false },
          content: "# Draft",
          fullContent: "# Draft",
        },
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiff(client, diff, [], {
      projectId: "proj123",
      publish: true,
    });

    // Frontmatter isPublished: false should win over --publish flag
    const createOp = capturedOperations[0];
    assert.equal(createOp.isPublished, false);
  });

  it("should pass branchId to API calls", async () => {
    let capturedBulkBody: any = {};
    let capturedFolderBody: any = {};

    const client = createMockClient({
      post: (path, body: any) => {
        if (path.includes("/pages/bulk")) {
          capturedBulkBody = body;
          return {
            data: {
              results: [],
              summary: { succeeded: 0, failed: 0 },
            },
          };
        }
        if (path.includes("/folders")) {
          capturedFolderBody = body;
          return { data: { _id: "f1" } };
        }
        return { data: {} };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [{ path: "a", name: "a", parentPath: "" }],
      pagesToCreate: [
        {
          relativePath: "a/page.mdx",
          folderPath: "a",
          filename: "page.mdx",
          slug: "page",
          title: "Page",
          frontmatter: {},
          content: "# Page",
          fullContent: "# Page",
        },
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiff(client, diff, [], {
      projectId: "proj123",
      branchId: "branch_abc",
    });

    assert.equal(capturedFolderBody.branchId, "branch_abc");
    assert.equal(capturedBulkBody.branchId, "branch_abc");
  });

  it("should collect errors without stopping", async () => {
    let callCount = 0;
    const client = createMockClient({
      post: (path) => {
        callCount++;
        if (path.includes("/folders")) {
          throw new Error("Folder creation failed");
        }
        return {
          data: {
            results: [
              { index: 0, action: "create", status: "error", error: "Page failed" },
            ],
            summary: { succeeded: 0, failed: 1 },
          },
        };
      },
    });

    const diff: DiffResult = {
      foldersToCreate: [{ path: "a", name: "a", parentPath: "" }],
      pagesToCreate: [
        {
          relativePath: "page.mdx",
          folderPath: "",
          filename: "page.mdx",
          slug: "page",
          title: "Page",
          frontmatter: {},
          content: "# Page",
          fullContent: "# Page",
        },
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    const summary = await applyDiff(client, diff, [], {
      projectId: "proj123",
    });

    // Should have recorded errors but not thrown
    assert.ok(summary.errors.length >= 2);
    assert.ok(summary.errors[0].includes("Folder creation failed"));
    assert.ok(summary.errors[1].includes("Page failed"));
  });

  it("should use existing remote folder IDs for page folderId assignments", async () => {
    let capturedOperations: any[] = [];

    const client = createMockClient({
      post: (path, body: any) => {
        if (path.includes("/pages/bulk")) {
          capturedOperations = body.operations;
          return {
            data: {
              results: body.operations.map((op: any, i: number) => ({
                index: i,
                action: op.action,
                status: "success",
              })),
              summary: { succeeded: body.operations.length, failed: 0 },
            },
          };
        }
        return { data: { _id: "new_folder" } };
      },
    });

    const remoteFolders: RemoteFolder[] = [
      { id: "existing_folder_1", name: "guides", slug: "guides" },
    ];

    const diff: DiffResult = {
      foldersToCreate: [],
      pagesToCreate: [
        {
          relativePath: "guides/page.mdx",
          folderPath: "guides",
          filename: "page.mdx",
          slug: "page",
          title: "Page",
          frontmatter: {},
          content: "# Page",
          fullContent: "# Page",
        },
      ],
      pagesToUpdate: [],
      pagesToDelete: [],
      foldersToDelete: [],
    };

    await applyDiff(client, diff, remoteFolders, {
      projectId: "proj123",
    });

    // Page should reference the existing remote folder ID
    assert.equal(capturedOperations[0].folderId, "existing_folder_1");
  });
});
