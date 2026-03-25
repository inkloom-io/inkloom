import React from "react";
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
  Columns,
  Column,
  CodeGroup,
  CodeBlock,
  Heading,
  CustomLink,
  Badge,
  IconDisplay,
} from "./index";
import type { ParsedComponent } from "./mdx-parser";
import {
  parseAttributes,
  findBalancedCloseTag,
  findMDXComponents,
  preprocessCodeBlocks,
  preprocessInlineComponents,
} from "./mdx-parser";

// ---------------------------------------------------------------------------
// Component overrides interface
// ---------------------------------------------------------------------------

export interface ComponentOverrides {
  ApiEndpoint?: React.ComponentType<Record<string, unknown>>;
}

interface RenderOptions {
  componentOverrides?: ComponentOverrides;
  renderContent: (source: string) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Child renderers
// ---------------------------------------------------------------------------

export function renderTabChildren(
  content: string,
  renderContent: (source: string) => React.ReactNode
): React.ReactNode[] {
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
        title={(props.title as string) || "Tab"}
        icon={props.icon as string}
      >
        {renderContent(childContent)}
      </Tab>
    );

    openTagRegex.lastIndex = closeIdx + "</Tab>".length;
    idx++;
  }

  return tabs;
}

export function renderStepChildren(
  content: string,
  renderContent: (source: string) => React.ReactNode
): React.ReactNode[] {
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
        title={(props.title as string) || "Step"}
        icon={props.icon as string}
        stepNumber={idx + 1}
      >
        {renderContent(childContent)}
      </Step>
    );

    openTagRegex.lastIndex = closeIdx + "</Step>".length;
    idx++;
  }

  return steps;
}

export function renderColumnChildren(
  content: string,
  renderContent: (source: string) => React.ReactNode
): React.ReactNode[] {
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
      <Column key={idx}>{renderContent(childContent)}</Column>
    );

    openTagRegex.lastIndex = closeIdx + "</Column>".length;
    idx++;
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Interactive check list item
// ---------------------------------------------------------------------------

function CheckListItem({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const childArray = React.Children.toArray(children);
  let hasCheckbox = false;
  let defaultChecked = false;

  for (const child of childArray) {
    if (
      React.isValidElement(child) &&
      (child as React.ReactElement<{ type?: string; checked?: boolean }>).props
        .type === "checkbox"
    ) {
      hasCheckbox = true;
      defaultChecked =
        !!(child as React.ReactElement<{ checked?: boolean }>).props.checked;
      break;
    }
  }

  const [checked, setChecked] = React.useState(defaultChecked);

  if (!hasCheckbox) {
    return <li style={style}>{children}</li>;
  }

  const newChildren: React.ReactNode[] = [];
  let checkboxFound = false;
  const remainingChildren: React.ReactNode[] = [];

  for (const child of childArray) {
    if (
      !checkboxFound &&
      React.isValidElement(child) &&
      (child as React.ReactElement<{ type?: string }>).props.type ===
        "checkbox"
    ) {
      checkboxFound = true;
      newChildren.push(
        <input
          key="checkbox"
          type="checkbox"
          checked={checked}
          onChange={() => setChecked((prev) => !prev)}
          style={{ cursor: "pointer" }}
        />
      );
    } else {
      remainingChildren.push(child);
    }
  }

  newChildren.push(
    <span
      key="label"
      style={{
        textDecoration: checked ? "line-through" : "none",
      }}
    >
      {remainingChildren}
    </span>
  );

  return <li style={style}>{newChildren}</li>;
}

// ---------------------------------------------------------------------------
// Markdown component overrides
// ---------------------------------------------------------------------------

export function getMarkdownComponents(): Record<string, React.ComponentType<Record<string, unknown>>> {
  return {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={1}>{children}</Heading>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={2}>{children}</Heading>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={3}>{children}</Heading>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={4}>{children}</Heading>
    ),
    h5: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={5}>{children}</Heading>
    ),
    h6: ({ children }: { children?: React.ReactNode }) => (
      <Heading level={6}>{children}</Heading>
    ),
    p: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => <p style={style}>{children}</p>,
    div: ({
      children,
      style,
      className,
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
      className?: string;
    }) => (
      <div style={style} className={className}>
        {children}
      </div>
    ),
    span: ({
      children,
      style,
      className,
      ...rest
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
      className?: string;
      [key: string]: unknown;
    }) => {
      const dataIcon = rest["data-icon"];
      if (typeof dataIcon === "string" && dataIcon) {
        const dataSize = rest["data-size"];
        return (
          <IconDisplay
            icon={dataIcon}
            className={typeof dataSize === "string" ? `h-[${dataSize}px] w-[${dataSize}px]` : undefined}
          />
        );
      }
      return (
        <span style={style} className={className}>
          {children}
        </span>
      );
    },
    ul: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol>{children}</ol>,
    li: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => <CheckListItem style={style}>{children}</CheckListItem>,
    a: ({
      href,
      children,
    }: {
      href?: string;
      children?: React.ReactNode;
    }) => <CustomLink href={href || "#"}>{children}</CustomLink>,
    code: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => {
      const isBlock = className?.includes("language-");
      return isBlock ? (
        <code className={className}>{children}</code>
      ) : (
        <code>{children}</code>
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => {
      const codeChild = React.Children.toArray(children).find(
        (child): child is React.ReactElement => React.isValidElement(child)
      ) as React.ReactElement | undefined;

      const className = codeChild?.props?.className || "";
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : undefined;
      const code =
        typeof codeChild?.props?.children === "string"
          ? codeChild.props.children
          : "";
      return <CodeBlock language={lang}>{code}</CodeBlock>;
    },
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote>{children}</blockquote>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <table>{children}</table>
    ),
    th: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => <th style={style}>{children}</th>,
    td: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => <td style={style}>{children}</td>,
    mark: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: Record<string, string>;
    }) => {
      let color = "gray";
      if (style && typeof style.color === "string") {
        color = style.color;
      }
      return <Badge color={color}>{children}</Badge>;
    },
    hr: () => <hr />,
  } as Record<string, React.ComponentType<Record<string, unknown>>>;
}

// ---------------------------------------------------------------------------
// MarkdownWithCodeBlocks
// ---------------------------------------------------------------------------

export function MarkdownWithCodeBlocks({
  content,
  markdownComponents,
}: {
  content: string;
  markdownComponents?: Record<
    string,
    React.ComponentType<Record<string, unknown>>
  >;
}): React.ReactNode {
  const { segments, hasCodeBlocks } = preprocessCodeBlocks(content);
  const components = markdownComponents ?? getMarkdownComponents();

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
        if (segment.type === "markdown") {
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
        } else if (segment.type === "codeblock") {
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

// ---------------------------------------------------------------------------
// renderComponent
// ---------------------------------------------------------------------------

export function renderComponent(
  component: ParsedComponent,
  key: number,
  options: RenderOptions
): React.ReactNode {
  const { type, props, children } = component;
  const { componentOverrides, renderContent } = options;

  switch (type) {
    case "Card":
      return (
        <Card
          key={key}
          title={(props.title as string) || ""}
          icon={props.icon as string}
          href={props.href as string}
        >
          {children && renderContent(children)}
        </Card>
      );

    case "CardGroup":
      return (
        <CardGroup key={key} cols={props.cols as 2 | 3 | 4}>
          {children && renderContent(children)}
        </CardGroup>
      );

    case "Callout":
      return (
        <Callout
          key={key}
          type={
            props.type as
              | "info"
              | "warning"
              | "danger"
              | "success"
              | "tip"
          }
          title={props.title as string}
        >
          {children ? renderContent(children) : ""}
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
          {children ? renderTabChildren(children, renderContent) : <></>}
        </Tabs>
      );

    case "Tab":
      return (
        <Tab
          key={key}
          title={(props.title as string) || "Tab"}
          icon={props.icon as string}
        >
          {children ? renderContent(children) : ""}
        </Tab>
      );

    case "Steps":
      return (
        <Steps key={key}>
          {children ? renderStepChildren(children, renderContent) : <></>}
        </Steps>
      );

    case "Step":
      return (
        <Step
          key={key}
          title={(props.title as string) || "Step"}
          icon={props.icon as string}
          stepNumber={key + 1}
        >
          {children ? renderContent(children) : ""}
        </Step>
      );

    case "CodeGroup":
      return <CodeGroup key={key}>{children || ""}</CodeGroup>;

    case "Columns":
      return (
        <Columns key={key} cols={props.cols as 2 | 3 | 4}>
          {children ? (
            renderColumnChildren(children, renderContent)
          ) : (
            <></>
          )}
        </Columns>
      );

    case "Column":
      return (
        <Column key={key}>
          {children && renderContent(children)}
        </Column>
      );

    case "ApiEndpoint": {
      const ApiComp = componentOverrides?.ApiEndpoint;
      if (ApiComp) {
        return (
          <ApiComp
            key={key}
            method={(props.method as string) || "GET"}
            path={(props.path as string) || "/"}
            deprecated={
              props.deprecated === true || props.deprecated === "true"
            }
          >
            {children && renderContent(children)}
          </ApiComp>
        );
      }
      return (
        <div
          key={key}
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <code style={{ fontWeight: 700 }}>
              {((props.method as string) || "GET").toUpperCase()}
            </code>
            <code style={{ fontSize: "14px" }}>
              {(props.path as string) || "/"}
            </code>
          </div>
          {children && <div>{renderContent(children)}</div>}
        </div>
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// MDXRenderer — main entry point
// ---------------------------------------------------------------------------

export interface MDXRendererProps {
  content: string;
  componentOverrides?: ComponentOverrides;
}

export function MDXRenderer({
  content,
  componentOverrides,
}: MDXRendererProps) {
  const markdownComponents = getMarkdownComponents();

  const renderContent = (source: string): React.ReactNode => {
    return (
      <MDXRenderer
        content={source}
        componentOverrides={componentOverrides}
      />
    );
  };

  // 1. Preprocess inline components
  const preprocessedContent = preprocessInlineComponents(content);

  // 2. Find all MDX components
  const components = findMDXComponents(preprocessedContent);

  if (components.length === 0) {
    return (
      <MarkdownWithCodeBlocks
        content={preprocessedContent}
        markdownComponents={markdownComponents}
      />
    );
  }

  // 3. Build segments alternating between markdown and components
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  components.forEach((comp, idx) => {
    if (comp.startIndex > lastIndex) {
      const markdownContent = preprocessedContent
        .slice(lastIndex, comp.startIndex)
        .trim();
      if (markdownContent) {
        segments.push(
          <MarkdownWithCodeBlocks
            key={`md-${idx}`}
            content={markdownContent}
            markdownComponents={markdownComponents}
          />
        );
      }
    }

    segments.push(
      renderComponent(comp, idx, {
        componentOverrides,
        renderContent,
      })
    );
    lastIndex = comp.endIndex;
  });

  if (lastIndex < preprocessedContent.length) {
    const remainingContent = preprocessedContent.slice(lastIndex).trim();
    if (remainingContent) {
      segments.push(
        <MarkdownWithCodeBlocks
          key="md-final"
          content={remainingContent}
          markdownComponents={markdownComponents}
        />
      );
    }
  }

  return <>{segments}</>;
}
