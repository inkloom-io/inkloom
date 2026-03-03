import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { PreviewCard } from "@/components/editor/preview-components/card";
import { PreviewCardGroup } from "@/components/editor/preview-components/card-group";
import { PreviewCallout } from "@/components/editor/preview-components/callout";
import { PreviewImage } from "@/components/editor/preview-components/image";
import { PreviewTabs, PreviewTab } from "@/components/editor/preview-components/tabs";
import { PreviewSteps, PreviewStep } from "@/components/editor/preview-components/steps";
import { PreviewAccordion, PreviewAccordionGroup } from "@/components/editor/preview-components/accordion";
import { PreviewCodeGroup } from "@/components/editor/preview-components/code-group";
import { PreviewCodeBlock } from "@/components/editor/preview-components/code-block";

interface ParsedComponent {
  type: "Card" | "CardGroup" | "Callout" | "Image" | "Tabs" | "Tab" | "Steps" | "Step" | "Accordion" | "AccordionGroup" | "CodeGroup";
  props: Record<string, string | number | boolean>;
  children: string;
  startIndex: number;
  endIndex: number;
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

// Render markdown with pre-processed code blocks
function MarkdownWithCodeBlocks({ content }: { content: string }): React.ReactNode {
  const { segments, hasCodeBlocks } = preprocessCodeBlocks(content);

  if (!hasCodeBlocks) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <p style={style}>{children}</p>,
          div: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <div style={style} className={className}>{children}</div>,
          span: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <span style={style} className={className}>{children}</span>,
          pre: ({ children }) => {
            // Extract language from child <code className="language-xxx">
            const codeChild = React.Children.toArray(children).find(
              (child): child is React.ReactElement =>
                React.isValidElement(child) && (child as React.ReactElement).type === "code"
            ) as React.ReactElement | undefined;
            const className = codeChild?.props?.className || "";
            const langMatch = className.match(/language-(\w+)/);
            const lang = langMatch ? langMatch[1] : undefined;
            const code = typeof codeChild?.props?.children === "string" ? codeChild.props.children : "";
            return <PreviewCodeBlock language={lang}>{code}</PreviewCodeBlock>;
          },
        }}
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
              components={{
                p: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <p style={style}>{children}</p>,
                div: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <div style={style} className={className}>{children}</div>,
                span: ({ children, style, className }: { children?: React.ReactNode; style?: React.CSSProperties; className?: string }) => <span style={style} className={className}>{children}</span>,
                pre: ({ children }) => {
                  const codeChild = React.Children.toArray(children).find(
                    (child): child is React.ReactElement =>
                      React.isValidElement(child) && (child as React.ReactElement).type === "code"
                  ) as React.ReactElement | undefined;
                  const className = codeChild?.props?.className || "";
                  const langMatch = className.match(/language-(\w+)/);
                  const lang = langMatch ? langMatch[1] : undefined;
                  const code = typeof codeChild?.props?.children === "string" ? codeChild.props.children : "";
                  return <PreviewCodeBlock language={lang}>{code}</PreviewCodeBlock>;
                },
              }}
            >
              {segment.content}
            </ReactMarkdown>
          );
        } else if (segment.type === 'codeblock') {
          return (
            <PreviewCodeBlock
              key={segment.key}
              language={segment.language}
              height={segment.height}
            >
              {segment.code}
            </PreviewCodeBlock>
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

// Find all MDX components in the content
function findMDXComponents(content: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const componentNames = ["Card", "CardGroup", "Callout", "Image", "Tabs", "Tab", "Steps", "Step", "Accordion", "AccordionGroup", "CodeGroup"];

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

    // Match components with children: <Card ...>...</Card>
    // Use negative lookbehind (?<!/) to avoid matching self-closing tags like <Card ... />
    const withChildrenRegex = new RegExp(
      `${namePattern}\\s*([^>]*)(?<!/)>([\\s\\S]*?)</${name}>`,
      "g"
    );
    while ((match = withChildrenRegex.exec(content)) !== null) {
      const attrStr = match[1] ?? "";
      const childrenStr = match[2] ?? "";
      components.push({
        type: name as ParsedComponent["type"],
        props: parseAttributes(attrStr),
        children: childrenStr.trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
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

// Render a single parsed component
function renderComponent(
  component: ParsedComponent,
  key: number
): React.ReactNode {
  const { type, props, children } = component;

  switch (type) {
    case "Card":
      return (
        <PreviewCard
          key={key}
          title={(props.title as string) || ""}
          icon={props.icon as string}
          href={props.href as string}
        >
          {children && <span>{children}</span>}
        </PreviewCard>
      );

    case "CardGroup":
      return (
        <PreviewCardGroup key={key} cols={props.cols as number}>
          {children && (
            <MDXPreviewRenderer content={children} />
          )}
        </PreviewCardGroup>
      );

    case "Callout":
      return (
        <PreviewCallout
          key={key}
          type={props.type as "info" | "warning" | "danger" | "success" | "tip"}
          title={props.title as string}
        >
          {children}
        </PreviewCallout>
      );

    case "Image":
      return (
        <PreviewImage
          key={key}
          src={props.src as string}
          alt={props.alt as string}
          width={props.width as number}
        />
      );

    case "Tabs":
      return (
        <PreviewTabs key={key}>
          {children && renderTabChildren(children)}
        </PreviewTabs>
      );

    case "Tab":
      return (
        <PreviewTab
          key={key}
          title={props.title as string}
          icon={props.icon as string}
        >
          {children}
        </PreviewTab>
      );

    case "Steps":
      return (
        <PreviewSteps key={key}>
          {children && renderStepChildren(children)}
        </PreviewSteps>
      );

    case "Step":
      return (
        <PreviewStep
          key={key}
          title={props.title as string}
          icon={props.icon as string}
        >
          {children}
        </PreviewStep>
      );

    case "CodeGroup":
      return (
        <PreviewCodeGroup key={key}>
          {children}
        </PreviewCodeGroup>
      );

    case "Accordion":
      return (
        <PreviewAccordion
          key={key}
          title={props.title as string}
          icon={props.icon as string}
          defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
        >
          {children}
        </PreviewAccordion>
      );

    case "AccordionGroup":
      return (
        <PreviewAccordionGroup key={key}>
          {children && renderAccordionChildren(children)}
        </PreviewAccordionGroup>
      );

    default:
      return null;
  }
}

// Helper function to render Tab children within a Tabs component
// Returns an array of PreviewTab elements (not a component wrapper)
function renderTabChildren(content: string): React.ReactNode[] {
  // Parse Tab components from the content string
  const tabRegex = /<Tab(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Tab>/g;
  const tabs: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = tabRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = (match[2] ?? "").trim();
    const props = parseAttributes(attrStr);

    tabs.push(
      <PreviewTab
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
      >
        {childContent}
      </PreviewTab>
    );
    idx++;
  }

  return tabs;
}

// Helper function to render Step children within a Steps component
// Returns an array of PreviewStep elements
function renderStepChildren(content: string): React.ReactNode[] {
  // Parse Step components from the content string
  const stepRegex = /<Step(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Step>/g;
  const steps: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = stepRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = (match[2] ?? "").trim();
    const props = parseAttributes(attrStr);

    steps.push(
      <PreviewStep
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
        stepNumber={idx + 1}
      >
        {childContent}
      </PreviewStep>
    );
    idx++;
  }

  return steps;
}

// Helper function to render Accordion children within an AccordionGroup component
// Returns an array of PreviewAccordion elements
function renderAccordionChildren(content: string): React.ReactNode[] {
  // Parse Accordion components from the content string
  const accordionRegex = /<Accordion(?![a-zA-Z])\s*([^>]*)>([\s\S]*?)<\/Accordion>/g;
  const accordions: React.ReactNode[] = [];
  let match;
  let idx = 0;

  while ((match = accordionRegex.exec(content)) !== null) {
    const attrStr = match[1] ?? "";
    const childContent = (match[2] ?? "").trim();
    const props = parseAttributes(attrStr);

    accordions.push(
      <PreviewAccordion
        key={idx}
        title={props.title as string}
        icon={props.icon as string}
        defaultOpen={props.defaultOpen === true || props.defaultOpen === "true"}
      >
        {childContent}
      </PreviewAccordion>
    );
    idx++;
  }

  return accordions;
}

// Main component that renders MDX content with component support
export function MDXPreviewRenderer({ content }: { content: string }) {
  const components = findMDXComponents(content);

  if (components.length === 0) {
    // No MDX components, just render as markdown with code block support
    return <MarkdownWithCodeBlocks content={content} />;
  }

  // Build segments alternating between markdown and components
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  components.forEach((comp, idx) => {
    // Add markdown before this component
    if (comp.startIndex > lastIndex) {
      const markdownContent = content.slice(lastIndex, comp.startIndex).trim();
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
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex).trim();
    if (remainingContent) {
      segments.push(
        <MarkdownWithCodeBlocks key="md-final" content={remainingContent} />
      );
    }
  }

  return <>{segments}</>;
}
