"use client";

import { useState, useEffect, Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { useDocsRenderer } from "../context";

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  java: "Java",
  csharp: "C#",
  cpp: "C++",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  yaml: "YAML",
  markdown: "Markdown",
  mermaid: "Mermaid",
  plaintext: "Plain Text",
};

interface CodeGroupProps {
  children: ReactNode;
}

interface CodeBlockInfo {
  language: string;
  code: string;
  title?: string;
  height?: number;
  content?: ReactElement;
}

interface CodeElementProps {
  className?: string;
  children?: ReactNode;
}

// Parse code blocks from markdown string (```lang title {height=200}\ncode```)
function parseCodeBlocksFromString(content: string): CodeBlockInfo[] {
  const blocks: CodeBlockInfo[] = [];
  // Match code blocks with optional title and height metadata
  const codeBlockRegex = /```(\w*)[ \t]*(.*?)(?:\{height=(\d+)\})?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const title = match[2] ? match[2].trim() : undefined;
    blocks.push({
      language: match[1] || "code",
      title: title || undefined,
      height: match[3] ? parseInt(match[3], 10) : undefined,
      code: match[4]?.trim() || "",
    });
  }

  return blocks;
}

// Component for highlighted code block
function HighlightedCode({ code, language, height }: { code: string; language: string; height?: number }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const { highlightCode } = useDocsRenderer();

  useEffect(() => {
    let cancelled = false;

    highlightCode(code, language).then((result) => {
      if (!cancelled) {
        setHighlightedHtml(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, language, highlightCode]);

  const style: React.CSSProperties = height ? { height: `${height}px`, overflow: "auto" } : {};

  if (highlightedHtml) {
    return (
      <div
        className="code-group-highlighted"
        style={style}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    );
  }

  return (
    <pre style={style}>
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}

export function CodeGroup({ children }: CodeGroupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Try to parse children as string first (from MDX content parser)
  if (typeof children === "string") {
    const codeBlocks = parseCodeBlocksFromString(children);

    if (codeBlocks.length === 0) {
      return <div className="code-group-empty">No code blocks in this group</div>;
    }

    return (
      <div className="code-group">
        <div className="code-group-header">
          {codeBlocks.map((block, index) => (
            <button
              key={index}
              type="button"
              className={`code-group-tab ${index === activeIndex ? "code-group-tab-active" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              {block.title || LANGUAGE_LABELS[block.language] || block.language}
            </button>
          ))}
        </div>
        <div className="code-group-content">
          <HighlightedCode
            code={codeBlocks[activeIndex]?.code || ""}
            language={codeBlocks[activeIndex]?.language || "text"}
            height={codeBlocks[activeIndex]?.height}
          />
        </div>
      </div>
    );
  }

  // Otherwise, extract code blocks from React children (pre elements)
  const codeBlocks: CodeBlockInfo[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === "pre") {
      // Get the code element inside pre
      const preProps = child.props as { children?: ReactNode };
      const preChildren = preProps.children;
      if (isValidElement(preChildren) && preChildren.type === "code") {
        const codeProps = preChildren.props as CodeElementProps;
        const className = codeProps.className || "";
        const languageMatch = className.match(/language-(\w+)/);
        const language = languageMatch && languageMatch[1] ? languageMatch[1] : "code";

        // Extract code content
        const codeContent = codeProps.children;
        const code = typeof codeContent === "string" ? codeContent : "";

        codeBlocks.push({
          language,
          code,
          content: child,
        });
      }
    }
  });

  if (codeBlocks.length === 0) {
    return <div className="code-group-empty">{children}</div>;
  }

  return (
    <div className="code-group">
      <div className="code-group-header">
        {codeBlocks.map((block, index) => (
          <button
            key={index}
            type="button"
            className={`code-group-tab ${index === activeIndex ? "code-group-tab-active" : ""}`}
            onClick={() => setActiveIndex(index)}
          >
            {block.title || LANGUAGE_LABELS[block.language] || block.language}
          </button>
        ))}
      </div>
      <div className="code-group-content">
        <HighlightedCode
          code={codeBlocks[activeIndex]?.code || ""}
          language={codeBlocks[activeIndex]?.language || "text"}
          height={codeBlocks[activeIndex]?.height}
        />
      </div>
    </div>
  );
}
