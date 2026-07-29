import { describe, expect, it } from "vitest";
import fs from "fs-extra";
import path from "path";

import { getTemplatePath } from "../templates";

describe("core D1 template", () => {
  const templateDir = getTemplatePath("core");

  it("contains the standalone application and data Worker", () => {
    for (const file of [
      "package.json",
      "wrangler.jsonc",
      "drizzle.config.ts",
      "db/schema/core.ts",
      "db/migrations/0000_true_the_fallen.sql",
      "worker/index.ts",
      "data/client.ts",
      "data/operations.ts",
      "data/provider.tsx",
      "app/api/data/[...path]/route.ts",
      "app/layout.tsx",
      "app/page.tsx",
    ]) {
      expect(
        fs.existsSync(path.join(templateDir, file)),
        `missing ${file}`,
      ).toBe(true);
    }
  });

  it("declares D1, Hono, Drizzle, and React Query dependencies", async () => {
    const pkg = await fs.readJson(path.join(templateDir, "package.json"));
    expect(pkg.dependencies).toHaveProperty("hono");
    expect(pkg.dependencies).toHaveProperty("drizzle-orm");
    expect(pkg.dependencies).toHaveProperty("@tanstack/react-query");
    expect(pkg.devDependencies).toHaveProperty("wrangler");
    expect(pkg.scripts).toHaveProperty("data:migrate:local");
    expect(pkg.scripts).toHaveProperty("data:deploy");
  });

  it("contains no SaaS-only dependencies", async () => {
    const pkg = await fs.readJson(path.join(templateDir, "package.json"));
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of [
      "@workos-inc/authkit-nextjs",
      "stripe",
      "@stripe/stripe-js",
      "partykit",
      "y-partykit",
    ]) {
      expect(dependencies).not.toHaveProperty(name);
    }
  });

  it("uses the typed data provider and local identity", async () => {
    const provider = await fs.readFile(
      path.join(templateDir, "components/providers.tsx"),
      "utf8",
    );
    expect(provider).toContain("DataProvider");
    expect(provider).toContain("QueryClientProvider");
    expect(provider).toContain("ensureLocalUser");

    const users = await fs.readFile(
      path.join(templateDir, "worker/routes/users.ts"),
      "utf8",
    );
    expect(users).toContain('"local"');
    expect(users).toContain("local@inkloom.local");
  });

  it("documents local migrations and Worker startup", async () => {
    const readme = await fs.readFile(
      path.join(templateDir, "README.md"),
      "utf8",
    );
    expect(readme).toContain("data:migrate:local");
    expect(readme).toContain("Cloudflare D1");
    expect(readme).toContain("pnpm dev");
  });
});
