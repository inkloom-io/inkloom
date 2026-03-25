import type { ExtractedText } from "./types";

interface BlockNoteInlineContent {
  type: string;
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: BlockNoteInlineContent[];
}

interface TableContentCell {
  type: "tableCell";
  content: BlockNoteInlineContent[];
}

interface TableContent {
  type: "tableContent";
  rows: {
    cells: BlockNoteInlineContent[][] | TableContentCell[];
  }[];
}

interface BlockNoteBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInlineContent[] | TableContent;
  children?: BlockNoteBlock[];
}

function isInlineContentArray(
  content: BlockNoteInlineContent[] | TableContent
): content is BlockNoteInlineContent[] {
  return Array.isArray(content);
}

function extractInlineText(content: BlockNoteInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "text") {
        return item.text || "";
      }
      if (item.type === "link" && item.content) {
        return extractInlineText(item.content);
      }
      return "";
    })
    .join("");
}

function extractFromBlock(
  block: BlockNoteBlock,
  result: {
    headings: string[];
    content: string[];
    codeBlocks: string[];
  }
): void {
  switch (block.type) {
    case "heading": {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.headings.push(text);
      }
      break;
    }

    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem":
    case "quote": {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "codeBlock": {
      const codeFromProps = (block.props?.code as string) || "";
      const codeFromContent = block.content && isInlineContentArray(block.content)
        ? extractInlineText(block.content)
        : "";
      const code = codeFromProps || codeFromContent;
      if (code) {
        result.codeBlocks.push(code);
      }
      break;
    }

    case "table": {
      if (block.content && !isInlineContentArray(block.content) && block.content.type === "tableContent") {
        for (const row of block.content.rows) {
          for (const cell of row.cells) {
            let cellContent: BlockNoteInlineContent[];
            if (Array.isArray(cell) && (cell.length === 0 || cell[0] === undefined || !("type" in cell[0]) || cell[0].type !== "tableCell")) {
              cellContent = cell as BlockNoteInlineContent[];
            } else if (!Array.isArray(cell)) {
              cellContent = [];
            } else {
              const tableCell = cell as unknown as TableContentCell;
              cellContent = tableCell.type === "tableCell" ? tableCell.content || [] : cell as BlockNoteInlineContent[];
            }
            const text = extractInlineText(cellContent);
            if (text) {
              result.content.push(text);
            }
          }
        }
      }
      break;
    }

    case "callout": {
      const title = block.props?.title as string;
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "card": {
      const title = (block.props?.title as string) || "";
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "tab": {
      const title = (block.props?.title as string) || "";
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    default: {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.content.push(text);
      }
    }
  }

  // Process children recursively
  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      extractFromBlock(child, result);
    }
  }
}

export function extractSearchableText(
  blocks: BlockNoteBlock[],
  pageTitle: string
): ExtractedText {
  const result = {
    headings: [] as string[],
    content: [] as string[],
    codeBlocks: [] as string[],
  };

  for (const block of blocks) {
    extractFromBlock(block, result);
  }

  const headingsText = result.headings.join(" ");
  const contentText = result.content.join(" ");
  const codeBlocksText = result.codeBlocks.join(" ");

  // Generate excerpt from first ~150 chars of content
  const allText = [contentText, headingsText].filter(Boolean).join(" ");
  const excerpt = allText.slice(0, 150).trim() + (allText.length > 150 ? "..." : "");

  return {
    title: pageTitle,
    headings: headingsText,
    content: contentText,
    codeBlocks: codeBlocksText,
    excerpt: excerpt || pageTitle,
  };
}

export function parseBlockNoteContent(content: string): BlockNoteBlock[] {
  try {
    return JSON.parse(content) as BlockNoteBlock[];
  } catch {
    return [];
  }
}
