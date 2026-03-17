import type {
  BlockNoteInlineContent,
  BlockNoteBlock,
  TableContent,
  TableContentCell,
} from "./types.js";

// BlockNote named color -> hex mapping
const TEXT_COLOR_MAP: Record<string, string> = {
  gray: "#9b9a97",
  brown: "#64473a",
  red: "#e03e3e",
  orange: "#d9730d",
  yellow: "#dfab01",
  green: "#4d6461",
  blue: "#0b6e99",
  purple: "#6940a5",
  pink: "#ad1a72",
};

const BG_COLOR_MAP: Record<string, string> = {
  gray: "#ebeced",
  brown: "#e9e5e3",
  red: "#fbe4e4",
  orange: "#faebdd",
  yellow: "#fbf3db",
  green: "#ddedea",
  blue: "#ddebf1",
  purple: "#eae4f2",
  pink: "#f4dfeb",
};

function resolveTextColor(color: string): string {
  return TEXT_COLOR_MAP[color] || color;
}

function resolveBackgroundColor(color: string): string {
  return BG_COLOR_MAP[color] || color;
}

function isTableContent(content: unknown): content is TableContent {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as TableContent).type === "tableContent"
  );
}

function isInlineContentArray(
  content: BlockNoteInlineContent[] | TableContent
): content is BlockNoteInlineContent[] {
  return Array.isArray(content);
}

function convertInlineContent(content: BlockNoteInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "text") {
        let text = item.text || "";

        // Use HTML tags instead of markdown syntax so formatting works
        // inside HTML wrappers (colored divs, <li>, etc.)
        if (item.styles?.bold) {
          text = `<strong>${text}</strong>`;
        }
        if (item.styles?.italic) {
          text = `<em>${text}</em>`;
        }
        if (item.styles?.code) {
          text = `<code>${text}</code>`;
        }
        if (item.styles?.strike) {
          text = `<del>${text}</del>`;
        }
        if (item.styles?.underline) {
          text = `<u>${text}</u>`;
        }

        // Wrap with color spans if non-default colors are set
        const textColor = item.styles?.textColor;
        const bgColor = item.styles?.backgroundColor;
        const hasTextColor = typeof textColor === "string" && textColor !== "default" && textColor !== "";
        const hasBgColor = typeof bgColor === "string" && bgColor !== "default" && bgColor !== "";

        if (hasTextColor || hasBgColor) {
          const styles: string[] = [];
          if (hasTextColor) styles.push(`color:${resolveTextColor(textColor)}`);
          if (hasBgColor) styles.push(`background-color:${resolveBackgroundColor(bgColor)}`);
          text = `<span style="${styles.join(";")}">${text}</span>`;
        }

        return text;
      }

      if (item.type === "link") {
        const linkText = item.content
          ? convertInlineContent(item.content)
          : item.href || "";
        return `<a href="${item.href}">${linkText}</a>`;
      }

      return "";
    })
    .join("");
}

// Get inline style string for block-level color props (returns empty string if no colors)
function getBlockColorStyle(props?: Record<string, unknown>): string {
  if (!props) return "";
  const textColor = props.textColor as string | undefined;
  const bgColor = props.backgroundColor as string | undefined;
  const hasTextColor = typeof textColor === "string" && textColor !== "default" && textColor !== "";
  const hasBgColor = typeof bgColor === "string" && bgColor !== "default" && bgColor !== "";

  if (!hasTextColor && !hasBgColor) return "";

  const styles: string[] = [];
  if (hasTextColor) styles.push(`color:${resolveTextColor(textColor)}`);
  if (hasBgColor) styles.push(`background-color:${resolveBackgroundColor(bgColor)}`);
  return styles.join(";");
}

// Wrap block-level content with a div if block has non-default colors or non-left alignment
function wrapWithBlockStyles(text: string, props?: Record<string, unknown>): string {
  const styles: string[] = [];
  const colorStyle = getBlockColorStyle(props);
  if (colorStyle) styles.push(colorStyle);
  const alignment = props?.textAlignment as string | undefined;
  if (alignment && alignment !== "left") {
    styles.push(`text-align:${alignment}`);
  }
  if (styles.length === 0) return text;
  return `<div style="${styles.join(";")}">\n\n${text}\n\n</div>`;
}

function convertBlock(block: BlockNoteBlock, depth = 0): string {
  const indent = "  ".repeat(depth);
  let result = "";

  switch (block.type) {
    case "paragraph": {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      const line = text ? `${indent}${text}\n\n` : "\n";
      result = wrapWithBlockStyles(line, block.props);
      break;
    }

    case "heading": {
      const level = (block.props?.level as number) || 1;
      const prefix = "#".repeat(Math.min(level, 6));
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      const headingLine = `${prefix} ${text}`;

      if (block.props?.isToggleable && block.children && block.children.length > 0) {
        // Toggleable heading: wrap in <details>/<summary> with inline HTML heading
        const headingContent = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
        let childContent = "";
        for (const child of block.children) {
          childContent += convertBlock(child, 0);
        }
        const hLevel = Math.min(level, 6);
        result = `<details>\n<summary><h${hLevel}><span class="toggle-caret">&#9656;</span>${headingContent}</h${hLevel}></summary>\n\n${childContent}\n</details>\n\n`;
        // Return early to avoid duplicate child processing
        return wrapWithBlockStyles(result, block.props);
      }

      result = `${headingLine}\n\n`;
      result = wrapWithBlockStyles(result, block.props);
      break;
    }

    case "bulletListItem": {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      let childrenHTML = "";
      if (block.children && block.children.length > 0) {
        childrenHTML = "<ul>";
        for (const child of block.children) {
          childrenHTML += convertBlock(child, 0);
        }
        childrenHTML += "</ul>";
      }
      const style = getBlockColorStyle(block.props);
      const styleAttr = style ? ` style="${style}"` : "";
      result = `<li${styleAttr}>${text}${childrenHTML}</li>\n`;
      return result;
    }

    case "numberedListItem": {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      result = `${indent}1. ${text}\n`;
      result = wrapWithBlockStyles(result, block.props);
      break;
    }

    case "toggleListItem": {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      let childContent = "";
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          childContent += convertBlock(child, 0);
        }
      }
      result = `<details>\n<summary><span class="toggle-caret">&#9656;</span>${text}</summary>\n\n${childContent}\n</details>\n\n`;
      result = wrapWithBlockStyles(result, block.props);
      // Return early to skip default child processing (children already handled)
      return result;
    }

    case "checkListItem": {
      const checked = block.props?.checked ? "x" : " ";
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      result = `${indent}- [${checked}] ${text}\n`;
      result = wrapWithBlockStyles(result, block.props);
      break;
    }

    case "codeBlock": {
      // BlockNote's built-in codeBlock defaults to "text" which isn't a standard
      // language name. Normalize it to "plaintext" to match our editor's dropdown.
      const rawLang = (block.props?.language as string) || "javascript";
      const language = rawLang === "text" ? "plaintext" : rawLang;
      const height = block.props?.height as string | undefined;
      // Code is stored in props.code (custom code block) or as inline content (legacy)
      const codeFromProps = (block.props?.code as string) || "";
      const codeFromContent = block.content && isInlineContentArray(block.content)
        ? convertInlineContent(block.content)
        : "";
      const text = codeFromProps || codeFromContent;
      // Include height as metadata in fenced code block syntax
      const defaultHeight = "150";
      if (height && height !== defaultHeight) {
        result = `\`\`\`${language} {height=${height}}\n${text}\n\`\`\`\n\n`;
      } else {
        result = `\`\`\`${language}\n${text}\n\`\`\`\n\n`;
      }
      break;
    }

    case "image": {
      const url = block.props?.url as string;
      const caption = block.props?.caption as string;
      const previewWidth = block.props?.previewWidth as number;
      const alt = caption || "Image";

      // If image has a custom width, use Image component to preserve it
      if (previewWidth && previewWidth !== 512) {
        const attrs = [
          `src="${url}"`,
          `alt="${alt}"`,
          `width={${previewWidth}}`,
        ].join(" ");
        result = `<Image ${attrs} />\n\n`;
      } else {
        // Default markdown image for full-width or default-sized images
        result = `![${alt}](${url})\n\n`;
      }
      break;
    }

    case "table": {
      if (!block.content || !isTableContent(block.content)) {
        break;
      }

      const tableContent = block.content;
      const rows = tableContent.rows;
      if (rows.length === 0) break;

      // Extract cell text and alignment from each row
      // GFM requires at least one header row, so clamp to minimum of 1
      const headerRowCount = Math.max(tableContent.headerRows ?? 1, 1);
      const headerColCount = tableContent.headerCols ?? 0;
      const processedRows: { texts: string[]; alignments: ("left" | "center" | "right")[] }[] = [];

      for (const row of rows) {
        const texts: string[] = [];
        const alignments: ("left" | "center" | "right")[] = [];

        for (const cell of row.cells) {
          let cellInlineContent: BlockNoteInlineContent[];
          let alignment: "left" | "center" | "right" = "left";
          let cellTextColor: string | undefined;
          let cellBgColor: string | undefined;

          // Check if cell is a direct TableContentCell object (not in an array)
          if (!Array.isArray(cell) && typeof cell === "object" && cell !== null && "type" in cell && (cell as TableContentCell).type === "tableCell") {
            const tableCell = cell as TableContentCell;
            cellInlineContent = tableCell.content || [];
            const align = tableCell.props?.textAlignment;
            if (align === "center" || align === "right") {
              alignment = align;
            }
            cellTextColor = tableCell.props?.textColor as string | undefined;
            cellBgColor = tableCell.props?.backgroundColor as string | undefined;
          } else if (Array.isArray(cell) && (cell.length === 0 || cell[0] === undefined || !("type" in cell[0]) || cell[0].type !== "tableCell")) {
            // Simple format: InlineContent[]
            cellInlineContent = cell as BlockNoteInlineContent[];
          } else if (Array.isArray(cell)) {
            // Complex format: array containing TableContentCell objects
            const tableCell = cell as unknown as TableContentCell;
            if (tableCell.type === "tableCell") {
              cellInlineContent = tableCell.content || [];
              const align = tableCell.props?.textAlignment;
              if (align === "center" || align === "right") {
                alignment = align;
              }
              cellTextColor = tableCell.props?.textColor as string | undefined;
              cellBgColor = tableCell.props?.backgroundColor as string | undefined;
            } else {
              // Array of inline content items
              cellInlineContent = cell as BlockNoteInlineContent[];
            }
          } else {
            cellInlineContent = [];
          }

          // Convert to text, escape pipes, strip newlines
          let cellText = convertInlineContent(cellInlineContent);
          cellText = cellText.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

          // Wrap with cell-level color if set (separate from inline content styles)
          const hasCellTextColor = typeof cellTextColor === "string" && cellTextColor !== "default" && cellTextColor !== "";
          const hasCellBgColor = typeof cellBgColor === "string" && cellBgColor !== "default" && cellBgColor !== "";
          if (hasCellTextColor || hasCellBgColor) {
            const styles: string[] = [];
            if (hasCellTextColor) styles.push(`color:${resolveTextColor(cellTextColor!)}`);
            if (hasCellBgColor) styles.push(`background-color:${resolveBackgroundColor(cellBgColor!)}`);
            cellText = `<span style="${styles.join(";")}">${cellText}</span>`;
          }
          texts.push(cellText);
          alignments.push(alignment);
        }

        processedRows.push({ texts, alignments });
      }

      // Determine column count from the widest row
      const colCount = Math.max(...processedRows.map((r) => r.texts.length));
      if (colCount === 0) break;

      // Pad rows to equal column count
      for (const row of processedRows) {
        while (row.texts.length < colCount) {
          row.texts.push("");
          row.alignments.push("left");
        }
      }

      const hasHTMLContent = processedRows.some(row =>
        row.texts.some(text => /<[a-z][\s\S]*>/i.test(text))
      );

      // Check for block-level colors (set via drag handle menu on the table block)
      const blockTextColor = block.props?.textColor as string | undefined;
      const blockBgColor = block.props?.backgroundColor as string | undefined;
      const hasBlockTextColor = typeof blockTextColor === "string" && blockTextColor !== "default" && blockTextColor !== "";
      const hasBlockBgColor = typeof blockBgColor === "string" && blockBgColor !== "default" && blockBgColor !== "";
      const hasBlockColor = hasBlockTextColor || hasBlockBgColor;

      // Build inline style for block-level color (applied directly to cells so CSS specificity works)
      let blockStyleAttr = "";
      if (hasBlockColor) {
        const styles: string[] = [];
        if (hasBlockTextColor) styles.push(`color:${resolveTextColor(blockTextColor)}`);
        if (hasBlockBgColor) styles.push(`background-color:${resolveBackgroundColor(blockBgColor)}`);
        blockStyleAttr = ` style="${styles.join(";")}"`;
      }

      if (headerColCount >= 1 || hasHTMLContent || hasBlockColor) {
        // Output as raw HTML table to support column headers, inline HTML, or block-level colors
        const headerRows = processedRows.slice(0, Math.min(headerRowCount, processedRows.length));
        const dataRows = processedRows.slice(Math.min(headerRowCount, processedRows.length));

        result += `<table>\n`;

        // Output thead with header rows
        if (headerRows.length > 0) {
          result += `<thead>\n`;
          for (const hRow of headerRows) {
            result += `<tr>`;
            for (const cellText of hRow.texts) {
              result += `<th${blockStyleAttr}>${cellText}</th>`;
            }
            result += `</tr>\n`;
          }
          result += `</thead>\n`;
        }

        // Output tbody with data rows, using <th> for header column cells
        if (dataRows.length > 0) {
          result += `<tbody>\n`;
          for (const dRow of dataRows) {
            result += `<tr>`;
            for (let colIdx = 0; colIdx < dRow.texts.length; colIdx++) {
              const tag = colIdx < headerColCount ? "th" : "td";
              result += `<${tag}${blockStyleAttr}>${dRow.texts[colIdx]}</${tag}>`;
            }
            result += `</tr>\n`;
          }
          result += `</tbody>\n`;
        }

        result += `</table>\n\n`;
      } else {
        // Standard GFM markdown table (no column headers)
        const headerRows = processedRows.slice(0, Math.min(headerRowCount, processedRows.length));
        const dataRows = processedRows.slice(Math.min(headerRowCount, processedRows.length));

        // Use last header row's alignment for the separator
        const lastHeader = headerRows[headerRows.length - 1]!;

        // Output header rows
        for (const hRow of headerRows) {
          result += `| ${hRow.texts.join(" | ")} |\n`;
        }

        // Output separator with alignment
        const separators = lastHeader.alignments.map((align) => {
          if (align === "center") return ":---:";
          if (align === "right") return "---:";
          return "---";
        });
        result += `| ${separators.join(" | ")} |\n`;

        // Output data rows
        for (const dRow of dataRows) {
          result += `| ${dRow.texts.join(" | ")} |\n`;
        }

        result += "\n";
      }

      // Skip wrapWithBlockStyles for tables — block-level colors are applied
      // directly as inline styles on <th>/<td> elements above
      break;
    }

    case "callout": {
      const type = (block.props?.type as string) || "info";
      const title = block.props?.title as string;
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      const attrs = [
        `type="${type}"`,
        title && `title="${title}"`,
      ]
        .filter(Boolean)
        .join(" ");
      result = `<Callout ${attrs}>\n${text}\n</Callout>\n\n`;
      break;
    }

    case "card": {
      const title = (block.props?.title as string) || "";
      const icon = block.props?.icon as string;
      const href = block.props?.href as string;
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";

      const attrs = [
        `title="${title}"`,
        icon && `icon="${icon}"`,
        href && `href="${href}"`,
      ]
        .filter(Boolean)
        .join(" ");

      if (text.trim()) {
        result = `<Card ${attrs}>\n${text}\n</Card>\n\n`;
      } else {
        result = `<Card ${attrs} />\n\n`;
      }
      break;
    }

    case "cardGroup": {
      // cardGroup is handled in blockNoteToMDX for proper grouping
      result = "";
      break;
    }

    case "tab": {
      const title = (block.props?.title as string) || "Tab";
      const icon = block.props?.icon as string;
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      const attrs = [
        `title="${title}"`,
        icon && `icon="${icon}"`,
      ]
        .filter(Boolean)
        .join(" ");
      result = `<Tab ${attrs}>\n${text}\n</Tab>\n`;
      break;
    }

    case "tabs": {
      // tabs container itself doesn't output anything directly
      // The grouping is handled in blockNoteToMDX
      result = "";
      break;
    }

    case "step": {
      const title = (block.props?.title as string) || "Step";
      const icon = block.props?.icon as string;
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      const attrs = [
        `title="${title}"`,
        icon && `icon="${icon}"`,
      ]
        .filter(Boolean)
        .join(" ");
      result = `<Step ${attrs}>\n${text}\n</Step>\n`;
      break;
    }

    case "steps": {
      // steps container itself doesn't output anything directly
      // The grouping is handled in blockNoteToMDX
      result = "";
      break;
    }

    case "codeGroup": {
      // codeGroup is handled in blockNoteToMDX for proper grouping
      result = "";
      break;
    }

    case "responseField": {
      const rfName = (block.props?.name as string) || "";
      const rfType = block.props?.type as string;
      const rfRequired = block.props?.required as boolean;
      const text = block.content && isInlineContentArray(block.content)
        ? convertInlineContent(block.content)
        : "";

      const attrs = [
        `name="${rfName}"`,
        rfType && `type="${rfType}"`,
        rfRequired && "required",
      ].filter(Boolean).join(" ");

      if (text.trim()) {
        result = `<ResponseField ${attrs}>\n${text}\n</ResponseField>\n`;
      } else {
        result = `<ResponseField ${attrs} />\n`;
      }
      break;
    }

    case "expandable": {
      // expandable is handled in blockNoteToMDX for proper grouping
      result = "";
      break;
    }

    case "accordion": {
      const title = (block.props?.title as string) || "Accordion";
      const icon = block.props?.icon as string;
      const defaultOpen = block.props?.defaultOpen as string;
      const text = block.content && isInlineContentArray(block.content)
        ? convertInlineContent(block.content)
        : "";

      const attrs = [
        `title="${title}"`,
        icon && `icon="${icon}"`,
        defaultOpen === "true" && `defaultOpen`,
      ].filter(Boolean).join(" ");

      result = `<Accordion ${attrs}>\n${text}\n</Accordion>\n`;
      break;
    }

    case "accordionGroup": {
      // accordionGroup is handled in blockNoteToMDX for proper grouping
      result = "";
      break;
    }

    case "divider": {
      result = `<hr />\n\n`;
      break;
    }

    case "quote": {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      // Convert to markdown blockquote by prefixing with >
      const quotedLines = text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      result = `${quotedLines}\n\n`;
      break;
    }

    default: {
      const text = block.content && isInlineContentArray(block.content) ? convertInlineContent(block.content) : "";
      if (text) {
        result = `${indent}${text}\n\n`;
      }
    }
  }

  // Process children recursively with visual indentation
  if (block.children && block.children.length > 0) {
    let childContent = "";
    for (const child of block.children) {
      childContent += convertBlock(child, 0);
    }
    result += `<div style="border-left:1px solid #ffffff;padding-left:1.5rem">\n\n${childContent}\n\n</div>\n`;
  }

  return result;
}

// Helper to check if a block is empty (paragraph with no content)
function isEmptyParagraph(block: BlockNoteBlock): boolean {
  if (block.type !== "paragraph") return false;
  if (!block.content || !isInlineContentArray(block.content) || block.content.length === 0) return true;
  // Check if content is just empty text
  return block.content.every(
    (item) => item.type === "text" && (!item.text || item.text.trim() === "")
  );
}

/**
 * Collect a responseField block and any following expandable children that belong to it.
 * Returns the serialized MDX and the next index to continue from.
 */
function collectResponseFieldSlice(
  blocks: BlockNoteBlock[],
  startIndex: number,
): { mdx: string; nextIndex: number } {
  const block = blocks[startIndex];
  if (!block || block.type !== "responseField") {
    return { mdx: "", nextIndex: startIndex + 1 };
  }

  const rfName = (block.props?.name as string) || "";
  const rfType = block.props?.type as string;
  const rfRequired = block.props?.required as boolean;
  const text = block.content && isInlineContentArray(block.content)
    ? convertInlineContent(block.content)
    : "";

  const attrs = [
    `name="${rfName}"`,
    rfType && `type="${rfType}"`,
    rfRequired && "required",
  ].filter(Boolean).join(" ");

  let j = startIndex + 1;
  // Skip empty paragraphs and check for expandable children
  const childParts: string[] = [];
  while (j < blocks.length) {
    const nextBlock = blocks[j];
    if (!nextBlock) break;
    if (isEmptyParagraph(nextBlock)) {
      j++;
      continue;
    }
    if (nextBlock.type !== "expandable") break;
    // Serialize this expandable with its children
    const expTitle = (nextBlock.props?.title as string) || "Details";
    const expType = nextBlock.props?.type as string;
    const expAttrs = [
      `title="${expTitle}"`,
      expType && `type="${expType}"`,
    ].filter(Boolean).join(" ");
    let expContent = `<Expandable ${expAttrs}>\n`;
    j++;
    while (j < blocks.length) {
      const innerBlock = blocks[j];
      if (!innerBlock) break;
      if (isEmptyParagraph(innerBlock)) {
        j++;
        continue;
      }
      if (innerBlock.type !== "responseField") break;
      const innerSlice = collectResponseFieldSlice(blocks, j);
      expContent += innerSlice.mdx;
      j = innerSlice.nextIndex;
    }
    expContent += "</Expandable>\n";
    childParts.push(expContent);
  }

  let result: string;
  if (childParts.length > 0) {
    // ResponseField wraps both inline content and expandable children
    result = `<ResponseField ${attrs}>\n`;
    if (text.trim()) {
      result += `${text}\n`;
    }
    result += childParts.join("");
    result += "</ResponseField>\n";
  } else if (text.trim()) {
    result = `<ResponseField ${attrs}>\n${text}\n</ResponseField>\n`;
  } else {
    result = `<ResponseField ${attrs} />\n`;
  }

  return { mdx: result, nextIndex: j };
}

export function blockNoteToMDX(blocks: BlockNoteBlock[]): string {
  let mdx = "";
  let i = 0;
  const LIST_TYPES = new Set(["bulletListItem", "numberedListItem", "checkListItem"]);
  let prevBlockType = "";

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block) {
      i++;
      continue;
    }

    // Insert blank line between consecutive blocks of different list types
    // so the markdown parser correctly starts a new list
    if (LIST_TYPES.has(block.type) && LIST_TYPES.has(prevBlockType) && block.type !== prevBlockType) {
      mdx += "\n";
    }

    // Handle bullet list - group consecutive bulletListItem blocks in <ul>
    if (block.type === "bulletListItem") {
      mdx += "<ul>\n";
      while (i < blocks.length && blocks[i]?.type === "bulletListItem") {
        mdx += convertBlock(blocks[i]!);
        i++;
      }
      mdx += "</ul>\n\n";
      prevBlockType = "bulletListItem";
      continue;
    }

    // Handle tabs container - collect following tab blocks (skipping empty paragraphs)
    if (block.type === "tabs") {
      mdx += "<Tabs>\n";
      i++;
      // Skip empty paragraphs and collect all following tab blocks
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        // Skip empty paragraphs between tabs container and tab blocks
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        // Stop if we hit a non-tab block that isn't an empty paragraph
        if (nextBlock.type !== "tab") break;
        mdx += convertBlock(nextBlock);
        i++;
      }
      mdx += "</Tabs>\n\n";
      prevBlockType = "tabs";
      continue;
    }

    // Handle steps container - collect following step blocks (skipping empty paragraphs)
    if (block.type === "steps") {
      mdx += "<Steps>\n";
      i++;
      // Skip empty paragraphs and collect all following step blocks
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        // Skip empty paragraphs between steps container and step blocks
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        // Stop if we hit a non-step block that isn't an empty paragraph
        if (nextBlock.type !== "step") break;
        mdx += convertBlock(nextBlock);
        i++;
      }
      mdx += "</Steps>\n\n";
      prevBlockType = "steps";
      continue;
    }

    // Handle cardGroup - collect following card blocks (skipping empty paragraphs)
    if (block.type === "cardGroup") {
      const cols = (block.props?.cols as string) || "2";
      mdx += `<CardGroup cols={${cols}}>\n`;
      i++;
      // Skip empty paragraphs and collect all following card blocks
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        if (nextBlock.type !== "card") break;
        mdx += convertBlock(nextBlock);
        i++;
      }
      mdx += "</CardGroup>\n\n";
      prevBlockType = "cardGroup";
      continue;
    }

    // Handle codeGroup - collect following codeBlock blocks (skipping empty paragraphs)
    if (block.type === "codeGroup") {
      mdx += "<CodeGroup>\n";
      i++;
      // Skip empty paragraphs and collect all following codeBlock blocks
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        if (nextBlock.type !== "codeBlock") break;
        mdx += convertBlock(nextBlock);
        i++;
      }
      mdx += "</CodeGroup>\n\n";
      prevBlockType = "codeGroup";
      continue;
    }

    // Handle expandable - collect following responseField blocks (skipping empty paragraphs)
    if (block.type === "expandable") {
      const expTitle = (block.props?.title as string) || "Details";
      const expType = block.props?.type as string;
      const expAttrs = [
        `title="${expTitle}"`,
        expType && `type="${expType}"`,
      ].filter(Boolean).join(" ");
      mdx += `<Expandable ${expAttrs}>\n`;
      i++;
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        if (nextBlock.type !== "responseField") break;
        // Recursively handle responseField which may have its own expandable children
        const rfSlice = collectResponseFieldSlice(blocks, i);
        mdx += rfSlice.mdx;
        i = rfSlice.nextIndex;
      }
      mdx += "</Expandable>\n";
      prevBlockType = "expandable";
      continue;
    }

    // Handle responseField - may be followed by expandable children
    if (block.type === "responseField") {
      const rfSlice = collectResponseFieldSlice(blocks, i);
      mdx += rfSlice.mdx;
      i = rfSlice.nextIndex;
      prevBlockType = "responseField";
      continue;
    }

    // Handle accordionGroup - collect following accordion blocks (skipping empty paragraphs)
    if (block.type === "accordionGroup") {
      mdx += "<AccordionGroup>\n";
      i++;
      // Skip empty paragraphs and collect all following accordion blocks
      while (i < blocks.length) {
        const nextBlock = blocks[i];
        if (!nextBlock) break;
        if (isEmptyParagraph(nextBlock)) {
          i++;
          continue;
        }
        if (nextBlock.type !== "accordion") break;
        mdx += convertBlock(nextBlock);
        i++;
      }
      mdx += "</AccordionGroup>\n\n";
      prevBlockType = "accordionGroup";
      continue;
    }

    // Normal block processing
    mdx += convertBlock(block);
    prevBlockType = block.type;
    i++;
  }

  return mdx.trim() + "\n";
}

export function parseBlockNoteContent(content: string): BlockNoteBlock[] {
  try {
    return JSON.parse(content) as BlockNoteBlock[];
  } catch {
    return [];
  }
}
