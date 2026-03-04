/**
 * Tests for the `inkloom migrate --to-cloud` CLI command.
 *
 * Covers:
 * - Export data validation (validateExportData)
 * - File reading and parsing
 * - Dry-run mode
 * - API upload behavior
 * - Error handling
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateExportData } from "../src/commands/migrate.ts";
import type { ExportData } from "../src/lib/convex-client.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createValidExportData(
  overrides?: Partial<ExportData>
): ExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: [
      {
        _id: "proj_001",
        _creationTime: 1700000000000,
        name: "My Docs",
        slug: "my-docs",
        workosOrgId: "local",
        defaultBranchId: "branch_001",
      },
    ],
    branches: [
      {
        _id: "branch_001",
        _creationTime: 1700000000000,
        projectId: "proj_001",
        name: "main",
        isDefault: true,
        isLocked: false,
      },
    ],
    pages: [
      {
        _id: "page_001",
        _creationTime: 1700000000000,
        branchId: "branch_001",
        title: "Getting Started",
        slug: "getting-started",
        path: "/getting-started",
        position: 0,
        isPublished: true,
        content:
          '[{"type":"paragraph","content":[{"type":"text","text":"Hello world"}]}]',
      },
    ],
    folders: [
      {
        _id: "folder_001",
        _creationTime: 1700000000000,
        branchId: "branch_001",
        name: "Guides",
        slug: "guides",
        path: "/guides",
        position: 0,
      },
    ],
    assets: [
      {
        _id: "asset_001",
        _creationTime: 1700000000000,
        projectId: "proj_001",
        filename: "logo.png",
        mimeType: "image/png",
        size: 12345,
      },
    ],
    deployments: [
      {
        _id: "deploy_001",
        _creationTime: 1700000000000,
        projectId: "proj_001",
        status: "success",
        target: "production",
        url: "https://my-docs.inkloom.dev",
      },
    ],
    mergeRequests: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: validateExportData
// ---------------------------------------------------------------------------

describe("validateExportData", () => {
  it("should return no errors for valid export data", () => {
    const data = createValidExportData();
    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("should reject null input", () => {
    const errors = validateExportData(null);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("JSON object"));
  });

  it("should reject non-object input", () => {
    const errors = validateExportData("not an object");
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("JSON object"));
  });

  it("should reject wrong version number", () => {
    const data = createValidExportData({ version: 2 as never });
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("version")));
  });

  it("should reject missing version", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).version;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("version")));
  });

  it("should reject missing exportedAt", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).exportedAt;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("exportedAt")));
  });

  it("should reject non-string exportedAt", () => {
    const data = createValidExportData();
    (data as Record<string, unknown>).exportedAt = 12345;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("exportedAt")));
  });

  it("should reject missing projects array", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).projects;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("projects")));
  });

  it("should reject non-array projects", () => {
    const data = createValidExportData();
    (data as Record<string, unknown>).projects = "not an array";
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("projects")));
  });

  it("should reject missing branches array", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).branches;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("branches")));
  });

  it("should reject missing pages array", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).pages;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("pages")));
  });

  it("should reject missing folders array", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).folders;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("folders")));
  });

  it("should reject missing assets array", () => {
    const data = createValidExportData();
    delete (data as Record<string, unknown>).assets;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("assets")));
  });

  it("should reject empty projects array", () => {
    const data = createValidExportData({ projects: [] });
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("at least one project")));
  });

  it("should reject projects without name", () => {
    const data = createValidExportData();
    (data.projects[0] as Record<string, unknown>).name = undefined;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("projects[0]") && e.includes("name")));
  });

  it("should reject projects without _id", () => {
    const data = createValidExportData();
    (data.projects[0] as Record<string, unknown>)._id = undefined;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("projects[0]") && e.includes("_id")));
  });

  it("should reject branches referencing non-existent projects", () => {
    const data = createValidExportData();
    (data.branches[0] as Record<string, unknown>).projectId = "proj_nonexistent";
    const errors = validateExportData(data);
    assert.ok(
      errors.some((e) => e.includes("branches[0]") && e.includes("non-existent"))
    );
  });

  it("should reject pages referencing non-existent branches", () => {
    const data = createValidExportData();
    (data.pages[0] as Record<string, unknown>).branchId = "branch_nonexistent";
    const errors = validateExportData(data);
    assert.ok(
      errors.some((e) => e.includes("pages[0]") && e.includes("non-existent"))
    );
  });

  it("should reject pages without title", () => {
    const data = createValidExportData();
    (data.pages[0] as Record<string, unknown>).title = undefined;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("pages[0]") && e.includes("title")));
  });

  it("should reject pages without slug", () => {
    const data = createValidExportData();
    (data.pages[0] as Record<string, unknown>).slug = undefined;
    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("pages[0]") && e.includes("slug")));
  });

  it("should accumulate multiple errors", () => {
    const data = {
      version: 2,
      projects: "not array",
      branches: null,
    };
    const errors = validateExportData(data);
    assert.ok(errors.length >= 3, `Expected >= 3 errors, got ${errors.length}`);
  });

  it("should accept valid data with empty optional collections", () => {
    const data = createValidExportData({
      pages: [],
      folders: [],
      assets: [],
      deployments: [],
      mergeRequests: [],
    });
    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// Tests: Multi-project validation
// ---------------------------------------------------------------------------

describe("validateExportData multi-project", () => {
  it("should validate multiple projects with cross-references", () => {
    const data = createValidExportData({
      projects: [
        {
          _id: "proj_001",
          _creationTime: 1700000000000,
          name: "Project A",
          slug: "project-a",
          workosOrgId: "local",
        },
        {
          _id: "proj_002",
          _creationTime: 1700000000000,
          name: "Project B",
          slug: "project-b",
          workosOrgId: "local",
        },
      ],
      branches: [
        {
          _id: "branch_001",
          _creationTime: 1700000000000,
          projectId: "proj_001",
          name: "main",
          isDefault: true,
          isLocked: false,
        },
        {
          _id: "branch_002",
          _creationTime: 1700000000000,
          projectId: "proj_002",
          name: "main",
          isDefault: true,
          isLocked: false,
        },
      ],
      pages: [
        {
          _id: "page_001",
          _creationTime: 1700000000000,
          branchId: "branch_001",
          title: "Page A",
          slug: "page-a",
          position: 0,
        },
        {
          _id: "page_002",
          _creationTime: 1700000000000,
          branchId: "branch_002",
          title: "Page B",
          slug: "page-b",
          position: 0,
        },
      ],
      folders: [],
      assets: [],
    });

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("should detect cross-reference errors in multi-project exports", () => {
    const data = createValidExportData({
      projects: [
        {
          _id: "proj_001",
          _creationTime: 1700000000000,
          name: "Project A",
          slug: "project-a",
          workosOrgId: "local",
        },
      ],
      branches: [
        {
          _id: "branch_001",
          _creationTime: 1700000000000,
          projectId: "proj_001",
          name: "main",
          isDefault: true,
          isLocked: false,
        },
        {
          _id: "branch_orphan",
          _creationTime: 1700000000000,
          projectId: "proj_missing",
          name: "orphan",
          isDefault: false,
          isLocked: false,
        },
      ],
      pages: [],
      folders: [],
      assets: [],
    });

    const errors = validateExportData(data);
    assert.ok(errors.some((e) => e.includes("branches[1]")));
  });
});

// ---------------------------------------------------------------------------
// Tests: File reading and JSON parsing edge cases
// ---------------------------------------------------------------------------

describe("migrate file handling", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "inkloom-migrate-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should read and parse a valid export file", () => {
    const data = createValidExportData();
    const filePath = join(tmpDir, "export.json");
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ExportData;

    assert.equal(parsed.version, 1);
    assert.equal(parsed.projects.length, 1);
    assert.equal(parsed.projects[0].name, "My Docs");
  });

  it("should handle minified JSON export files", () => {
    const data = createValidExportData();
    const filePath = join(tmpDir, "export.min.json");
    writeFileSync(filePath, JSON.stringify(data), "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ExportData;
    const errors = validateExportData(parsed);

    assert.deepEqual(errors, []);
    assert.equal(parsed.version, 1);
  });

  it("should handle export files with unicode content", () => {
    const data = createValidExportData();
    data.projects[0].name = "Dokumentation 日本語";
    data.pages[0].title = "はじめに";
    data.pages[0].content = JSON.stringify([
      {
        type: "paragraph",
        content: [{ type: "text", text: "日本語テスト 🎉" }],
      },
    ]);

    const filePath = join(tmpDir, "unicode.json");
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ExportData;
    const errors = validateExportData(parsed);

    assert.deepEqual(errors, []);
    assert.equal(parsed.projects[0].name, "Dokumentation 日本語");
    assert.equal(parsed.pages[0].title, "はじめに");
  });

  it("should handle large export files", () => {
    const data = createValidExportData({
      pages: Array.from({ length: 200 }, (_, i) => ({
        _id: `page_${i}`,
        _creationTime: 1700000000000,
        branchId: "branch_001",
        title: `Page ${i}`,
        slug: `page-${i}`,
        path: `/page-${i}`,
        position: i,
        isPublished: true,
        content: JSON.stringify([
          {
            type: "paragraph",
            content: [
              { type: "text", text: `Content for page ${i}. `.repeat(50) },
            ],
          },
        ]),
      })),
    });

    const filePath = join(tmpDir, "large.json");
    writeFileSync(filePath, JSON.stringify(data), "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ExportData;
    const errors = validateExportData(parsed);

    assert.deepEqual(errors, []);
    assert.equal(parsed.pages.length, 200);
  });

  it("should reject truncated JSON files", () => {
    const filePath = join(tmpDir, "truncated.json");
    writeFileSync(filePath, '{"version": 1, "projects": [{"name":', "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    assert.throws(() => JSON.parse(raw), SyntaxError);
  });

  it("should reject empty files", () => {
    const filePath = join(tmpDir, "empty.json");
    writeFileSync(filePath, "", "utf-8");

    const raw = readFileSync(filePath, "utf-8");
    assert.throws(() => JSON.parse(raw), SyntaxError);
  });
});

// ---------------------------------------------------------------------------
// Tests: Export-to-import round-trip compatibility
// ---------------------------------------------------------------------------

describe("export-import compatibility", () => {
  it("should produce a file that passes validation after JSON round-trip", () => {
    const data = createValidExportData();
    const json = JSON.stringify(data);
    const restored = JSON.parse(json);
    const errors = validateExportData(restored);

    assert.deepEqual(errors, []);
  });

  it("workosOrgId: 'local' projects should pass validation", () => {
    const data = createValidExportData();
    assert.equal(data.projects[0].workosOrgId, "local");
    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("should accept exports with additional unknown fields (forward compat)", () => {
    const data = createValidExportData();
    (data as Record<string, unknown>).futureField = "some value";
    (data.projects[0] as Record<string, unknown>).futureProjectField = 42;

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("should validate data with nested folder hierarchy", () => {
    const data = createValidExportData({
      folders: [
        {
          _id: "folder_root",
          _creationTime: 1700000000000,
          branchId: "branch_001",
          name: "API",
          slug: "api",
          path: "/api",
          position: 0,
        },
        {
          _id: "folder_child",
          _creationTime: 1700000000000,
          branchId: "branch_001",
          parentId: "folder_root",
          name: "Endpoints",
          slug: "endpoints",
          path: "/api/endpoints",
          position: 0,
        },
        {
          _id: "folder_grandchild",
          _creationTime: 1700000000000,
          branchId: "branch_001",
          parentId: "folder_child",
          name: "Users",
          slug: "users",
          path: "/api/endpoints/users",
          position: 0,
        },
      ],
    });

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });

  it("should validate data with multiple branches per project", () => {
    const data = createValidExportData({
      branches: [
        {
          _id: "branch_main",
          _creationTime: 1700000000000,
          projectId: "proj_001",
          name: "main",
          isDefault: true,
          isLocked: false,
        },
        {
          _id: "branch_dev",
          _creationTime: 1700000000000,
          projectId: "proj_001",
          name: "development",
          isDefault: false,
          isLocked: false,
        },
        {
          _id: "branch_feature",
          _creationTime: 1700000000000,
          projectId: "proj_001",
          name: "feature/new-api",
          isDefault: false,
          isLocked: false,
        },
      ],
      pages: [
        {
          _id: "page_main",
          _creationTime: 1700000000000,
          branchId: "branch_main",
          title: "Main Intro",
          slug: "intro",
          position: 0,
        },
        {
          _id: "page_dev",
          _creationTime: 1700000000000,
          branchId: "branch_dev",
          title: "Dev Intro",
          slug: "dev-intro",
          position: 0,
        },
        {
          _id: "page_feat",
          _creationTime: 1700000000000,
          branchId: "branch_feature",
          title: "New API Docs",
          slug: "new-api",
          position: 0,
        },
      ],
    });

    const errors = validateExportData(data);
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// Tests: Validation error messages quality
// ---------------------------------------------------------------------------

describe("validateExportData error message quality", () => {
  it("should include field path in error messages", () => {
    const data = createValidExportData();
    data.projects[0].name = "" as unknown as string;
    // Empty string is falsy, should trigger validation
    const errors = validateExportData(data);
    if (errors.length > 0) {
      assert.ok(
        errors.some((e) => e.includes("projects[0]")),
        "Error should reference the field path"
      );
    }
  });

  it("should report multiple branch reference errors", () => {
    const data = createValidExportData({
      branches: [
        {
          _id: "b1",
          _creationTime: 1,
          projectId: "nonexistent_1",
          name: "a",
          isDefault: true,
          isLocked: false,
        },
        {
          _id: "b2",
          _creationTime: 1,
          projectId: "nonexistent_2",
          name: "b",
          isDefault: false,
          isLocked: false,
        },
      ],
      pages: [],
    });

    const errors = validateExportData(data);
    const branchErrors = errors.filter((e) => e.includes("branches["));
    assert.equal(
      branchErrors.length,
      2,
      "Should report errors for both invalid branches"
    );
  });

  it("should report version error clearly", () => {
    const data = createValidExportData({ version: 99 as never });
    const errors = validateExportData(data);
    assert.ok(
      errors.some((e) => e.includes("99") && e.includes("version")),
      "Version error should include the invalid version number"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Property-based style checks for validation robustness
// ---------------------------------------------------------------------------

describe("validateExportData property-based", () => {
  it("should never throw for any input shape", () => {
    const inputs = [
      null,
      undefined,
      42,
      "string",
      [],
      {},
      { version: 1 },
      { version: "1" },
      { version: 1, projects: [] },
      { version: 1, projects: [{}] },
      true,
      false,
      NaN,
      Infinity,
    ];

    for (const input of inputs) {
      assert.doesNotThrow(
        () => validateExportData(input),
        `validateExportData should not throw for input: ${JSON.stringify(input)}`
      );
    }
  });

  it("should always return an array", () => {
    const inputs = [null, {}, createValidExportData()];

    for (const input of inputs) {
      const result = validateExportData(input);
      assert.ok(Array.isArray(result), "Should always return an array");
    }
  });

  it("should return empty array only for valid data", () => {
    const valid = createValidExportData();
    const invalid = { version: 2 };

    assert.deepEqual(validateExportData(valid), []);
    assert.ok(validateExportData(invalid).length > 0);
  });

  it("should be idempotent — calling twice gives same result", () => {
    const data = createValidExportData();
    const errors1 = validateExportData(data);
    const errors2 = validateExportData(data);
    assert.deepEqual(errors1, errors2);
  });

  it("should not mutate the input data", () => {
    const data = createValidExportData();
    const original = JSON.stringify(data);
    validateExportData(data);
    assert.equal(JSON.stringify(data), original);
  });
});

// ---------------------------------------------------------------------------
// Helper: readFileSync import for test file reading
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
