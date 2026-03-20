import type {
  BlockNoteInlineContent,
  BlockNoteBlock,
  TableContent,
  TableContentCell,
} from "./types.js";

/**
 * Convert BlockNote inline content to plain markdown (no HTML tags).
 */
function convertInline(content: BlockNoteInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "text") {
        let text = item.text || "";

        // Apply markdown formatting (innermost first)
        if (item.styles?.code) {
          text = `\`${text}\``;
        }
        if (item.styles?.bold) {
          text = `**${text}**`;
        }
        if (item.styles?.italic) {
          text = `*${text}*`;
        }
        if (item.styles?.strike) {
          text = `~~${text}~~`;
        }
        // underline has no markdown equivalent — keep as-is
        // color styles are stripped (no markdown equivalent)

        return text;
      }

      if (item.type === "link") {
        const linkText = item.content
          ? convertInline(item.content)
          : item.href || "";
        return `[${linkText}](${item.href})`;
      }

      return "";
    })
    .join("");
}

function isTableContent(content: unknown): content is TableContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as TableContent).type === "tableContent"
  );
}

function isInlineArray(
  content: BlockNoteInlineContent[] | TableContent
): content is BlockNoteInlineContent[] {
  return Array.isArray(content);
}

function getInlineText(block: BlockNoteBlock): string {
  return block.content && isInlineArray(block.content)
    ? convertInline(block.content)
    : "";
}

const CALLOUT_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  success: "Success",
  tip: "Tip",
  note: "Note",
  caution: "Caution",
};

function convertBlock(block: BlockNoteBlock, depth: number = 0): string {
  const indent = "  ".repeat(depth);

  switch (block.type) {
    case "paragraph": {
      const text = getInlineText(block);
      return text ? `${indent}${text}\n\n` : "\n";
    }

    case "heading": {
      const level = (block.props?.level as number) || 1;
      const prefix = "#".repeat(Math.min(level, 6));
      const text = getInlineText(block);
      let result = `${prefix} ${text}\n\n`;

      // Toggleable headings: render children inline (no details/summary in plain md)
      if (
        block.props?.isToggleable &&
        block.children &&
        block.children.length > 0
      ) {
        for (const child of block.children) {
          result += convertBlock(child);
        }
        return result;
      }
      break;
    }

    case "bulletListItem": {
      const text = getInlineText(block);
      let result = `${indent}- ${text}\n`;
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          result += convertBlock(child, depth + 1);
        }
      }
      return result;
    }

    case "numberedListItem": {
      const text = getInlineText(block);
      let result = `${indent}1. ${text}\n`;
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          result += convertBlock(child, depth + 1);
        }
      }
      return result;
    }

    case "checkListItem": {
      const checked = block.props?.checked ? "x" : " ";
      const text = getInlineText(block);
      return `${indent}- [${checked}] ${text}\n`;
    }

    case "toggleListItem": {
      const text = getInlineText(block);
      let result = `- ${text}\n`;
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          result += convertBlock(child, 1);
        }
      }
      return result;
    }

    case "codeBlock": {
      const rawLang = (block.props?.language as string) || "javascript";
      const language = rawLang === "text" ? "plaintext" : rawLang;
      const codeFromProps = (block.props?.code as string) || "";
      const codeFromContent = getInlineText(block);
      const code = codeFromProps || codeFromContent;
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    case "image": {
      const url = block.props?.url as string;
      const caption = block.props?.caption as string;
      const alt = caption || "Image";
      return `![${alt}](${url})\n\n`;
    }

    case "table": {
      if (!block.content || !isTableContent(block.content)) break;

      const rows = block.content.rows;
      if (rows.length === 0) break;

      const processedRows: string[][] = [];

      for (const row of rows) {
        const texts: string[] = [];
        for (const cell of row.cells) {
          let cellContent: BlockNoteInlineContent[];

          if (
            !Array.isArray(cell) &&
            typeof cell === "object" &&
            cell !== null &&
            "type" in cell &&
            (cell as TableContentCell).type === "tableCell"
          ) {
            cellContent = (cell as TableContentCell).content || [];
          } else if (Array.isArray(cell)) {
            const asCell = cell as unknown as TableContentCell;
            if (asCell.type === "tableCell") {
              cellContent = asCell.content || [];
            } else {
              cellContent = cell as BlockNoteInlineContent[];
            }
          } else {
            cellContent = [];
          }

          let cellText = convertInline(cellContent);
          cellText = cellText.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
          texts.push(cellText);
        }
        processedRows.push(texts);
      }

      const colCount = Math.max(...processedRows.map((r) => r.length));
      if (colCount === 0) break;

      // Pad rows
      for (const row of processedRows) {
        while (row.length < colCount) row.push("");
      }

      // First row as header, rest as data
      let result = `| ${processedRows[0]!.join(" | ")} |\n`;
      result += `| ${processedRows[0]!.map(() => "---").join(" | ")} |\n`;
      for (let r = 1; r < processedRows.length; r++) {
        result += `| ${processedRows[r]!.join(" | ")} |\n`;
      }
      result += "\n";
      return result;
    }

    case "callout": {
      const type = (block.props?.type as string) || "info";
      const title = block.props?.title as string;
      const text = getInlineText(block);
      const label = title || CALLOUT_LABELS[type] || "Note";
      const body = text
        .split("\n")
        .map((line, i) => (i === 0 ? `> **${label}:** ${line}` : `> ${line}`))
        .join("\n");
      return `${body}\n\n`;
    }

    case "card": {
      const title = (block.props?.title as string) || "";
      const href = block.props?.href as string;
      const text = getInlineText(block);

      if (href) {
        const desc = text.trim() ? ` — ${text.trim()}` : "";
        return `- [**${title}**](${href})${desc}\n`;
      }
      if (text.trim()) {
        return `**${title}** — ${text.trim()}\n\n`;
      }
      return `**${title}**\n\n`;
    }

    case "cardGroup":
    case "codeGroup":
    case "tabs":
    case "steps":
    case "accordionGroup":
      // Container blocks — content comes from children handled in blockNoteToMarkdown
      return "";

    case "tab": {
      const title = (block.props?.title as string) || "Tab";
      const text = getInlineText(block);
      let result = `**${title}:**\n\n`;
      if (text.trim()) {
        result += `${text}\n\n`;
      }
      return result;
    }

    case "step": {
      const title = (block.props?.title as string) || "Step";
      const text = getInlineText(block);
      let result = `**${title}**\n\n`;
      if (text.trim()) {
        result += `${text}\n\n`;
      }
      return result;
    }

    case "accordion": {
      const title = (block.props?.title as string) || "Accordion";
      const text = getInlineText(block);
      let result = `**${title}**\n\n`;
      if (text.trim()) {
        result += `${text}\n\n`;
      }
      return result;
    }

    case "divider":
      return "---\n\n";

    case "quote": {
      // Split content on newline characters in text nodes into separate paragraphs.
      // BlockNote represents line breaks as "\n" in text nodes (not as hardBreak
      // inline content items). We also handle legacy { type: "hardBreak" } for
      // data that hasn't been through the editor.
      const contentArray = block.content && isInlineArray(block.content) ? block.content : [];
      const paragraphs: BlockNoteInlineContent[][] = [];
      let currentParagraph: BlockNoteInlineContent[] = [];

      for (const item of contentArray) {
        if (item.type === "hardBreak") {
          // Legacy hardBreak inline content item
          paragraphs.push(currentParagraph);
          currentParagraph = [];
        } else if (item.type === "text" && item.text === "\n") {
          // BlockNote-native newline text node
          paragraphs.push(currentParagraph);
          currentParagraph = [];
        } else if (item.type === "text" && item.text && item.text.includes("\n")) {
          // Text node containing embedded newlines — split into parts
          const parts = item.text.split("\n");
          for (let pi = 0; pi < parts.length; pi++) {
            if (pi > 0) {
              paragraphs.push(currentParagraph);
              currentParagraph = [];
            }
            if (parts[pi]) {
              currentParagraph.push({ ...item, text: parts[pi] });
            }
          }
        } else {
          currentParagraph.push(item);
        }
      }
      paragraphs.push(currentParagraph);

      let quoteContent = "";
      for (let i = 0; i < paragraphs.length; i++) {
        const segmentText = convertInline(paragraphs[i]);
        if (i > 0) {
          quoteContent += "\n>\n";
        }
        const quotedLines = segmentText
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        quoteContent += quotedLines;
      }
      return `${quoteContent}\n\n`;
    }

    default: {
      const text = getInlineText(block);
      if (text) return `${indent}${text}\n\n`;
      return "";
    }
  }

  // Default: render heading/paragraph result + children
  const text = getInlineText(block);
  let result = "";
  if (block.type === "heading") {
    const level = (block.props?.level as number) || 1;
    result = `${"#".repeat(Math.min(level, 6))} ${text}\n\n`;
  }

  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      result += convertBlock(child);
    }
  }

  return result;
}

function isEmptyParagraph(block: BlockNoteBlock): boolean {
  if (block.type !== "paragraph") return false;
  if (
    !block.content ||
    !isInlineArray(block.content) ||
    block.content.length === 0
  )
    return true;
  return block.content.every(
    (item) => item.type === "text" && (!item.text || item.text.trim() === "")
  );
}

/**
 * Convert BlockNote blocks to plain markdown with no MDX components or HTML.
 * Suitable for llms.txt and other plain-text consumption.
 */
export function blockNoteToMarkdown(blocks: BlockNoteBlock[]): string {
  let md = "";
  let i = 0;
  const LIST_TYPES = new Set([
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
  ]);
  let prevBlockType = "";

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block) {
      i++;
      continue;
    }

    // Blank line between different list types
    if (
      LIST_TYPES.has(block.type) &&
      LIST_TYPES.has(prevBlockType) &&
      block.type !== prevBlockType
    ) {
      md += "\n";
    }

    // Group consecutive bullet items
    if (block.type === "bulletListItem") {
      while (i < blocks.length && blocks[i]?.type === "bulletListItem") {
        md += convertBlock(blocks[i]!);
        i++;
      }
      md += "\n";
      prevBlockType = "bulletListItem";
      continue;
    }

    // Group consecutive numbered items
    if (block.type === "numberedListItem") {
      let num = 1;
      while (i < blocks.length && blocks[i]?.type === "numberedListItem") {
        const text = getInlineText(blocks[i]!);
        md += `${num}. ${text}\n`;
        // Handle nested children
        if (blocks[i]!.children && blocks[i]!.children!.length > 0) {
          for (const child of blocks[i]!.children!) {
            md += convertBlock(child, 1);
          }
        }
        num++;
        i++;
      }
      md += "\n";
      prevBlockType = "numberedListItem";
      continue;
    }

    // Container blocks: collect children, skip empty paragraph separators
    if (block.type === "tabs") {
      i++;
      while (i < blocks.length) {
        if (isEmptyParagraph(blocks[i]!)) {
          i++;
          continue;
        }
        if (blocks[i]!.type !== "tab") break;
        md += convertBlock(blocks[i]!);
        i++;
      }
      prevBlockType = "tabs";
      continue;
    }

    if (block.type === "steps") {
      i++;
      let stepNum = 1;
      while (i < blocks.length) {
        if (isEmptyParagraph(blocks[i]!)) {
          i++;
          continue;
        }
        if (blocks[i]!.type !== "step") break;
        const title = (blocks[i]!.props?.title as string) || "Step";
        const text = getInlineText(blocks[i]!);
        md += `${stepNum}. **${title}**\n`;
        if (text.trim()) {
          md += `\n   ${text}\n`;
        }
        md += "\n";
        stepNum++;
        i++;
      }
      prevBlockType = "steps";
      continue;
    }

    if (block.type === "cardGroup") {
      i++;
      while (i < blocks.length) {
        if (isEmptyParagraph(blocks[i]!)) {
          i++;
          continue;
        }
        if (blocks[i]!.type !== "card") break;
        md += convertBlock(blocks[i]!);
        i++;
      }
      md += "\n";
      prevBlockType = "cardGroup";
      continue;
    }

    if (block.type === "codeGroup") {
      i++;
      while (i < blocks.length) {
        if (isEmptyParagraph(blocks[i]!)) {
          i++;
          continue;
        }
        if (blocks[i]!.type !== "codeBlock") break;
        md += convertBlock(blocks[i]!);
        i++;
      }
      prevBlockType = "codeGroup";
      continue;
    }

    if (block.type === "accordionGroup") {
      i++;
      while (i < blocks.length) {
        if (isEmptyParagraph(blocks[i]!)) {
          i++;
          continue;
        }
        if (blocks[i]!.type !== "accordion") break;
        md += convertBlock(blocks[i]!);
        i++;
      }
      prevBlockType = "accordionGroup";
      continue;
    }

    // Normal block
    md += convertBlock(block);
    prevBlockType = block.type;
    i++;
  }

  return md.trim() + "\n";
}
