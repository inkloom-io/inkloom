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
    | "Columns"
    | "Column"
    | "CodeGroup"
    | "ApiEndpoint";
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
 */
export function parseAttributes(
  attrString: string
): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {};

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
        const num = Number(jsValue);
        attrs[key] = isNaN(num) ? jsValue : num;
      }
    }
  }

  // Match boolean attributes
  const booleanAttrRegex = /(?:^|\s)(\w+)(?=\s|$|>|\/)/g;
  while ((match = booleanAttrRegex.exec(attrString)) !== null) {
    const key = match[1];
    if (key && !(key in attrs)) {
      attrs[key] = true;
    }
  }

  return attrs;
}

/**
 * Find the balanced closing tag for a component, handling nested same-name tags.
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
 * Compute the index ranges of all fenced code blocks.
 */
function getCodeFenceRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const regex = /^```[^\n]*\n[\s\S]*?^```/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function isInsideCodeFence(
  index: number,
  ranges: Array<[number, number]>
): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Find all MDX components in the content string.
 */
export function findMDXComponents(content: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const codeFenceRanges = getCodeFenceRanges(content);
  const componentNames = [
    "Card",
    "CardGroup",
    "Callout",
    "Image",
    "Tabs",
    "Tab",
    "Steps",
    "Step",
    "Columns",
    "Column",
    "CodeGroup",
    "ApiEndpoint",
  ];

  for (const name of componentNames) {
    const namePattern = `<${name}(?![a-zA-Z])`;

    // Match self-closing tags
    const selfClosingRegex = new RegExp(`${namePattern}([^>]*?)/>`, "g");
    let match;
    while ((match = selfClosingRegex.exec(content)) !== null) {
      if (isInsideCodeFence(match.index, codeFenceRanges)) continue;
      const attrStr = match[1] ?? "";
      components.push({
        type: name as ParsedComponent["type"],
        props: parseAttributes(attrStr),
        children: "",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Match components with children
    const openTagRegex = new RegExp(
      `${namePattern}\\s*([^>]*)(?<!/)>`,
      "g"
    );
    while ((match = openTagRegex.exec(content)) !== null) {
      if (isInsideCodeFence(match.index, codeFenceRanges)) continue;
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

  // Filter out nested components
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
 * Pre-process markdown to extract code blocks with metadata.
 */
export function preprocessCodeBlocks(content: string): {
  segments: ContentSegment[];
  hasCodeBlocks: boolean;
} {
  const segments: ContentSegment[] = [];
  const codeBlockRegex = /```(\w+)[ \t]+(.*?)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let idx = 0;
  let hasCodeBlocks = false;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    hasCodeBlocks = true;
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

    const extra = match[2] || "";
    const heightMatch = extra.match(/\{height=(\d+)\}/);
    const height =
      heightMatch && heightMatch[1] ? parseInt(heightMatch[1], 10) : 150;
    const title = extra.replace(/\{[^}]*\}/g, "").trim();

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
 * Preprocess inline components (Icon, Badge, inline Latex) into HTML.
 */
export function preprocessInlineComponents(source: string): string {
  const codeFenceRegex = /^```[^\n]*\n[\s\S]*?^```/gm;
  const parts: string[] = [];
  let lastIndex = 0;
  let cfMatch;

  while ((cfMatch = codeFenceRegex.exec(source)) !== null) {
    parts.push(source.slice(lastIndex, cfMatch.index));
    parts.push(`\0CF\0${cfMatch[0]}`);
    lastIndex = cfMatch.index + cfMatch[0].length;
  }
  parts.push(source.slice(lastIndex));

  const transformed = parts.map((segment) => {
    if (segment.startsWith("\0CF\0")) {
      return segment.slice(4);
    }

    // Convert <Icon icon="name" size={16} /> to <span data-icon="name" data-size="16"></span>
    let result = segment.replace(
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
    result = result.replace(
      /<Latex(\s+inline)?>([\s\S]*?)<\/Latex>/g,
      (fullMatch, inlineAttr: string | undefined, expr: string) => {
        if (!inlineAttr) {
          return fullMatch;
        }
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
  });

  return transformed.join("");
}
