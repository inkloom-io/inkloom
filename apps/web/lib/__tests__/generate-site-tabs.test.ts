import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock heavy dependencies that aren't relevant to navigation generation
// ---------------------------------------------------------------------------

vi.mock("../blocknote-to-mdx", () => ({
  blockNoteToMDX: vi.fn(() => "# Mock MDX"),
  parseBlockNoteContent: vi.fn(() => []),
}));

vi.mock("../search/extract-text", () => ({
  extractSearchableText: vi.fn(() => "searchable text"),
  parseBlockNoteContent: vi.fn(() => []),
}));

vi.mock("../openapi/parse-spec", () => ({
  parseOpenApiSpec: vi.fn(),
}));

vi.mock("../openapi/generate-api-mdx", () => ({
  generateApiReferenceMdx: vi.fn(),
  generatePlaygroundData: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { generateSiteFiles, buildSiteData } from "../generate-site";

// ---------------------------------------------------------------------------
// Helper: minimal BlockNote content that parseBlockNoteContent accepts
// ---------------------------------------------------------------------------
const EMPTY_CONTENT = JSON.stringify([
  { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
]);

// ---------------------------------------------------------------------------
// Tests: multi-folder tab navigation
// ---------------------------------------------------------------------------

describe("generateSiteFiles – multi-folder tab navigation", () => {
  /**
   * Acceptance criteria #1:
   * When a tab has multiple folders (each containing pages), the generated
   * navigation-{slug}.json must contain multiple top-level folder items,
   * each with a non-empty children array.
   */
  it("should generate correct navigation for a tab with multiple folders", async () => {
    const pages = [
      // Getting Started folder pages
      {
        id: "p1",
        title: "Quick Start",
        slug: "quick-start",
        path: "/getting-started/quick-start",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p2",
        title: "Installation",
        slug: "installation",
        path: "/getting-started/installation",
        content: EMPTY_CONTENT,
        position: 1,
      },
      {
        id: "p3",
        title: "First Project",
        slug: "first-project",
        path: "/getting-started/first-project",
        content: EMPTY_CONTENT,
        position: 2,
      },
      // Customization folder pages
      {
        id: "p4",
        title: "Themes",
        slug: "themes",
        path: "/customization/themes",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p5",
        title: "Branding",
        slug: "branding",
        path: "/customization/branding",
        content: EMPTY_CONTENT,
        position: 1,
      },
      // Writing Content folder pages
      {
        id: "p6",
        title: "Markdown Basics",
        slug: "markdown-basics",
        path: "/writing-content/markdown-basics",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p7",
        title: "MDX Components",
        slug: "mdx-components",
        path: "/writing-content/mdx-components",
        content: EMPTY_CONTENT,
        position: 1,
      },
      {
        id: "p8",
        title: "Code Blocks",
        slug: "code-blocks",
        path: "/writing-content/code-blocks",
        content: EMPTY_CONTENT,
        position: 2,
      },
      {
        id: "p9",
        title: "Images",
        slug: "images",
        path: "/writing-content/images",
        content: EMPTY_CONTENT,
        position: 3,
      },
      // AI Tools folder pages
      {
        id: "p10",
        title: "AI Generation",
        slug: "ai-generation",
        path: "/ai-tools/ai-generation",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p11",
        title: "AI Review",
        slug: "ai-review",
        path: "/ai-tools/ai-review",
        content: EMPTY_CONTENT,
        position: 1,
      },
      {
        id: "p12",
        title: "AI Translation",
        slug: "ai-translation",
        path: "/ai-tools/ai-translation",
        content: EMPTY_CONTENT,
        position: 2,
      },
    ];

    const folders = [
      {
        id: "f1",
        name: "Getting Started",
        slug: "getting-started",
        path: "/getting-started",
        position: 0,
      },
      {
        id: "f2",
        name: "Customization",
        slug: "customization",
        path: "/customization",
        position: 1,
      },
      {
        id: "f3",
        name: "Writing Content",
        slug: "writing-content",
        path: "/writing-content",
        position: 2,
      },
      {
        id: "f4",
        name: "AI Tools",
        slug: "ai-tools",
        path: "/ai-tools",
        position: 3,
      },
    ];

    const config = {
      name: "Test Docs",
      navTabs: [
        {
          id: "tab1",
          name: "Guides",
          slug: "guides",
          items: [
            { type: "folder" as const, folderId: "f1" },
            { type: "folder" as const, folderId: "f2" },
            { type: "folder" as const, folderId: "f3" },
            { type: "folder" as const, folderId: "f4" },
          ],
        },
      ],
    };

    const result = await generateSiteFiles(pages, folders, config);

    // Find the navigation file for the "guides" tab
    const navFile = result.files.find(
      (f) => f.file === "lib/navigation-guides.json"
    );
    expect(navFile).toBeDefined();
    if (!navFile) throw new Error("Expected navigation file to exist");

    const navigation = JSON.parse(navFile.data);

    // Should have 4 top-level items (one per folder)
    expect(navigation).toHaveLength(4);

    // Each top-level item should be a folder with children
    expect(navigation[0].title).toBe("Getting Started");
    expect(navigation[0].children).toBeDefined();
    expect(navigation[0].children).toHaveLength(3);
    expect(navigation[0].href).toBe("/guides/getting-started");

    expect(navigation[1].title).toBe("Customization");
    expect(navigation[1].children).toBeDefined();
    expect(navigation[1].children).toHaveLength(2);
    expect(navigation[1].href).toBe("/guides/customization");

    expect(navigation[2].title).toBe("Writing Content");
    expect(navigation[2].children).toBeDefined();
    expect(navigation[2].children).toHaveLength(4);
    expect(navigation[2].href).toBe("/guides/writing-content");

    expect(navigation[3].title).toBe("AI Tools");
    expect(navigation[3].children).toBeDefined();
    expect(navigation[3].children).toHaveLength(3);
    expect(navigation[3].href).toBe("/guides/ai-tools");
  });

  /**
   * Verify that folder section headers link to the first child page
   * (the sidebar component does this, but the navigation data should
   * support it by having the folder href set correctly).
   */
  it("should set folder href with correct path prefix", async () => {
    const pages = [
      {
        id: "p1",
        title: "Page A",
        slug: "page-a",
        path: "/folder-a/page-a",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p2",
        title: "Page B",
        slug: "page-b",
        path: "/folder-b/page-b",
        content: EMPTY_CONTENT,
        position: 0,
      },
    ];

    const folders = [
      {
        id: "fa",
        name: "Folder A",
        slug: "folder-a",
        path: "/folder-a",
        position: 0,
      },
      {
        id: "fb",
        name: "Folder B",
        slug: "folder-b",
        path: "/folder-b",
        position: 1,
      },
    ];

    const config = {
      name: "Test Docs",
      navTabs: [
        {
          id: "tab1",
          name: "Docs",
          slug: "docs",
          items: [
            { type: "folder" as const, folderId: "fa" },
            { type: "folder" as const, folderId: "fb" },
          ],
        },
      ],
    };

    const result = await generateSiteFiles(pages, folders, config);
    const navFile = result.files.find(
      (f) => f.file === "lib/navigation-docs.json"
    );
    if (!navFile) throw new Error("Expected navigation file to exist");
    const navigation = JSON.parse(navFile.data);

    // Both folders should be top-level items with children
    expect(navigation).toHaveLength(2);

    // Children should have rewritten paths under the tab + folder prefix
    expect(navigation[0].children[0].href).toBe("/docs/folder-a/page-a");
    expect(navigation[1].children[0].href).toBe("/docs/folder-b/page-b");
  });

  /**
   * Verify the full pipeline: generateSiteFiles → tabs JSON → navigation JSON
   * → buildSiteData round-trip preserves multi-folder navigation structure.
   * This simulates the deploy.ts assembly logic.
   */
  it("should survive the full buildSiteData round-trip", async () => {
    const pages = [
      {
        id: "p1",
        title: "Page A",
        slug: "page-a",
        path: "/folder-a/page-a",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p2",
        title: "Page B",
        slug: "page-b",
        path: "/folder-b/page-b",
        content: EMPTY_CONTENT,
        position: 0,
      },
    ];

    const folders = [
      {
        id: "fa",
        name: "Folder A",
        slug: "folder-a",
        path: "/folder-a",
        position: 0,
      },
      {
        id: "fb",
        name: "Folder B",
        slug: "folder-b",
        path: "/folder-b",
        position: 1,
      },
    ];

    const config = {
      name: "Test Docs",
      navTabs: [
        {
          id: "tab1",
          name: "Docs",
          slug: "docs",
          items: [
            { type: "folder" as const, folderId: "fa" },
            { type: "folder" as const, folderId: "fb" },
          ],
        },
      ],
    };

    const result = await generateSiteFiles(pages, folders, config);

    // Simulate deploy.ts assembly: parse tabs and tab navigations from generated files
    const tabsFile = result.files.find((f) => f.file === "lib/tabs.json");
    const tabsConfig: { id: string; name: string; slug: string; icon?: string }[] =
      tabsFile ? JSON.parse(tabsFile.data) : [];

    const navFile = result.files.find((f) => f.file === "lib/navigation.json");
    const navigation = navFile ? JSON.parse(navFile.data) : [];

    const tabNavigations = tabsConfig.map((tab) => {
      const tabNavFile = result.files.find(
        (f) => f.file === `lib/navigation-${tab.slug}.json`
      );
      return {
        ...tab,
        navigation: tabNavFile ? JSON.parse(tabNavFile.data) : [],
      };
    });

    // Build siteData like deploy.ts does
    const siteData = buildSiteData(
      { name: "Test Docs" },
      navigation,
      tabNavigations
    );

    // Simulate JSON serialization round-trip (HTML embedding + parsing)
    const serialized = JSON.stringify(siteData);
    const parsed = JSON.parse(serialized) as {
      config: unknown;
      navigation: unknown[];
      tabs: { id: string; name: string; slug: string; navigation: { title: string; href: string; children?: unknown[] }[] }[];
    };

    // Verify tabs survive round-trip
    expect(parsed.tabs).toHaveLength(1);
    const tab0 = parsed.tabs[0];
    if (!tab0) throw new Error("Expected tab0 to exist");
    expect(tab0.slug).toBe("docs");
    expect(tab0.navigation).toHaveLength(2);

    // Both folders should have children arrays
    const docsNav = tab0.navigation;
    const nav0 = docsNav[0];
    const nav1 = docsNav[1];
    if (!nav0 || !nav1) throw new Error("Expected both nav items to exist");
    expect(nav0.title).toBe("Folder A");
    expect(nav0.children).toBeDefined();
    expect(nav0.children).toHaveLength(1);
    expect(nav1.title).toBe("Folder B");
    expect(nav1.children).toBeDefined();
    expect(nav1.children).toHaveLength(1);

    // Main navigation should be empty when tabs exist
    expect(parsed.navigation).toEqual([]);
  });

  /**
   * Verify that folders with no matching pages still appear in navigation
   * but with empty children (defensive handling).
   */
  it("should handle folders with no matching pages gracefully", async () => {
    const pages = [
      {
        id: "p1",
        title: "Page A",
        slug: "page-a",
        path: "/folder-a/page-a",
        content: EMPTY_CONTENT,
        position: 0,
      },
      // Note: no pages under folder-b
    ];

    const folders = [
      {
        id: "fa",
        name: "Folder A",
        slug: "folder-a",
        path: "/folder-a",
        position: 0,
      },
      {
        id: "fb",
        name: "Folder B",
        slug: "folder-b",
        path: "/folder-b",
        position: 1,
      },
    ];

    const config = {
      name: "Test Docs",
      navTabs: [
        {
          id: "tab1",
          name: "Docs",
          slug: "docs",
          items: [
            { type: "folder" as const, folderId: "fa" },
            { type: "folder" as const, folderId: "fb" },
          ],
        },
      ],
    };

    const result = await generateSiteFiles(pages, folders, config);
    const navFile = result.files.find(
      (f) => f.file === "lib/navigation-docs.json"
    );
    if (!navFile) throw new Error("Expected navigation file to exist");
    const navigation = JSON.parse(navFile.data);

    // Folder A should have 1 child
    expect(navigation[0].title).toBe("Folder A");
    expect(navigation[0].children).toHaveLength(1);

    // Folder B should be excluded (no children = not useful in sidebar)
    // After fix: empty folders should be omitted from the navigation
    expect(navigation).toHaveLength(1);
  });

  /**
   * Verify multiple tabs each with multiple folders work correctly.
   */
  it("should handle multiple tabs with multiple folders each", async () => {
    const pages = [
      {
        id: "p1",
        title: "Guide Page",
        slug: "guide-page",
        path: "/guides-folder/guide-page",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p2",
        title: "Tutorial Page",
        slug: "tutorial-page",
        path: "/tutorials-folder/tutorial-page",
        content: EMPTY_CONTENT,
        position: 0,
      },
      {
        id: "p3",
        title: "Ref Page",
        slug: "ref-page",
        path: "/ref-folder/ref-page",
        content: EMPTY_CONTENT,
        position: 0,
      },
    ];

    const folders = [
      {
        id: "fg",
        name: "Guides Folder",
        slug: "guides-folder",
        path: "/guides-folder",
        position: 0,
      },
      {
        id: "ft",
        name: "Tutorials Folder",
        slug: "tutorials-folder",
        path: "/tutorials-folder",
        position: 1,
      },
      {
        id: "fr",
        name: "Reference Folder",
        slug: "ref-folder",
        path: "/ref-folder",
        position: 0,
      },
    ];

    const config = {
      name: "Test Docs",
      navTabs: [
        {
          id: "tab1",
          name: "Learn",
          slug: "learn",
          items: [
            { type: "folder" as const, folderId: "fg" },
            { type: "folder" as const, folderId: "ft" },
          ],
        },
        {
          id: "tab2",
          name: "Reference",
          slug: "reference",
          items: [
            { type: "folder" as const, folderId: "fr" },
          ],
        },
      ],
    };

    const result = await generateSiteFiles(pages, folders, config);

    // Check "learn" tab
    const learnNav = result.files.find(
      (f) => f.file === "lib/navigation-learn.json"
    );
    expect(learnNav).toBeDefined();
    if (!learnNav) throw new Error("Expected learn nav file to exist");
    const learnNavigation = JSON.parse(learnNav.data);
    expect(learnNavigation).toHaveLength(2);
    expect(learnNavigation[0].title).toBe("Guides Folder");
    expect(learnNavigation[0].children).toHaveLength(1);
    expect(learnNavigation[1].title).toBe("Tutorials Folder");
    expect(learnNavigation[1].children).toHaveLength(1);

    // Check "reference" tab
    const refNav = result.files.find(
      (f) => f.file === "lib/navigation-reference.json"
    );
    expect(refNav).toBeDefined();
    if (!refNav) throw new Error("Expected ref nav file to exist");
    const refNavigation = JSON.parse(refNav.data);
    expect(refNavigation).toHaveLength(1);
    expect(refNavigation[0].title).toBe("Reference Folder");
    expect(refNavigation[0].children).toHaveLength(1);
  });
});
