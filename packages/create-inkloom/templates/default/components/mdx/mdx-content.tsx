"use client";

import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Callout,
  Card,
  CardGroup,
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
  DocsRendererProvider,
} from "@inkloom/docs-renderer";
import { Link } from "react-router";
import { highlightCode as shikiHighlightCode } from "@/lib/syntax-highlighter";
import { ApiEndpoint } from "./api-endpoint";
import { ParamField } from "./param-field";
import { ResponseField } from "./response-field";
import { Expandable } from "./expandable";

// Wrapper to adapt react-router's Link (uses `to`) to docs-renderer's LinkComponent (uses `href`)
function RouterLink({
  href,
  children,
  className,
  target,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}) {
  // External links use a regular <a> tag
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    return (
      <a href={href} className={className} target={target || "_blank"} rel={rel || "noopener noreferrer"}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} target={target} rel={rel}>
      {children}
    </Link>
  );
}

// Wrapper to adapt the template's highlightCode (returns { html }) to docs-renderer's (returns string)
async function highlightCode(code: string, language: string): Promise<string> {
  const result = await shikiHighlightCode(code, language);
  return result.html;
}

interface MDXContentProps {
  source: string;
}

interface ParsedComponent {
  type: "Card" | "CardGroup" | "Callout" | "Image" | "Tabs" | "Tab" | "Steps" | "Step" | "Accordion" | "AccordionGroup" | "Columns" | "Column" | "CodeGroup" | "ApiEndpoint" | "ParamField" | "ResponseField" | "Expandable" | "Frame";
  props: Record<string, string | number | boolean>;
  children: string;
  startIndex: number;
  endIndex: number;
}

// Parse attributes from a JSX-like tag string
function parseAttributes(attrString: string): Record<string, string | number | boolean> {
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
  const componentNames = ["Card", "CardGroup", "Callout", "Image", "Tabs", "Tab", "Steps", "Step", "Accordion", "AccordionGroup", "Columns", "Column", "CodeGroup", "ApiEndpoint", "ParamField", "ResponseField", "Expandable", "Frame"];

  for (const name of componentNames) {
    // Use negative lookahead to ensure exact component name matching
    // e.g., <Tab should not match <Tabs
    const namePattern = `<${name}(?![a-zA-Z])`;

    // Match self-closing tags: <Card ... /> or <Card/>
    // Changed from \s+ to allow tags without space after component name
    const selfClosingRegex = new RegExp(`${namePattern}([^>]*?)/>`, "g");
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
    // This correctly handles nested same-name tags (e.g., ResponseField inside ResponseField)
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

  // Filter out nested components (e.g., Tab inside Tabs, Card inside CardGroup)
  const filtered = components.filter((comp) => {
    // Check if this component is nested inside another component
    const isNested = components.some((parent) => {
      if (parent === comp) return false;
      // Check if comp is inside parent's range
      return (
        comp.startIndex > parent.startIndex &&
        comp.endIndex <= parent.endIndex
      );
    });
    return !isNested;
  });

  return filtered;
}

interface CodeBlockSegment {
  type: 'codeblock';
  language: string;
  height: number;
  code: string;
  key: string;
}

interface MarkdownSegment {
  type: 'markdown';
  content: string;
  key: string;
}

type ContentSegment = CodeBlockSegment | MarkdownSegment;

// Pre-process markdown to extract code blocks with height metadata
// Returns segments of markdown and CodeBlock components
function preprocessCodeBlocks(content: string): { segments: ContentSegment[], hasCodeBlocks: boolean } {
  const segments: ContentSegment[] = [];
  // Match code blocks with height metadata: ```lang {height=N}\ncode\n```
  const codeBlockRegex = /```(\w*)\s*\{height=(\d+)\}\n([\s\S]*?)```/g;
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

    // Add the code block component
    segments.push({
      type: 'codeblock',
      language: match[1] || 'plaintext',
      height: parseInt(match[2] || '150', 10),
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

// Render markdown content
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({ children }) => <Heading level={1}>{children}</Heading>,
        h2: ({ children }) => <Heading level={2}>{children}</Heading>,
        h3: ({ children }) => <Heading level={3}>{children}</Heading>,
        h4: ({ children }) => <Heading level={4}>{children}</Heading>,
        h5: ({ children }) => <Heading level={5}>{children}</Heading>,
        h6: ({ children }) => <Heading level={6}>{children}</Heading>,
        p: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <p style={style}>{children}</p>,
        div: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <div style={style} className={className}>{children}</div>,
        span: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <span style={style} className={className}>{children}</span>,
        ul: ({ children }) => <ul>{children}</ul>,
        ol: ({ children }) => <ol>{children}</ol>,
        li: ({ children, style }) => <li style={style}>{children}</li>,
        a: ({ href, children }) => (
          <CustomLink href={href || "#"}>{children}</CustomLink>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className={className}>{children}</code>
          ) : (
            <code>{children}</code>
          );
        },
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        table: ({ children }) => <table>{children}</table>,
        th: ({ children, style }) => <th style={style}>{children}</th>,
        td: ({ children, style }) => <td style={style}>{children}</td>,
        hr: () => <hr />,
      }}
    >
      {content}
    </Markdown>
  );
}

// Render markdown with pre-processed code blocks
function MarkdownWithCodeBlocks({ content }: { content: string }) {
  const { segments, hasCodeBlocks } = preprocessCodeBlocks(content);

  if (!hasCodeBlocks) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <>
      {segments.map((segment) => {
        if (segment.type === 'markdown') {
          return <MarkdownRenderer key={segment.key} content={segment.content} />;
        } else {
          return (
            <CodeBlock
              key={segment.key}
              language={segment.language}
              height={segment.height}
            >
              {segment.code}
            </CodeBlock>
          );
        }
      })}
    </>
  );
}

// Parse and render Tab children within a Tabs component
function renderTabChildren(content: string): React.ReactNode[] {
  const tabs: React.ReactNode[] = [];
  // Use negative lookahead to match Tab but not Tabs
  const tabRegex = /<Tab(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Tab>/g;
  let match;
  let index = 0;

  while ((match = tabRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = match[2] ?? "";
    const props = parseAttributes(attrStr);

    tabs.push(
      <Tab
        key={index}
        title={(props.title as string) || "Tab"}
        icon={props.icon as string}
      >
        <MDXContent source={childContent.trim()} />
      </Tab>
    );
    index++;
  }

  return tabs;
}

// Parse and render Step children within a Steps component
function renderStepChildren(content: string): React.ReactNode[] {
  const steps: React.ReactNode[] = [];
  // Use negative lookahead to match Step but not Steps
  const stepRegex = /<Step(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Step>/g;
  let match;
  let index = 0;

  while ((match = stepRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = match[2] ?? "";
    const props = parseAttributes(attrStr);

    steps.push(
      <Step
        key={index}
        title={(props.title as string) || "Step"}
        icon={props.icon as string}
        stepNumber={index + 1}
      >
        <MDXContent source={childContent.trim()} />
      </Step>
    );
    index++;
  }

  return steps;
}

// Parse and render Accordion children within an AccordionGroup component
function renderAccordionChildren(content: string): React.ReactNode[] {
  const accordions: React.ReactNode[] = [];
  // Use negative lookahead to match Accordion but not AccordionGroup
  const accordionRegex = /<Accordion(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Accordion>/g;
  let match;
  let index = 0;

  while ((match = accordionRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = match[2] ?? "";
    const props = parseAttributes(attrStr);

    accordions.push(
      <Accordion
        key={index}
        title={(props.title as string) || "Accordion"}
        icon={props.icon as string}
        defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
      >
        <MDXContent source={childContent.trim()} />
      </Accordion>
    );
    index++;
  }

  return accordions;
}

// Parse and render Column children within a Columns component
function renderColumnChildren(content: string): React.ReactNode[] {
  const columns: React.ReactNode[] = [];
  // Use negative lookahead to match Column but not Columns
  const columnRegex = /<Column(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Column>/g;
  let match;
  let index = 0;

  while ((match = columnRegex.exec(content)) !== null) {
    const childContent = match[2] ?? "";

    columns.push(
      <Column key={index}>
        <MDXContent source={childContent.trim()} />
      </Column>
    );
    index++;
  }

  return columns;
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
          {children && <span>{children}</span>}
        </Card>
      );

    case "CardGroup":
      return (
        <CardGroup key={key} cols={props.cols as 2 | 3 | 4}>
          {children && <MDXContent source={children} />}
        </CardGroup>
      );

    case "Callout":
      return (
        <Callout
          key={key}
          type={props.type as "info" | "warning" | "danger" | "success" | "tip"}
          title={props.title as string}
        >
          {children}
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
          {children && renderTabChildren(children)}
        </Tabs>
      );

    case "Tab":
      return (
        <Tab key={key} title={(props.title as string) || "Tab"} icon={props.icon as string}>
          <MDXContent source={children} />
        </Tab>
      );

    case "Steps":
      return (
        <Steps key={key}>
          {children && renderStepChildren(children)}
        </Steps>
      );

    case "Step":
      return (
        <Step key={key} title={(props.title as string) || "Step"} icon={props.icon as string}>
          <MDXContent source={children} />
        </Step>
      );

    case "CodeGroup":
      // Pass children as string - CodeGroup will parse the code blocks
      return (
        <CodeGroup key={key}>
          {children}
        </CodeGroup>
      );

    case "Accordion":
      return (
        <Accordion
          key={key}
          title={(props.title as string) || "Accordion"}
          icon={props.icon as string}
          defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
        >
          <MDXContent source={children} />
        </Accordion>
      );

    case "AccordionGroup":
      return (
        <AccordionGroup key={key}>
          {children && renderAccordionChildren(children)}
        </AccordionGroup>
      );

    case "Columns":
      return (
        <Columns key={key} cols={props.cols as 2 | 3 | 4}>
          {children && renderColumnChildren(children)}
        </Columns>
      );

    case "Column":
      return (
        <Column key={key}>
          {children && <MDXContent source={children} />}
        </Column>
      );

    case "ApiEndpoint":
      return (
        <ApiEndpoint
          key={key}
          method={(props.method as string) || "GET"}
          path={(props.path as string) || "/"}
          deprecated={props.deprecated === true || props.deprecated === "true"}
        >
          {children && <MDXContent source={children} />}
        </ApiEndpoint>
      );

    case "ParamField":
      return (
        <ParamField
          key={key}
          name={(props.name as string) || ""}
          type={props.type as string}
          location={props.location as string}
          required={props.required === true || props.required === "true"}
        >
          {children && <span>{children}</span>}
        </ParamField>
      );

    case "ResponseField":
      return (
        <ResponseField
          key={key}
          name={(props.name as string) || ""}
          type={props.type as string}
          required={props.required === true || props.required === "true"}
        >
          {children && <MDXContent source={children} />}
        </ResponseField>
      );

    case "Expandable":
      return (
        <Expandable
          key={key}
          title={(props.title as string) || ""}
          type={props.type as string}
        >
          {children && <MDXContent source={children} />}
        </Expandable>
      );

    case "Frame":
      return (
        <Frame
          key={key}
          hint={props.hint as string}
          caption={props.caption as string}
        >
          {children && <MDXContent source={children} />}
        </Frame>
      );

    default:
      return null;
  }
}

export function MDXContent({ source }: MDXContentProps) {
  const components = findMDXComponents(source);

  if (components.length === 0) {
    return (
      <DocsRendererProvider LinkComponent={RouterLink} highlightCode={highlightCode}>
        <MarkdownWithCodeBlocks content={source} />
      </DocsRendererProvider>
    );
  }

  // Build segments alternating between markdown and components
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  components.forEach((comp, idx) => {
    // Add markdown before this component
    if (comp.startIndex > lastIndex) {
      const markdownContent = source.slice(lastIndex, comp.startIndex).trim();
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
  if (lastIndex < source.length) {
    const remainingContent = source.slice(lastIndex).trim();
    if (remainingContent) {
      segments.push(
        <MarkdownWithCodeBlocks key="md-final" content={remainingContent} />
      );
    }
  }

  return (
    <DocsRendererProvider LinkComponent={RouterLink} highlightCode={highlightCode}>
      {segments}
    </DocsRendererProvider>
  );
}
