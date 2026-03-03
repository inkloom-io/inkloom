/**
 * MDX frontmatter parsing and serialization utilities.
 * Used by `pages push` and `pages pull` commands.
 *
 * Frontmatter format:
 * ---
 * title: Getting Started
 * slug: getting-started
 * position: 0
 * isPublished: true
 * icon: book
 * description: Learn how to set up InkLoom
 * ---
 */

export interface PageFrontmatter {
  title?: string;
  slug?: string;
  position?: number;
  isPublished?: boolean;
  icon?: string;
  description?: string;
}

const DELIMITER = "---";

/**
 * Parse YAML-style frontmatter from the beginning of an MDX file.
 * Returns the parsed frontmatter fields and the remaining body content.
 *
 * If no frontmatter delimiters are found, returns empty frontmatter
 * and the full content as body.
 */
export function parseFrontmatter(content: string): {
  frontmatter: PageFrontmatter;
  body: string;
} {
  const trimmedContent = content.trimStart();

  // Must start with ---
  if (!trimmedContent.startsWith(DELIMITER)) {
    return { frontmatter: {}, body: content };
  }

  // Find the closing delimiter
  const afterOpening = trimmedContent.indexOf("\n");
  if (afterOpening === -1) {
    return { frontmatter: {}, body: content };
  }

  // Check that the opening line is exactly "---" (with optional trailing whitespace)
  const openingLine = trimmedContent.slice(0, afterOpening).trim();
  if (openingLine !== DELIMITER) {
    return { frontmatter: {}, body: content };
  }

  const rest = trimmedContent.slice(afterOpening + 1);
  const closingIndex = rest.indexOf(`\n${DELIMITER}`);
  if (closingIndex === -1) {
    // No closing delimiter found — treat entire content as body
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = rest.slice(0, closingIndex);
  const frontmatter = parseYamlBlock(yamlBlock);

  // Body starts after the closing delimiter line.
  // The closing delimiter is at rest[closingIndex+1] through rest[closingIndex+DELIMITER.length].
  // Skip past the closing "---" and its trailing newline.
  let bodyStart = closingIndex + 1 + DELIMITER.length;
  const afterClosing = rest.slice(bodyStart);

  // Skip the rest of the closing delimiter line
  const lineEnd = afterClosing.indexOf("\n");
  let body: string;
  if (lineEnd === -1) {
    body = "";
  } else {
    body = afterClosing.slice(lineEnd + 1);
  }

  // Strip a single leading newline (the blank separator between frontmatter and body)
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }

  return { frontmatter, body };
}

/**
 * Parse a block of simple YAML key-value pairs into PageFrontmatter.
 * Handles:
 * - String values (with or without quotes)
 * - Boolean values ("true" / "false")
 * - Numeric values
 * - Quoted strings (single or double)
 */
function parseYamlBlock(block: string): PageFrontmatter {
  const result: PageFrontmatter = {};

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = trimmed.slice(colonIndex + 1).trim();

    if (!key || !rawValue) continue;

    const value = coerceValue(rawValue);

    switch (key) {
      case "title":
        result.title = String(value);
        break;
      case "slug":
        result.slug = String(value);
        break;
      case "position":
        result.position = typeof value === "number" ? value : undefined;
        break;
      case "isPublished":
        result.isPublished = typeof value === "boolean" ? value : undefined;
        break;
      case "icon":
        result.icon = String(value);
        break;
      case "description":
        result.description = String(value);
        break;
      // Ignore unknown keys
    }
  }

  return result;
}

/**
 * Coerce a raw YAML value string to the appropriate JS type.
 * - "true" / "false" → boolean
 * - Numeric strings → number
 * - Quoted strings → unquoted string
 * - Everything else → string
 */
function coerceValue(raw: string): string | number | boolean {
  // Boolean
  if (raw === "true") return true;
  if (raw === "false") return false;

  // Strip surrounding quotes (single or double)
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // Numeric (integer or float)
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  return raw;
}

/**
 * Serialize PageFrontmatter and body content into a complete MDX file string.
 * Only includes fields that are not undefined.
 * If frontmatter is empty (no defined fields), returns body without delimiters.
 */
export function serializeFrontmatter(
  frontmatter: PageFrontmatter,
  body: string
): string {
  const lines: string[] = [];

  if (frontmatter.title !== undefined) {
    lines.push(`title: ${formatYamlValue(frontmatter.title)}`);
  }
  if (frontmatter.slug !== undefined) {
    lines.push(`slug: ${formatYamlValue(frontmatter.slug)}`);
  }
  if (frontmatter.position !== undefined) {
    lines.push(`position: ${frontmatter.position}`);
  }
  if (frontmatter.isPublished !== undefined) {
    lines.push(`isPublished: ${frontmatter.isPublished}`);
  }
  if (frontmatter.icon !== undefined) {
    lines.push(`icon: ${formatYamlValue(frontmatter.icon)}`);
  }
  if (frontmatter.description !== undefined) {
    lines.push(`description: ${formatYamlValue(frontmatter.description)}`);
  }

  if (lines.length === 0) {
    return body;
  }

  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

/**
 * Format a string value for YAML output.
 * Quotes the value if it contains special characters.
 */
function formatYamlValue(value: string): string {
  // Quote if contains characters that could be ambiguous in YAML
  if (
    value.includes(":") ||
    value.includes("#") ||
    value.includes('"') ||
    value.includes("'") ||
    value.includes("\n") ||
    value.startsWith(" ") ||
    value.endsWith(" ") ||
    value === "true" ||
    value === "false" ||
    /^-?\d+(\.\d+)?$/.test(value)
  ) {
    // Use double quotes, escaping internal double quotes
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
