"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { blockNoteToMDX, parseBlockNoteContent } from "@inkloom/mdx-parser";
import { MDXPreviewRenderer } from "@/lib/parse-mdx-preview";
import { DocsRendererProvider } from "@/components/docs-renderer";
import "@/components/docs-renderer/styles/index.css";
import { highlightCode } from "@/lib/syntax-highlighter";
import { ChevronRight, Home, Sun, Moon } from "lucide-react";
import "./preview-styles.css";

interface PreviewPanelProps {
  /** BlockNote JSON string content */
  content: string | null;
  /** Page title to display */
  pageTitle: string;
}

/** Simple link wrapper for preview — links don't navigate in preview mode */
function PreviewLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}) {
  return (
    <a href={href} className={className} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  );
}

/** Adapter: wraps the highlightCode to match DocsRendererProvider's expected signature */
async function highlightCodeForRenderer(
  code: string,
  language: string
): Promise<string> {
  return highlightCode(code, language);
}

export function PreviewPanel({
  content,
  pageTitle,
}: PreviewPanelProps) {
  const { resolvedTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(
    () => (resolvedTheme === "dark" ? "dark" : "light")
  );

  const markdown = useMemo(() => {
    if (!content) return "";
    try {
      const blocks = parseBlockNoteContent(content);
      return blockNoteToMDX(blocks);
    } catch {
      return "";
    }
  }, [content]);

  const isDark = previewTheme === "dark";

  // Basic theme CSS variables for the preview container
  const containerStyle: React.CSSProperties = {
    "--color-background": isDark ? "#0a0a0a" : "#ffffff",
    "--color-foreground": isDark ? "#fafafa" : "#0a0a0a",
    "--color-background-subtle": isDark ? "#171717" : "#f5f5f5",
    "--color-muted": isDark ? "#262626" : "#f5f5f5",
    "--color-muted-foreground": isDark ? "#a3a3a3" : "#737373",
    "--color-border": isDark ? "#262626" : "#e5e5e5",
    "--color-border-subtle": isDark ? "#1a1a1a" : "#f0f0f0",
    "--color-primary": isDark ? "#3b82f6" : "#2563eb",
    "--color-primary-foreground": "#ffffff",
    "--color-accent": isDark ? "#1e3a5f" : "#eff6ff",
    "--color-accent-foreground": isDark ? "#93c5fd" : "#1d4ed8",
    "--color-code-background": isDark ? "#1a1a1a" : "#f8f8f8",
    "--color-code-foreground": isDark ? "#e5e5e5" : "#24292e",
    "--color-code-highlight": isDark ? "#262626" : "#f0f0f0",
    "--color-header-background": isDark ? "rgba(10, 10, 10, 0.8)" : "rgba(255, 255, 255, 0.8)",
    "--color-header-border": isDark ? "#262626" : "#e5e5e5",
    "--header-blur": "12px",
    "--font-sans": "system-ui, -apple-system, sans-serif",
    "--font-mono": "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
    "--font-display": "system-ui, -apple-system, sans-serif",
    "--shadow-sm": isDark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.05)",
    "--shadow-md": isDark ? "0 4px 6px rgba(0,0,0,0.3)" : "0 4px 6px rgba(0,0,0,0.07)",
    "--radius-sm": "4px",
    "--radius-md": "6px",
    "--radius-lg": "8px",
    background: isDark
      ? "linear-gradient(180deg, #0a0a0a 0%, #171717 100%)"
      : "linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)",
    color: isDark ? "#fafafa" : "#0a0a0a",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as React.CSSProperties;

  return (
    <DocsRendererProvider
      LinkComponent={PreviewLink}
      highlightCode={highlightCodeForRenderer}
      resolvedTheme={previewTheme}
    >
      <div
        className="preview-container flex h-full flex-col"
        data-preview-theme={previewTheme}
        style={containerStyle}
      >
        <div className="preview-header sticky top-0 z-10 border-b border-[var(--color-header-border)]">
          <div className="flex h-12 items-center justify-between px-5">
            <span
              className="text-sm font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-foreground)",
              }}
            >
              Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPreviewTheme(previewTheme === "dark" ? "light" : "dark")
                }
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors"
                style={{
                  color: "var(--color-muted-foreground)",
                  backgroundColor: "var(--color-background)",
                }}
                aria-label="Toggle preview theme"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          <nav
            className="mb-4 flex items-center gap-1 text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <Home className="h-3.5 w-3.5 shrink-0" />
            <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0" />
            <span
              className="truncate font-medium"
              style={{ color: "var(--color-foreground)" }}
            >
              {pageTitle}
            </span>
          </nav>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              color: "var(--color-foreground)",
            }}
          >
            {pageTitle}
          </h1>
          <hr
            className="mt-4 mb-6"
            style={{ borderColor: "var(--color-border)" }}
          />
          <article className="prose mx-auto">
            {markdown ? (
              <MDXPreviewRenderer content={markdown} />
            ) : (
              <p style={{ color: "var(--color-muted-foreground)" }}>
                No content to preview
              </p>
            )}
          </article>
        </div>
      </div>
    </DocsRendererProvider>
  );
}
