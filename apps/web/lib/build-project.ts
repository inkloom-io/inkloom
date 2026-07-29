/**
 * Server-side static site builder for core mode.
 *
 * Fetches project data from the D1 data service, generates
 * static site files using `generateSiteFiles()`, writes them to
 * the `dist/` directory, and creates a deployment record in D1.
 *
 * Used by the `/api/build` route (UI "Build" button) and could also
 * be reused by any server-side build trigger.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { DataClient } from "@/data/client";
import { generateSiteFiles } from "./generate-site";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildProjectOptions {
  projectId: string;
  branchId?: string;
  /** Output directory (default: "dist"). */
  outDir?: string;
  /** Clean output directory before building. */
  clean?: boolean;
}

export interface BuildProjectResult {
  deploymentId: string;
  url: string;
  pageCount: number;
  fileCount: number;
  outDir: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildProject(
  data: DataClient,
  opts: BuildProjectOptions
): Promise<BuildProjectResult> {
  const outDir = opts.outDir ?? "dist";

  // 1. Fetch project
  const project = await data.projects.get(opts.projectId);
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
  const { id: deploymentId } = await data.deployments.create({
    projectId: opts.projectId,
    branchId,
    target: "preview",
    buildPhase: "generating",
  });

  try {
    // 4. Fetch pages and folders
    const [rawPages, rawFolders] = await Promise.all([
      data.pages.listByBranch(branchId),
      data.folders.listByBranch(branchId),
    ]);

    // 5. Recompute folder paths from parent chain (matches deploy.ts logic)
    const folderMap = new Map(rawFolders.map((folder) => [folder.id, folder]));
    function computePath(folder: {
      id: string;
      slug: string;
      parentId: string | null;
    }): string {
      if (!folder.parentId) {
        return `/${folder.slug}`;
      }
      const parent = folderMap.get(folder.parentId);
      if (!parent) {
        return `/${folder.slug}`;
      }
      return `${computePath(parent)}/${folder.slug}`;
    }

    const folders = rawFolders.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      path: computePath(f),
      position: f.position ?? 0,
      icon: f.icon ?? undefined,
    }));

    // 6. Recompute page paths based on folder hierarchy (matches deploy.ts logic)
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const pagesWithFixedPaths = rawPages.map((page) => {
      if (!page.folderId) {
        return { ...page, path: `/${page.slug}` };
      }
      const folder = folderById.get(page.folderId);
      if (!folder) {
        return page;
      }
      return { ...page, path: `${folder.path}/${page.slug}` };
    });

    // 7. Fetch content for published pages only (matches deploy.ts isPublished filter)
    const pages = [];
    for (const page of pagesWithFixedPaths) {
      if (!page.isPublished) continue;
      const contentDoc = await data.pages.getContent(page.id);
      if (!contentDoc?.content) continue;
      pages.push({
        id: page.id,
        title: page.title,
        slug: page.slug,
        path: page.path || `/${page.slug}`,
        content: contentDoc.content,
        position: page.position ?? 0,
        icon: page.icon ?? undefined,
        subtitle: page.subtitle ?? undefined,
      });
    }

    // 8. Generate site files
    await data.deployments.updateBuildPhase(deploymentId, {
      buildPhase: "generating",
    });

    // Access settings from the project object — navTabs lives under project.settings
    const settings = project.settings as
      | { theme?: string; primaryColor?: string; navTabs?: unknown }
      | undefined;

    const { files: siteFiles, warnings: buildWarnings } =
      await generateSiteFiles(pages, folders, {
        name: project.name,
        description: project.description ?? undefined,
        theme: settings?.theme as "default" | undefined,
        primaryColor: settings?.primaryColor as string | undefined,
        navTabs: settings?.navTabs as any,
      });

    if (buildWarnings && buildWarnings.length > 0) {
      for (const w of buildWarnings) {
        console.warn(`[Build] Warning: ${w}`);
      }
    }

    // 9. Write files to disk
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

    // 10. Update deployment record to ready
    const url = `file://${join(process.cwd(), outDir)}`;
    await data.deployments.updateStatus(deploymentId, {
      status: "ready",
      url,
      ...(buildWarnings && buildWarnings.length > 0
        ? { warnings: buildWarnings }
        : {}),
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
    await data.deployments.updateStatus(deploymentId, {
      status: "error",
      error: error instanceof Error ? error.message : "Build failed",
    });
    throw error;
  }
}
