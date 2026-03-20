import katex from "katex";

export interface ParsedComponent {
  type:
    | "Card"
    | "CardGroup"
    | "Callout"
    | "Image"
    | "Tabs"
    | "Tab"
    | "Steps"
    | "Step"
    | "Accordion"
    | "AccordionGroup"
    | "Columns"
    | "Column"
    | "CodeGroup"
    | "ApiEndpoint"
    | "ParamField"
    | "ResponseField"
    | "Expandable"
    | "Frame"
    | "Latex"
    | "Video"
    | "IFrame";
  props: Record<string, string | number | boolean>;
  children: string;
  startIndex: number;
  endIndex: number;
}

export interface CodeBlockSegment {
  type: "codeblock";
  language: string;
  height: number;
  title: string;
  code: string;
  key: string;
}

export interface MarkdownSegment {
  type: "markdown";
  content: string;
  key: string;
}

export type ContentSegment = CodeBlockSegment | MarkdownSegment;

/**
 * Decode HTML entities (&amp; and &quot;) in attribute values.
 */
function decodeAttrValue(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/**
 * Parse attributes from a JSX-like tag string.
 * Supports key="value", key={value}, and boolean attributes.
 * Decodes HTML entities (&quot; and &amp;) in string attribute values.
 */
export function parseAttributes(
  attrString: string
): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {};

  // Match key="value" or key={value} patterns
  const attrRegex = /(\w+)=(?:"([^"]*)"|{([^}]*)})/g;
  let match;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1];
    const stringValue = match[2];
    const jsValue = match[3];

    if (key) {
      if (stringValue !== undefined) {
        attrs[key] = decodeAttrValue(stringValue);
      } else if (jsValue !== undefined) {
        // Try to parse as number
        const num = Number(jsValue);
        attrs[key] = isNaN(num) ? jsValue : num;
      }
    }
  }

  // Match boolean attributes (attributes without values, like "defaultOpen")
  const booleanAttrRegex = /(?:^|\s)(\w+)(?=\s|$|>|\/)/g;
  while ((match = booleanAttrRegex.exec(attrString)) !== null) {
    const key = match[1];
    // Only add if not already set by key=value pattern
    if (key && !(key in attrs)) {
      attrs[key] = true;
    }
  }

  return attrs;
}

/**
 * Find the balanced closing tag for a component, handling nested same-name tags.
 * Returns the index of the closing tag, or -1 if not found.
 */
export function findBalancedCloseTag(
  content: string,
  tagName: string,
  searchFrom: number
): number {
  let depth = 1;
  const openRegex = new RegExp(
    `<${tagName}(?![a-zA-Z])\\s*[^>]*(?<!/)>`,
    "g"
  );
  const closeTag = `</${tagName}>`;
  let pos = searchFrom;

  while (pos < content.length && depth > 0) {
    const closeIdx = content.indexOf(closeTag, pos);
    if (closeIdx === -1) return -1;

    // Count any non-self-closing opening tags between pos and closeIdx
    openRegex.lastIndex = pos;
    let openMatch;
    while (
      (openMatch = openRegex.exec(content)) !== null &&
      openMatch.index < closeIdx
    ) {
      depth++;
    }

    depth--;
    if (depth === 0) return closeIdx;
    pos = closeIdx + closeTag.length;
  }

  return -1;
}

/**
 * Find all MDX components in the content string.
 * Returns a sorted, filtered list of ParsedComponent objects.
 * Components nested inside other detected components are filtered out
 * (they are handled by their parent's child renderer).
 */
export function findMDXComponents(content: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const componentNames = [
    "Card",
    "CardGroup",
    "Callout",
    "Image",
    "Tabs",
    "Tab",
    "Steps",
    "Step",
    "Accordion",
    "AccordionGroup",
    "Columns",
    "Column",
    "CodeGroup",
    "ApiEndpoint",
    "ParamField",
    "ResponseField",
    "Expandable",
    "Frame",
    "Latex",
    "Video",
    "IFrame",
  ];

  for (const name of componentNames) {
    // Use negative lookahead to ensure we match exact component name
    // e.g., <Tab should not match <Tabs
    const namePattern = `<${name}(?![a-zA-Z])`;

    // Match self-closing tags: <Card ... /> or <Card/>
    const selfClosingRegex = new RegExp(`${namePattern}([^>]*?)/>`, "g");
    let match;
    while ((match = selfClosingRegex.exec(content)) !== null) {
      const attrStr = match[1] ?? "";
      components.push({
        type: name as ParsedComponent["type"],
        props: parseAttributes(attrStr),
        children: "",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Match components with children using balanced tag matching
    // This correctly handles nested same-name tags (e.g., Accordion inside Accordion)
    const openTagRegex = new RegExp(
      `${namePattern}\\s*([^>]*)(?<!/)>`,
      "g"
    );
    while ((match = openTagRegex.exec(content)) !== null) {
      const attrStr = match[1] ?? "";
      const contentStart = match.index + match[0].length;
      const closeIdx = findBalancedCloseTag(content, name, contentStart);
      if (closeIdx === -1) continue;

      const childrenStr = content.slice(contentStart, closeIdx);
      const endIndex = closeIdx + `</${name}>`.length;

      components.push({
        type: name as ParsedComponent["type"],
        props: parseAttributes(attrStr),
        children: childrenStr.trim(),
        startIndex: match.index,
        endIndex,
      });
    }
  }

  // Sort by start index
  components.sort((a, b) => a.startIndex - b.startIndex);

  // Filter out components that are nested inside other components
  // (e.g., Tab inside Tabs should be handled by the parent's child renderer)
  const filtered: ParsedComponent[] = [];
  for (const comp of components) {
    const isNested = filtered.some(
      (parent) =>
        comp.startIndex > parent.startIndex &&
        comp.endIndex <= parent.endIndex
    );
    if (!isNested) {
      filtered.push(comp);
    }
  }

  return filtered;
}

/**
 * Pre-process markdown to extract code blocks with metadata (title, height, language).
 * Returns segments of markdown and code block data.
 */
export function preprocessCodeBlocks(content: string): {
  segments: ContentSegment[];
  hasCodeBlocks: boolean;
} {
  const segments: ContentSegment[] = [];
  // Match code blocks with extra info after language (title and/or height metadata)
  // Group 1: language, Group 2: extra info (title + optional {height=N}), Group 3: code
  const codeBlockRegex = /```(\w+)[ \t]+(.*?)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let idx = 0;
  let hasCodeBlocks = false;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    hasCodeBlocks = true;
    // Add markdown before this code block
    if (match.index > lastIndex) {
      const beforeContent = content.slice(lastIndex, match.index);
      if (beforeContent.trim()) {
        segments.push({
          type: "markdown",
          content: beforeContent,
          key: `md-${idx}`,
        });
      }
    }

    // Parse height and title from the extra info
    const extra = match[2] || "";
    const heightMatch = extra.match(/\{height=(\d+)\}/);
    const height =
      heightMatch && heightMatch[1] ? parseInt(heightMatch[1], 10) : 150;
    const title = extra.replace(/\{[^}]*\}/g, "").trim();

    // Add the code block component
    segments.push({
      type: "codeblock",
      language: match[1] || "plaintext",
      height,
      title,
      code: match[3] || "",
      key: `code-${idx}`,
    });

    lastIndex = match.index + match[0].length;
    idx++;
  }

  // Add remaining markdown
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex);
    if (remainingContent.trim()) {
      segments.push({
        type: "markdown",
        content: remainingContent,
        key: `md-final`,
      });
    }
  }

  return { segments, hasCodeBlocks };
}

/**
 * Preprocess inline components (Icon, Badge, inline Latex) into HTML
 * that react-markdown can handle via rehypeRaw.
 *
 * This uses the preview panel's version which includes inline LaTeX handling.
 * Block-level <Latex> tags (without `inline` attribute) are left for
 * findMDXComponents to handle.
 */
export function preprocessInlineComponents(source: string): string {
  // Convert <Icon icon="name" size={16} /> to <span data-icon="name" data-size="16"></span>
  let result = source.replace(
    /<Icon\s+([^>]*?)\/>/g,
    (_match, attrStr: string) => {
      const iconMatch = attrStr.match(/icon="([^"]*)"/);
      const sizeMatch =
        attrStr.match(/size=\{(\d+)\}/) || attrStr.match(/size="(\d+)"/);
      const icon = iconMatch ? iconMatch[1] : "";
      const size = sizeMatch ? sizeMatch[1] : "16";
      return `<span data-icon="${icon}" data-size="${size}"></span>`;
    }
  );

  // Convert inline <Latex inline>expr</Latex> to pre-rendered KaTeX HTML spans.
  // The `inline` attribute is added by wrapInlineLatex in blocknote-to-mdx.
  // Block-level <Latex> (without `inline` attr) is left for findMDXComponents to handle.
  result = result.replace(
    /<Latex(\s+inline)?>([\s\S]*?)<\/Latex>/g,
    (fullMatch, inlineAttr: string | undefined, expr: string) => {
      if (!inlineAttr) {
        // Block-level: leave for findMDXComponents
        return fullMatch;
      }

      // Inline: pre-render with KaTeX in inline mode
      try {
        const html = katex.renderToString(expr.trim(), {
          throwOnError: false,
          displayMode: false,
        });
        return `<span class="latex-inline">${html}</span>`;
      } catch {
        return fullMatch;
      }
    }
  );

  return result;
}
