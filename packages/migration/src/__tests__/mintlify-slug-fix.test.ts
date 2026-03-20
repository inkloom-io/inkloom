/**
 * Tests for the pageRefToSlug fix: slugs should be basenames (last path
 * segment), not full Mintlify page reference paths.
 *
 * Bug: pageRefToSlug("essentials/settings") returned "essentials/settings"
 * instead of "settings". This caused deploy.ts to construct paths like
 * "/customization/essentials/settings" (4 segments) instead of
 * "/customization/settings" (3 segments). The generateNavigationForFolder()
 * direct-child filter then couldn't find these pages, so folders appeared empty.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { migrate } from "../index.js";
import { MigrationSource, type EnrichedMigrationResult } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary Mintlify docs directory with the given docs.json
 * and page files.
 */
function createMintlifyFixture(
  docsJson: Record<string, unknown>,
  pageRefs: string[]
): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "mintlify-slug-test-"));

  // Write docs.json
  writeFileSync(
    join(tmpDir, "docs.json"),
    JSON.stringify(docsJson, null, 2)
  );

  // Create stub MDX files for each page ref
  for (const ref of pageRefs) {
    const filePath = join(tmpDir, `${ref}.mdx`);
    const dir = join(tmpDir, ref.includes("/") ? ref.slice(0, ref.lastIndexOf("/")) : "");
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, `---\ntitle: "${ref.split("/").pop()}"\n---\n\nContent for ${ref}.`);
  }

  return tmpDir;
}

// ---------------------------------------------------------------------------
// Test: pageRefToSlug returns basename slugs
// ---------------------------------------------------------------------------

describe("Mintlify migration: pageRefToSlug basename fix", () => {
  const DOCS_JSON = {
    navigation: {
      tabs: [
        {
          tab: "Guides",
          groups: [
            {
              group: "Getting started",
              pages: ["index", "quickstart", "development"],
            },
            {
              group: "Customization",
              pages: ["essentials/settings", "essentials/navigation"],
            },
            {
              group: "Writing content",
              pages: [
                "essentials/markdown",
                "essentials/code",
                "essentials/images",
                "essentials/reusable-snippets",
              ],
            },
            {
              group: "AI tools",
              pages: [
                "ai-tools/cursor",
                "ai-tools/claude-code",
                "ai-tools/windsurf",
              ],
            },
          ],
        },
        {
          tab: "API reference",
          groups: [
            {
              group: "API documentation",
              pages: ["api-reference/introduction"],
            },
            {
              group: "Endpoint examples",
              pages: [
                "api-reference/endpoint/get",
                "api-reference/endpoint/create",
                "api-reference/endpoint/delete",
                "api-reference/endpoint/webhook",
              ],
            },
          ],
        },
      ],
    },
  };

  const ALL_PAGE_REFS = [
    "index",
    "quickstart",
    "development",
    "essentials/settings",
    "essentials/navigation",
    "essentials/markdown",
    "essentials/code",
    "essentials/images",
    "essentials/reusable-snippets",
    "ai-tools/cursor",
    "ai-tools/claude-code",
    "ai-tools/windsurf",
    "api-reference/introduction",
    "api-reference/endpoint/get",
    "api-reference/endpoint/create",
    "api-reference/endpoint/delete",
    "api-reference/endpoint/webhook",
  ];

  let result: EnrichedMigrationResult;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = createMintlifyFixture(DOCS_JSON, ALL_PAGE_REFS);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: new Headers({ "content-type": "image/png" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    result = await migrate({
      source: MigrationSource.Mintlify,
      dirPath: tmpDir,
      projectName: "Slug Fix Test",
    });
  });

  it("should produce basename slugs, not full path slugs", () => {
    const slugs = result.pages.map((p) => p.slug);

    // These should be basenames only
    expect(slugs).toContain("settings");
    expect(slugs).toContain("navigation");
    expect(slugs).toContain("markdown");
    expect(slugs).toContain("code");
    expect(slugs).toContain("cursor");
    expect(slugs).toContain("claude-code");
    expect(slugs).toContain("introduction");
    expect(slugs).toContain("get");
    expect(slugs).toContain("create");
    expect(slugs).toContain("delete");
    expect(slugs).toContain("webhook");

    // These MUST NOT be full-path slugs
    expect(slugs).not.toContain("essentials/settings");
    expect(slugs).not.toContain("essentials/navigation");
    expect(slugs).not.toContain("ai-tools/cursor");
    expect(slugs).not.toContain("api-reference/introduction");
    expect(slugs).not.toContain("api-reference/endpoint/get");
  });

  it("should not produce multi-segment slugs", () => {
    for (const page of result.pages) {
      expect(page.slug).not.toContain("/");
    }
  });

  it("should assign pages to the correct folders", () => {
    const settingsPage = result.pages.find((p) => p.slug === "settings");
    expect(settingsPage).toBeDefined();
    if (settingsPage) {
      expect(settingsPage.folderPath).toBeTruthy();
    }

    const cursorPage = result.pages.find((p) => p.slug === "cursor");
    expect(cursorPage).toBeDefined();
    if (cursorPage) {
      expect(cursorPage.folderPath).toBeTruthy();
    }
  });

  it("should handle flat page refs unchanged", () => {
    const slugs = result.pages.map((p) => p.slug);
    expect(slugs).toContain("index");
    expect(slugs).toContain("quickstart");
    expect(slugs).toContain("development");
  });

  it("should deduplicate slug collisions within the same folder", async () => {
    // Create a fixture where two page refs have the same basename in the same folder
    const collisionDocsJson = {
      navigation: [
        {
          group: "Test Group",
          pages: ["subdir-a/intro", "subdir-b/intro"],
        },
      ],
    };
    const collisionPageRefs = ["subdir-a/intro", "subdir-b/intro"];
    const collisionDir = createMintlifyFixture(
      collisionDocsJson,
      collisionPageRefs
    );

    const collisionResult = await migrate({
      source: MigrationSource.Mintlify,
      dirPath: collisionDir,
      projectName: "Collision Test",
    });

    const slugs = collisionResult.pages.map((p) => p.slug);
    // First should be "intro", second should be "intro-1"
    expect(slugs).toContain("intro");
    expect(slugs).toContain("intro-1");

    rmSync(collisionDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Integration test: migration → generateSiteFiles → verify nav structure
// ---------------------------------------------------------------------------

describe("Mintlify migration → navigation generation integration", () => {
  it("should produce pages with correct single-segment slugs for generate-site", async () => {
    const docsJson = {
      navigation: {
        tabs: [
          {
            tab: "Guides",
            groups: [
              {
                group: "Getting started",
                pages: ["index", "quickstart"],
              },
              {
                group: "Customization",
                pages: ["essentials/settings", "essentials/navigation"],
              },
            ],
          },
          {
            tab: "API reference",
            groups: [
              {
                group: "API documentation",
                pages: ["api-reference/introduction"],
              },
            ],
          },
        ],
      },
    };

    const pageRefs = [
      "index",
      "quickstart",
      "essentials/settings",
      "essentials/navigation",
      "api-reference/introduction",
    ];

    const tmpDir = createMintlifyFixture(docsJson, pageRefs);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: new Headers({ "content-type": "image/png" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await migrate({
      source: MigrationSource.Mintlify,
      dirPath: tmpDir,
      projectName: "Nav Integration Test",
    });

    // Verify all slugs are single-segment (basenames)
    for (const page of result.pages) {
      expect(page.slug).not.toContain("/");
    }

    // Verify that when we simulate deploy.ts path recomputation,
    // the paths have the correct number of segments
    for (const page of result.pages) {
      if (page.folderPath) {
        const recomputedPath = `/${page.folderPath}/${page.slug}`;
        const segments = recomputedPath.split("/").filter(Boolean);
        // Should be exactly 2 segments: folder + page basename
        expect(segments.length).toBe(2);
      }
    }

    // Verify the "settings" and "navigation" pages exist with correct slugs
    expect(result.pages.find((p) => p.slug === "settings")).toBeDefined();
    expect(result.pages.find((p) => p.slug === "navigation")).toBeDefined();
    expect(result.pages.find((p) => p.slug === "introduction")).toBeDefined();

    // Verify no full-path slugs leaked through
    expect(
      result.pages.find((p) => p.slug === "essentials/settings")
    ).toBeUndefined();
    expect(
      result.pages.find((p) => p.slug === "api-reference/introduction")
    ).toBeUndefined();

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
