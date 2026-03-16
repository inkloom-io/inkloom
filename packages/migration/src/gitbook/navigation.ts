import { parse as parseYaml } from "yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedFolder, RedirectRule } from "../types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A page reference extracted from SUMMARY.md. */
export interface PageReference {
  /** Display title from the link text. */
  title: string;
  /** Optional sidebar title (from quoted text after href). */
  sidebarTitle?: string;
  /** File path relative to the docs root. */
  path: string;
  /** Folder path this page belongs to (empty string for root). */
  folderPath: string;
  /** Sort position within its folder. */
  position: number;
}

/** Parsed .gitbook.yaml configuration. */
export interface GitbookConfig {
  /** Root directory for documentation (default: "."). */
  root: string;
  /** Structure paths. */
  structure: {
    /** First page file path (default: "README.md"). */
    readme: string;
    /** Table of contents file path (default: "SUMMARY.md"). */
    summary: string;
  };
  /** Redirect rules from config. */
  redirects: RedirectRule[];
}

/** Complete navigation result from parsing. */
export interface GitbookNavigation {
  /** Parsed folder hierarchy. */
  folders: ParsedFolder[];
  /** Page references with positions. */
  pages: PageReference[];
  /** Redirect rules from .gitbook.yaml. */
  redirects: RedirectRule[];
}

// ---------------------------------------------------------------------------
// .gitbook.yaml parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `.gitbook.yaml` file and return structured configuration.
 *
 * @param yamlContent - Raw YAML string content.
 * @returns Parsed GitbookConfig with defaults applied.
 */
export function parseGitbookYaml(yamlContent: string): GitbookConfig {
  const raw = parseYaml(yamlContent) as Record<string, unknown> | null;

  const root = typeof raw?.root === "string" ? raw.root : ".";

  const structureRaw =
    raw?.structure && typeof raw.structure === "object"
      ? (raw.structure as Record<string, unknown>)
      : {};

  const structure = {
    readme:
      typeof structureRaw.readme === "string"
        ? structureRaw.readme
        : "README.md",
    summary:
      typeof structureRaw.summary === "string"
        ? structureRaw.summary
        : "SUMMARY.md",
  };

  const redirects: RedirectRule[] = [];
  if (raw?.redirects && typeof raw.redirects === "object") {
    const redirectMap = raw.redirects as Record<string, string>;
    for (const [from, to] of Object.entries(redirectMap)) {
      if (typeof to === "string") {
        const normalizedFrom = from.startsWith("/") ? from : `/${from}`;
        const normalizedTo = to.startsWith("/") ? to : `/${to}`;
        redirects.push({ from: normalizedFrom, to: normalizedTo, status: 301 });
      }
    }
  }

  return { root, structure, redirects };
}

// ---------------------------------------------------------------------------
// SUMMARY.md parsing
// ---------------------------------------------------------------------------

/** Internal representation of a parsed SUMMARY line. */
interface SummaryEntry {
  title: string;
  sidebarTitle?: string;
  href: string;
  depth: number;
  /** Group heading this entry belongs to (if any). */
  group?: string;
}

const LINK_PATTERN = /\[([^\]]+)\]\(([^)"]+)(?:\s+"([^"]+)")?\)/;

/**
 * Parse SUMMARY.md content into navigation structure.
 *
 * Supported syntax:
 * - `# Summary` or `# Table of contents` (top-level heading, ignored)
 * - `## Group Name` — creates a section group mapped to a folder
 * - `---` — separator between groups (ignored, groups are delimited by headings)
 * - `* [Title](path.md)` — page link
 * - `* [Title](path.md "Sidebar title")` — page link with sidebar title
 * - Nesting via 2-space or 4-space indentation (or tabs)
 *
 * @param summaryContent - Raw SUMMARY.md string.
 * @returns Parsed navigation structure.
 */
export function parseSummaryMd(summaryContent: string): GitbookNavigation {
  const lines = summaryContent.split("\n");
  const entries: SummaryEntry[] = [];
  let currentGroup: string | undefined;
  let groupIndex = 0;

  // Detect indentation unit from the file
  const indentUnit = detectIndentUnit(lines);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and separators
    if (trimmed === "" || trimmed === "---") {
      continue;
    }

    // Top-level heading (# Summary) — skip
    if (/^#\s+/.test(trimmed) && !/^##\s+/.test(trimmed)) {
      continue;
    }

    // Group heading (## Group Name)
    if (/^##\s+/.test(trimmed)) {
      currentGroup = trimmed.replace(/^##\s+/, "").trim();
      groupIndex++;
      continue;
    }

    // List item with link
    const linkMatch = LINK_PATTERN.exec(line);
    if (linkMatch) {
      const depth = getIndentDepth(line, indentUnit);
      const title = linkMatch[1];
      const href = linkMatch[2];
      const sidebarTitle = linkMatch[3];

      entries.push({
        title,
        sidebarTitle: sidebarTitle || undefined,
        href,
        depth,
        group: currentGroup,
      });
    }
  }

  return buildNavigation(entries);
}

/**
 * Detect the indentation unit (number of spaces per level) used in a file.
 * Returns the smallest non-zero indentation found, defaulting to 2.
 */
function detectIndentUnit(lines: string[]): number {
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === "" || /^#/.test(line.trim())) continue;
    const match = /^( +)[*\-+]/.exec(line);
    if (match) {
      const spaces = match[1].length;
      if (spaces > 0 && spaces < minIndent) {
        minIndent = spaces;
      }
    }
  }
  return minIndent === Infinity ? 2 : minIndent;
}

/**
 * Compute the nesting depth of a list line.
 * Supports space-based and tab indentation.
 */
function getIndentDepth(line: string, indentUnit: number): number {
  const match = /^(\s*)/.exec(line);
  if (!match) return 0;
  const indent = match[1];
  // Count tabs as one level each
  const tabs = (indent.match(/\t/g) || []).length;
  // Count remaining spaces (after replacing tabs)
  const spaces = indent.replace(/\t/g, "").length;
  const spaceDepth = indentUnit > 0 ? Math.floor(spaces / indentUnit) : 0;
  return tabs + spaceDepth;
}

/**
 * Build folder hierarchy and page references from parsed entries.
 */
function buildNavigation(entries: SummaryEntry[]): GitbookNavigation {
  const folders: ParsedFolder[] = [];
  const pages: PageReference[] = [];
  const folderSet = new Set<string>();
  const groupFolders = new Map<string, string>(); // group name -> folder path

  // Track parent stack for nesting: each element is { path, depth }
  const parentStack: Array<{ folderPath: string; depth: number }> = [];
  let groupPosition = 0;

  // First pass: create group folders
  const groups = [...new Set(entries.filter((e) => e.group).map((e) => e.group))];
  for (const group of groups) {
    if (!group) continue;
    const slug = slugify(group);
    const folderPath = slug;
    if (!folderSet.has(folderPath)) {
      folders.push({
        name: group,
        slug,
        path: folderPath,
        parentPath: undefined,
        position: groupPosition++,
      });
      folderSet.add(folderPath);
    }
    groupFolders.set(group, folderPath);
  }

  // Second pass: process entries, building nested folder hierarchy
  // Track position counters per folder path
  const positionCounters = new Map<string, number>();

  function getNextPosition(folderPath: string): number {
    const current = positionCounters.get(folderPath) ?? 0;
    positionCounters.set(folderPath, current + 1);
    return current;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const groupFolder = entry.group ? groupFolders.get(entry.group) : undefined;

    // Determine the effective depth accounting for group nesting
    const effectiveDepth = entry.depth;

    // Pop parent stack to find correct parent
    while (
      parentStack.length > 0 &&
      parentStack[parentStack.length - 1].depth >= effectiveDepth
    ) {
      parentStack.pop();
    }

    // Determine parent folder path
    let parentFolderPath: string;
    if (parentStack.length > 0) {
      parentFolderPath = parentStack[parentStack.length - 1].folderPath;
    } else if (groupFolder) {
      parentFolderPath = groupFolder;
    } else {
      parentFolderPath = "";
    }

    // Check if this entry has children (next entry has greater depth)
    const hasChildren =
      i + 1 < entries.length && entries[i + 1].depth > effectiveDepth;

    if (hasChildren) {
      // This entry represents a folder with a landing page
      const slug = slugFromHref(entry.href);
      const folderPath = parentFolderPath
        ? `${parentFolderPath}/${slug}`
        : slug;

      if (!folderSet.has(folderPath)) {
        folders.push({
          name: entry.title,
          slug,
          path: folderPath,
          parentPath: parentFolderPath || undefined,
          position: getNextPosition(parentFolderPath),
        });
        folderSet.add(folderPath);
      }

      // Also add the page itself (landing page of the folder)
      pages.push({
        title: entry.title,
        sidebarTitle: entry.sidebarTitle,
        path: entry.href,
        folderPath,
        position: getNextPosition(folderPath),
      });

      parentStack.push({ folderPath, depth: effectiveDepth });
    } else {
      // Leaf page
      pages.push({
        title: entry.title,
        sidebarTitle: entry.sidebarTitle,
        path: entry.href,
        folderPath: parentFolderPath,
        position: getNextPosition(parentFolderPath),
      });
    }
  }

  return { folders, pages, redirects: [] };
}

// ---------------------------------------------------------------------------
// Fallback: directory scan
// ---------------------------------------------------------------------------

/**
 * Build navigation hierarchy by scanning a directory for .md files.
 * Used as fallback when SUMMARY.md is not found.
 *
 * @param dirPath - Absolute path to the documentation root directory.
 * @returns Navigation structure derived from file paths.
 */
export function buildNavigationFromDirectory(
  dirPath: string
): GitbookNavigation {
  const mdFiles = findMarkdownFiles(dirPath, dirPath);
  // Sort for deterministic ordering
  mdFiles.sort();

  const folders: ParsedFolder[] = [];
  const pages: PageReference[] = [];
  const folderSet = new Set<string>();
  const positionCounters = new Map<string, number>();

  function getNextPosition(folderPath: string): number {
    const current = positionCounters.get(folderPath) ?? 0;
    positionCounters.set(folderPath, current + 1);
    return current;
  }

  for (const relPath of mdFiles) {
    const dirName = path.dirname(relPath);
    const folderPath = dirName === "." ? "" : dirName.replace(/\\/g, "/");

    // Ensure all ancestor folders exist
    if (folderPath) {
      const parts = folderPath.split("/");
      for (let i = 0; i < parts.length; i++) {
        const partial = parts.slice(0, i + 1).join("/");
        if (!folderSet.has(partial)) {
          const parentPath =
            i > 0 ? parts.slice(0, i).join("/") : undefined;
          folders.push({
            name: parts[i],
            slug: parts[i],
            path: partial,
            parentPath,
            position: getNextPosition(parentPath ?? ""),
          });
          folderSet.add(partial);
        }
      }
    }

    // Derive title from filename
    const basename = path.basename(relPath, path.extname(relPath));
    const title =
      basename === "README" || basename === "readme"
        ? folderPath
          ? path.basename(folderPath)
          : "Home"
        : basename.replace(/[-_]/g, " ");

    pages.push({
      title,
      path: relPath.replace(/\\/g, "/"),
      folderPath,
      position: getNextPosition(folderPath),
    });
  }

  return { folders, pages, redirects: [] };
}

/**
 * Recursively find all .md files under a directory.
 */
function findMarkdownFiles(rootDir: string, currentDir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(rootDir, fullPath));
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      results.push(path.relative(rootDir, fullPath));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Full entry point
// ---------------------------------------------------------------------------

/**
 * Parse Gitbook navigation from a local directory.
 *
 * 1. Reads `.gitbook.yaml` for configuration (root, structure, redirects).
 * 2. Attempts to parse `SUMMARY.md` for navigation hierarchy.
 * 3. Falls back to directory scanning if `SUMMARY.md` is missing.
 *
 * @param dirPath - Absolute path to the Git-synced Gitbook directory.
 * @returns Complete navigation structure with folders, pages, and redirects.
 */
export function parseGitbookNavigation(dirPath: string): GitbookNavigation {
  // 1. Parse .gitbook.yaml if it exists
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

  // 2. Resolve docs root
  const docsRoot = path.resolve(dirPath, config.root);

  // 3. Try SUMMARY.md
  const summaryPath = path.join(docsRoot, config.structure.summary);
  if (fs.existsSync(summaryPath)) {
    const summaryContent = fs.readFileSync(summaryPath, "utf-8");
    const nav = parseSummaryMd(summaryContent);
    nav.redirects = config.redirects;
    return nav;
  }

  // 4. Fallback to directory scan
  const nav = buildNavigationFromDirectory(docsRoot);
  nav.redirects = config.redirects;
  return nav;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugFromHref(href: string): string {
  // Remove file extension and extract the last segment
  const withoutExt = href.replace(/\.md$/i, "");
  const segments = withoutExt.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "index";
  // If it's a README, use the parent directory name
  if (last.toLowerCase() === "readme" && segments.length > 1) {
    return slugify(segments[segments.length - 2]);
  }
  return slugify(last);
}
