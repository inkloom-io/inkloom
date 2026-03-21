import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  readDocsConfig,
  parseDocsConfig,
  resolveNavTabs,
  resolvePagePositions,
} from "../docs-config.js";

// ── readDocsConfig ──────────────────────────────────────────────────────────

describe("readDocsConfig", () => {
  it("returns null for directory without docs.json", () => {
    const result = readDocsConfig("/tmp/nonexistent-dir-" + Date.now());
    expect(result).toBeNull();
  });

  it("returns parsed config when docs.json exists", () => {
    const dir = fs.mkdtempSync(path.join("/tmp", "docs-config-test-"));
    const config = {
      tabs: [
        {
          name: "Guides",
          slug: "guides",
          groups: [
            { group: "Getting Started", folder: "getting-started" },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(dir, "docs.json"), JSON.stringify(config));

    const result = readDocsConfig(dir);

    expect(result).not.toBeNull();
    expect(result?.tabs).toHaveLength(1);
    expect(result?.tabs[0].name).toBe("Guides");
    expect(result?.tabs[0].slug).toBe("guides");
    expect(result?.tabs[0].groups[0].group).toBe("Getting Started");
    expect(result?.tabs[0].groups[0].folder).toBe("getting-started");

    // Cleanup
    fs.rmSync(dir, { recursive: true });
  });
});

// ── parseDocsConfig ─────────────────────────────────────────────────────────

describe("parseDocsConfig", () => {
  it("parses valid config with tabs, groups, and openapi", () => {
    const input = JSON.stringify({
      name: "My Docs",
      openapi: "./openapi.yaml",
      tabs: [
        {
          name: "API Reference",
          slug: "api",
          icon: "code",
          groups: [
            {
              group: "Endpoints",
              folder: "endpoints",
              pages: ["auth", "users"],
            },
          ],
        },
      ],
    });

    const result = parseDocsConfig(input);

    expect(result.name).toBe("My Docs");
    expect(result.openapi).toBe("./openapi.yaml");
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].name).toBe("API Reference");
    expect(result.tabs[0].slug).toBe("api");
    expect(result.tabs[0].icon).toBe("code");
    expect(result.tabs[0].groups[0].group).toBe("Endpoints");
    expect(result.tabs[0].groups[0].folder).toBe("endpoints");
    expect(result.tabs[0].groups[0].pages).toEqual(["auth", "users"]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDocsConfig("{not valid json")).toThrow(
      "docs.json contains invalid JSON",
    );
  });

  it("throws when tabs array is missing", () => {
    expect(() => parseDocsConfig(JSON.stringify({ name: "test" }))).toThrow(
      'docs.json is missing required "tabs" array',
    );
  });

  it("throws when tab is missing name", () => {
    const input = JSON.stringify({
      tabs: [{ slug: "api", groups: [] }],
    });
    expect(() => parseDocsConfig(input)).toThrow(
      'tabs[0] is missing required "name" field',
    );
  });

  it("throws when tab is missing slug", () => {
    const input = JSON.stringify({
      tabs: [{ name: "API", groups: [] }],
    });
    expect(() => parseDocsConfig(input)).toThrow(
      'tabs[0] is missing required "slug" field',
    );
  });

  it("accepts tabs without icon (optional)", () => {
    const input = JSON.stringify({
      tabs: [
        {
          name: "Guides",
          slug: "guides",
          groups: [{ group: "Intro", folder: "intro" }],
        },
      ],
    });

    const result = parseDocsConfig(input);
    expect(result.tabs[0].icon).toBeUndefined();
  });

  it("accepts groups without pages (optional)", () => {
    const input = JSON.stringify({
      tabs: [
        {
          name: "Guides",
          slug: "guides",
          groups: [{ group: "All Docs", folder: "all-docs" }],
        },
      ],
    });

    const result = parseDocsConfig(input);
    expect(result.tabs[0].groups[0].pages).toBeUndefined();
  });
});

// ── resolveNavTabs ──────────────────────────────────────────────────────────

describe("resolveNavTabs", () => {
  const sampleConfig = parseDocsConfig(
    JSON.stringify({
      tabs: [
        {
          name: "Guides",
          slug: "guides",
          icon: "book",
          groups: [
            { group: "Getting Started", folder: "getting-started" },
            { group: "Advanced", folder: "advanced" },
          ],
        },
      ],
    }),
  );

  it("maps folder slugs to remote folder IDs", () => {
    const remoteFolders = [
      { id: "f1", slug: "getting-started" },
      { id: "f2", slug: "advanced" },
    ];

    const result = resolveNavTabs(sampleConfig, remoteFolders, []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Guides");
    expect(result[0].slug).toBe("guides");
    expect(result[0].icon).toBe("book");
    expect(result[0].items).toEqual([
      { type: "folder", folderId: "f1" },
      { type: "folder", folderId: "f2" },
    ]);
  });

  it("warns on stderr and skips unmatched folder slugs", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const remoteFolders = [{ id: "f1", slug: "getting-started" }];
    const result = resolveNavTabs(sampleConfig, remoteFolders, []);

    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].folderId).toBe("f1");

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('folder slug "advanced"'),
    );

    stderrSpy.mockRestore();
  });

  it("generates unique IDs for each tab", () => {
    const multiTabConfig = parseDocsConfig(
      JSON.stringify({
        tabs: [
          {
            name: "Tab A",
            slug: "tab-a",
            groups: [{ group: "G", folder: "g" }],
          },
          {
            name: "Tab B",
            slug: "tab-b",
            groups: [{ group: "G", folder: "g" }],
          },
        ],
      }),
    );

    const remoteFolders = [{ id: "f1", slug: "g" }];
    const result = resolveNavTabs(multiTabConfig, remoteFolders, []);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBeTruthy();
    expect(result[1].id).toBeTruthy();
    expect(result[0].id).not.toBe(result[1].id);
  });
});

// ── resolvePagePositions ────────────────────────────────────────────────────

describe("resolvePagePositions", () => {
  it("returns correct position map from config ordering", () => {
    const config = parseDocsConfig(
      JSON.stringify({
        tabs: [
          {
            name: "Guides",
            slug: "guides",
            groups: [
              {
                group: "Getting Started",
                folder: "getting-started",
                pages: ["introduction", "quickstart", "installation"],
              },
              {
                group: "Advanced",
                folder: "advanced",
                pages: ["plugins", "themes"],
              },
            ],
          },
        ],
      }),
    );

    const positions = resolvePagePositions(config);

    expect(positions.get("getting-started/introduction")).toBe(0);
    expect(positions.get("getting-started/quickstart")).toBe(1);
    expect(positions.get("getting-started/installation")).toBe(2);
    expect(positions.get("advanced/plugins")).toBe(0);
    expect(positions.get("advanced/themes")).toBe(1);
  });

  it("returns empty map when no pages arrays exist", () => {
    const config = parseDocsConfig(
      JSON.stringify({
        tabs: [
          {
            name: "Guides",
            slug: "guides",
            groups: [
              { group: "All Docs", folder: "all-docs" },
            ],
          },
        ],
      }),
    );

    const positions = resolvePagePositions(config);
    expect(positions.size).toBe(0);
  });
});
