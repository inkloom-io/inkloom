import type { DeployAdapter, DeployOptions, DeployResult } from "./types";

/**
 * Core-mode deploy adapter.
 *
 * Generates a static site to `dist/` using `generateSiteFiles()`.
 * The output can be deployed to any static host (Vercel, Netlify,
 * GitHub Pages, S3, or served locally with `npx serve dist`).
 *
 * In core mode, "Publish" becomes "Build" — there's no managed
 * hosting, just local file output.
 */
export const deployAdapter: DeployAdapter = {
  async publish(_opts: DeployOptions): Promise<DeployResult> {
    // In core mode, the actual build is triggered via the CLI (`inkloom build`)
    // or via a `/api/build` route. This adapter provides a no-op stub that
    // signals core mode. The real build logic will be wired in Phase 2 when
    // the CLI and build route are implemented.
    return {
      success: true,
      url: "file://dist/",
      message:
        "Use `inkloom build` to generate a static site, or click Export in the UI.",
    };
  },

  getDeployUrl(projectSlug: string): string {
    return `file://dist/${projectSlug}`;
  },

  actionLabel: "Build",
};
