/**
 * Server-side static site builder for core mode.
 *
 * Fetches project data from Convex via ConvexHttpClient, generates
 * static site files using `generateSiteFiles()`, writes them to
 * the `dist/` directory, and creates a deployment record in Convex.
 *
 * Used by the `/api/build` route (UI "Build" button) and could also
 * be reused by any server-side build trigger.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateSiteFiles } from "./generate-site";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildProjectOptions {
  projectId: Id<"projects">;
  branchId?: Id<"branches">;
  /** Output directory (default: "dist"). */
  outDir?: string;
  /** Clean output directory before building. */
  clean?: boolean;
}

export interface BuildProjectResult {
  deploymentId: Id<"deployments">;
  url: string;
  pageCount: number;
  fileCount: number;
  outDir: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildProject(
  convex: ConvexHttpClient,
  opts: BuildProjectOptions
): Promise<BuildProjectResult> {
  const outDir = opts.outDir ?? "dist";

  // 1. Fetch project
  const project = await convex.query(api.projects.get, {
    projectId: opts.projectId,
  });
  if (!project) {
    throw new Error(`Project not found: ${opts.projectId}`);
  }

  // 2. Resolve branch
  let branchId = opts.branchId;
  if (!branchId) {
    if (!project.defaultBranchId) {
      throw new Error("Project has no default branch.");
    }
    branchId = project.defaultBranchId;
  }

  // 3. Create deployment record (status: building)
  const deploymentId = await convex.mutation(api.deployments.create, {
    projectId: opts.projectId,
    branchId,
    target: "preview",
    buildPhase: "generating",
  });

  try {
    // 4. Fetch pages and folders
    const [rawPages, rawFolders] = await Promise.all([
      convex.query(api.pages.listByBranch, { branchId }),
      convex.query(api.folders.listByBranch, { branchId }),
    ]);

    // 5. Fetch content for each page
    const pages = [];
    for (const page of rawPages) {
      const contentDoc = await convex.query(api.pages.getContent, {
        pageId: page._id,
      });
      if (!contentDoc?.content) continue;
      pages.push({
        id: page._id,
        title: page.title,
        slug: page.slug,
        path: page.path || `/${page.slug}`,
        content: contentDoc.content,
        position: page.position ?? 0,
        icon: page.icon,
        subtitle: page.subtitle,
      });
    }

    const folders = rawFolders.map((f: any) => ({
      id: f._id,
      name: f.name,
      slug: f.slug,
      path: f.path || `/${f.slug}`,
      position: f.position ?? 0,
      icon: f.icon,
    }));

    // 6. Generate site files
    await convex.mutation(api.deployments.updateBuildPhase, {
      deploymentId,
      buildPhase: "generating",
    });

    const { files: siteFiles, warnings: buildWarnings } = await generateSiteFiles(pages, folders, {
      name: project.name,
      description: (project as Record<string, unknown>).description as string | undefined,
      theme: (project as Record<string, unknown>).theme as "default" | undefined,
      primaryColor: (project as Record<string, unknown>).primaryColor as string | undefined,
      navTabs: (project as Record<string, unknown>).navTabs as undefined,
    });

    if (buildWarnings && buildWarnings.length > 0) {
      for (const w of buildWarnings) {
        console.warn(`[Build] Warning: ${w}`);
      }
    }

    // 7. Write files to disk
    if (opts.clean !== false && existsSync(outDir)) {
      rmSync(outDir, { recursive: true, force: true });
    }

    let fileCount = 0;
    for (const file of siteFiles) {
      const filePath = join(outDir, file.file);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, file.data, "utf-8");
      fileCount++;
    }

    // 8. Update deployment record to ready
    const url = `file://${join(process.cwd(), outDir)}`;
    await convex.mutation(api.deployments.updateStatus, {
      deploymentId,
      status: "ready",
      url,
      ...(buildWarnings && buildWarnings.length > 0 ? { warnings: buildWarnings } : {}),
    });

    return {
      deploymentId,
      url,
      pageCount: pages.length,
      fileCount,
      outDir,
    };
  } catch (error) {
    // Mark deployment as failed
    await convex.mutation(api.deployments.updateStatus, {
      deploymentId,
      status: "error",
      error: error instanceof Error ? error.message : "Build failed",
    });
    throw error;
  }
}
