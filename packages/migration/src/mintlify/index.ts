/**
 * Mintlify migration orchestrator.
 *
 * Reads a Mintlify documentation directory (with docs.json or mint.json config),
 * parses navigation structure, transforms MDX content, collects assets, and
 * returns a complete MigrationResult ready for InkLoom import.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, relative, basename, dirname, extname, posix } from "path";

import type {
  MigrationResult,
  ParsedPage,
  ParsedFolder,
  ParsedNavTab,
  RedirectRule,
  MigrationAsset,
  ParsedBranding,
} from "../types.js";
import {
  parseMintlifyConfig,
  type RawMintlifyConfig,
  type MintlifyConfigResult,
} from "./config.js";
import { transformMintlifyMdx } from "./transform.js";
import { collectAssets } from "../assets.js";

// ── Config detection ─────────────────────────────────────────────────────────

/** Supported config file names, in priority order. */
const CONFIG_FILENAMES = ["docs.json", "mint.json"] as const;

/**
 * Detect and read the Mintlify config file from a directory.
 * Tries docs.json first, then mint.json.
 */
function readConfigFile(dirPath: string): {
  config: RawMintlifyConfig;
  configPath: string;
} | null {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = resolve(dirPath, filename);
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as RawMintlifyConfig;
      return { config, configPath };
    }
  }
  return null;
}

// ── File discovery ───────────────────────────────────────────────────────────

/** Extensions to consider as documentation pages. */
const PAGE_EXTENSIONS = new Set([".mdx", ".md"]);

/**
 * Resolve a page reference (from navigation config) to a file on disk.
 * Mintlify page refs are relative paths without extensions (e.g. "guides/quickstart").
 * We try .mdx first, then .md.
 */
function resolvePageFile(
  dirPath: string,
  pageRef: string
): { filePath: string; relativePath: string } | null {
  for (const ext of [".mdx", ".md"]) {
    const candidate = resolve(dirPath, pageRef + ext);
    if (existsSync(candidate)) {
      return { filePath: candidate, relativePath: pageRef + ext };
    }
  }
  // Also check if the ref already has an extension
  const direct = resolve(dirPath, pageRef);
  if (existsSync(direct) && PAGE_EXTENSIONS.has(extname(pageRef))) {
    return { filePath: direct, relativePath: pageRef };
  }
  return null;
}

/**
 * Recursively walk a directory and collect all .mdx/.md file paths
 * (relative to the root dirPath).
 */
function walkDirectory(dirPath: string, rootDir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return results;
  }

  for (const name of entries) {
    const fullPath = resolve(dirPath, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      // Skip hidden directories and node_modules
      if (name.startsWith(".") || name === "node_modules") {
        continue;
      }
      results.push(...walkDirectory(fullPath, rootDir));
    } else if (stat.isFile() && PAGE_EXTENSIONS.has(extname(name))) {
      results.push(relative(rootDir, fullPath));
    }
  }
  return results;
}

// ── Slug helpers ─────────────────────────────────────────────────────────────

/**
 * Derive a URL slug from a page reference path.
 * Mintlify URLs are file-path based: "guides/quickstart" → "/guides/quickstart".
 */
function pageRefToSlug(pageRef: string): string {
  // Strip extension if present
  let slug = pageRef;
  for (const ext of [".mdx", ".md"]) {
    if (slug.endsWith(ext)) {
      slug = slug.slice(0, -ext.length);
    }
  }
  return slug;
}

/**
 * Determine the folder path for a page based on its page reference.
 * Returns the directory portion of the ref, or empty string for root-level pages.
 */
function pageRefToFolderPath(
  pageRef: string,
  folders: ParsedFolder[]
): string {
  const dirPart = dirname(pageRef);
  if (dirPart === "." || dirPart === "") return "";

  // Try to find a matching folder by checking if any folder's page refs
  // share this directory prefix. We use the folder paths from config.
  // The folder assignment is based on which navigation group contains this page.
  return "";
}

/**
 * Determine which folder a page ref belongs to, based on the config parser's
 * folder structure and the page ref's directory prefix.
 */
function assignPageToFolder(
  pageRef: string,
  configResult: MintlifyConfigResult
): string {
  // Build a map of pageRef → folder by walking the navigation structure.
  // The config parser gives us folders and pageRefs, but doesn't directly
  // link pages to folders. We need to re-derive this from the nav structure.
  //
  // Strategy: the folder whose path prefix best matches the pageRef's directory.
  const slug = pageRefToSlug(pageRef);
  const slugDir = dirname(slug);

  if (slugDir === "." || slugDir === "") {
    // Root-level page — check if there's a root folder from the first nav group
    return "";
  }

  // Find the most specific folder whose path appears in the page slug's directory
  let bestMatch = "";
  let bestLen = 0;
  for (const folder of configResult.folders) {
    // Folder path is like "getting-started" or "guides/auth"
    // Page slug dir is like "guides" or "guides/auth"
    if (
      slugDir === folder.slug ||
      slugDir.startsWith(folder.slug + "/") ||
      slugDir === folder.path ||
      slugDir.startsWith(folder.path + "/")
    ) {
      if (folder.path.length > bestLen) {
        bestMatch = folder.path;
        bestLen = folder.path.length;
      }
    }
  }

  return bestMatch;
}

// ── Navigation-aware folder assignment ───────────────────────────────────────

interface PageFolderMap {
  /** Maps pageRef → folderPath */
  mapping: Map<string, string>;
  /** Maps pageRef → position within its folder */
  positions: Map<string, number>;
}

/**
 * Build a map from page refs to their containing folder path and position,
 * by re-walking the raw config navigation structure.
 */
function buildPageFolderMap(config: RawMintlifyConfig): PageFolderMap {
  const mapping = new Map<string, string>();
  const positions = new Map<string, number>();

  // Handle object-wrapped navigation: { tabs: [...], global: {...} }
  let rawNav: unknown;
  if (
    config.navigation &&
    !Array.isArray(config.navigation) &&
    typeof config.navigation === "object" &&
    "tabs" in config.navigation
  ) {
    rawNav = (config.navigation as Record<string, unknown>).tabs ?? [];
  } else {
    rawNav = config.navigation ?? [];
  }
  const navItems = rawNav as Array<Record<string, unknown>>;

  function walkGroup(
    group: Record<string, unknown>,
    folderPath: string
  ): void {
    const pages = (group["pages"] ?? group["groups"] ?? []) as Array<
      string | Record<string, unknown>
    >;
    let pagePos = 0;
    for (const item of pages) {
      if (typeof item === "string") {
        mapping.set(item, folderPath);
        positions.set(item, pagePos++);
      } else if (typeof item === "object" && item !== null) {
        if ("group" in item) {
          const groupName = item["group"] as string;
          const childSlug = slugify(groupName);
          const childPath = folderPath
            ? `${folderPath}/${childSlug}`
            : childSlug;
          walkGroup(item, childPath);
        }
      }
    }
  }

  for (const item of navItems) {
    if (typeof item === "string") {
      mapping.set(item, "");
      positions.set(item, positions.size);
    } else if (typeof item === "object" && item !== null) {
      if ("tab" in item) {
        // Tab item — walk its groups/pages
        const groups = ((item["groups"] ?? item["pages"] ?? []) as Array<
          string | Record<string, unknown>
        >);
        for (const child of groups) {
          if (typeof child === "string") {
            mapping.set(child, "");
            positions.set(child, positions.size);
          } else if (typeof child === "object" && child !== null && "group" in child) {
            const groupName = child["group"] as string;
            const childSlug = slugify(groupName);
            walkGroup(child, childSlug);
          }
        }
      } else if ("group" in item) {
        const groupName = item["group"] as string;
        const groupSlug = slugify(groupName);
        walkGroup(item, groupSlug);
      }
    }
  }

  return { mapping, positions };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Parse a Mintlify documentation directory and produce a complete MigrationResult.
 *
 * Orchestration flow:
 * 1. Detect and read config file (docs.json or mint.json)
 * 2. Extract navigation structure, branding, redirects, OpenAPI flag
 * 3. Walk the directory for all .mdx/.md files referenced in navigation
 * 4. For each page: read content, run AST transform, extract frontmatter
 * 5. Build ParsedPage[] with title, slug, path, mdxContent, folderPath, position
 * 6. Build ParsedFolder[] from navigation groups
 * 7. Build ParsedNavTab[] from navigation tabs
 * 8. Build URL map: Mintlify URLs are file-path based with optional tab prefixes
 * 9. Collect asset references (image URLs)
 * 10. Return complete MigrationResult
 *
 * @param dirPath - Absolute path to the Mintlify documentation directory
 * @returns Complete migration result
 */
export async function parseMintlify(
  dirPath: string
): Promise<MigrationResult> {
  const warnings: string[] = [];
  const resolvedDir = resolve(dirPath);

  // ── Step 1: Read config ──────────────────────────────────────────────────
  const configFile = readConfigFile(resolvedDir);
  if (!configFile) {
    throw new Error(
      `No Mintlify config found in ${resolvedDir}. Expected docs.json or mint.json.`
    );
  }

  // ── Step 2: Parse config ─────────────────────────────────────────────────
  const configResult = parseMintlifyConfig(configFile.config);
  warnings.push(...configResult.warnings);

  // ── Step 3: Build page-folder assignment map from raw navigation ────────
  const pageFolderMap = buildPageFolderMap(configFile.config);

  // ── Step 4: Resolve and read page files ──────────────────────────────────
  const pages: ParsedPage[] = [];
  const allMdxContents: string[] = [];
  const resolvedPageRefs = new Set<string>();

  // Track per-folder page positions when not available from nav
  const folderPositionCounters = new Map<string, number>();

  for (const pageRef of configResult.pageRefs) {
    const resolved = resolvePageFile(resolvedDir, pageRef);
    if (!resolved) {
      warnings.push(
        `Page referenced in navigation but file not found: ${pageRef}`
      );
      continue;
    }

    resolvedPageRefs.add(resolved.relativePath);

    // Read and transform
    const rawContent = readFileSync(resolved.filePath, "utf-8");
    const transformed = await transformMintlifyMdx(rawContent);

    // Build full MDX content (frontmatter + body)
    const mdxContent = transformed.frontmatter
      ? `${transformed.frontmatter}\n\n${transformed.mdx}`
      : transformed.mdx;

    allMdxContents.push(mdxContent);

    // Determine title
    const title =
      transformed.metadata["title"] ||
      titleFromSlug(basename(pageRefToSlug(pageRef)));

    // Determine folder path from navigation structure
    const folderPath = pageFolderMap.mapping.get(pageRef) ?? "";

    // Determine position
    let position: number;
    if (pageFolderMap.positions.has(pageRef)) {
      position = pageFolderMap.positions.get(pageRef) ?? 0;
    } else {
      const currentCount = folderPositionCounters.get(folderPath) ?? 0;
      position = currentCount;
      folderPositionCounters.set(folderPath, currentCount + 1);
    }

    const slug = pageRefToSlug(pageRef);

    pages.push({
      title,
      slug,
      path: resolved.relativePath,
      mdxContent,
      folderPath,
      position,
      metadata: transformed.metadata,
    });
  }

  // ── Step 5: Find orphaned pages (on disk but not in navigation) ────────
  // Known Mintlify non-page directory prefixes (reusable content fragments)
  const SNIPPET_DIR_PREFIXES = ["snippets/", "_snippets/"];
  // Well-known repo meta-file basenames (never documentation pages)
  const REPO_META_BASENAMES = new Set([
    "readme",
    "contributing",
    "changelog",
    "license",
    "code_of_conduct",
    "agents",
    "claude",
    "security",
    "codeowners",
  ]);

  const allDiskFiles = walkDirectory(resolvedDir, resolvedDir);
  for (const diskFile of allDiskFiles) {
    if (resolvedPageRefs.has(diskFile)) continue;

    // Skip config files and non-page files
    const ext = extname(diskFile);
    if (!PAGE_EXTENSIONS.has(ext)) continue;

    // Skip files in Mintlify snippet directories
    if (SNIPPET_DIR_PREFIXES.some((prefix) => diskFile.startsWith(prefix)))
      continue;

    // Skip well-known repo meta-files
    const baseName = basename(diskFile, ext);
    if (REPO_META_BASENAMES.has(baseName.toLowerCase())) continue;

    const isIndex = baseName === "index" || baseName === "README";

    const filePath = resolve(resolvedDir, diskFile);
    const rawContent = readFileSync(filePath, "utf-8");
    const transformed = await transformMintlifyMdx(rawContent);

    const mdxContent = transformed.frontmatter
      ? `${transformed.frontmatter}\n\n${transformed.mdx}`
      : transformed.mdx;

    allMdxContents.push(mdxContent);

    const pageRef = diskFile.slice(0, -ext.length);
    const slug = pageRefToSlug(diskFile);
    const title =
      transformed.metadata["title"] ||
      titleFromSlug(baseName);

    warnings.push(
      `Page found on disk but not in navigation: ${diskFile}${isIndex ? " (index page)" : ""}`
    );

    pages.push({
      title,
      slug,
      path: diskFile,
      mdxContent,
      folderPath: "",
      position: pages.length,
      metadata: transformed.metadata,
    });
  }

  // ── Step 6: Build URL map ────────────────────────────────────────────────
  // Mintlify URLs are file-path based and map nearly 1:1 to InkLoom URLs
  const urlMap = new Map<string, string>();
  for (const page of pages) {
    const sourceUrl = `/${page.slug}`;
    // InkLoom preserves the same slug structure
    const targetUrl = `/${page.slug}`;
    urlMap.set(sourceUrl, targetUrl);
  }

  // ── Step 7: Collect assets ───────────────────────────────────────────────
  const assetResult = await collectAssets(allMdxContents, resolvedDir);
  warnings.push(...assetResult.warnings);

  // ── Step 8: Assemble result ──────────────────────────────────────────────
  const result: MigrationResult = {
    pages,
    folders: configResult.folders,
    navTabs:
      configResult.navTabs.length > 0 ? configResult.navTabs : undefined,
    redirects: configResult.redirects,
    assets: assetResult.assets,
    warnings,
    urlMap,
    branding: configResult.branding,
  };

  return result;
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable title from a slug.
 * "quickstart" → "Quickstart", "jwt-tokens" → "Jwt Tokens"
 */
function titleFromSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
