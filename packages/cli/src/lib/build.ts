/**
 * Build module — generates a static documentation site from Convex data.
 *
 * Fetches pages, folders, and project config from Convex, converts
 * BlockNote content to MDX, builds navigation, generates theme CSS,
 * and writes a deployable static site to the output directory.
 *
 * Uses pre-built SPA assets from the `create-inkloom` template and
 * generates individual HTML pages with embedded data.
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  blockNoteToMDX,
  parseBlockNoteContent,
  type BlockNoteBlock,
  type BlockNoteInlineContent,
} from "@inkloom/mdx-parser";
import { getPrebuiltAssets, getAssetManifest } from "create-inkloom";
import type { ConvexCliClient } from "./convex-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildOptions {
  /** Project ID to build (or slug lookup). */
  projectId: string;
  /** Branch ID to build. If omitted, uses default branch. */
  branchId?: string;
  /** Output directory (default: "dist"). */
  outDir?: string;
  /** Clean output directory before building. */
  clean?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
}

export interface BuildResult {
  /** Number of pages generated. */
  pageCount: number;
  /** Number of files written. */
  fileCount: number;
  /** Output directory path. */
  outDir: string;
}

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

interface PageWithContent {
  id: string;
  title: string;
  slug: string;
  path: string;
  content: string; // BlockNote JSON
  position: number;
  icon?: string;
  subtitle?: string;
  description?: string;
}

interface FolderData {
  id: string;
  name: string;
  slug: string;
  path: string;
  position: number;
  icon?: string;
  parentId?: string;
}

interface GeneratedFile {
  file: string;
  data: string | Buffer;
}

// ---------------------------------------------------------------------------
// Build orchestrator
// ---------------------------------------------------------------------------

export async function buildSite(
  client: ConvexCliClient,
  opts: BuildOptions
): Promise<BuildResult> {
  const outDir = opts.outDir || "dist";
  const log = opts.verbose ? (msg: string) => process.stderr.write(`  ${msg}\n`) : () => {};

  // 1. Fetch project
  log("Fetching project...");
  const project = await client.getProject(opts.projectId);
  if (!project) {
    throw new Error(`Project not found: ${opts.projectId}`);
  }

  // 2. Resolve branch
  let branchId = opts.branchId;
  if (!branchId) {
    if (!project.defaultBranchId) {
      throw new Error("Project has no default branch. Specify --branch.");
    }
    branchId = project.defaultBranchId;
  }
  log(`Using branch: ${branchId}`);

  // 3. Fetch pages and folders
  log("Fetching pages and folders...");
  const [rawPages, rawFolders] = await Promise.all([
    client.listPagesByBranch(branchId),
    client.listFoldersByBranch(branchId),
  ]);

  // 4. Fetch content for each page
  log(`Fetching content for ${rawPages.length} pages...`);
  const pagesWithContent: PageWithContent[] = [];
  for (const page of rawPages) {
    const contentDoc = await client.getPageContent(page._id);
    if (!contentDoc?.content) continue;

    pagesWithContent.push({
      id: page._id,
      title: page.title,
      slug: page.slug,
      path: page.path || `/${page.slug}`,
      content: contentDoc.content,
      position: page.position ?? 0,
      icon: page.icon,
      subtitle: page.subtitle,
      description: page.description,
    });
  }

  const folders: FolderData[] = rawFolders.map((f) => ({
    id: f._id,
    name: f.name,
    slug: f.slug,
    path: f.path || `/${f.slug}`,
    position: f.position ?? 0,
    icon: f.icon,
    parentId: f.parentId,
  }));

  // 5. Generate all files
  log("Generating site files...");
  const files: GeneratedFile[] = [];

  // Navigation
  const navigation = buildNavigation(pagesWithContent, folders);
  files.push({
    file: "lib/navigation.json",
    data: JSON.stringify(navigation, null, 2),
  });
  files.push({
    file: "lib/tabs.json",
    data: "[]",
  });
  files.push({
    file: "lib/all-navigation.json",
    data: JSON.stringify({ main: navigation, tabs: {} }, null, 2),
  });

  // Site data (embedded in HTML)
  const siteData = {
    config: {
      title: project.name,
      description: project.description || "",
      search: { enabled: true },
      showBranding: project.showBranding !== false,
    },
    navigation,
    tabs: [],
  };

  // MDX files
  for (const page of pagesWithContent) {
    const mdxContent = convertToMdx(page.content, page.title);
    const mdxPath = page.path === "/" ? "docs/index.mdx" : `docs${page.path}.mdx`;
    files.push({ file: mdxPath, data: mdxContent });
  }

  // Search index
  const searchDocuments = pagesWithContent.map((page) => ({
    id: page.path,
    title: page.title,
    headings: extractHeadings(page.content),
    content: extractPlainText(page.content),
    path: page.path,
    excerpt: page.description || "",
  }));
  files.push({
    file: "search-index.json",
    data: JSON.stringify({ documents: searchDocuments }, null, 2),
  });

  // 6. Get pre-built SPA assets
  log("Copying SPA assets...");
  let spaAssets: { path: string; content: Buffer }[] = [];
  let assetManifest: { js: string[]; css: string[] } = { js: [], css: [] };
  try {
    spaAssets = getPrebuiltAssets();
    assetManifest = getAssetManifest();
  } catch {
    log("Warning: Pre-built SPA assets not found. HTML pages will be minimal.");
  }

  // 7. Generate HTML pages
  log("Generating HTML pages...");
  const firstPage = pagesWithContent.sort((a, b) => a.position - b.position)[0];
  const firstPageHref = firstPage?.path || "/getting-started";

  // Shell (index.html) — redirects to first page
  files.push({
    file: "index.html",
    data: generateHtmlPage({
      title: project.name,
      description: project.description,
      siteData,
      assetManifest,
      redirectTo: firstPageHref,
    }),
  });

  // Individual page HTML files
  for (const page of pagesWithContent) {
    const mdxContent = convertToMdx(page.content, page.title);
    const htmlPath = page.path === "/" ? "index.html" : `${page.path.slice(1)}/index.html`;
    // Skip root index — already generated as redirect
    if (page.path === "/") continue;

    files.push({
      file: htmlPath,
      data: generateHtmlPage({
        title: `${page.title} - ${project.name}`,
        description: page.description,
        siteData,
        assetManifest,
        pageContent: mdxContent,
        pageTitle: page.title,
      }),
    });
  }

  // 8. Write all files to disk
  log(`Writing ${files.length + spaAssets.length} files to ${outDir}/...`);
  if (opts.clean && existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }

  const writtenPaths = new Set<string>();

  // Write SPA assets FIRST (so generated files can override, e.g. index.html)
  for (const asset of spaAssets) {
    const filePath = join(outDir, asset.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, asset.content);
    writtenPaths.add(filePath);
  }

  // Write generated files SECOND (override SPA defaults like index.html)
  for (const file of files) {
    const filePath = join(outDir, file.file);
    mkdirSync(dirname(filePath), { recursive: true });
    if (typeof file.data === "string") {
      writeFileSync(filePath, file.data, "utf-8");
    } else {
      writeFileSync(filePath, file.data);
    }
    writtenPaths.add(filePath);
  }

  return {
    pageCount: pagesWithContent.length,
    fileCount: writtenPaths.size,
    outDir,
  };
}

// ---------------------------------------------------------------------------
// Navigation builder
// ---------------------------------------------------------------------------

function buildNavigation(pages: PageWithContent[], folders: FolderData[]): NavItem[] {
  const navigation: NavItem[] = [];

  // Root pages (depth 1: /slug)
  const rootPages = pages
    .filter((p) => p.path !== "/" && p.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);

  // Root folders (depth 1: /slug)
  const rootFolders = folders
    .filter((f) => f.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);

  // Interleave folders and pages — pages above folders at root level, sorted by position within each group
  const rootItems = [
    ...rootPages.map((p) => ({ type: "page" as const, item: p, position: p.position })),
    ...rootFolders.map((f) => ({ type: "folder" as const, item: f, position: f.position })),
  ].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "page" ? -1 : 1;
    }
    return a.position - b.position;
  });

  for (const entry of rootItems) {
    if (entry.type === "folder") {
      const folder = entry.item as FolderData;
      const children = buildFolderChildren(folder, pages, folders);
      const navItem: NavItem = {
        title: folder.name,
        href: folder.path,
        children,
      };
      if (folder.icon) navItem.icon = folder.icon;
      navigation.push(navItem);
    } else {
      const page = entry.item as PageWithContent;
      const navItem: NavItem = {
        title: page.title,
        href: page.path,
      };
      if (page.icon) navItem.icon = page.icon;
      navigation.push(navItem);
    }
  }

  return navigation;
}

function buildFolderChildren(
  folder: FolderData,
  pages: PageWithContent[],
  folders: FolderData[]
): NavItem[] {
  const depth = folder.path.split("/").length;

  const childPages = pages
    .filter(
      (p) =>
        p.path.startsWith(folder.path + "/") &&
        p.path.split("/").length === depth + 1
    )
    .sort((a, b) => a.position - b.position);

  const childFolders = folders
    .filter(
      (f) =>
        f.path.startsWith(folder.path + "/") &&
        f.path.split("/").length === depth + 1
    )
    .sort((a, b) => a.position - b.position);

  const items = [
    ...childFolders.map((f) => ({ type: "folder" as const, item: f, position: f.position })),
    ...childPages.map((p) => ({ type: "page" as const, item: p, position: p.position })),
  ].sort((a, b) => a.position - b.position);

  const children: NavItem[] = [];
  for (const entry of items) {
    if (entry.type === "folder") {
      const f = entry.item as FolderData;
      const navItem: NavItem = {
        title: f.name,
        href: f.path,
        children: buildFolderChildren(f, pages, folders),
      };
      if (f.icon) navItem.icon = f.icon;
      children.push(navItem);
    } else {
      const p = entry.item as PageWithContent;
      const navItem: NavItem = {
        title: p.title,
        href: p.path,
      };
      if (p.icon) navItem.icon = p.icon;
      children.push(navItem);
    }
  }

  return children;
}

// ---------------------------------------------------------------------------
// Content conversion
// ---------------------------------------------------------------------------

function convertToMdx(content: string, title: string): string {
  try {
    const blocks = parseBlockNoteContent(content);
    if (blocks && blocks.length > 0) {
      const mdx = blockNoteToMDX(blocks);
      return `---\ntitle: "${escapeYaml(title)}"\n---\n\n${mdx}`;
    }
  } catch {
    // If parsing fails, treat content as raw MDX
  }

  // If content is already MDX or plain text
  if (content.startsWith("---") || content.startsWith("#")) {
    return content;
  }
  return `---\ntitle: "${escapeYaml(title)}"\n---\n\n${content}`;
}

function escapeYaml(s: string): string {
  return s.replace(/"/g, '\\"');
}

function getBlockTextContent(block: BlockNoteBlock): string {
  if (!block.content || !Array.isArray(block.content)) return "";
  return (block.content as BlockNoteInlineContent[])
    .filter((i) => i.type === "text" && i.text)
    .map((i) => i.text!)
    .join("");
}

function extractHeadings(content: string): string[] {
  try {
    const blocks = parseBlockNoteContent(content);
    if (!blocks) return [];
    return blocks
      .filter((b) => b.type === "heading")
      .map((b) => getBlockTextContent(b))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractPlainText(content: string): string {
  try {
    const blocks = parseBlockNoteContent(content);
    if (!blocks) return "";
    return blocks
      .map((b) => getBlockTextContent(b))
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

interface HtmlPageOptions {
  title: string;
  description?: string;
  siteData: object;
  assetManifest: { js: string[]; css: string[] };
  pageContent?: string;
  pageTitle?: string;
  redirectTo?: string;
}

function generateHtmlPage(opts: HtmlPageOptions): string {
  const cssLinks = opts.assetManifest.css
    .map((href) => `    <link rel="stylesheet" href="/${href}" />`)
    .join("\n");
  const jsScripts = opts.assetManifest.js
    .map((src) => `    <script type="module" src="/${src}"></script>`)
    .join("\n");

  const metaDesc = opts.description
    ? `    <meta name="description" content="${escapeHtml(opts.description)}" />`
    : "";

  const redirectMeta = opts.redirectTo
    ? `    <meta http-equiv="refresh" content="0;url=${opts.redirectTo}" />`
    : "";

  const pageDataScript = opts.pageContent
    ? `    <script id="__PAGE_DATA__" type="application/json">${JSON.stringify({
        title: opts.pageTitle || "",
        content: opts.pageContent,
      })}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(opts.title)}</title>
${metaDesc}
${redirectMeta}
${cssLinks}
  </head>
  <body>
    <div id="root"></div>
    <script id="__INKLOOM_DATA__" type="application/json">${JSON.stringify(opts.siteData)}</script>
${pageDataScript}
${jsScripts}
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
