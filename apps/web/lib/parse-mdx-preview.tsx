import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Card,
  CardGroup,
  Callout,
  Image,
  Tabs,
  Tab,
  Steps,
  Step,
  Accordion,
  AccordionGroup,
  Columns,
  Column,
  CodeGroup,
  CodeBlock,
  Heading,
  CustomLink,
  Frame,
  Latex,
  Video,
  IFrame,
  InlineIcon,
  Badge,
} from "@inkloom/docs-renderer";

interface ParsedComponent {
  type: "Card" | "CardGroup" | "Callout" | "Image" | "Tabs" | "Tab" | "Steps" | "Step" | "Accordion" | "AccordionGroup" | "Columns" | "Column" | "CodeGroup" | "ApiEndpoint" | "ParamField" | "ResponseField" | "Expandable" | "Frame" | "Latex" | "Video" | "IFrame";
  props: Record<string, string | number | boolean>;
  children: string;
  startIndex: number;
  endIndex: number;
}

interface CodeBlockSegment {
  type: 'codeblock';
  language: string;
  height: number;
  title: string;
  code: string;
  key: string;
}

interface MarkdownSegment {
  type: 'markdown';
  content: string;
  key: string;
}

type ContentSegment = CodeBlockSegment | MarkdownSegment;

// Preprocess inline components (Icon, Badge) into HTML that react-markdown can handle via rehypeRaw.
// This ensures they render truly inline within paragraphs rather than breaking text into block segments.
function preprocessInlineComponents(source: string): string {
  // Convert <Icon icon="name" size={16} /> to <span data-icon="name" data-size="16"></span>
  const result = source.replace(
    /<Icon\s+([^>]*?)\/>/g,
    (_match, attrStr: string) => {
      const iconMatch = attrStr.match(/icon="([^"]*)"/);
      const sizeMatch = attrStr.match(/size=\{(\d+)\}/) || attrStr.match(/size="(\d+)"/);
      const icon = iconMatch ? iconMatch[1] : "";
      const size = sizeMatch ? sizeMatch[1] : "16";
      return `<span data-icon="${icon}" data-size="${size}"></span>`;
    }
  );
  return result;
}

// Pre-process markdown to extract code blocks with extra metadata (title and/or height)
function preprocessCodeBlocks(content: string): { segments: ContentSegment[], hasCodeBlocks: boolean } {
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
        segments.push({ type: 'markdown', content: beforeContent, key: `md-${idx}` });
      }
    }

    // Parse height and title from the extra info
    const extra = match[2] || "";
    const heightMatch = extra.match(/\{height=(\d+)\}/);
    const height = heightMatch && heightMatch[1] ? parseInt(heightMatch[1], 10) : 150;
    const title = extra.replace(/\{[^}]*\}/g, "").trim();

    // Add the code block component
    segments.push({
      type: 'codeblock',
      language: match[1] || 'plaintext',
      height,
      title,
      code: match[3] || '',
      key: `code-${idx}`
    });

    lastIndex = match.index + match[0].length;
    idx++;
  }

  // Add remaining markdown
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex);
    if (remainingContent.trim()) {
      segments.push({ type: 'markdown', content: remainingContent, key: `md-final` });
    }
  }

  return { segments, hasCodeBlocks };
}

// Shared markdown component overrides for react-markdown
function getMarkdownComponents() {
  return {
    p: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <p style={style}>{children}</p>,
    div: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <div style={style} className={className}>{children}</div>,
    span: ({ children, style, className, ...rest }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string; [key: string]: unknown }) => {
      const dataIcon = rest["data-icon"];
      if (typeof dataIcon === "string" && dataIcon) {
        const dataSize = rest["data-size"];
        return <InlineIcon icon={dataIcon} size={typeof dataSize === "string" ? dataSize : undefined} />;
      }
      return <span style={style} className={className}>{children}</span>;
    },
    pre: ({ children }: { children?: React.ReactNode }) => {
      // Extract language from child <code className="language-xxx">
      const codeChild = React.Children.toArray(children).find(
        (child): child is React.ReactElement =>
          React.isValidElement(child) && (child as React.ReactElement).type === "code"
      ) as React.ReactElement | undefined;
      const className = codeChild?.props?.className || "";
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : undefined;
      const code = typeof codeChild?.props?.children === "string" ? codeChild.props.children : "";
      return <CodeBlock language={lang}>{code}</CodeBlock>;
    },
    h1: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={1} {...props}>{children}</Heading>,
    h2: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={2} {...props}>{children}</Heading>,
    h3: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={3} {...props}>{children}</Heading>,
    h4: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={4} {...props}>{children}</Heading>,
    h5: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={5} {...props}>{children}</Heading>,
    h6: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Heading level={6} {...props}>{children}</Heading>,
    a: ({ href, children, ...props }: { href?: string; children?: React.ReactNode; [key: string]: unknown }) => <CustomLink href={href} {...props}>{children}</CustomLink>,
    mark: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => {
      // The MDX parser outputs badges as <mark style="color:green;">text</mark>
      // Extract the color and render as a Badge component
      let color = "gray";
      if (style && typeof style.color === "string") {
        color = style.color;
      }
      return <Badge color={color}>{children}</Badge>;
    },
  } as Record<string, React.ComponentType<Record<string, unknown>>>;
}

// Render markdown with pre-processed code blocks
function MarkdownWithCodeBlocks({ content }: { content: string }): React.ReactNode {
  const { segments, hasCodeBlocks } = preprocessCodeBlocks(content);
  const components = getMarkdownComponents();

  if (!hasCodeBlocks) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {segments.map((segment) => {
        if (segment.type === 'markdown') {
          return (
            <ReactMarkdown
              key={segment.key}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={components}
            >
              {segment.content}
            </ReactMarkdown>
          );
        } else if (segment.type === 'codeblock') {
          return (
            <CodeBlock
              key={segment.key}
              language={segment.language}
              height={segment.height}
              title={segment.title || undefined}
            >
              {segment.code}
            </CodeBlock>
          );
        }
        return null;
      })}
    </>
  );
}

// Parse attributes from a JSX-like tag string
function parseAttributes(
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
        attrs[key] = stringValue;
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

// Find the balanced closing tag for a component, handling nested same-name tags
function findBalancedCloseTag(content: string, tagName: string, searchFrom: number): number {
  let depth = 1;
  const openRegex = new RegExp(`<${tagName}(?![a-zA-Z])\\s*[^>]*(?<!/)>`, "g");
  const closeTag = `</${tagName}>`;
  let pos = searchFrom;

  while (pos < content.length && depth > 0) {
    const closeIdx = content.indexOf(closeTag, pos);
    if (closeIdx === -1) return -1;

    // Count any non-self-closing opening tags between pos and closeIdx
    openRegex.lastIndex = pos;
    let openMatch;
    while ((openMatch = openRegex.exec(content)) !== null && openMatch.index < closeIdx) {
      depth++;
    }

    depth--;
    if (depth === 0) return closeIdx;
    pos = closeIdx + closeTag.length;
  }

  return -1;
}

// Find all MDX components in the content
function findMDXComponents(content: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const componentNames = ["Card", "CardGroup", "Callout", "Image", "Tabs", "Tab", "Steps", "Step", "Accordion", "AccordionGroup", "Columns", "Column", "CodeGroup", "ApiEndpoint", "ParamField", "ResponseField", "Expandable", "Frame", "Latex", "Video", "IFrame"];

  for (const name of componentNames) {
    // Use negative lookahead to ensure we match exact component name
    // e.g., <Tab should not match <Tabs
    const namePattern = `<${name}(?![a-zA-Z])`;

    // Match self-closing tags: <Card ... /> or <Card/>
    // Changed from \s+ to allow tags without space after component name
    const selfClosingRegex = new RegExp(
      `${namePattern}([^>]*?)/>`,
      "g"
    );
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
    const openTagRegex = new RegExp(`${namePattern}\\s*([^>]*)(?<!/)>`, "g");
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
  // (e.g., Tab inside Tabs should be handled by TabsChildrenRenderer)
  const filtered: ParsedComponent[] = [];
  for (const comp of components) {
    // Check if this component is contained within any previously added component
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

// Minimal preview-only ApiEndpoint component
function PreviewApiEndpoint({ method, path, deprecated, children }: {
  method: string;
  path: string;
  deprecated?: boolean;
  children?: React.ReactNode;
}) {
  const methodUpper = method.toUpperCase();
  const badgeColors: Record<string, string> = {
    GET: "#22c55e",
    POST: "#3b82f6",
    PUT: "#f59e0b",
    PATCH: "#f59e0b",
    DELETE: "#ef4444",
  };
  const badgeColor = badgeColors[methodUpper] || "#6b7280";

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{ background: badgeColor, color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const }}>{methodUpper}</span>
        <code style={{ fontSize: "14px" }}>{path}</code>
        {deprecated && <span style={{ color: "#f59e0b", fontSize: "12px", fontWeight: 600 }}>Deprecated</span>}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

// Minimal preview-only ParamField component
function PreviewParamField({ name, type, location, required, children }: {
  name: string;
  type?: string;
  location?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <code style={{ fontWeight: 600 }}>{name}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
        {location && <span style={{ color: "#6b7280", fontSize: "12px", background: "var(--muted, #f3f4f6)", padding: "1px 6px", borderRadius: "4px" }}>{location}</span>}
        {required && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>required</span>}
      </div>
      {children && <div style={{ marginTop: "4px", fontSize: "14px", color: "var(--muted-foreground, #6b7280)" }}>{children}</div>}
    </div>
  );
}

// Minimal preview-only ResponseField component
function PreviewResponseField({ name, type, required, children }: {
  name: string;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <code style={{ fontWeight: 600 }}>{name}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
        {required && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>required</span>}
      </div>
      {children && <div style={{ marginTop: "4px", fontSize: "14px", color: "var(--muted-foreground, #6b7280)" }}>{children}</div>}
    </div>
  );
}

// Minimal preview-only Expandable component
function PreviewExpandable({ title, type, children }: {
  title: string;
  type?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "6px", marginBottom: "8px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const, fontSize: "14px" }}
      >
        <span>{open ? "▼" : "▶"}</span>
        <code style={{ fontWeight: 600 }}>{title}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
      </button>
      {open && <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border, #e5e7eb)" }}>{children}</div>}
    </div>
  );
}

// Render a single parsed component
function renderComponent(
  component: ParsedComponent,
  key: number
): React.ReactNode {
  const { type, props, children } = component;

  switch (type) {
    case "Card":
      return (
        <Card
          key={key}
          title={(props.title as string) || ""}
          icon={props.icon as string}
          href={props.href as string}
        >
          {children && <MDXPreviewRenderer content={children} />}
        </Card>
      );

    case "CardGroup":
      return (
        <CardGroup key={key} cols={props.cols as 2 | 3 | 4}>
          {children && (
            <MDXPreviewRenderer content={children} />
          )}
        </CardGroup>
      );

    case "Callout":
      return (
        <Callout
          key={key}
          type={props.type as "info" | "warning" | "danger" | "success" | "tip"}
          title={props.title as string}
        >
          {children ? <MDXPreviewRenderer content={children} /> : ""}
        </Callout>
      );

    case "Image":
      return (
        <Image
          key={key}
          src={props.src as string}
          alt={props.alt as string}
          width={props.width as number}
        />
      );

    case "Tabs":
      return (
        <Tabs key={key}>
          {children ? renderTabChildren(children) : <></>}
        </Tabs>
      );

    case "Tab":
      return (
        <Tab
          key={key}
          title={props.title as string}
          icon={props.icon as string}
        >
          {children ? <MDXPreviewRenderer content={children} /> : ""}
        </Tab>
      );

    case "Steps":
      return (
        <Steps key={key}>
          {children ? renderStepChildren(children) : <></>}
        </Steps>
      );

    case "Step":
      return (
        <Step
          key={key}
          title={props.title as string}
          icon={props.icon as string}
        >
          {children ? <MDXPreviewRenderer content={children} /> : ""}
        </Step>
      );

    case "CodeGroup":
      return (
        <CodeGroup key={key}>
          {children || ""}
        </CodeGroup>
      );

    case "Accordion":
      return (
        <Accordion
          key={key}
          title={props.title as string}
          icon={props.icon as string}
          defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
        >
          {children ? <MDXPreviewRenderer content={children} /> : ""}
        </Accordion>
      );

    case "AccordionGroup":
      return (
        <AccordionGroup key={key}>
          {children ? renderAccordionChildren(children) : <></>}
        </AccordionGroup>
      );

    case "Columns":
      return (
        <Columns key={key} cols={props.cols as 2 | 3 | 4}>
          {children ? renderColumnChildren(children) : <></>}
        </Columns>
      );

    case "Column":
      return (
        <Column key={key}>
          {children && <MDXPreviewRenderer content={children} />}
        </Column>
      );

    case "ApiEndpoint":
      return (
        <PreviewApiEndpoint
          key={key}
          method={(props.method as string) || "GET"}
          path={(props.path as string) || "/"}
          deprecated={props.deprecated === true || props.deprecated === "true"}
        >
          {children && <MDXPreviewRenderer content={children} />}
        </PreviewApiEndpoint>
      );

    case "ParamField":
      return (
        <PreviewParamField
          key={key}
          name={(props.name as string) || ""}
          type={props.type as string}
          location={props.location as string}
          required={props.required === true || props.required === "true"}
        >
          {children && <span>{children}</span>}
        </PreviewParamField>
      );

    case "ResponseField":
      return (
        <PreviewResponseField
          key={key}
          name={(props.name as string) || ""}
          type={props.type as string}
          required={props.required === true || props.required === "true"}
        >
          {children && <MDXPreviewRenderer content={children} />}
        </PreviewResponseField>
      );

    case "Expandable":
      return (
        <PreviewExpandable
          key={key}
          title={(props.title as string) || ""}
          type={props.type as string}
        >
          {children && <MDXPreviewRenderer content={children} />}
        </PreviewExpandable>
      );

    case "Frame":
      return (
        <Frame
          key={key}
          hint={props.hint as string}
          caption={props.caption as string}
        >
          {children && <MDXPreviewRenderer content={children} />}
        </Frame>
      );

    case "Latex": {
      const expr =
        (props.expression as string) ||
        (typeof children === "string" ? children.trim() : "") ||
        "";
      return <Latex key={key} expression={expr} />;
    }

    case "Video":
      return <Video key={key} src={(props.src as string) || ""} {...(props as Record<string, string>)} />;

    case "IFrame":
      return <IFrame key={key} src={(props.src as string) || ""} {...(props as Record<string, string>)} />;

    default:
      return null;
  }
}

// Helper function to render Tab children within a Tabs component
// Returns an array of Tab elements (not a component wrapper)
function renderTabChildren(content: string): React.ReactNode[] {
  // Parse Tab components from the content string using balanced tag matching
  const openTagRegex = /<Tab(?![a-zA-Z])\s*([^>]*)(?<!\/)>/g;
  const tabs: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = openTagRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const contentStart = match.index + match[0].length;
    const closeIdx = findBalancedCloseTag(content, "Tab", contentStart);
    if (closeIdx === -1) continue;

    const childContent = content.slice(contentStart, closeIdx).trim();
    const props = parseAttributes(attrStr);

    tabs.push(
      <Tab
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
      >
        <MDXPreviewRenderer content={childContent} />
      </Tab>
    );

    // Advance past this tag to avoid re-matching
    openTagRegex.lastIndex = closeIdx + "</Tab>".length;
    idx++;
  }

  return tabs;
}

// Helper function to render Step children within a Steps component
// Returns an array of Step elements
function renderStepChildren(content: string): React.ReactNode[] {
  // Parse Step components from the content string using balanced tag matching
  const openTagRegex = /<Step(?![a-zA-Z])\s*([^>]*)(?<!\/)>/g;
  const steps: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = openTagRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const contentStart = match.index + match[0].length;
    const closeIdx = findBalancedCloseTag(content, "Step", contentStart);
    if (closeIdx === -1) continue;

    const childContent = content.slice(contentStart, closeIdx).trim();
    const props = parseAttributes(attrStr);

    steps.push(
      <Step
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
      >
        <MDXPreviewRenderer content={childContent} />
      </Step>
    );

    // Advance past this tag to avoid re-matching
    openTagRegex.lastIndex = closeIdx + "</Step>".length;
    idx++;
  }

  return steps;
}

// Helper function to render Accordion children within an AccordionGroup component
// Returns an array of Accordion elements
function renderAccordionChildren(content: string): React.ReactNode[] {
  // Parse Accordion components from the content string using balanced tag matching
  const openTagRegex = /<Accordion(?![a-zA-Z])\s*([^>]*)(?<!\/)>/g;
  const accordions: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = openTagRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const contentStart = match.index + match[0].length;
    const closeIdx = findBalancedCloseTag(content, "Accordion", contentStart);
    if (closeIdx === -1) continue;

    const childContent = content.slice(contentStart, closeIdx).trim();
    const props = parseAttributes(attrStr);

    accordions.push(
      <Accordion
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
        defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
      >
        <MDXPreviewRenderer content={childContent} />
      </Accordion>
    );

    // Advance past this tag to avoid re-matching
    openTagRegex.lastIndex = closeIdx + "</Accordion>".length;
    idx++;
  }

  return accordions;
}

// Helper function to render Column children within a Columns component
// Returns an array of Column elements
function renderColumnChildren(content: string): React.ReactNode[] {
  // Parse Column components from the content string using balanced tag matching
  const openTagRegex = /<Column(?![a-zA-Z])\s*([^>]*)(?<!\/)>/g;
  const columns: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = openTagRegex.exec(content)) !== null) {
    const contentStart = match.index + match[0].length;
    const closeIdx = findBalancedCloseTag(content, "Column", contentStart);
    if (closeIdx === -1) continue;

    const childContent = content.slice(contentStart, closeIdx).trim();

    columns.push(
      <Column key={idx}>
        <MDXPreviewRenderer content={childContent} />
      </Column>
    );

    // Advance past this tag to avoid re-matching
    openTagRegex.lastIndex = closeIdx + "</Column>".length;
    idx++;
  }

  return columns;
}

// Main component that renders MDX content with component support
export function MDXPreviewRenderer({ content }: { content: string }) {
  // Preprocess inline components (Icon) into HTML spans so they render truly inline
  const preprocessedContent = preprocessInlineComponents(content);
  const components = findMDXComponents(preprocessedContent);

  if (components.length === 0) {
    // No MDX components, just render as markdown with code block support
    return <MarkdownWithCodeBlocks content={preprocessedContent} />;
  }

  // Build segments alternating between markdown and components
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  components.forEach((comp, idx) => {
    // Add markdown before this component
    if (comp.startIndex > lastIndex) {
      const markdownContent = preprocessedContent.slice(lastIndex, comp.startIndex).trim();
      if (markdownContent) {
        segments.push(
          <MarkdownWithCodeBlocks key={`md-${idx}`} content={markdownContent} />
        );
      }
    }

    // Add the component
    segments.push(renderComponent(comp, idx));
    lastIndex = comp.endIndex;
  });

  // Add any remaining markdown after the last component
  if (lastIndex < preprocessedContent.length) {
    const remainingContent = preprocessedContent.slice(lastIndex).trim();
    if (remainingContent) {
      segments.push(
        <MarkdownWithCodeBlocks key="md-final" content={remainingContent} />
      );
    }
  }

  return <>{segments}</>;
}
