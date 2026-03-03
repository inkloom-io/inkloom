"use client";

import { useEffect, useState } from "react";
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

interface PreviewCodeBlockProps {
  language?: string;
  height?: number;
  children?: React.ReactNode;
}

export function PreviewCodeBlock({ language = "plaintext", height, children }: PreviewCodeBlockProps) {
  const [highlighted, setHighlighted] = useState<HighlightResult | null>(null);

  // Extract code content from children
  const code = typeof children === "string" ? children : "";

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

  const style: React.CSSProperties = height ? { height: `${height}px`, overflow: "auto" } : {};
  const showLabel = !!language;

  return (
    <div className="preview-standalone-code-block">
      {showLabel && (
        <div className="preview-standalone-code-label">
          <span className="preview-standalone-code-label-text">
            {LANGUAGE_LABELS[language] || language}
          </span>
        </div>
      )}
      {highlighted ? (
        <div
          className="preview-standalone-code-highlighted"
          style={style}
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      ) : (
        <pre className="preview-standalone-code-content" style={style}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
