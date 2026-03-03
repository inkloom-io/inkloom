/**
 * Core-mode project functions for OSS single-tenant operation.
 *
 * These functions are the core-mode alternatives to the platform versions:
 * - `create` — no org arg, uses sentinel `workosOrgId: "local"`
 * - `list` — no org filter, returns all projects
 * - `createFromImport` — same but with "local" sentinel
 *
 * After the core/platform restructure, these will become the main
 * implementations in `core/apps/web/convex/projects.ts`, while the
 * platform versions will override them in `apps/dev/convex/`.
 */
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getTemplateById,
  getDefaultTemplate,
  type TemplateId,
} from "../lib/templates";

/** The sentinel org value used in core (OSS) mode. */
export const LOCAL_ORG_ID = "local";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * List all projects (core mode — no org filter).
 * In core mode there's a single tenant, so we return everything.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

/**
 * Create a project in core mode.
 * No `workosOrgId` arg — automatically uses the "local" sentinel.
 * No `createdBy` / `createdByUserId` — single-tenant, no auth audit trail.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    templateId: v.optional(v.string()),
    skipFolderPaths: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);

    // Check if slug is unique (within the single "local" tenant)
    const existingProject = await ctx.db
      .query("projects")
      .withIndex("by_workos_org_and_slug", (q) =>
        q.eq("workosOrgId", LOCAL_ORG_ID).eq("slug", slug)
      )
      .first();

    if (existingProject) {
      throw new Error(
        `A project with the slug "${slug}" already exists`
      );
    }

    // Create project with sentinel org ID
    const projectId = await ctx.db.insert("projects", {
      workosOrgId: LOCAL_ORG_ID,
      name: args.name,
      slug,
      description: args.description,
      isPublic: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create default branch
    const branchId = await ctx.db.insert("branches", {
      projectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update project with default branch
    await ctx.db.patch(projectId, { defaultBranchId: branchId });

    // Auto-assign the local user as project admin
    const localUser = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", "local")
      )
      .first();

    if (localUser) {
      await ctx.db.insert("projectMembers", {
        projectId,
        userId: localUser._id,
        role: "admin",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Get the selected template or default
    const template =
      getTemplateById(args.templateId as TemplateId) || getDefaultTemplate();

    // Helper to replace [Product Name] placeholders
    const replaceProductName = (content: unknown[]): unknown[] => {
      return JSON.parse(
        JSON.stringify(content).replace(/\[Product Name\]/g, args.name)
      );
    };

    // Create folders from template (track path → folderId mapping)
    const folderIdByPath: Record<string, Id<"folders">> = {};
    const skippedFolderPaths = new Set(args.skipFolderPaths ?? []);

    for (const folder of template.folders) {
      if (skippedFolderPaths.has(folder.path)) continue;

      const folderId = await ctx.db.insert("folders", {
        branchId,
        name: folder.name,
        slug: folder.slug,
        path: folder.path,
        position: folder.position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      folderIdByPath[folder.path] = folderId;
    }

    // Create pages from template
    for (const page of template.pages) {
      // Skip pages belonging to skipped folders
      if (page.folderPath && skippedFolderPaths.has(page.folderPath)) continue;

      const folderId = page.folderPath
        ? folderIdByPath[page.folderPath]
        : undefined;

      const pageId = await ctx.db.insert("pages", {
        branchId,
        folderId,
        title: page.title.replace(/\[Product Name\]/g, args.name),
        ...(page.subtitle
          ? { subtitle: page.subtitle.replace(/\[Product Name\]/g, args.name) }
          : {}),
        ...(page.icon ? { icon: page.icon } : {}),
        slug: page.slug,
        path: page.path,
        position: page.position,
        isPublished: page.isPublished,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create page content with product name substituted
      await ctx.db.insert("pageContents", {
        pageId,
        content: JSON.stringify(replaceProductName(page.content)),
        updatedAt: Date.now(),
      });
    }

    return projectId;
  },
});

/**
 * Create a project from imported structure in core mode.
 * Same as platform `createFromImport` but uses "local" sentinel.
 */
export const createFromImport = mutation({
  args: {
    name: v.string(),
    folders: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        path: v.string(),
        position: v.number(),
        parentPath: v.optional(v.string()),
      })
    ),
    pages: v.array(
      v.object({
        title: v.string(),
        slug: v.string(),
        path: v.string(),
        position: v.number(),
        folderPath: v.optional(v.string()),
        content: v.string(),
        isPublished: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);

    // Check slug uniqueness
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_workos_org_and_slug", (q) =>
        q.eq("workosOrgId", LOCAL_ORG_ID).eq("slug", slug)
      )
      .first();
    if (existing) {
      throw new Error(
        `A project with the slug "${slug}" already exists`
      );
    }

    // Create project with sentinel org ID
    const projectId = await ctx.db.insert("projects", {
      workosOrgId: LOCAL_ORG_ID,
      name: args.name,
      slug,
      isPublic: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create default branch
    const branchId = await ctx.db.insert("branches", {
      projectId,
      name: "main",
      isDefault: true,
      isLocked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(projectId, { defaultBranchId: branchId });

    // Create folders (track path -> folderId)
    const folderIdByPath: Record<string, Id<"folders">> = {};

    for (const folder of args.folders) {
      const parentId = folder.parentPath
        ? folderIdByPath[folder.parentPath]
        : undefined;

      const folderId = await ctx.db.insert("folders", {
        branchId,
        parentId,
        name: folder.name,
        slug: folder.slug,
        path: folder.path,
        position: folder.position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      folderIdByPath[folder.path] = folderId;
    }

    // Create pages
    for (const page of args.pages) {
      const folderId = page.folderPath
        ? folderIdByPath[page.folderPath]
        : undefined;

      const pageId = await ctx.db.insert("pages", {
        branchId,
        folderId,
        title: page.title,
        slug: page.slug,
        path: page.path,
        position: page.position,
        isPublished: page.isPublished,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("pageContents", {
        pageId,
        content: page.content,
        updatedAt: Date.now(),
      });
    }

    return projectId;
  },
});

/**
 * Get dashboard stats in core mode (no org filter).
 * Simplified version — no org-scoping needed.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .order("desc")
      .collect();

    let totalPages = 0;
    let recentDeployments = 0;
    let unpublishedCount = 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const enrichedProjects = await Promise.all(
      projects.slice(0, 6).map(async (project) => {
        const branch = project.defaultBranchId
          ? await ctx.db.get(project.defaultBranchId)
          : null;
        let pageCount = 0;
        if (branch) {
          const pages = await ctx.db
            .query("pages")
            .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
            .collect();
          pageCount = pages.length;
        }
        totalPages += pageCount;

        const deployments = await ctx.db
          .query("deployments")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .order("desc")
          .collect();

        const recent = deployments.filter((d) => d.createdAt > thirtyDaysAgo);
        recentDeployments += recent.length;

        const latestProduction = deployments.find(
          (d) => d.target === "production"
        );

        let deploymentStatus: "ready" | "error" | "building" | "never_deployed" =
          "never_deployed";
        if (latestProduction) {
          if (latestProduction.status === "ready") deploymentStatus = "ready";
          else if (latestProduction.status === "error") deploymentStatus = "error";
          else if (
            latestProduction.status === "building" ||
            latestProduction.status === "queued"
          )
            deploymentStatus = "building";
        }

        const hasUnpublished =
          !latestProduction ||
          latestProduction.status !== "ready" ||
          project.updatedAt > latestProduction.createdAt;

        if (hasUnpublished) unpublishedCount++;

        return {
          _id: project._id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          updatedAt: project.updatedAt,
          deploymentStatus,
          hasUnpublishedChanges: hasUnpublished,
          pageCount,
        };
      })
    );

    for (const project of projects.slice(6)) {
      if (project.defaultBranchId) {
        const branch = await ctx.db.get(project.defaultBranchId);
        if (branch) {
          const pages = await ctx.db
            .query("pages")
            .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
            .collect();
          totalPages += pages.length;
        }
      }
    }

    return {
      totalProjects: projects.length,
      totalPages,
      recentDeployments,
      unpublishedCount,
      projects: enrichedProjects,
    };
  },
});
