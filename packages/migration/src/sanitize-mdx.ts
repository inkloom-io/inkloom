/**
 * Sanitize plain Markdown content so it can be parsed by remark-mdx without
 * errors. Characters that look like JSX expressions (curly braces, angle
 * brackets, non-self-closing HTML void elements) are escaped so acorn does
 * not choke on them.
 *
 * IMPORTANT: All escaping is applied ONLY outside of fenced code blocks,
 * inline code spans, and LaTeX math expressions ($...$ / $$...$$). Content
 * inside these protected regions is preserved verbatim.
 */

// HTML void elements that must be self-closing in JSX/MDX
const VOID_ELEMENTS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
];

// Match void elements that are NOT already self-closed.
const VOID_ELEMENTS_RE = new RegExp(
  `<(${VOID_ELEMENTS.join("|")})(\\s[^>]*)?>`,
  "gi",
);

/**
 * Sanitize markdown content for MDX compatibility.
 *
 * Splits the input into protected vs non-protected segments, applies escaping
 * rules only to non-protected segments, then reassembles.
 */
export function sanitizeForMdx(content: string): string {
  const segments = splitByProtectedRegions(content);

  const result = segments
    .map((segment) => {
      if (segment.isProtected) return segment.text;
      return sanitizeNonCodeSegment(segment.text);
    })
    .join("");

  return result;
}

export interface Segment {
  text: string;
  isProtected: boolean;
}

/**
 * Split content into protected and non-protected segments.
 *
 * Protected regions (content is preserved verbatim):
 * - Fenced code blocks (``` or ~~~, with optional language/meta)
 * - Inline code spans (single or multiple backticks)
 * - Display math blocks ($$...$$)
 * - Inline math ($...$)
 */
export function splitByProtectedRegions(content: string): Segment[] {
  const segments: Segment[] = [];

  // Combined pattern matching protected regions in priority order:
  // 1. Fenced code blocks: ```...``` or ~~~...~~~
  // 2. Inline code: `...` (single or multi-backtick)
  // 3. Display math: $$...$$
  // 4. Inline math: $...$ (not preceded by $ or followed by $, content is non-empty)
  const protectedPattern =
    /(?:^|\n)((`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?:\n|$))|(`+)(?!`)(.+?)\3(?!`)|\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = protectedPattern.exec(content)) !== null) {
    // For fenced code blocks (match[1]), the regex may have consumed a
    // leading newline — adjust segment boundary.
    const isFencedBlock = match[1] && content[match.index] === "\n";
    const protectedStart = isFencedBlock ? match.index + 1 : match.index;

    // Add non-protected segment before this match
    if (protectedStart > lastIndex) {
      segments.push({ text: content.slice(lastIndex, protectedStart), isProtected: false });
    }

    // Add the protected segment
    segments.push({
      text: content.slice(protectedStart, match.index + match[0].length),
      isProtected: true,
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining non-protected segment
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isProtected: false });
  }

  return segments;
}

/**
 * Apply sanitization rules to a non-protected segment of content.
 */
function sanitizeNonCodeSegment(text: string): string {
  let result = text;

  // 1. Fix non-self-closing HTML void elements: <br> → <br />, <img src="x"> → <img src="x" />
  result = result.replace(VOID_ELEMENTS_RE, (match, tag: string, attrs: string) => {
    // Already self-closed — leave as-is
    if (match.endsWith("/>")) return match;
    const attrsPart = attrs ? attrs.replace(/\s*$/, "") : "";
    return `<${tag}${attrsPart} />`;
  });

  // 2. Escape curly braces that are NOT part of JSX attribute values (not preceded by =)
  //    We escape ALL { and } in body text. The GitBook/Mintlify transform has
  //    already converted known components to JSX, so remaining braces are literal.
  //    Exception: don't escape braces that are part of JSX attribute expressions (preceded by =)
  result = escapeCurlyBraces(result);

  // 3. Escape angle brackets that are NOT HTML/JSX tags
  //    Match < when followed by a non-letter, non-/, and non-! character
  //    This catches: x < y, but preserves: <div>, <Callout>, </div>, <!-- comment -->
  result = result.replace(/<(?=[^a-zA-Z/!])/g, "\\<");

  return result;
}

/**
 * Escape curly braces in body text while preserving them in JSX attribute
 * expressions (e.g., `cols={2}`).
 *
 * Strategy: we look for `={...}` patterns (JSX attribute expressions) and
 * protect them, then escape all remaining braces.
 */
function escapeCurlyBraces(text: string): string {
  const placeholder = "\0JSXATTR\0";
  const protectedExprs: string[] = [];

  // Protect JSX attribute expressions: ={...} (handles nested braces)
  // We use a brace-depth-aware scanner instead of a regex so that nested
  // brace patterns like style={{ borderRadius: '0.5rem' }} are matched
  // all the way to the balanced closing brace.
  let protected_ = "";
  let i = 0;
  while (i < text.length) {
    // Look for ={
    if (text[i] === "=" && text[i + 1] === "{") {
      // Walk forward from the opening { tracking brace depth
      let depth = 0;
      let j = i + 1; // points at the opening {
      while (j < text.length) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        if (depth === 0) break;
        j++;
      }
      // j now points at the balanced closing } (or end of string if unbalanced)
      const expr = text.slice(i, j + 1); // includes ={...}
      protectedExprs.push(expr);
      protected_ += `${placeholder}${protectedExprs.length - 1}${placeholder}`;
      i = j + 1;
    } else {
      protected_ += text[i];
      i++;
    }
  }

  // Escape remaining curly braces
  protected_ = protected_.replace(/\{/g, "\\{");
  protected_ = protected_.replace(/\}/g, "\\}");

  // Restore protected JSX attribute expressions
  let result = protected_;
  for (let i = 0; i < protectedExprs.length; i++) {
    result = result.replace(`${placeholder}${i}${placeholder}`, protectedExprs[i]);
  }

  return result;
}
