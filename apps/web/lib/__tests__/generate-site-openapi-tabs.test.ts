import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedSpec } from "../openapi/parse-spec";

// Mock parseOpenApiSpec to avoid needing a real OpenAPI spec + SwaggerParser
vi.mock("../openapi/parse-spec", () => ({
  parseOpenApiSpec: vi.fn(),
}));

import { generateSiteFiles } from "../generate-site";
import { parseOpenApiSpec } from "../openapi/parse-spec";

const mockedParseOpenApiSpec = vi.mocked(parseOpenApiSpec);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createParsedSpec(): ParsedSpec {
  return {
    title: "Pet Store",
    version: "1.0.0",
    description: "A sample API for pets",
    servers: [{ url: "https://api.example.com", description: "Production" }],
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer" },
    },
    tagGroups: [
      { tag: "Pets", endpointCount: 2 },
      { tag: "Users", endpointCount: 1 },
    ],
    endpoints: [
      {
        operationId: "listPets",
        method: "GET",
        path: "/pets",
        summary: "List all pets",
        description: "Returns a list of pets.",
        tag: "Pets",
        deprecated: false,
        parameters: [
          {
            name: "limit",
            in: "query",
            type: "integer",
            required: false,
            description: "Max items to return",
          },
        ],
        responses: [
          { statusCode: "200", description: "A list of pets", fields: [] },
        ],
      },
      {
        operationId: "createPet",
        method: "POST",
        path: "/pets",
        summary: "Create a pet",
        description: "Creates a new pet.",
        tag: "Pets",
        deprecated: false,
        parameters: [],
        requestBody: {
          contentType: "application/json",
          fields: [
            {
              name: "name",
              type: "string",
              required: true,
              description: "Pet name",
            },
          ],
        },
        responses: [
          { statusCode: "201", description: "Pet created", fields: [] },
        ],
      },
      {
        operationId: "getUser",
        method: "GET",
        path: "/users/{userId}",
        summary: "Get user by ID",
        description: "Fetches a user.",
        tag: "Users",
        deprecated: false,
        parameters: [
          {
            name: "userId",
            in: "path",
            type: "string",
            required: true,
            description: "User identifier",
          },
        ],
        responses: [
          { statusCode: "200", description: "A user object", fields: [] },
        ],
      },
    ],
  };
}

/** Minimal page content (BlockNote blocks array) */
const emptyContent = JSON.stringify([
  {
    id: "1",
    type: "paragraph",
    content: [{ type: "text", text: "Hello" }],
    children: [],
  },
]);

function makePage(overrides: {
  id?: string;
  title: string;
  slug: string;
  path: string;
  position?: number;
}) {
  return {
    id: overrides.id ?? overrides.slug,
    title: overrides.title,
    slug: overrides.slug,
    path: overrides.path,
    content: emptyContent,
    position: overrides.position ?? 0,
  };
}

function makeFolder(overrides: {
  id?: string;
  name: string;
  slug: string;
  path: string;
  position?: number;
}) {
  return {
    id: overrides.id ?? overrides.slug,
    name: overrides.name,
    slug: overrides.slug,
    path: overrides.path,
    position: overrides.position ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Helper to extract navigation from generated files
// ---------------------------------------------------------------------------

function findFile(
  files: { file: string; data: string }[],
  filename: string
): { file: string; data: string } | undefined {
  return files.find((f) => f.file === filename);
}

function parseJsonFile(
  files: { file: string; data: string }[],
  filename: string
): unknown {
  const f = findFile(files, filename);
  if (!f) throw new Error(`File not found: ${filename}`);
  return JSON.parse(f.data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSiteFiles with tabs + OpenAPI", () => {
  beforeEach(() => {
    mockedParseOpenApiSpec.mockReset();
    mockedParseOpenApiSpec.mockResolvedValue(createParsedSpec());
  });

  it("merges OpenAPI endpoints into existing tab navigation when tabId matches", async () => {
    const pages = [
      makePage({
        id: "page-1",
        title: "Getting Started",
        slug: "getting-started",
        path: "/api-docs/getting-started",
        position: 0,
      }),
    ];

    const folders = [
      makeFolder({
        id: "folder-1",
        name: "API documentation",
        slug: "api-docs",
        path: "/api-docs",
        position: 0,
      }),
    ];

    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-1",
          name: "API Reference",
          slug: "api-reference",
          items: [{ type: "folder", folderId: "folder-1" }],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}', // content doesn't matter, parseOpenApiSpec is mocked
        basePath: "/api-reference",
        tabId: "tab-1",
      },
    });

    const { files } = result;

    // 1. Navigation file for the tab should exist and contain BOTH manual folder nav AND endpoint nav
    const navFile = findFile(files, "lib/navigation-api-reference.json");
    expect(navFile).toBeTruthy();

    const navigation = JSON.parse(navFile!.data);
    // Should have at least 2 top-level items: the manual folder + the API Reference group
    expect(navigation.length).toBeGreaterThanOrEqual(2);

    // The manual folder should be present
    const folderNav = navigation.find(
      (n: { title: string }) => n.title === "API documentation"
    );
    expect(folderNav).toBeTruthy();

    // The API Reference nav group should be present with endpoint children
    const apiNav = navigation.find(
      (n: { title: string }) => n.title === "API Reference"
    );
    expect(apiNav).toBeTruthy();
    expect(apiNav.children).toBeDefined();
    expect(apiNav.children.length).toBeGreaterThan(0);

    // 2. MDX files should be generated for endpoints
    const endpointMdxFiles = files.filter(
      (f) =>
        f.file.startsWith("docs/api-reference/") && f.file.endsWith(".mdx")
    );
    expect(endpointMdxFiles.length).toBeGreaterThan(0);

    // Specific endpoint files
    const petEndpoint = findFile(
      files,
      "docs/api-reference/pets/get-pets.mdx"
    );
    expect(petEndpoint).toBeTruthy();

    const userEndpoint = findFile(
      files,
      "docs/api-reference/users/get-users-userId.mdx"
    );
    expect(userEndpoint).toBeTruthy();

    // 3. api-playground.json should be generated
    const playground = findFile(files, "public/api-playground.json");
    expect(playground).toBeTruthy();
  });

  it("merges OpenAPI endpoints when matching tab by slug (no tabId set)", async () => {
    const pages = [
      makePage({
        id: "page-1",
        title: "Getting Started",
        slug: "getting-started",
        path: "/api-docs/getting-started",
        position: 0,
      }),
    ];

    const folders = [
      makeFolder({
        id: "folder-1",
        name: "API documentation",
        slug: "api-docs",
        path: "/api-docs",
        position: 0,
      }),
    ];

    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-1",
          name: "API Reference",
          slug: "api-reference",
          items: [{ type: "folder", folderId: "folder-1" }],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}',
        basePath: "/api-reference",
        // No tabId — should fall back to slug matching
      },
    });

    const { files } = result;

    const navFile = findFile(files, "lib/navigation-api-reference.json");
    expect(navFile).toBeTruthy();

    const navigation = JSON.parse(navFile!.data);

    // Should have both manual folder nav AND API endpoint nav
    const folderNav = navigation.find(
      (n: { title: string }) => n.title === "API documentation"
    );
    expect(folderNav).toBeTruthy();

    const apiNav = navigation.find(
      (n: { title: string }) => n.title === "API Reference"
    );
    expect(apiNav).toBeTruthy();
    expect(apiNav.children.length).toBeGreaterThan(0);
  });

  it("all-navigation.json tabs entry includes merged OpenAPI endpoints", async () => {
    const pages = [
      makePage({
        id: "page-1",
        title: "Getting Started",
        slug: "getting-started",
        path: "/api-docs/getting-started",
        position: 0,
      }),
    ];

    const folders = [
      makeFolder({
        id: "folder-1",
        name: "API documentation",
        slug: "api-docs",
        path: "/api-docs",
        position: 0,
      }),
    ];

    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-1",
          name: "API Reference",
          slug: "api-reference",
          items: [{ type: "folder", folderId: "folder-1" }],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}',
        basePath: "/api-reference",
        tabId: "tab-1",
      },
    });

    const allNav = parseJsonFile(result.files, "lib/all-navigation.json") as {
      main: unknown[];
      tabs: Record<string, unknown[]>;
    };

    const apiRefTab = allNav.tabs["api-reference"];
    expect(apiRefTab).toBeDefined();
    if (apiRefTab) {
      expect(apiRefTab.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("falls back to slug matching when tabId does not match any tab", async () => {
    const pages = [
      makePage({
        id: "page-1",
        title: "Getting Started",
        slug: "getting-started",
        path: "/api-docs/getting-started",
        position: 0,
      }),
    ];

    const folders = [
      makeFolder({
        id: "folder-1",
        name: "API documentation",
        slug: "api-docs",
        path: "/api-docs",
        position: 0,
      }),
    ];

    // tabId is set to an ID that doesn't exist in the tabs config
    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-1",
          name: "API Reference",
          slug: "api-reference",
          items: [{ type: "folder", folderId: "folder-1" }],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}',
        basePath: "/api-reference",
        tabId: "stale-tab-id-that-no-longer-exists",
      },
    });

    const { files } = result;

    // The navigation for the existing tab should STILL contain API endpoints
    // because slug matching should be used as a fallback
    const navFile = findFile(files, "lib/navigation-api-reference.json");
    expect(navFile).toBeTruthy();

    const navigation = JSON.parse(navFile!.data);

    // Should have both manual folder nav AND API endpoint nav
    const folderNav = navigation.find(
      (n: { title: string }) => n.title === "API documentation"
    );
    expect(folderNav).toBeTruthy();

    const apiNav = navigation.find(
      (n: { title: string }) => n.title === "API Reference"
    );
    expect(apiNav).toBeTruthy();
    expect(apiNav.children.length).toBeGreaterThan(0);

    // Should NOT create a duplicate tab
    const tabsFile = findFile(files, "lib/tabs.json");
    expect(tabsFile).toBeTruthy();
    const tabs = JSON.parse(tabsFile!.data);
    expect(tabs.length).toBe(1); // Only the original tab, no duplicate
  });

  it("tabId match takes precedence over slug match when both are possible", async () => {
    // Two tabs: one matches by slug, one matches by tabId
    // tabId should win
    const pages: ReturnType<typeof makePage>[] = [];
    const folders: ReturnType<typeof makeFolder>[] = [];

    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-guides",
          name: "Guides",
          slug: "guides",
          items: [],
        },
        {
          id: "tab-api",
          name: "API Docs",
          slug: "api-reference",
          items: [],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}',
        basePath: "/api-reference",
        tabId: "tab-guides", // Explicitly assign to Guides tab (not the matching slug tab)
      },
    });

    const { files } = result;

    // API endpoints should be in the Guides tab navigation (matched by tabId)
    const guidesNav = findFile(files, "lib/navigation-guides.json");
    expect(guidesNav).toBeTruthy();
    const guidesNavItems = JSON.parse(guidesNav!.data);
    const apiInGuides = guidesNavItems.find(
      (n: { title: string }) => n.title === "API Reference"
    );
    expect(apiInGuides).toBeTruthy();

    // api-reference tab should NOT contain API endpoints
    const apiRefNav = findFile(files, "lib/navigation-api-reference.json");
    expect(apiRefNav).toBeTruthy();
    const apiRefNavItems = JSON.parse(apiRefNav!.data);
    const apiInApiRef = apiRefNavItems.find(
      (n: { title: string }) => n.title === "API Reference"
    );
    expect(apiInApiRef).toBeUndefined();
  });

  it("endpoint MDX file paths align with navigation hrefs", async () => {
    const pages: ReturnType<typeof makePage>[] = [];
    const folders: ReturnType<typeof makeFolder>[] = [];

    const result = await generateSiteFiles(pages, folders, {
      name: "Test Project",
      navTabs: [
        {
          id: "tab-1",
          name: "API Reference",
          slug: "api-reference",
          items: [],
        },
      ],
      openapi: {
        specContent: '{"openapi":"3.0.0"}',
        basePath: "/api-reference",
        tabId: "tab-1",
      },
    });

    const { files } = result;

    const navFile = findFile(files, "lib/navigation-api-reference.json");
    expect(navFile).toBeTruthy();

    const navigation = JSON.parse(navFile!.data);

    // Collect all endpoint hrefs from navigation
    function collectHrefs(items: { href?: string; children?: unknown[] }[]): string[] {
      const hrefs: string[] = [];
      for (const item of items) {
        if (item.href) hrefs.push(item.href);
        if (item.children) {
          hrefs.push(...collectHrefs(item.children as { href?: string; children?: unknown[] }[]));
        }
      }
      return hrefs;
    }

    const navHrefs = collectHrefs(navigation);

    // For each navigation href, there should be a corresponding MDX file
    for (const href of navHrefs) {
      // hrefs are like /api-reference/pets/get-pets
      // MDX files are at docs/api-reference/pets/get-pets.mdx
      const mdxPath = `docs${href}.mdx`;
      const mdxFile = findFile(files, mdxPath);
      // Tag index pages have their own MDX files too
      if (!mdxFile) {
        // The index page uses a different file naming: docs/api-reference.mdx (no trailing /index)
        const altMdxPath = `docs${href}.mdx`;
        expect(
          findFile(files, altMdxPath) || findFile(files, `docs${href}/index.mdx`)
        ).toBeTruthy();
      }
    }
  });
});
