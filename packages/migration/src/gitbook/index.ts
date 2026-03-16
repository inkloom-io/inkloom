/**
 * Gitbook migration orchestrator.
 *
 * Wires the SUMMARY.md navigation parser, block syntax pre-processor,
 * asset collection, and redirect merging into a complete migration pipeline.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseGitbookNavigation,
  parseGitbookYaml,
  type GitbookConfig,
  type PageReference,
} from "./navigation.js";
import { transformGitbookBlocks, type TransformResult } from "./transform.js";
import { collectAssets } from "../assets.js";
import type {
  MigrationResult,
  ParsedPage,
  ParsedFolder,
  RedirectRule,
  MigrationAsset,
} from "../types.js";

// Re-export sub-modules for consumers
export { transformGitbookBlocks, type TransformResult } from "./transform.js";
export {
  parseGitbookNavigation,
  parseGitbookYaml,
  parseSummaryMd,
  buildNavigationFromDirectory,
  type GitbookConfig,
  type GitbookNavigation,
  type PageReference,
} from "./navigation.js";

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Extract YAML frontmatter from markdown content.
 * Returns the metadata object and the content without the frontmatter block.
 */
function extractFrontmatter(content: string): {
  metadata: Record<string, unknown>;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const rawYaml = match[1];
  const body = content.slice(match[0].length).replace(/^\r?\n/, "");
  const metadata: Record<string, unknown> = {};

  // Simple key: value parser (avoids adding a yaml dep just for frontmatter)
  for (const line of rawYaml.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value: string | boolean = line.slice(colonIndex + 1).trim();
    if (!key) continue;

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Coerce booleans
    if (value === "true") {
      metadata[key] = true;
    } else if (value === "false") {
      metadata[key] = false;
    } else {
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugFromFilePath(filePath: string): string {
  const withoutExt = filePath.replace(/\.mdx?$/i, "");
  const segments = withoutExt.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "index";

  // README files use their parent folder name as slug, or "index" for root
  if (last.toLowerCase() === "readme") {
    return segments.length > 1 ? slugify(segments[segments.length - 2]) : "index";
  }
  return slugify(last);
}

// ---------------------------------------------------------------------------
// URL map builder
// ---------------------------------------------------------------------------

/**
 * Build URL map from Gitbook page paths to InkLoom slugs.
 *
 * Gitbook URLs mirror the SUMMARY.md hierarchy — file paths (minus .md)
 * become URL paths. We map those to the InkLoom folder/slug structure.
 */
function buildUrlMap(
  pages: ParsedPage[],
): Map<string, string> {
  const urlMap = new Map<string, string>();

  for (const page of pages) {
    // Source URL: file path without extension, leading slash
    const sourcePath = "/" + page.path.replace(/\.mdx?$/i, "").replace(/\/README$/i, "");
    // Normalise root README
    const normalizedSource = sourcePath === "/" ? "/" : sourcePath;

    // Target URL: folderPath/slug
    const targetPath = page.folderPath
      ? `/${page.folderPath}/${page.slug}`
      : `/${page.slug}`;

    // Normalise index
    const normalizedTarget = page.slug === "index" && !page.folderPath
      ? "/"
      : targetPath;

    urlMap.set(normalizedSource, normalizedTarget);
  }

  return urlMap;
}

// ---------------------------------------------------------------------------
// Structural redirect generation
// ---------------------------------------------------------------------------

/**
 * Generate redirect rules for any URL changes between source and target.
 */
function buildStructuralRedirects(urlMap: Map<string, string>): RedirectRule[] {
  const redirects: RedirectRule[] = [];
  for (const [from, to] of urlMap) {
    if (from !== to) {
      redirects.push({ from, to, status: 301 });
    }
  }
  return redirects;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export interface ParseGitbookOptions {
  /** Custom fetch function for downloading remote assets (useful for testing). */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Parse a Gitbook documentation directory into a complete MigrationResult.
 *
 * Orchestration flow:
 * 1. Read `.gitbook.yaml` for config (root dir, structure paths, redirects)
 * 2. Parse SUMMARY.md (or fall back to directory scan) for navigation
 * 3. Walk the directory for all referenced .md/.mdx files
 * 4. For each page: read content, run block syntax pre-processor, extract frontmatter
 * 5. Build ParsedPage[] with title, slug, path, mdxContent, folderPath, position
 * 6. Build ParsedFolder[] from SUMMARY.md heading groups
 * 7. Build URL map from Gitbook paths to InkLoom slugs
 * 8. Collect asset references including .gitbook/assets/ directory
 * 9. Merge redirects from .gitbook.yaml with structural redirects
 * 10. Return complete MigrationResult
 *
 * @param dirPath - Absolute path to the Gitbook documentation directory.
 * @param options - Optional configuration.
 * @returns Complete migration result.
 */
export async function parseGitbook(
  dirPath: string,
  options: ParseGitbookOptions = {},
): Promise<MigrationResult> {
  const warnings: string[] = [];

  // 1. Read .gitbook.yaml for config
  let config: GitbookConfig = {
    root: ".",
    structure: { readme: "README.md", summary: "SUMMARY.md" },
    redirects: [],
  };

  const yamlPath = path.join(dirPath, ".gitbook.yaml");
  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    config = parseGitbookYaml(yamlContent);
  }

  // 2. Parse navigation (SUMMARY.md or directory fallback)
  const navigation = parseGitbookNavigation(dirPath);

  // Resolve docs root for file reading
  const docsRoot = path.resolve(dirPath, config.root);

  // 3. Collect all referenced file paths and discover extra files
  const referencedPaths = new Set(navigation.pages.map((p) => p.path));
  const extraFiles = discoverExtraFiles(docsRoot, referencedPaths);

  for (const extra of extraFiles) {
    warnings.push(`Page not in SUMMARY.md (included with warning): ${extra}`);
  }

  // Build a lookup map from path -> PageReference for SUMMARY.md pages
  const pageRefMap = new Map<string, PageReference>();
  for (const ref of navigation.pages) {
    pageRefMap.set(ref.path, ref);
  }

  // 4-5. Process each page: read, transform, extract frontmatter, build ParsedPage
  const allPagePaths = [...referencedPaths, ...extraFiles];
  const pages: ParsedPage[] = [];
  const allContents: string[] = [];

  // Track position for extra files (those not in SUMMARY.md)
  let extraPosition = 0;

  for (const pagePath of allPagePaths) {
    const fullPath = path.join(docsRoot, pagePath);

    // Read file content
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(fullPath, "utf-8");
    } catch {
      warnings.push(`Could not read file: ${pagePath}`);
      continue;
    }

    // Extract frontmatter
    const { metadata, body } = extractFrontmatter(rawContent);

    // Run block syntax pre-processor
    const transformed: TransformResult = transformGitbookBlocks(body);

    // Determine page properties from SUMMARY.md ref or derive them
    const ref = pageRefMap.get(pagePath);

    const title =
      (typeof metadata.title === "string" && metadata.title) ||
      (ref ? ref.title : deriveTitleFromContent(body, pagePath));

    const slug = slugFromFilePath(pagePath);
    const folderPath = ref ? ref.folderPath : deriveFolderPath(pagePath);
    const position = ref ? ref.position : extraPosition++;

    pages.push({
      title,
      slug,
      path: pagePath,
      mdxContent: transformed.content,
      folderPath,
      position,
      metadata,
    });

    allContents.push(transformed.content);
  }

  // 6. Build ParsedFolder[] from navigation
  const folders: ParsedFolder[] = navigation.folders;

  // Ensure folders exist for extra files' paths
  ensureFoldersForExtraFiles(extraFiles, folders);

  // 7. Build URL map
  const urlMap = buildUrlMap(pages);

  // 8. Collect assets (including .gitbook/assets/ directory)
  const assetResult = await collectAssets(allContents, docsRoot, {
    includeGitbookAssets: true,
    fetchFn: options.fetchFn,
  });

  warnings.push(...assetResult.warnings);
  const assets: MigrationAsset[] = assetResult.assets;

  // 9. Merge redirects: .gitbook.yaml redirects + structural redirects
  const structuralRedirects = buildStructuralRedirects(urlMap);
  const allRedirects = deduplicateRedirects([
    ...config.redirects,
    ...structuralRedirects,
  ]);

  // 10. Return complete result
  return {
    pages,
    folders,
    redirects: allRedirects,
    assets,
    warnings,
    urlMap,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Discover .md/.mdx files in the docs root that are NOT referenced in SUMMARY.md.
 */
function discoverExtraFiles(
  docsRoot: string,
  referencedPaths: Set<string>,
): string[] {
  const extras: string[] = [];
  walkMarkdownFiles(docsRoot, docsRoot, (relPath) => {
    // Skip SUMMARY.md itself and .gitbook directory
    if (
      relPath === "SUMMARY.md" ||
      relPath.startsWith(".gitbook/") ||
      relPath.startsWith(".gitbook\\")
    ) {
      return;
    }
    if (!referencedPaths.has(relPath)) {
      extras.push(relPath);
    }
  });
  return extras.sort();
}

/**
 * Recursively walk a directory collecting .md/.mdx file paths.
 */
function walkMarkdownFiles(
  rootDir: string,
  currentDir: string,
  callback: (relPath: string) => void,
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(rootDir, fullPath, callback);
    } else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      callback(relPath);
    }
  }
}

/**
 * Derive a page title from content (first heading) or filename.
 */
function deriveTitleFromContent(body: string, filePath: string): string {
  // Try first heading
  const headingMatch = /^#\s+(.+)$/m.exec(body);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Fall back to filename
  const basename = path.basename(filePath, path.extname(filePath));
  if (basename.toLowerCase() === "readme") {
    const dir = path.dirname(filePath);
    return dir === "." ? "Home" : path.basename(dir);
  }
  return basename.replace(/[-_]/g, " ");
}

/**
 * Derive folder path for a file not in SUMMARY.md based on its directory.
 */
function deriveFolderPath(filePath: string): string {
  const dir = path.dirname(filePath);
  return dir === "." ? "" : dir.replace(/\\/g, "/");
}

/**
 * Ensure ParsedFolder entries exist for directories containing extra files.
 */
function ensureFoldersForExtraFiles(
  extraFiles: string[],
  folders: ParsedFolder[],
): void {
  const folderSet = new Set(folders.map((f) => f.path));
  let nextPosition = folders.length;

  for (const filePath of extraFiles) {
    const dir = path.dirname(filePath);
    if (dir === ".") continue;

    const parts = dir.replace(/\\/g, "/").split("/");
    for (let i = 0; i < parts.length; i++) {
      const folderPath = parts.slice(0, i + 1).join("/");
      if (!folderSet.has(folderPath)) {
        const parentPath = i > 0 ? parts.slice(0, i).join("/") : undefined;
        folders.push({
          name: parts[i],
          slug: slugify(parts[i]),
          path: folderPath,
          parentPath,
          position: nextPosition++,
        });
        folderSet.add(folderPath);
      }
    }
  }
}

/**
 * Deduplicate redirect rules, keeping first occurrence of each `from`.
 */
function deduplicateRedirects(rules: RedirectRule[]): RedirectRule[] {
  const seen = new Set<string>();
  const result: RedirectRule[] = [];
  for (const rule of rules) {
    if (!seen.has(rule.from)) {
      seen.add(rule.from);
      result.push(rule);
    }
  }
  return result;
}
