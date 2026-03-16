"use client";

import { useState, useEffect } from "react";
import { Check, Copy } from "lucide-react";
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
  plaintext: "Plaintext",
  text: "Plaintext",
};

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children?: React.ReactNode;
  language?: string;
  height?: number;
}

export function CodeBlock({ children, className, language, height, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const { highlightCode } = useDocsRenderer();

  const getCodeContent = (): string => {
    if (!children) return "";

    // Handle code element children (from markdown rendering)
    if (
      typeof children === "object" &&
      "props" in (children as React.ReactElement)
    ) {
      const codeElement = children as React.ReactElement;
      const codeChildren = codeElement.props.children;
      if (typeof codeChildren === "string") {
        return codeChildren;
      }
      // Handle array of children (mixed text and elements)
      if (Array.isArray(codeChildren)) {
        return codeChildren
          .map((child: unknown) => (typeof child === "string" ? child : ""))
          .join("");
      }
      return "";
    }

    // Handle string children (from CodeBlock component with height)
    return typeof children === "string" ? children : "";
  };

  // Get language from className (e.g., "language-javascript") or from prop
  const getLanguage = (): string => {
    if (language) return language;

    // Extract from code element's className
    if (
      typeof children === "object" &&
      "props" in (children as React.ReactElement)
    ) {
      const codeElement = children as React.ReactElement;
      const codeClassName = codeElement.props.className || "";
      const match = codeClassName.match(/language-(\w+)/);
      if (match && match[1]) return match[1];
    }

    // Extract from pre's className
    if (className) {
      const match = className.match(/language-(\w+)/);
      if (match && match[1]) return match[1];
    }

    return "text";
  };

  const code = getCodeContent();
  const lang = getLanguage();

  // Highlight the code
  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    highlightCode(code, lang).then((result) => {
      if (!cancelled) {
        setHighlightedHtml(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang, highlightCode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const preStyle: React.CSSProperties = height ? { height: `${height}px`, overflow: "auto" } : {};

  return (
    <div className="code-block-wrapper group">
      <div className="code-block-label">
        <span className="code-block-label-text">
          {LANGUAGE_LABELS[lang] || lang}
        </span>
      </div>
      {highlightedHtml ? (
        <div
          className="code-block-highlighted"
          style={preStyle}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className={className} style={preStyle} {...props}>
          <code className={lang ? `language-${lang}` : undefined}>{code}</code>
        </pre>
      )}
      <button
        onClick={handleCopy}
        className="code-block-copy text-[var(--color-code-foreground)]"
        aria-label={copied ? "Copied!" : "Copy code"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
