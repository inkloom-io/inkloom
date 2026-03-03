import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import type {
  MdastNode,
  MdxAttribute,
  BlockNoteInlineContent,
  BlockNoteBlock,
  TableContent,
} from "./types.js";

function getAttrValue(
  attrs: MdxAttribute[] | undefined,
  name: string
): string | undefined {
  if (!attrs) return undefined;
  const attr = attrs.find((a) => a.name === name);
  if (!attr) return undefined;
  if (typeof attr.value === "string") return attr.value;
  if (attr.value && typeof attr.value === "object" && "value" in attr.value) {
    return attr.value.value;
  }
  if (attr.value === true) return "true";
  return undefined;
}

function convertInlineNodes(
  nodes: MdastNode[]
): BlockNoteInlineContent[] {
  const result: BlockNoteInlineContent[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        result.push({ type: "text", text: node.value || "" });
        break;
      }
      case "strong": {
        const children = node.children
          ? convertInlineNodes(node.children)
          : [];
        for (const child of children) {
          if (child.type === "text") {
            child.styles = { ...child.styles, bold: true };
          }
          result.push(child);
        }
        break;
      }
      case "emphasis": {
        const children = node.children
          ? convertInlineNodes(node.children)
          : [];
        for (const child of children) {
          if (child.type === "text") {
            child.styles = { ...child.styles, italic: true };
          }
          result.push(child);
        }
        break;
      }
      case "inlineCode": {
        result.push({
          type: "text",
          text: node.value || "",
          styles: { code: true },
        });
        break;
      }
      case "delete": {
        const children = node.children
          ? convertInlineNodes(node.children)
          : [];
        for (const child of children) {
          if (child.type === "text") {
            child.styles = { ...child.styles, strike: true };
          }
          result.push(child);
        }
        break;
      }
      case "link": {
        const linkContent = node.children
          ? convertInlineNodes(node.children)
          : [];
        result.push({
          type: "link",
          href: node.url || "",
          content: linkContent.length > 0
            ? linkContent
            : [{ type: "text", text: node.url || "" }],
        });
        break;
      }
      case "html": {
        // Pass through raw HTML as text
        result.push({ type: "text", text: node.value || "" });
        break;
      }
      case "mdxJsxTextElement": {
        // Handle HTML formatting tags serialized by blocknote-to-mdx
        const tagName = node.name || "";
        if (tagName === "strong") {
          const children = node.children ? convertInlineNodes(node.children) : [];
          for (const child of children) {
            if (child.type === "text") {
              child.styles = { ...child.styles, bold: true };
            }
            result.push(child);
          }
        } else if (tagName === "em") {
          const children = node.children ? convertInlineNodes(node.children) : [];
          for (const child of children) {
            if (child.type === "text") {
              child.styles = { ...child.styles, italic: true };
            }
            result.push(child);
          }
        } else if (tagName === "u") {
          const children = node.children ? convertInlineNodes(node.children) : [];
          for (const child of children) {
            if (child.type === "text") {
              child.styles = { ...child.styles, underline: true };
            }
            result.push(child);
          }
        } else if (tagName === "del") {
          const children = node.children ? convertInlineNodes(node.children) : [];
          for (const child of children) {
            if (child.type === "text") {
              child.styles = { ...child.styles, strike: true };
            }
            result.push(child);
          }
        } else if (tagName === "code") {
          const children = node.children ? convertInlineNodes(node.children) : [];
          for (const child of children) {
            if (child.type === "text") {
              child.styles = { ...child.styles, code: true };
            }
            result.push(child);
          }
        } else if (tagName === "a") {
          const href = getAttrValue(node.attributes, "href") || "";
          const linkContent = node.children ? convertInlineNodes(node.children) : [];
          result.push({
            type: "link",
            href,
            content: linkContent.length > 0 ? linkContent : [{ type: "text", text: href }],
          });
        } else if (tagName === "span") {
          // Handle colored spans: <span style="color:...;background-color:...">
          const styleStr = getAttrValue(node.attributes, "style") || "";
          const children = node.children ? convertInlineNodes(node.children) : [];
          const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/);
          const bgMatch = styleStr.match(/background-color:\s*([^;]+)/);
          for (const child of children) {
            if (child.type === "text") {
              if (colorMatch?.[1]) {
                child.styles = { ...child.styles, textColor: colorMatch[1].trim() };
              }
              if (bgMatch?.[1]) {
                child.styles = { ...child.styles, backgroundColor: bgMatch[1].trim() };
              }
            }
            result.push(child);
          }
        } else {
          // Unknown inline JSX element — extract text
          if (node.children) {
            result.push(...convertInlineNodes(node.children));
          }
        }
        break;
      }
      default: {
        // For unknown inline types, try to extract text
        if (node.children) {
          result.push(...convertInlineNodes(node.children));
        } else if (node.value) {
          result.push({ type: "text", text: node.value });
        }
      }
    }
  }

  return result;
}

function convertListItem(
  node: MdastNode,
  ordered: boolean
): BlockNoteBlock[] {
  const blocks: BlockNoteBlock[] = [];

  // List items can have paragraphs and nested lists as children
  let inlineContent: BlockNoteInlineContent[] = [];
  const nestedBlocks: BlockNoteBlock[] = [];

  for (const child of node.children || []) {
    if (child.type === "paragraph") {
      inlineContent = child.children
        ? convertInlineNodes(child.children)
        : [];
    } else if (child.type === "list") {
      // Nested list -> children
      for (const listItem of child.children || []) {
        nestedBlocks.push(
          ...convertListItem(listItem, child.ordered ?? false)
        );
      }
    }
  }

  let blockType: string;
  const props: Record<string, unknown> = {};

  if (node.checked !== null && node.checked !== undefined) {
    blockType = "checkListItem";
    props.checked = node.checked;
  } else if (ordered) {
    blockType = "numberedListItem";
  } else {
    blockType = "bulletListItem";
  }

  blocks.push({
    type: blockType,
    props,
    content: inlineContent,
    children: nestedBlocks.length > 0 ? nestedBlocks : undefined,
  });

  return blocks;
}

function convertMdxJsxElement(node: MdastNode): BlockNoteBlock[] {
  const name = node.name || "";
  const attrs = node.attributes;

  switch (name) {
    case "Callout": {
      const type = getAttrValue(attrs, "type") || "info";
      const title = getAttrValue(attrs, "title");
      const content = node.children
        ? flattenToInline(node.children)
        : [];
      return [
        {
          type: "callout",
          props: {
            type,
            ...(title ? { title } : {}),
          },
          content,
        },
      ];
    }

    case "Card": {
      const title = getAttrValue(attrs, "title") || "";
      const icon = getAttrValue(attrs, "icon");
      const href = getAttrValue(attrs, "href");
      const content = node.children
        ? flattenToInline(node.children)
        : [];
      return [
        {
          type: "card",
          props: {
            title,
            ...(icon ? { icon } : {}),
            ...(href ? { href } : {}),
          },
          content,
        },
      ];
    }

    case "CardGroup": {
      const cols = getAttrValue(attrs, "cols") || "2";
      // CardGroup container block, followed by child Card blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "cardGroup",
          props: { cols },
          content: [],
        },
      ];
      // Convert child elements (Cards)
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "mdxJsxFlowElement" && child.name === "Card") {
            blocks.push(...convertMdxJsxElement(child));
          }
        }
      }
      return blocks;
    }

    case "Tabs": {
      // Tabs container block, followed by child Tab blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "tabs",
          content: [],
        },
      ];
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "mdxJsxFlowElement" && child.name === "Tab") {
            blocks.push(...convertMdxJsxElement(child));
          }
        }
      }
      return blocks;
    }

    case "Tab": {
      const title = getAttrValue(attrs, "title") || "Tab";
      const icon = getAttrValue(attrs, "icon");
      const content = node.children
        ? flattenToInline(node.children)
        : [];
      return [
        {
          type: "tab",
          props: {
            title,
            ...(icon ? { icon } : {}),
          },
          content,
        },
      ];
    }

    case "CodeGroup": {
      // CodeGroup container, followed by code blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "codeGroup",
          content: [],
        },
      ];
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "code") {
            blocks.push({
              type: "codeBlock",
              props: {
                language: child.lang || "",
                code: child.value || "",
              },
            });
          }
        }
      }
      return blocks;
    }

    case "Image": {
      const src = getAttrValue(attrs, "src") || "";
      const alt = getAttrValue(attrs, "alt") || "";
      const width = getAttrValue(attrs, "width");
      return [
        {
          type: "image",
          props: {
            url: src,
            caption: alt || undefined,
            ...(width ? { previewWidth: parseInt(width, 10) } : {}),
          },
        },
      ];
    }

    case "div": {
      // Handle wrapper divs generated by blocknote-to-mdx
      const styleStr = getAttrValue(attrs, "style") || "";

      // Extract text alignment from style
      const alignMatch = styleStr.match(/text-align:\s*(center|right|justify)/);
      const alignment = alignMatch ? alignMatch[1] : undefined;

      // Check if this is a nesting div (border-left + padding-left)
      const isNestingDiv = /border-left/.test(styleStr) && /padding-left/.test(styleStr);

      // Extract color styles
      const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/);
      const bgMatch = styleStr.match(/background-color:\s*([^;]+)/);

      // Convert child blocks
      const childBlocks: BlockNoteBlock[] = [];
      if (node.children) {
        for (const child of node.children) {
          childBlocks.push(...convertBlockNode(child));
        }
      }

      if (isNestingDiv) {
        // This is a nesting wrapper — return children as-is (they'll be added as nested children by parent)
        return childBlocks;
      }

      // Apply alignment and color props to child blocks
      for (const block of childBlocks) {
        if (!block.props) block.props = {};
        if (alignment) block.props.textAlignment = alignment;
        if (colorMatch?.[1]) block.props.textColor = colorMatch[1].trim();
        if (bgMatch?.[1]) block.props.backgroundColor = bgMatch[1].trim();
      }

      return childBlocks;
    }

    default: {
      // Unknown JSX element -> convert to paragraph with raw text
      const rawText = serializeJsxToString(node);
      if (rawText) {
        return [
          {
            type: "paragraph",
            content: [{ type: "text", text: rawText }],
          },
        ];
      }
      return [];
    }
  }
}

function serializeJsxToString(node: MdastNode): string {
  const name = node.name || "Unknown";
  const attrs = (node.attributes || [])
    .map((a) => {
      const val =
        typeof a.value === "string"
          ? `"${a.value}"`
          : a.value && typeof a.value === "object" && "value" in a.value
            ? `{${a.value.value}}`
            : "";
      return `${a.name}=${val}`;
    })
    .join(" ");

  if (!node.children || node.children.length === 0) {
    return `<${name}${attrs ? " " + attrs : ""} />`;
  }

  return `<${name}${attrs ? " " + attrs : ""}> ... </${name}>`;
}

function flattenToInline(
  nodes: MdastNode[]
): BlockNoteInlineContent[] {
  const result: BlockNoteInlineContent[] = [];

  for (const node of nodes) {
    if (
      node.type === "paragraph" ||
      node.type === "text" ||
      node.type === "strong" ||
      node.type === "emphasis" ||
      node.type === "inlineCode" ||
      node.type === "delete" ||
      node.type === "link" ||
      node.type === "mdxJsxTextElement"
    ) {
      if (node.type === "paragraph" && node.children) {
        result.push(...convertInlineNodes(node.children));
      } else {
        result.push(...convertInlineNodes([node]));
      }
    } else if (node.children) {
      result.push(...flattenToInline(node.children));
    } else if (node.value) {
      result.push({ type: "text", text: node.value });
    }
  }

  return result;
}

function convertBlockNode(node: MdastNode): BlockNoteBlock[] {
  switch (node.type) {
    case "heading": {
      const level = node.depth || 1;
      const content = node.children
        ? convertInlineNodes(node.children)
        : [];
      return [
        {
          type: "heading",
          props: { level },
          content,
        },
      ];
    }

    case "paragraph": {
      const content = node.children
        ? convertInlineNodes(node.children)
        : [];
      // Check if it's a single image
      if (
        content.length === 0 &&
        node.children?.length === 1 &&
        node.children[0]?.type === "image"
      ) {
        const img = node.children[0];
        return [
          {
            type: "image",
            props: {
              url: img.url || "",
              caption: img.alt || undefined,
            },
          },
        ];
      }
      return [
        {
          type: "paragraph",
          content,
        },
      ];
    }

    case "list": {
      const blocks: BlockNoteBlock[] = [];
      for (const item of node.children || []) {
        blocks.push(
          ...convertListItem(item, node.ordered ?? false)
        );
      }
      return blocks;
    }

    case "code": {
      const language = node.lang || "";
      const code = node.value || "";
      const props: Record<string, unknown> = { language, code };

      // Parse height from meta if present (e.g., {height=300})
      if (node.meta) {
        const heightMatch = node.meta.match(/height=(\d+)/);
        if (heightMatch) {
          props.height = heightMatch[1];
        }
      }

      return [
        {
          type: "codeBlock",
          props,
        },
      ];
    }

    case "table": {
      const rows = (node.children || []).map((row) => ({
        cells: (row.children || []).map((cell) => ({
          type: "tableCell" as const,
          content: cell.children
            ? convertInlineNodes(cell.children)
            : [],
        })),
      }));

      return [
        {
          type: "table",
          content: {
            type: "tableContent" as const,
            rows,
          },
        },
      ];
    }

    case "image": {
      return [
        {
          type: "image",
          props: {
            url: node.url || "",
            caption: node.alt || undefined,
          },
        },
      ];
    }

    case "thematicBreak": {
      return [{ type: "divider" }];
    }

    case "blockquote": {
      // Flatten children to inline content
      const content = node.children
        ? flattenToInline(node.children)
        : [];
      return [
        {
          type: "paragraph",
          content,
        },
      ];
    }

    case "html": {
      // Skip HTML comments, pass through content
      const value = (node.value || "").trim();
      if (value.startsWith("<!--")) return [];
      if (value === "<hr />" || value === "<hr>") {
        return [{ type: "divider" }];
      }
      return [
        {
          type: "paragraph",
          content: [{ type: "text", text: value }],
        },
      ];
    }

    case "mdxJsxFlowElement": {
      return convertMdxJsxElement(node);
    }

    case "mdxjsEsm":
    case "mdxFlowExpression": {
      // Skip import/export statements and JSX expressions
      return [];
    }

    default: {
      // For unknown block types, try to extract content
      if (node.children) {
        const blocks: BlockNoteBlock[] = [];
        for (const child of node.children) {
          blocks.push(...convertBlockNode(child));
        }
        return blocks;
      }
      if (node.value) {
        return [
          {
            type: "paragraph",
            content: [{ type: "text", text: node.value }],
          },
        ];
      }
      return [];
    }
  }
}

export function mdxToBlockNote(mdxContent: string): BlockNoteBlock[] {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdx);

  const tree = processor.parse(mdxContent);
  const blocks: BlockNoteBlock[] = [];

  for (const child of (tree as MdastNode).children || []) {
    blocks.push(...convertBlockNode(child));
  }

  // Ensure we have at least one block
  if (blocks.length === 0) {
    blocks.push({
      type: "paragraph",
      content: [],
    });
  }

  return blocks;
}
