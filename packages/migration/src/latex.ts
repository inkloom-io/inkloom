/**
 * LaTeX syntax transformer for migration pipelines.
 *
 * Converts LaTeX delimiters (`$$...$$` and `$...$`) to `<Latex>` JSX components.
 * Preserves dollar signs inside code blocks (fenced and inline) and escaped `\$`.
 */

/**
 * Transform LaTeX delimiters in markdown content to `<Latex>` JSX components.
 *
 * Processing order:
 * 1. Protect code blocks (fenced and inline) from transformation
 * 2. Handle block-level `$$...$$` fences (with newlines)
 * 3. Handle inline `$$...$$`
 * 4. Handle inline `$...$`
 * 5. Restore protected code blocks
 */
export function transformLatex(content: string): string {
  // Placeholder system to protect code blocks from LaTeX transformation
  const placeholders: string[] = [];

  function protect(match: string): string {
    const index = placeholders.length;
    placeholders.push(match);
    return `\0LATEX_PLACEHOLDER_${index}\0`;
  }

  let result = content;

  // Protect fenced code blocks (``` or ~~~, with optional language)
  result = result.replace(/^(`{3,}|~{3,}).*\n[\s\S]*?\n\1\s*$/gm, protect);

  // Protect inline code spans (backtick-delimited)
  result = result.replace(/`[^`\n]+`/g, protect);

  // Handle escaped dollar signs: replace \$ with placeholder
  result = result.replace(/\\\$/g, protect);

  // 1. Block-level $$...$$ fences (standalone $$ on their own lines)
  result = result.replace(
    /^\$\$\s*\n([\s\S]*?)\n\s*\$\$\s*$/gm,
    (_match, inner: string) => {
      return `<Latex>\n${inner.trim()}\n</Latex>`;
    },
  );

  // 2. Inline $$...$$ (within a line, non-greedy)
  result = result.replace(
    /\$\$((?!\$)[\s\S]+?)\$\$/g,
    (_match, inner: string) => {
      return `<Latex>${inner.trim()}</Latex>`;
    },
  );

  // 3. Inline $...$ (single dollar, must contain math-like content)
  // To avoid false positives with currency (e.g., "$100"), we require the content
  // to contain at least one math-like character: \, ^, _, {, }, or be a single
  // variable-like token (letter(s) optionally with subscripts/superscripts).
  // The content must NOT contain spaces unless it also has math-like characters,
  // to avoid matching across unrelated dollar signs.
  result = result.replace(
    /(?<!\$)\$(?!\$)((?:[^$\n\\]|\\.)+?)\$(?!\$)/g,
    (_match, inner: string) => {
      const trimmed = inner.trim();
      // Skip if it looks like currency (just digits, commas, periods)
      if (/^\d[\d,.]*$/.test(trimmed)) {
        return _match;
      }
      // If content contains spaces, require at least one math-like character
      // to avoid false positives like "$100 and $200" matching "$100 and $"
      if (/\s/.test(trimmed) && !/[\\^_{}\[\]]/.test(trimmed)) {
        return _match;
      }
      return `<Latex>${trimmed}</Latex>`;
    },
  );

  // Restore placeholders
  result = result.replace(
    /\0LATEX_PLACEHOLDER_(\d+)\0/g,
    (_match, index: string) => {
      return placeholders[parseInt(index, 10)] ?? _match;
    },
  );

  return result;
}
