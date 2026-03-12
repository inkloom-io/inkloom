import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import { getTemplatePath } from "../templates";

describe("core template structure", () => {
  const templateDir = getTemplatePath("core");

  it("resolves the core template path", () => {
    expect(templateDir).toBeTruthy();
    expect(fs.existsSync(templateDir)).toBe(true);
  });

  it("has package.json with required dependencies", async () => {
    const pkg = await fs.readJson(path.join(templateDir, "package.json"));
    expect(pkg.dependencies).toHaveProperty("convex");
    expect(pkg.dependencies).toHaveProperty("next");
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("react-dom");
    expect(pkg.dependencies).toHaveProperty("next-themes");
    expect(pkg.dependencies).toHaveProperty("@tanstack/react-query");
  });

  it("has package.json with required scripts", async () => {
    const pkg = await fs.readJson(path.join(templateDir, "package.json"));
    expect(pkg.scripts).toHaveProperty("dev");
    expect(pkg.scripts).toHaveProperty("build");
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.scripts.build).toBe("next build");
  });

  it("has no platform-specific dependencies", async () => {
    const pkg = await fs.readJson(path.join(templateDir, "package.json"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    // These are platform-only packages that should NOT be in the core template
    const platformDeps = [
      "@workos-inc/authkit-nextjs",
      "stripe",
      "@stripe/stripe-js",
      "partykit",
      "y-partykit",
    ];
    for (const dep of platformDeps) {
      expect(allDeps, `Found platform dep: ${dep}`).not.toHaveProperty(dep);
    }
  });
});

describe("core template Convex schema", () => {
  const templateDir = getTemplatePath("core");

  it("has convex.config.ts at project root", () => {
    expect(
      fs.existsSync(path.join(templateDir, "convex.config.ts"))
    ).toBe(true);
  });

  it("has schema.ts importing coreTables", async () => {
    const schema = await fs.readFile(
      path.join(templateDir, "convex", "schema.ts"),
      "utf-8"
    );
    expect(schema).toContain("coreTables");
    expect(schema).toContain("defineSchema");
    // Must NOT import platform tables
    expect(schema).not.toContain("platformTables");
  });

  it("has coreTables.ts with all required tables", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "convex", "schema", "coreTables.ts"),
      "utf-8"
    );

    const requiredTables = [
      "users",
      "projects",
      "branches",
      "folders",
      "pages",
      "pageContents",
      "pageVersions",
      "deploymentConfigs",
      "deployments",
      "assets",
      "searchIndex",
      "commentThreads",
      "comments",
      "projectMembers",
      "mergeRequests",
      "mergeRequestComments",
      "branchSnapshots",
    ];

    for (const table of requiredTables) {
      expect(content, `Missing table: ${table}`).toContain(`${table}:`);
    }
  });

  it("has coreTables.ts without platform-only table references", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "convex", "schema", "coreTables.ts"),
      "utf-8"
    );

    // Core tables must not contain v.id() references to platform-only tables
    const platformTables = [
      "organizations",
      "generationJobs",
      "billingEvents",
      "apiKeys",
      "webhooks",
      "customDomains",
    ];

    for (const table of platformTables) {
      expect(content, `Contains platform table ref: ${table}`).not.toContain(
        `v.id("${table}")`
      );
    }
  });

  it("has users.ts with ensureLocalUser and currentLocal", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "convex", "users.ts"),
      "utf-8"
    );
    expect(content).toContain("ensureLocalUser");
    expect(content).toContain("currentLocal");
    expect(content).toContain('"local"'); // sentinel value
  });

  it("has projects.ts with local org sentinel", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "convex", "projects.ts"),
      "utf-8"
    );
    expect(content).toContain('LOCAL_ORG_ID = "local"');
    expect(content).toContain("list");
    expect(content).toContain("create");
    expect(content).toContain("update");
    expect(content).toContain("remove");
  });
});

describe("core template Next.js app", () => {
  const templateDir = getTemplatePath("core");

  it("has app/layout.tsx", () => {
    expect(
      fs.existsSync(path.join(templateDir, "app", "layout.tsx"))
    ).toBe(true);
  });

  it("has app/page.tsx", () => {
    expect(
      fs.existsSync(path.join(templateDir, "app", "page.tsx"))
    ).toBe(true);
  });

  it("has app/globals.css with tailwind import", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "app", "globals.css"),
      "utf-8"
    );
    expect(content).toContain("tailwindcss");
  });

  it("has providers.tsx with Convex and Theme providers", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "components", "providers.tsx"),
      "utf-8"
    );
    expect(content).toContain("ConvexProvider");
    expect(content).toContain("ThemeProvider");
    expect(content).toContain("NEXT_PUBLIC_CONVEX_URL");
    expect(content).toContain("ensureLocalUser");
  });

  it("has next.config.ts", () => {
    expect(
      fs.existsSync(path.join(templateDir, "next.config.ts"))
    ).toBe(true);
  });

  it("has tsconfig.json with @/* path alias", async () => {
    const tsconfig = await fs.readJson(
      path.join(templateDir, "tsconfig.json")
    );
    expect(tsconfig.compilerOptions.paths).toHaveProperty("@/*");
  });
});

describe("core template environment", () => {
  const templateDir = getTemplatePath("core");

  it("has env.example with only Convex variables", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "env.example"),
      "utf-8"
    );
    expect(content).toContain("CONVEX_DEPLOYMENT");
    expect(content).toContain("NEXT_PUBLIC_CONVEX_URL");
    // Must NOT contain platform-specific env vars
    expect(content).not.toContain("WORKOS");
    expect(content).not.toContain("STRIPE");
    expect(content).not.toContain("CLOUDFLARE");
    expect(content).not.toContain("GITHUB_APP");
    expect(content).not.toContain("OPENROUTER");
    expect(content).not.toContain("PARTYKIT");
  });

  it("has gitignore file", () => {
    expect(
      fs.existsSync(path.join(templateDir, "gitignore"))
    ).toBe(true);
  });

  it("gitignore includes standard Next.js entries", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "gitignore"),
      "utf-8"
    );
    expect(content).toContain("node_modules");
    expect(content).toContain(".next");
    expect(content).toContain(".env*.local");
  });

  it("has README.md with setup instructions", async () => {
    const content = await fs.readFile(
      path.join(templateDir, "README.md"),
      "utf-8"
    );
    expect(content).toContain("InkLoom");
    expect(content).toContain("npx convex dev");
    expect(content).toContain("pnpm dev");
  });
});

describe("core template schema matches source", () => {
  const templateDir = getTemplatePath("core");
  const sourceDir = path.resolve(
    templateDir,
    "..",
    "..",
    "..",
    "..",
    "apps",
    "web",
    "convex"
  );

  it("template coreTables has the same tables as source coreTables", async () => {
    // Only run if source is available (in monorepo context)
    if (!fs.existsSync(path.join(sourceDir, "schema", "coreTables.ts"))) {
      return; // skip — running outside monorepo
    }

    const sourceContent = await fs.readFile(
      path.join(sourceDir, "schema", "coreTables.ts"),
      "utf-8"
    );
    const templateContent = await fs.readFile(
      path.join(templateDir, "convex", "schema", "coreTables.ts"),
      "utf-8"
    );

    // Extract table names from both files
    const extractTables = (content: string) => {
      const matches = content.match(/^\s+(\w+):\s*defineTable/gm);
      return (matches || []).map((m) => m.trim().split(":")[0].trim()).sort();
    };

    const sourceTables = extractTables(sourceContent);
    const templateTables = extractTables(templateContent);

    expect(templateTables).toEqual(sourceTables);
  });
});
