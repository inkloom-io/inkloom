/**
 * Ensures dist/cli.js exists before integration tests run.
 *
 * When tests are run via turbo, the build task dependency graph guarantees
 * that all upstream packages and the CLI itself are already built.
 *
 * When a single test file is run directly (e.g. `node --import tsx --test tests/foo.test.ts`),
 * the build step is skipped and all assertions fail because the CLI process exits immediately.
 * This module detects that case and triggers a build on-demand.
 *
 * Import this module at the top of any test file that spawns dist/cli.js:
 *
 *   import "./ensure-build.js";
 */

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_DIST = resolve(__dirname, "../dist/cli.js");
const CLI_PKG = resolve(__dirname, "..");

if (!existsSync(CLI_DIST)) {
  if (process.env.TURBO_HASH) {
    // Under turbo, builds should already be complete via task dependencies.
    // Do NOT attempt pnpm builds here — it would deadlock with turbo's locks.
    throw new Error(
      "dist/cli.js not found but running under turbo. " +
        "This means the turbo build task dependency is misconfigured. " +
        "Ensure turbo.json has test depending on build.",
    );
  }

  // Build workspace dependencies first, then the CLI itself.
  console.log("[ensure-build] dist/cli.js not found — building CLI…");
  execSync(
    "pnpm --filter @inkloom/mdx-parser --filter create-inkloom --filter @inkloom/migration build && pnpm build",
    { cwd: CLI_PKG, stdio: "inherit" },
  );

  if (!existsSync(CLI_DIST)) {
    throw new Error(
      "dist/cli.js still missing after build. Check the build output above for errors.",
    );
  }
  console.log("[ensure-build] Build complete.");
}
