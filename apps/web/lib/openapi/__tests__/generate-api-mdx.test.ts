import { describe, it, expect } from "vitest";

import { generateApiReferenceMdx } from "../generate-api-mdx";
import type { ParsedSpec } from "../parse-spec";

// ---------------------------------------------------------------------------
// Minimal fixture: 3 endpoints across 2 tags
// ---------------------------------------------------------------------------

function createFixtureSpec(): ParsedSpec {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateApiReferenceMdx", () => {
  // -----------------------------------------------------------------------
  // Default basePath (/api-reference)
  // -----------------------------------------------------------------------
  describe("with default basePath", () => {
    const spec = createFixtureSpec();
    const { files, navigation, searchDocuments } =
      generateApiReferenceMdx(spec);

    // -- Navigation hrefs --------------------------------------------------

    it("navigation hrefs start with /api-reference/ and never /docs/api-reference/", () => {
      const allHrefs = collectNavHrefs(navigation);
      expect(allHrefs.length).toBeGreaterThan(0);

      for (const href of allHrefs) {
        expect(href).not.toMatch(/^\/docs\//);
        expect(href).toMatch(/^\/api-reference(\/|$)/);
      }
    });

    // -- Search document paths ---------------------------------------------

    it("search document paths never contain /docs/ prefix", () => {
      expect(searchDocuments.length).toBeGreaterThan(0);

      for (const doc of searchDocuments) {
        expect(doc.path).not.toMatch(/^\/docs\//);
        expect(doc.path).toMatch(/^\/api-reference(\/|$)/);
        expect(doc.id).not.toMatch(/^\/docs\//);
      }
    });

    // -- Index page file path ----------------------------------------------

    it("overview page file is docs/api-reference.mdx, not docs/api-reference/index.mdx", () => {
      const indexFile = files.find(
        (f) => f.file === "docs/api-reference.mdx"
      );
      const wrongIndexFile = files.find(
        (f) => f.file === "docs/api-reference/index.mdx"
      );

      expect(indexFile).toBeTruthy();
      expect(wrongIndexFile).toBeUndefined();
    });

    // -- Card hrefs in MDX content -----------------------------------------

    it("Card hrefs in generated MDX do not contain /docs/ prefix and include basePath", () => {
      for (const f of files) {
        if (!f.file.endsWith(".mdx")) continue;

        const hrefMatches = [...f.data.matchAll(/href="([^"]+)"/g)];
        for (const match of hrefMatches) {
          const href = match[1];
          expect(href).not.toMatch(/^\/docs\//);
          expect(href).toMatch(/^\/api-reference(\/|$)/);
        }
      }
    });

    // -- File structure sanity ---------------------------------------------

    it("generates expected file paths for endpoints and tags", () => {
      const filePaths = files.map((f) => f.file);

      // Overview page
      expect(filePaths).toContain("docs/api-reference.mdx");

      // Tag index pages
      expect(filePaths).toContain("docs/api-reference/pets.mdx");
      expect(filePaths).toContain("docs/api-reference/users.mdx");

      // Endpoint pages
      expect(filePaths).toContain("docs/api-reference/pets/get-pets.mdx");
      expect(filePaths).toContain("docs/api-reference/pets/post-pets.mdx");
      expect(filePaths).toContain(
        "docs/api-reference/users/get-users-userId.mdx"
      );

      // Meta files
      expect(filePaths).toContain("docs/api-reference/_meta.json");
      expect(filePaths).toContain("docs/api-reference/pets/_meta.json");
      expect(filePaths).toContain("docs/api-reference/users/_meta.json");
    });
  });

  // -----------------------------------------------------------------------
  // Custom basePath (/reference)
  // -----------------------------------------------------------------------
  describe("with custom basePath /reference", () => {
    const spec = createFixtureSpec();
    const { files, navigation, searchDocuments } =
      generateApiReferenceMdx(spec, "/reference");

    it("navigation hrefs use /reference/ prefix, not /docs/ or /api-reference/", () => {
      const allHrefs = collectNavHrefs(navigation);
      expect(allHrefs.length).toBeGreaterThan(0);

      for (const href of allHrefs) {
        expect(href).not.toMatch(/^\/docs\//);
        expect(href).not.toMatch(/^\/api-reference(\/|$)/);
        expect(href).toMatch(/^\/reference(\/|$)/);
      }
    });

    it("search document paths use /reference/ prefix", () => {
      for (const doc of searchDocuments) {
        expect(doc.path).not.toMatch(/^\/docs\//);
        expect(doc.path).toMatch(/^\/reference(\/|$)/);
      }
    });

    it("overview page file is docs/reference.mdx", () => {
      const indexFile = files.find((f) => f.file === "docs/reference.mdx");
      const wrongIndexFile = files.find(
        (f) => f.file === "docs/reference/index.mdx"
      );

      expect(indexFile).toBeTruthy();
      expect(wrongIndexFile).toBeUndefined();
    });

    it("Card hrefs in MDX use /reference/ prefix", () => {
      for (const f of files) {
        if (!f.file.endsWith(".mdx")) continue;

        const hrefMatches = [...f.data.matchAll(/href="([^"]+)"/g)];
        for (const match of hrefMatches) {
          const href = match[1];
          expect(href).not.toMatch(/^\/docs\//);
          expect(href).toMatch(/^\/reference(\/|$)/);
        }
      }
    });

    it("file paths use docs/reference/ prefix", () => {
      const filePaths = files.map((f) => f.file);

      expect(filePaths).toContain("docs/reference.mdx");
      expect(filePaths).toContain("docs/reference/pets.mdx");
      expect(filePaths).toContain("docs/reference/pets/get-pets.mdx");
      expect(filePaths).toContain("docs/reference/_meta.json");
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all hrefs from a navigation tree. */
function collectNavHrefs(items: { href: string; children?: { href: string; children?: unknown[] }[] }[]): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    hrefs.push(item.href);
    if (item.children) {
      hrefs.push(
        ...collectNavHrefs(
          item.children as { href: string; children?: { href: string; children?: unknown[] }[] }[]
        )
      );
    }
  }
  return hrefs;
}
