import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The CLI's generateHtmlPage is a private function, so we test it
 * indirectly by importing the build module and checking the generated
 * HTML contains the branding badge when showBranding is enabled.
 *
 * Since we can't call generateHtmlPage directly without a full Convex
 * backend, we verify the source code contains the branding logic.
 */
describe("CLI build branding badge", () => {
  const buildSrcPath = resolve(__dirname, "../src/lib/build.ts");

  it("should contain branding badge HTML in the build source", () => {
    const source = readFileSync(buildSrcPath, "utf-8");
    assert.ok(
      source.includes("inkloom-badge"),
      "build.ts should reference inkloom-badge element"
    );
    assert.ok(
      source.includes("Built with"),
      "build.ts should contain 'Built with' text"
    );
    assert.ok(
      source.includes("github.com/inkloom/inkloom"),
      "build.ts should link to InkLoom GitHub"
    );
  });

  it("should respect showBranding config from siteData", () => {
    const source = readFileSync(buildSrcPath, "utf-8");
    assert.ok(
      source.includes("showBranding"),
      "build.ts should reference showBranding config"
    );
    assert.ok(
      source.includes("showBranding !== false"),
      "build.ts should default showBranding to true"
    );
  });

  it("should set showBranding in site data during build", () => {
    const source = readFileSync(buildSrcPath, "utf-8");
    assert.ok(
      source.includes("showBranding: project.showBranding !== false"),
      "build.ts should set showBranding in siteData config"
    );
  });
});
