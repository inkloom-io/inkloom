import { transformLatex } from "../latex.js";
import { stripLeadingH1 } from "../strip-leading-h1.js";

/**
 * Component rename map: Mintlify component name → { name, type } for InkLoom Callout.
 */
const COMPONENT_RENAME_MAP: Record<
  string,
  { name: string; type: string }
> = {
  Note: { name: "Callout", type: "info" },
  Warning: { name: "Callout", type: "warning" },
  Tip: { name: "Callout", type: "tip" },
  Info: { name: "Callout", type: "info" },
  Check: { name: "Callout", type: "success" },
};

/**
 * Mintlify-only frontmatter fields that should be stripped during migration.
 */
const MINTLIFY_ONLY_FIELDS = new Set(["openapi", "api", "mode"]);

/**
 * Frontmatter fields to preserve during migration.
 */
const PRESERVED_FIELDS = new Set(["title", "description", "icon"]);

interface FrontmatterResult {
  /** Cleaned frontmatter string (YAML block) or empty string if no fields remain. */
  frontmatter: string;
  /** Extracted metadata for use by the migration pipeline. */
  metadata: Record<string, string>;
  /** OpenAPI directive value if this page is an endpoint placeholder (e.g. "POST /plants"). */
  openapiDirective?: string;
}

/**
 * Parse and transform Mintlify frontmatter.
 *
 * - Strips Mintlify-only fields (openapi, api, mode)
 * - Preserves title, description, icon
 * - Maps sidebarTitle → title if no title present
 */
export function transformFrontmatter(raw: string): FrontmatterResult {
  const lines = raw.split("\n");
  const metadata: Record<string, string> = {};
  const kept: string[] = [];

  let hasTitle = false;
  let sidebarTitleValue: string | null = null;
  let openapiDirective: string | undefined;

  // First pass: parse all fields and identify what we have
  for (const line of lines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!match) {
      // Preserve non-field lines (comments, multi-line values, etc.)
      kept.push(line);
      continue;
    }

    const [, key, value] = match;
    const trimmedValue = value.trim().replace(/^["']|["']$/g, "");

    if (key === "title") {
      hasTitle = true;
    }

    if (key === "sidebarTitle") {
      sidebarTitleValue = trimmedValue;
      continue; // Don't add yet; we'll decide below
    }

    if (key === "openapi" || key === "api") {
      if (trimmedValue) {
        openapiDirective = trimmedValue;
      }
    }

    if (MINTLIFY_ONLY_FIELDS.has(key)) {
      continue; // Strip
    }

    if (PRESERVED_FIELDS.has(key)) {
      metadata[key] = trimmedValue;
    }

    kept.push(line);
  }

  // Map sidebarTitle → title if no title present
  if (!hasTitle && sidebarTitleValue) {
    kept.push(`title: ${sidebarTitleValue}`);
    metadata["title"] = sidebarTitleValue;
  }

  // Filter out empty lines that would produce blank frontmatter
  const meaningful = kept.filter((l) => l.trim() !== "");

  if (meaningful.length === 0) {
    return { frontmatter: "", metadata, openapiDirective };
  }

  return {
    frontmatter: `---\n${meaningful.join("\n")}\n---`,
    metadata,
    openapiDirective,
  };
}

/**
 * Split an MDX string into frontmatter and body.
 */
function splitFrontmatter(mdx: string): { rawFrontmatter: string; body: string } {
  const trimmed = mdx.trimStart();
  if (!trimmed.startsWith("---")) {
    return { rawFrontmatter: "", body: mdx };
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return { rawFrontmatter: "", body: mdx };
  }

  const rawFrontmatter = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3);

  return { rawFrontmatter, body };
}

/**
 * Build the opening tag string for a renamed Callout component.
 */
function buildOpenTag(name: string, type: string, existingAttrs: string): string {
  if (/\btype\s*=/.test(existingAttrs)) {
    return `<${name} ${existingAttrs}>`;
  }
  const typeAttr = `type="${type}"`;
  if (existingAttrs) {
    return `<${name} ${typeAttr} ${existingAttrs}>`;
  }
  return `<${name} ${typeAttr}>`;
}

/**
 * Rename Mintlify callout components in MDX body using string replacement.
 *
 * Converts elements like `<Note>text</Note>` to multi-line format:
 * ```
 * <Callout type="info">
 * text
 * </Callout>
 * ```
 *
 * Multi-line format is required because mdxToBlockNote() (via remark-mdx) only
 * recognizes JSX as flow elements when opening/closing tags are on their own lines.
 * Single-line JSX is parsed as inline text elements and won't produce callout blocks.
 */
function renameComponents(body: string): string {
  let result = body;

  for (const [mintlifyName, { name, type }] of Object.entries(COMPONENT_RENAME_MAP)) {
    // Match full elements: <Note>content</Note> (single or multi-line)
    // Uses [\s\S]*? for non-greedy match across newlines
    const fullElementRegex = new RegExp(
      `<${mintlifyName}(\\s[^>]*)?>([\\s\\S]*?)</${mintlifyName}>`,
      "g",
    );
    result = result.replace(fullElementRegex, (_match, attrs, content) => {
      const existingAttrs = attrs ? attrs.trim() : "";
      const openTag = buildOpenTag(name, type, existingAttrs);
      const trimmedContent = content.trim();
      // Always output in multi-line format for flow element parsing
      return `${openTag}\n${trimmedContent}\n</${name}>`;
    });

    // Replace self-closing tags: <Note /> or <Note attr="val" />
    const selfCloseRegex = new RegExp(
      `<${mintlifyName}(\\s[^>]*)?\\/\\s*>`,
      "g",
    );
    result = result.replace(selfCloseRegex, (_match, attrs) => {
      const existingAttrs = attrs ? attrs.trim() : "";
      if (/\btype\s*=/.test(existingAttrs)) {
        return `<${name} ${existingAttrs} />`;
      }
      const typeAttr = `type="${type}"`;
      if (existingAttrs) {
        return `<${name} ${typeAttr} ${existingAttrs} />`;
      }
      return `<${name} ${typeAttr} />`;
    });
  }

  return result;
}

/**
 * Regex to match Mintlify snippet import statements.
 * Captures: component name (group 1) and file path (group 2).
 *
 * Only matches local file imports (paths starting with /, ./, or ../),
 * NOT npm package imports like '@mintlify/components' or 'react'.
 *
 * Matches patterns like:
 *   import ComponentName from '/snippets/file-name.mdx';
 *   import ComponentName from './snippets/nested/file-name.mdx';
 *   import ComponentName from '../snippets/file-name';
 */
const SNIPPET_IMPORT_RE = /import\s+(\w+)\s+from\s+['"](\.{0,2}\/[^'"]+)['"]/g;

/**
 * Extract snippet import statements from MDX content.
 * Returns a map of component name → file path, and the body with import lines removed.
 */
export function extractSnippetImports(body: string): {
  snippetImports: Record<string, string>;
  bodyWithoutImports: string;
} {
  const snippetImports: Record<string, string> = {};
  const importLines = new Set<string>();

  // Strip fenced code blocks before matching to avoid false positives
  // on example imports inside ```...``` blocks.
  // Preserve newlines so line-based import removal still works on the original body.
  const bodyWithoutCodeBlocks = body.replace(
    /^```[\s\S]*?^```/gm,
    (match) => match.replace(/[^\n]/g, " "),
  );

  let match: RegExpExecArray | null;
  // Reset lastIndex to ensure clean matching
  SNIPPET_IMPORT_RE.lastIndex = 0;
  while ((match = SNIPPET_IMPORT_RE.exec(bodyWithoutCodeBlocks)) !== null) {
    const componentName = match[1];
    const filePath = match[2];
    if (componentName && filePath) {
      snippetImports[componentName] = filePath;
      importLines.add(match[0]);
    }
  }

  // Remove import lines from body
  let bodyWithoutImports = body;
  for (const importLine of importLines) {
    // Remove the full line containing the import (including trailing semicolons and newlines)
    bodyWithoutImports = bodyWithoutImports.replace(
      new RegExp(`^[ \\t]*${escapeRegExp(importLine)}[;]?[ \\t]*\\n?`, "gm"),
      "",
    );
  }

  return { snippetImports, bodyWithoutImports };
}

/**
 * Escape special regex characters in a string for use in a RegExp constructor.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Transform Mintlify MDX content to InkLoom-compatible MDX.
 *
 * This function:
 * 1. Parses frontmatter and strips/maps Mintlify-specific fields
 * 2. Extracts snippet import statements and builds a component-name → file-path map
 * 3. Renames Mintlify callout components (Note, Warning, Tip, Info, Check) to <Callout type="...">
 * 4. Leaves all other components unchanged (they're already InkLoom-compatible)
 * 5. Returns the MDX body (without frontmatter) ready for mdxToBlockNote()
 *
 * @param mintlifyMdx - Raw Mintlify MDX content string
 * @returns Object with mdx body, optional frontmatter string, metadata, and snippet imports
 */
export async function transformMintlifyMdx(
  mintlifyMdx: string,
): Promise<{
  mdx: string;
  frontmatter?: string;
  metadata: Record<string, string>;
  snippetImports: Record<string, string>;
  openapiDirective?: string;
}> {
  const { rawFrontmatter, body } = splitFrontmatter(mintlifyMdx);

  // Transform frontmatter
  const { frontmatter, metadata, openapiDirective } = rawFrontmatter
    ? transformFrontmatter(rawFrontmatter)
    : { frontmatter: "", metadata: {}, openapiDirective: undefined };

  // Extract snippet imports before component renaming
  const { snippetImports, bodyWithoutImports } = extractSnippetImports(body);

  // Rename Mintlify components in MDX body
  const transformedBody = renameComponents(bodyWithoutImports);

  // Strip leading H1 — the title is always set from frontmatter for Mintlify
  // pages, so a leading H1 would be duplicated in the rendered page.
  const h1Stripped = stripLeadingH1(transformedBody);

  // Transform LaTeX delimiters to <Latex> components (after all other transforms)
  const latexTransformed = transformLatex(h1Stripped);

  return {
    mdx: latexTransformed.trim() + "\n",
    frontmatter: frontmatter || undefined,
    metadata,
    snippetImports,
    openapiDirective,
  };
}
