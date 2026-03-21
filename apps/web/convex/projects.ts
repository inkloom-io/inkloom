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
 * Sorted by last updated time (most recently updated first).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_updated_at")
      .order("desc")
      .collect();
  },
});

/**
 * List projects by org ID.
 * In core mode the org filter is ignored (single tenant, return all).
 * Exists so the projects page can call `listByOrg` in both modes.
 * Sorted by last updated time (most recently updated first).
 */
export const listByOrg = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_updated_at")
      .order("desc")
      .collect();
    // Normalize plan: undefined → "free" so UI badges render correctly
    return projects.map((p) => ({ ...p, plan: p.plan ?? "free" }));
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
      .withIndex("by_workos_org_and_slug", (q: any) =>
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
      settings: { showBranding: true },
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
      .withIndex("by_workos_user_id", (q: any) =>
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
        subtitle: v.optional(v.string()),
        icon: v.optional(v.string()),
        description: v.optional(v.string()),
      })
    ),
    navTabs: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          slug: v.string(),
          icon: v.optional(v.string()),
          /** Path of the folder this tab roots (resolved to folderId after creation). */
          folderPath: v.optional(v.string()),
          /** Items referencing folders/pages by path (resolved to IDs after creation). */
          items: v.optional(
            v.array(
              v.union(
                v.object({
                  type: v.literal("folder"),
                  folderPath: v.string(),
                }),
                v.object({
                  type: v.literal("page"),
                  pagePath: v.string(),
                })
              )
            )
          ),
        })
      )
    ),
    branding: v.optional(
      v.object({
        primaryColor: v.optional(v.string()),
        logoAssetId: v.optional(v.id("assets")),
        logoDarkAssetId: v.optional(v.id("assets")),
        logoLightAssetId: v.optional(v.id("assets")),
        faviconAssetId: v.optional(v.id("assets")),
        socialLinks: v.optional(
          v.array(
            v.object({
              platform: v.union(
                v.literal("github"),
                v.literal("x"),
                v.literal("discord"),
                v.literal("linkedin"),
                v.literal("youtube")
              ),
              url: v.string(),
            })
          )
        ),
      })
    ),
    migrationRedirects: v.optional(
      v.array(
        v.object({
          from: v.string(),
          to: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);

    // Check slug uniqueness
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_workos_org_and_slug", (q: any) =>
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
      settings: { showBranding: true },
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

    // Create pages (track path -> pageId)
    const pageIdByPath: Record<string, Id<"pages">> = {};

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
        ...(page.subtitle ? { subtitle: page.subtitle } : {}),
        ...(page.icon ? { icon: page.icon } : {}),
        ...(page.description ? { description: page.description } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      pageIdByPath[page.path] = pageId;

      await ctx.db.insert("pageContents", {
        pageId,
        content: page.content,
        updatedAt: Date.now(),
      });
    }

    // Build project settings from navTabs, branding, and migrationRedirects
    const settings: Record<string, unknown> = {};
    settings.showBranding = true;

    if (args.navTabs && args.navTabs.length > 0) {
      settings.navTabs = args.navTabs.map((tab) => {
        const resolved: Record<string, unknown> = {
          id: tab.id,
          name: tab.name,
          slug: tab.slug,
        };
        if (tab.icon) {
          resolved.icon = tab.icon;
        }
        if (tab.folderPath && folderIdByPath[tab.folderPath]) {
          resolved.folderId = folderIdByPath[tab.folderPath];
        }
        if (tab.items) {
          resolved.items = tab.items
            .map((item) => {
              if (item.type === "folder") {
                const fId = folderIdByPath[item.folderPath];
                if (fId) return { type: "folder" as const, folderId: fId };
              } else {
                const pId = pageIdByPath[item.pagePath];
                if (pId) return { type: "page" as const, pageId: pId };
              }
              return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
        }
        return resolved;
      });
    }

    if (args.branding) {
      if (args.branding.primaryColor) {
        settings.primaryColor = args.branding.primaryColor;
      }
      if (args.branding.logoAssetId) {
        settings.logoAssetId = args.branding.logoAssetId;
      }
      if (args.branding.logoDarkAssetId) {
        settings.logoDarkAssetId = args.branding.logoDarkAssetId;
      }
      if (args.branding.logoLightAssetId) {
        settings.logoLightAssetId = args.branding.logoLightAssetId;
      }
      if (args.branding.faviconAssetId) {
        settings.faviconAssetId = args.branding.faviconAssetId;
      }
      if (args.branding.socialLinks) {
        settings.socialLinks = args.branding.socialLinks;
      }
    }

    if (args.migrationRedirects && args.migrationRedirects.length > 0) {
      settings.migrationRedirects = args.migrationRedirects;
    }

    // Patch project with settings if any were provided
    if (Object.keys(settings).length > 0) {
      await ctx.db.patch(projectId, {
        settings,
        updatedAt: Date.now(),
      });
    }

    return projectId;
  },
});

/**
 * Get a single project by ID.
 */
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

/**
 * Update a project's basic fields.
 */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(projectId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update project settings (theme, branding, SEO, content config).
 */
export const updateSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const currentSettings = (project.settings as Record<string, unknown>) || {};
    const newSettings = args.settings as Record<string, unknown>;

    const merged = { ...currentSettings, ...newSettings };
    // Remove keys explicitly set to null (convention: null = "delete this key")
    for (const key of Object.keys(newSettings)) {
      if (newSettings[key] === null) {
        delete merged[key];
      }
    }

    await ctx.db.patch(args.projectId, {
      settings: merged,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a project and all associated data.
 */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Delete branches and their pages/folders
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .collect();

    for (const branch of branches) {
      const pages = await ctx.db
        .query("pages")
        .withIndex("by_branch", (q: any) => q.eq("branchId", branch._id))
        .collect();
      for (const page of pages) {
        // Delete page contents
        const contents = await ctx.db
          .query("pageContents")
          .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
          .collect();
        for (const content of contents) {
          await ctx.db.delete(content._id);
        }
        await ctx.db.delete(page._id);
      }

      const folders = await ctx.db
        .query("folders")
        .withIndex("by_branch", (q: any) => q.eq("branchId", branch._id))
        .collect();
      for (const folder of folders) {
        await ctx.db.delete(folder._id);
      }

      await ctx.db.delete(branch._id);
    }

    // Delete project members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);
  },
});

/**
 * Check if a Cloudflare slug is available.
 * In core mode, this is a no-op (no Cloudflare deployment).
 */
export const checkCfSlugAvailable = query({
  args: {
    cfSlug: v.optional(v.string()),
    slug: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    excludeProjectId: v.optional(v.id("projects")),
  },
  handler: async () => {
    // In core mode, always available (no CF slugs)
    return { available: true };
  },
});

/**
 * Update a project's Cloudflare slug.
 * In core mode, this updates the slug field.
 */
export const updateCfSlug = mutation({
  args: { projectId: v.id("projects"), cfSlug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      cfSlug: args.cfSlug,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get dashboard stats in core mode (no org filter).
 * Simplified version — no org-scoping needed.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    // Sorted by last updated time (most recently updated first)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_updated_at")
      .order("desc")
      .collect();

    let totalPages = 0;
    let recentDeployments = 0;
    let unpublishedCount = 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const enrichedProjects = await Promise.all(
      projects.slice(0, 6).map(async (project: any) => {
        const branch = project.defaultBranchId
          ? await ctx.db.get(project.defaultBranchId)
          : null;
        let pageCount = 0;
        if (branch) {
          const pages = await ctx.db
            .query("pages")
            .withIndex("by_branch", (q: any) => q.eq("branchId", branch._id))
            .collect();
          pageCount = pages.length;
        }
        totalPages += pageCount;

        const deployments = await ctx.db
          .query("deployments")
          .withIndex("by_project", (q: any) => q.eq("projectId", project._id))
          .order("desc")
          .collect();

        const recent = deployments.filter((d: any) => d.createdAt > thirtyDaysAgo);
        recentDeployments += recent.length;

        const latestProduction = deployments.find(
          (d: any) => d.target === "production"
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
          plan: project.plan ?? "free",
          updatedAt: project.updatedAt,
          settings: project.settings
            ? { customDomain: project.settings.customDomain }
            : undefined,
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
            .withIndex("by_branch", (q: any) => q.eq("branchId", branch._id))
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
