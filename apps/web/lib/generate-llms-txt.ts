import { blockNoteToMDX, parseBlockNoteContent } from "./blocknote-to-mdx";

interface Page {
  title: string;
  slug: string;
  path: string;
  content: string;
  position: number;
}

interface Folder {
  name: string;
  slug: string;
  path: string;
  position: number;
}

interface LlmsTxtConfig {
  name: string;
  description?: string;
}

/**
 * Auto-generate an llms.txt file from published pages and folders.
 *
 * Structure:
 * - H1: project name
 * - Blockquote: project description
 * - Folders → H2, their pages → H3, nested subfolders → H4+
 * - Root-level pages (no folder) → H2
 */
export function generateLlmsTxt(
  pages: Page[],
  folders: Folder[],
  config: LlmsTxtConfig
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${config.name}`);
  if (config.description) {
    lines.push("");
    lines.push(`> ${config.description}`);
  }

  // Build folder tree
  const foldersByPath = new Map<string, Folder>();
  for (const f of folders) {
    foldersByPath.set(f.path, f);
  }

  // Group pages by their parent folder path
  const pagesByFolderPath = new Map<string, Page[]>();
  const rootPages: Page[] = [];

  for (const page of pages) {
    // Derive the folder path from the page path (everything before the last segment)
    const lastSlash = page.path.lastIndexOf("/");
    const folderPath = lastSlash > 0 ? page.path.substring(0, lastSlash) : "";

    if (folderPath && foldersByPath.has(folderPath)) {
      const existing = pagesByFolderPath.get(folderPath) || [];
      existing.push(page);
      pagesByFolderPath.set(folderPath, existing);
    } else {
      rootPages.push(page);
    }
  }

  // Sort pages within each group by position
  for (const [, groupPages] of pagesByFolderPath) {
    groupPages.sort((a, b) => a.position - b.position);
  }
  rootPages.sort((a, b) => a.position - b.position);

  // Build folder hierarchy: root folders (no parent path segments beyond one)
  // then process recursively
  const rootFolders = folders
    .filter((f) => {
      // Root folder = path has exactly one segment, e.g. "/getting-started"
      const segments = f.path.split("/").filter(Boolean);
      return segments.length === 1;
    })
    .sort((a, b) => a.position - b.position);

  function getSubfolders(parentPath: string): Folder[] {
    return folders
      .filter((f) => {
        if (!f.path.startsWith(parentPath + "/")) return false;
        // Direct child: no more slashes after parentPath/
        const rest = f.path.substring(parentPath.length + 1);
        return !rest.includes("/");
      })
      .sort((a, b) => a.position - b.position);
  }

  function renderFolder(folder: Folder, depth: number) {
    const headingLevel = Math.min(depth + 2, 6); // H2 for root folders, H3 for pages, H4+ for nested
    const heading = "#".repeat(headingLevel);

    lines.push("");
    lines.push(`${heading} ${folder.name}`);

    // Render pages in this folder
    const folderPages = pagesByFolderPath.get(folder.path) || [];
    const pageHeading = "#".repeat(Math.min(headingLevel + 1, 6));

    for (const page of folderPages) {
      lines.push("");
      lines.push(`${pageHeading} ${page.title}`);
      lines.push("");
      const markdown = renderPageContent(page);
      if (markdown) {
        lines.push(markdown);
      }
    }

    // Recurse into subfolders
    const subfolders = getSubfolders(folder.path);
    for (const sub of subfolders) {
      renderFolder(sub, depth + 1);
    }
  }

  // Render root folders and their contents
  for (const folder of rootFolders) {
    renderFolder(folder, 0);
  }

  // Render root-level pages (not in any folder)
  for (const page of rootPages) {
    lines.push("");
    lines.push(`## ${page.title}`);
    lines.push("");
    const markdown = renderPageContent(page);
    if (markdown) {
      lines.push(markdown);
    }
  }

  return lines.join("\n").trim() + "\n";
}

function renderPageContent(page: Page): string {
  try {
    const blocks = parseBlockNoteContent(page.content);
    return blockNoteToMDX(blocks).trim();
  } catch {
    return "";
  }
}
