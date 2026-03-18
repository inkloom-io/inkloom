/**
 * Strip a leading H1 heading from markdown content.
 *
 * When importing pages from Gitbook or Mintlify, the first H1 heading is
 * typically used as the page title. Keeping it in the body produces a
 * duplicate — the title appears once in the page title field and again as
 * the first heading block. This utility removes the leading H1 so the
 * content starts after it.
 *
 * Rules:
 * - Only strips `# ` (H1), not `##` or deeper headings.
 * - Only strips if the H1 is at the very start of the content (after any
 *   whitespace / blank lines).
 */

const LEADING_H1_RE = /^[ \t]*#[ \t]+.+$/m;

/**
 * Remove a leading H1 heading from markdown content, if present.
 *
 * @param content - Markdown body (frontmatter already removed).
 * @returns The content with the leading H1 stripped, or the original
 *          content if there is no leading H1.
 */
export function stripLeadingH1(content: string): string {
  const match = LEADING_H1_RE.exec(content);
  if (!match || match.index === undefined) return content;

  // Only strip if everything before the match is whitespace
  const before = content.slice(0, match.index);
  if (before.trim() !== "") return content;

  return content.slice(match.index + match[0].length).trimStart();
}
