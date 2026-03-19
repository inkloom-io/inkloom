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

/**
 * Normalize an icon attribute value from MDX import.
 * Bare icon names like "copy" or "book-open" get prefixed with "lucide:".
 * Already-prefixed values ("lucide:copy") and emojis are returned as-is.
 */
export function normalizeIconAttr(value: string | undefined): string | undefined {
  if (!value) return value;
  // Already has a prefix (e.g. "lucide:copy")
  if (value.includes(":")) return value;
  // Looks like a lucide icon name: lowercase, alphanumeric with hyphens
  if (/^[a-z][a-z0-9-]*$/.test(value)) {
    return `lucide:${value}`;
  }
  // Emoji or other value — return as-is
  return value;
}

/** Recursively extract plain text content from an mdast node tree. */
function extractTextContent(node: MdastNode): string {
  if (node.value) return node.value;
  if (node.children) {
    return node.children.map((c) => extractTextContent(c)).join("").trim();
  }
  return "";
}

/**
 * Find a named JSX child element within a node's children.
 * In flow mode, remark-mdx may wrap inner JSX elements in paragraph nodes,
 * so this also checks paragraph children for JSX elements.
 */
function findJsxChild(parent: MdastNode, tagName: string): MdastNode | undefined {
  if (!parent.children) return undefined;
  for (const child of parent.children) {
    if (
      (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
      child.name === tagName
    ) {
      return child;
    }
    // Check inside paragraph wrappers
    if (child.type === "paragraph" && child.children) {
      for (const grandchild of child.children) {
        if (
          (grandchild.type === "mdxJsxFlowElement" || grandchild.type === "mdxJsxTextElement") &&
          grandchild.name === tagName
        ) {
          return grandchild;
        }
      }
    }
  }
  return undefined;
}

/**
 * Find all named JSX child elements within a node's children.
 * In flow mode, remark-mdx may wrap inner JSX elements in paragraph nodes.
 */
function findAllJsxChildren(parent: MdastNode, tagName: string): MdastNode[] {
  const results: MdastNode[] = [];
  if (!parent.children) return results;
  for (const child of parent.children) {
    if (
      (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
      child.name === tagName
    ) {
      results.push(child);
    }
    // Check inside paragraph wrappers
    if (child.type === "paragraph" && child.children) {
      for (const grandchild of child.children) {
        if (
          (grandchild.type === "mdxJsxFlowElement" || grandchild.type === "mdxJsxTextElement") &&
          grandchild.name === tagName
        ) {
          results.push(grandchild);
        }
      }
    }
  }
  return results;
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
        } else if (tagName === "mark") {
          // Inline badge: <mark style="color:green;">POST</mark>
          const styleStr = getAttrValue(node.attributes, "style") || "";
          const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/);
          const color = colorMatch ? colorMatch[1].trim() : "";
          const children = node.children ? convertInlineNodes(node.children) : [];
          // Extract text from children
          const badgeText = children
            .filter((c) => c.type === "text")
            .map((c) => c.text || "")
            .join("");
          result.push({
            type: "badge",
            props: { color },
            content: [{ type: "text", text: badgeText }],
          });
        } else if (tagName === "Icon") {
          // Inline icon: <Icon icon="flag" size={32} />
          const iconName = getAttrValue(node.attributes, "icon") || "";
          const size = getAttrValue(node.attributes, "size") || "";
          result.push({
            type: "icon",
            props: {
              icon: iconName,
              ...(size ? { size } : {}),
            },
          });
        } else if (tagName === "Latex") {
          // Inline LaTeX — extract text content as expression
          const expression = node.children
            ? node.children
                .filter((c) => c.type === "text" || c.type === "paragraph")
                .map((c) =>
                  c.value ||
                  (c.children
                    ? c.children.map((cc) => cc.value || "").join("")
                    : "")
                )
                .join("")
                .trim()
            : "";
          // Return as text placeholder since inline LaTeX can't be a block
          result.push({ type: "text", text: `$${expression}$` });
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
      // First paragraph becomes the list item's inline content
      if (inlineContent.length === 0) {
        inlineContent = child.children
          ? convertInlineNodes(child.children)
          : [];
      } else {
        // Additional paragraphs become nested children
        nestedBlocks.push(...convertBlockNode(child));
      }
    } else if (child.type === "list") {
      // Nested list -> children
      for (const listItem of child.children || []) {
        nestedBlocks.push(
          ...convertListItem(listItem, child.ordered ?? false)
        );
      }
    } else {
      // Code blocks, blockquotes, images, JSX elements, etc. → children
      nestedBlocks.push(...convertBlockNode(child));
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
      const { inlineContent, blockChildren } = node.children
        ? convertMixedChildren(node.children)
        : { inlineContent: [], blockChildren: [] };
      return [
        {
          type: "callout",
          props: {
            type,
            ...(title ? { title } : {}),
          },
          content: inlineContent,
          ...(blockChildren.length > 0 ? { children: blockChildren } : {}),
        },
      ];
    }

    case "Card": {
      const title = getAttrValue(attrs, "title") || "";
      const icon = normalizeIconAttr(getAttrValue(attrs, "icon"));
      const href = getAttrValue(attrs, "href");
      const { inlineContent, blockChildren } = node.children
        ? convertMixedChildren(node.children)
        : { inlineContent: [], blockChildren: [] };
      return [
        {
          type: "card",
          props: {
            title,
            ...(icon ? { icon } : {}),
            ...(href ? { href } : {}),
          },
          content: inlineContent,
          ...(blockChildren.length > 0 ? { children: blockChildren } : {}),
        },
      ];
    }

    case "Columns": {
      const cols = getAttrValue(attrs, "cols") || "2";

      // Smart detection: check if ALL JSX children are <Card> elements
      const jsxChildren = (node.children || []).filter(
        (child) => child.type === "mdxJsxFlowElement"
      );
      const allCards =
        jsxChildren.length > 0 &&
        jsxChildren.every((child) => child.name === "Card");

      if (allCards) {
        // All children are Cards → produce cardGroup + card blocks (legacy behavior)
        const blocks: BlockNoteBlock[] = [
          {
            type: "cardGroup",
            props: { cols },
            content: [],
          },
        ];
        for (const child of jsxChildren) {
          blocks.push(...convertMdxJsxElement(child));
        }
        return blocks;
      }

      // Mixed or non-card content → produce columns + column blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "columns",
          props: { cols },
          content: [],
        },
      ];
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "mdxJsxFlowElement") {
            // Each JSX child becomes a column block
            const childBlocks = child.children
              ? child.children.flatMap((grandchild) =>
                  convertBlockNode(grandchild)
                )
              : [];
            // Flatten inline content from child blocks into the column's content
            const columnContent: BlockNoteInlineContent[] = [];
            for (const cb of childBlocks) {
              if (cb.content && Array.isArray(cb.content)) {
                columnContent.push(...(cb.content as BlockNoteInlineContent[]));
              }
            }
            blocks.push({
              type: "column",
              content: columnContent,
            });
          }
        }
      }
      return blocks;
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
      const icon = normalizeIconAttr(getAttrValue(attrs, "icon"));
      const { inlineContent, blockChildren } = node.children
        ? convertMixedChildren(node.children)
        : { inlineContent: [], blockChildren: [] };
      return [
        {
          type: "tab",
          props: {
            title,
            ...(icon ? { icon } : {}),
          },
          content: inlineContent,
          ...(blockChildren.length > 0 ? { children: blockChildren } : {}),
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
            // Unescape \{ and \} that may have been erroneously added by
            // sanitizeForMdx when adjacent code blocks inside a JSX element
            // weren't recognised as protected regions.
            const code = (child.value || "").replace(/\\([{}])/g, "$1");
            const childProps: Record<string, unknown> = {
              language: child.lang || "",
              code,
            };

            if (child.meta) {
              // Parse height from meta if present (e.g., {height=300})
              const heightMatch = child.meta.match(/\{height=(\d+)\}/);
              if (heightMatch) {
                childProps.height = heightMatch[1];
              }
              // Parse title from meta — supports title="value" or bare text
              const titleMatch = child.meta.match(/title="([^"]*)"/);
              if (titleMatch) {
                childProps.title = titleMatch[1];
              } else {
                // Title is everything in meta except {key=value} metadata blocks
                const title = child.meta.replace(/\{[^}]*\}/g, "").trim();
                if (title) {
                  childProps.title = title;
                }
              }
            }

            blocks.push({
              type: "codeBlock",
              props: childProps,
            });
          }
        }
      }
      return blocks;
    }

    case "Steps": {
      // Steps container block, followed by child Step blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "steps",
          content: [],
        },
      ];
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "mdxJsxFlowElement" && child.name === "Step") {
            blocks.push(...convertMdxJsxElement(child));
          }
        }
      }
      return blocks;
    }

    case "Step": {
      const title = getAttrValue(attrs, "title") || "Step";
      const icon = normalizeIconAttr(getAttrValue(attrs, "icon"));
      const { inlineContent, blockChildren } = node.children
        ? convertMixedChildren(node.children)
        : { inlineContent: [], blockChildren: [] };
      return [
        {
          type: "step",
          props: {
            title,
            ...(icon ? { icon } : {}),
          },
          content: inlineContent,
          ...(blockChildren.length > 0 ? { children: blockChildren } : {}),
        },
      ];
    }

    case "AccordionGroup": {
      // AccordionGroup container block, followed by child Accordion blocks
      const blocks: BlockNoteBlock[] = [
        {
          type: "accordionGroup",
          content: [],
        },
      ];
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "mdxJsxFlowElement" && child.name === "Accordion") {
            blocks.push(...convertMdxJsxElement(child));
          }
        }
      }
      return blocks;
    }

    case "Accordion": {
      const title = getAttrValue(attrs, "title") || "Accordion";
      const icon = normalizeIconAttr(getAttrValue(attrs, "icon"));
      const defaultOpen = getAttrValue(attrs, "defaultOpen");
      const { inlineContent, blockChildren } = node.children
        ? convertMixedChildren(node.children)
        : { inlineContent: [], blockChildren: [] };
      return [
        {
          type: "accordion",
          props: {
            title,
            ...(icon ? { icon } : {}),
            ...(defaultOpen ? { defaultOpen } : {}),
          },
          content: inlineContent,
          ...(blockChildren.length > 0 ? { children: blockChildren } : {}),
        },
      ];
    }

    case "Frame": {
      const hint = getAttrValue(attrs, "hint");
      const caption = getAttrValue(attrs, "caption");
      const frameChildren: BlockNoteBlock[] = [];
      // Convert child nodes into children of the frame block
      if (node.children) {
        for (const child of node.children) {
          const childBlocks = convertBlockNode(child);
          for (const childBlock of childBlocks) {
            frameChildren.push(childBlock);
          }
        }
      }
      return [
        {
          type: "frame",
          props: {
            ...(hint ? { hint } : {}),
            ...(caption ? { caption } : {}),
          },
          content: [],
          children: frameChildren,
        },
      ];
    }

    case "iframe": {
      const src = getAttrValue(attrs, "src") || "";
      const title = getAttrValue(attrs, "title") || "";
      const width = getAttrValue(attrs, "width") || "";
      const height = getAttrValue(attrs, "height") || "";
      const allow = getAttrValue(attrs, "allow") || "";
      // allowFullScreen is a boolean attribute — check presence (value may be null, true, or undefined)
      const allowFullScreen = attrs?.some((a) => a.name === "allowFullScreen") ? "true" : "false";
      return [
        {
          type: "iframe",
          props: {
            src,
            ...(title ? { title } : {}),
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            ...(allow ? { allow } : {}),
            allowFullScreen,
          },
        },
      ];
    }

    case "video": {
      const src = getAttrValue(attrs, "src") || "";
      // Boolean attributes — check presence (value may be null, true, or undefined)
      const autoPlay = attrs?.some((a) => a.name === "autoPlay") ? "true" : "false";
      const muted = attrs?.some((a) => a.name === "muted") ? "true" : "false";
      const loop = attrs?.some((a) => a.name === "loop") ? "true" : "false";
      const playsInline = attrs?.some((a) => a.name === "playsInline") ? "true" : "false";
      const controls = attrs?.some((a) => a.name === "controls") ? "true" : "false";
      return [
        {
          type: "video",
          props: {
            src,
            autoPlay,
            muted,
            loop,
            playsInline,
            controls,
          },
        },
      ];
    }

    case "figure": {
      // GitBook HTML figure: <figure><img src="..." alt="..."><figcaption><p>caption</p></figcaption></figure>
      // Produces a frame block with the image nested inside frame.children.
      let figSrc = "";
      let figAlt = "";
      let figCaption = "";
      const figureChildren: BlockNoteBlock[] = [];

      if (node.children) {
        for (const child of node.children) {
          // Find the <img> child — may be mdxJsxFlowElement or mdxJsxTextElement
          if (
            (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
            child.name === "img"
          ) {
            figSrc = getAttrValue(child.attributes, "src") || "";
            figAlt = getAttrValue(child.attributes, "alt") || "";
          }
          // Find the <figcaption> child and extract text content
          if (
            (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
            child.name === "figcaption"
          ) {
            figCaption = extractTextContent(child);
          }
        }
      }

      if (figSrc) {
        figureChildren.push({
          type: "image",
          props: {
            url: figSrc,
            ...(figAlt ? { alt: figAlt } : {}),
          },
        });
      }

      return [
        {
          type: "frame",
          props: {
            ...(figCaption ? { caption: figCaption } : {}),
          },
          content: [],
          children: figureChildren,
        },
      ];
    }

    case "Icon": {
      // Block-level icon: <Icon icon="flag" size={32} />
      const iconName = getAttrValue(attrs, "icon") || "";
      const size = getAttrValue(attrs, "size") || "";
      return [
        {
          type: "paragraph",
          content: [
            {
              type: "icon",
              props: {
                icon: iconName,
                ...(size ? { size } : {}),
              },
            },
          ],
        },
      ];
    }

    case "mark": {
      // Block-level mark: <mark style="color:green;">POST</mark>
      const styleStr = getAttrValue(attrs, "style") || "";
      const colorMatch = styleStr.match(/(?:^|;)\s*color:\s*([^;]+)/);
      const color = colorMatch ? colorMatch[1].trim() : "";
      const children = node.children ? flattenToInline(node.children) : [];
      const badgeText = children
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("");
      return [
        {
          type: "paragraph",
          content: [
            {
              type: "badge",
              props: { color },
              content: [{ type: "text", text: badgeText }],
            },
          ],
        },
      ];
    }

    case "br": {
      return [
        {
          type: "paragraph",
          content: [],
        },
      ];
    }

    case "img": {
      const src = getAttrValue(attrs, "src") || "";
      const alt = getAttrValue(attrs, "alt") || "";
      const width = getAttrValue(attrs, "width");
      // Style props (e.g. borderRadius) are intentionally dropped —
      // the parent Frame provides border treatment.
      return [
        {
          type: "image",
          props: {
            url: src,
            ...(alt ? { alt, caption: alt } : {}),
            ...(width ? { previewWidth: parseInt(width, 10) } : {}),
          },
        },
      ];
    }

    case "ResponseField": {
      const rfName = getAttrValue(attrs, "name") || "";
      const rfType = getAttrValue(attrs, "type");
      const rfRequired = attrs
        ? attrs.some(
            (a) =>
              a.name === "required" && (a.value === null || a.value === true),
          )
        : false;
      // Separate inline content from nested block children (Expandable, ResponseField)
      const inlineNodes: MdastNode[] = [];
      const nestedChildren: MdastNode[] = [];
      if (node.children) {
        for (const child of node.children) {
          if (
            child.type === "mdxJsxFlowElement" &&
            (child.name === "Expandable" || child.name === "ResponseField")
          ) {
            nestedChildren.push(child);
          } else {
            inlineNodes.push(child);
          }
        }
      }
      const rfContent = flattenToInline(inlineNodes);
      // Convert nested children into block children (not siblings)
      const rfChildren: BlockNoteBlock[] = [];
      for (const child of nestedChildren) {
        if (
          child.type === "mdxJsxFlowElement" &&
          (child.name === "Expandable" || child.name === "ResponseField")
        ) {
          rfChildren.push(...convertMdxJsxElement(child));
        }
      }
      return [
        {
          type: "responseField",
          props: {
            name: rfName,
            ...(rfType ? { type: rfType } : {}),
            ...(rfRequired ? { required: true } : {}),
          },
          content: rfContent,
          ...(rfChildren.length > 0 ? { children: rfChildren } : {}),
        },
      ];
    }

    case "Expandable": {
      const expTitle = getAttrValue(attrs, "title") || "Details";
      const expType = getAttrValue(attrs, "type");
      // Convert nested children into block children (not siblings)
      const expChildren: BlockNoteBlock[] = [];
      if (node.children) {
        for (const child of node.children) {
          if (
            child.type === "mdxJsxFlowElement" &&
            (child.name === "ResponseField" || child.name === "Expandable")
          ) {
            expChildren.push(...convertMdxJsxElement(child));
          }
        }
      }
      return [
        {
          type: "expandable",
          props: {
            title: expTitle,
            ...(expType ? { type: expType } : {}),
          },
          content: [],
          ...(expChildren.length > 0 ? { children: expChildren } : {}),
        },
      ];
    }

    case "Latex": {
      // Extract the text content as the LaTeX expression
      const expression = node.children
        ? node.children
            .filter((c) => c.type === "text" || c.type === "paragraph")
            .map((c) =>
              c.value ||
              (c.children
                ? c.children.map((cc) => cc.value || "").join("")
                : "")
            )
            .join("")
            .trim()
        : "";
      return [
        {
          type: "latex",
          props: { expression },
          content: [],
        },
      ];
    }

    case "Image": {
      const src = getAttrValue(attrs, "src") || "";
      const alt = getAttrValue(attrs, "alt") || "";
      const caption = getAttrValue(attrs, "caption") || "";
      const width = getAttrValue(attrs, "width");
      return [
        {
          type: "image",
          props: {
            url: src,
            ...(alt ? { alt } : {}),
            ...(caption ? { caption } : {}),
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

    case "table": {
      // GitBook card-view table: <table data-view="cards"><thead>...</thead><tbody>...</tbody></table>
      const dataView = getAttrValue(attrs, "data-view");
      if (dataView === "cards") {
        // Determine hidden columns from <thead>
        const hiddenCols = new Set<number>();
        const thead = findJsxChild(node, "thead");
        if (thead) {
          const headerRow = findJsxChild(thead, "tr");
          if (headerRow && headerRow.children) {
            headerRow.children.forEach((th, idx) => {
              if (
                th.attributes &&
                th.attributes.some((a) => a.name === "data-hidden")
              ) {
                hiddenCols.add(idx);
              }
            });
          }
        }

        // Extract card data from <tbody> rows
        const tbody = findJsxChild(node, "tbody");

        const cardBlocks: BlockNoteBlock[] = [];
        if (tbody) {
          const rows = findAllJsxChildren(tbody, "tr");
          for (const row of rows) {
            if (row.children) {
              // Collect visible cell texts
              const visibleCells: string[] = [];
              row.children.forEach((td, idx) => {
                if (!hiddenCols.has(idx)) {
                  visibleCells.push(extractTextContent(td));
                }
              });

              const cardTitle = visibleCells[0] || "";
              const cardDescription = visibleCells.slice(1).filter(Boolean).join(" ");

              const cardContent: BlockNoteInlineContent[] = [];
              if (cardDescription) {
                cardContent.push({ type: "text", text: cardDescription });
              }

              cardBlocks.push({
                type: "card",
                props: { title: cardTitle },
                content: cardContent,
              });
            }
          }
        }

        // Count visible columns for cols prop
        let totalCols = 0;
        if (thead) {
          const headerRow = findJsxChild(thead, "tr");
          if (headerRow && headerRow.children) {
            totalCols = headerRow.children.length - hiddenCols.size;
          }
        }
        const colsStr = totalCols > 0 ? String(totalCols) : "2";

        return [
          {
            type: "cardGroup",
            props: { cols: colsStr },
            content: [],
          },
          ...cardBlocks,
        ];
      }

      // Non-card table JSX element: fall through to default
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

  // Recursively serialize children instead of using placeholder text
  const childText = (node.children || [])
    .map((child) => {
      if (child.value) return child.value;
      if (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") {
        return serializeJsxToString(child);
      }
      if (child.children) {
        return child.children.map((c) => c.value || "").join("");
      }
      return "";
    })
    .join("\n");
  return `<${name}${attrs ? " " + attrs : ""}>${childText}</${name}>`;
}

// Set of node types that should be treated as inline content
const INLINE_NODE_TYPES = new Set([
  "paragraph",
  "text",
  "strong",
  "emphasis",
  "inlineCode",
  "delete",
  "link",
  "mdxJsxTextElement",
]);

/**
 * Separates child nodes of a JSX element into inline content and block-level children.
 * Inline nodes (paragraph, text, formatting) go into `inlineContent`.
 * Block nodes (code, table, list, heading, image, etc.) go into `blockChildren`.
 */
function convertMixedChildren(
  nodes: MdastNode[]
): { inlineContent: BlockNoteInlineContent[]; blockChildren: BlockNoteBlock[] } {
  const inlineContent: BlockNoteInlineContent[] = [];
  const blockChildren: BlockNoteBlock[] = [];

  for (const node of nodes) {
    if (INLINE_NODE_TYPES.has(node.type)) {
      // Check if this paragraph contains only a single image — treat as block content
      if (
        node.type === "paragraph" &&
        node.children &&
        node.children.length === 1 &&
        node.children[0] &&
        node.children[0].type === "image"
      ) {
        blockChildren.push(...convertBlockNode(node));
      } else if (node.type === "paragraph" && node.children) {
        inlineContent.push(...convertInlineNodes(node.children));
      } else {
        inlineContent.push(...convertInlineNodes([node]));
      }
    } else {
      // Block-level node — convert to BlockNote block(s)
      blockChildren.push(...convertBlockNode(node));
    }
  }

  return { inlineContent, blockChildren };
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
      // Check if the paragraph contains a single block-level JSX element
      // that remark-mdx wrapped inline (e.g. <figure>, <table data-view="cards">)
      if (node.children?.length === 1) {
        const only = node.children[0];
        if (only.type === "mdxJsxTextElement" || only.type === "mdxJsxFlowElement") {
          const jsxName = only.name || "";
          if (jsxName === "figure" || jsxName === "table") {
            // Promote to block-level and process through convertMdxJsxElement
            return convertMdxJsxElement(only);
          }
        }
      }

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
              ...(img.alt ? { alt: img.alt } : {}),
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

      if (node.meta) {
        // Parse height from meta if present (e.g., {height=300})
        const heightMatch = node.meta.match(/\{height=(\d+)\}/);
        if (heightMatch) {
          props.height = heightMatch[1];
        }
        // Parse title from meta — supports title="value" or bare text
        const titleMatch = node.meta.match(/title="([^"]*)"/);
        if (titleMatch) {
          props.title = titleMatch[1];
        } else {
          // Title is everything in meta except {key=value} metadata blocks
          const title = node.meta.replace(/\{[^}]*\}/g, "").trim();
          if (title) {
            props.title = title;
          }
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
            ...(node.alt ? { alt: node.alt } : {}),
          },
        },
      ];
    }

    case "thematicBreak": {
      return [{ type: "divider" }];
    }

    case "blockquote": {
      // Recursively convert blockquote children into blocks
      const childBlocks = node.children
        ? node.children.flatMap((child) => convertBlockNode(child))
        : [];

      if (childBlocks.length === 0) {
        return [{ type: "quote", content: [] }];
      }

      const firstChild = childBlocks[0];
      const restChildren = childBlocks.slice(1);

      // If the first child is a simple paragraph, promote its inline content
      // to the quote block's content, and put remaining blocks as children
      if (firstChild.type === "paragraph" && !firstChild.children?.length) {
        const quoteBlock: BlockNoteBlock = {
          type: "quote",
          content: firstChild.content || [],
        };
        if (restChildren.length > 0) {
          quoteBlock.children = restChildren;
        }
        return [quoteBlock];
      }

      // Otherwise (e.g. nested blockquotes, headings, etc.), keep content empty
      // and put all child blocks as children
      return [{
        type: "quote",
        content: [],
        children: childBlocks,
      }];
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
