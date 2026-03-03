"use client";

import { useState, useEffect, type ReactNode } from "react";
import { highlightCode, type HighlightResult } from "@/lib/syntax-highlighter";

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
  plaintext: "Plaintext",
  text: "Plaintext",
};

interface CodeBlock {
  language: string;
  code: string;
  height?: number;
}

interface PreviewCodeGroupProps {
  children?: ReactNode;
}

// Parse code blocks from children content string
function parseCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // Match code blocks with optional height metadata: ```lang {height=200}
  const codeBlockRegex = /```(\w*)\s*(?:\{height=(\d+)\})?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "plaintext",
      height: match[2] ? parseInt(match[2], 10) : undefined,
      code: match[3]?.trim() || "",
    });
  }

  return blocks;
}

interface HighlightedCodeProps {
  code: string;
  language: string;
}

function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const [highlighted, setHighlighted] = useState<HighlightResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    highlightCode(code, language).then((result) => {
      if (!cancelled) {
        setHighlighted(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (!highlighted) {
    // Show plain code while loading
    return <pre><code>{code}</code></pre>;
  }

  return (
    <div
      className="preview-code-group-highlighted"
      dangerouslySetInnerHTML={{ __html: highlighted.html }}
    />
  );
}

export function PreviewCodeGroup({ children }: PreviewCodeGroupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Parse code blocks from the children string
  const content = typeof children === "string" ? children : "";
  const codeBlocks = parseCodeBlocks(content);

  if (codeBlocks.length === 0) {
    return (
      <div className="preview-code-group-empty">
        No code blocks in this group
      </div>
    );
  }

  return (
    <div className="preview-code-group">
      <div className="preview-code-group-header">
        {codeBlocks.map((block, index) => (
          <button
            key={index}
            type="button"
            className={`preview-code-group-tab ${index === activeIndex ? "preview-code-group-tab-active" : ""}`}
            onClick={() => setActiveIndex(index)}
          >
            {LANGUAGE_LABELS[block.language] || block.language || `Code ${index + 1}`}
          </button>
        ))}
      </div>
      <div
        className="preview-code-group-content"
        style={codeBlocks[activeIndex]?.height ? { height: `${codeBlocks[activeIndex].height}px` } : undefined}
      >
        <HighlightedCode
          code={codeBlocks[activeIndex]?.code || ""}
          language={codeBlocks[activeIndex]?.language || "plaintext"}
        />
      </div>
    </div>
  );
}
