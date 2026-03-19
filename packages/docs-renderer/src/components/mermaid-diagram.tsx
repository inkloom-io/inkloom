"use client";

import { useState, useEffect, useId, useCallback } from "react";
import { useDocsRenderer } from "../context";

interface MermaidDiagramProps {
  code: string;
}

const ELK_DIRECTIVE_PATTERN =
  /%%\{init:\s*\{[^}]*['"]flowchart['"]:\s*\{[^}]*['"]defaultRenderer['"]:\s*['"]elk['"]/;

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const uniqueId = useId();
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useDocsRenderer();

  const getMermaidTheme = useCallback((): "dark" | "default" => {
    // If resolvedTheme is provided via context, use it directly
    if (resolvedTheme) {
      return resolvedTheme === "dark" ? "dark" : "default";
    }
    // Fallback: read from document for backward compat with third-party consumers
    if (typeof document === "undefined") return "default";
    return document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "default";
  }, [resolvedTheme]);

  const renderDiagram = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const needsElk = ELK_DIRECTIVE_PATTERN.test(code);

      // Dynamically import elkjs before mermaid if ELK renderer is needed
      if (needsElk) {
        await import("elkjs");
      }

      const mermaid = (await import("mermaid")).default;

      const theme = getMermaidTheme();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme,
      });

      // Create a sanitized ID from useId (replace colons which are invalid in CSS selectors)
      const elementId = `mermaid-${uniqueId.replace(/:/g, "-")}`;

      const { svg } = await mermaid.render(elementId, code);
      setSvgHtml(svg);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to render mermaid diagram";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [code, uniqueId, getMermaidTheme]);

  // Re-render when code or theme changes
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // When resolvedTheme is NOT provided via context, fall back to MutationObserver
  // for backward compat with third-party consumers who set data-theme on <html>
  useEffect(() => {
    // If resolvedTheme is provided, React re-renders handle theme changes — no observer needed
    if (resolvedTheme) return;
    if (typeof document === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-theme"
        ) {
          renderDiagram();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, [renderDiagram, resolvedTheme]);

  if (loading) {
    return (
      <div className="mermaid-diagram-wrapper">
        <div className="mermaid-diagram-label">
          <span className="mermaid-diagram-label-text">Mermaid</span>
        </div>
        <div className="mermaid-diagram-loading">Loading diagram…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mermaid-diagram-wrapper">
        <div className="mermaid-diagram-label">
          <span className="mermaid-diagram-label-text">Mermaid</span>
        </div>
        <div className="mermaid-diagram-error">
          Failed to render diagram: {error}
        </div>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="mermaid-diagram-wrapper">
      <div className="mermaid-diagram-label">
        <span className="mermaid-diagram-label-text">Mermaid</span>
      </div>
      {svgHtml && (
        <div
          className="mermaid-diagram-content"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
    </div>
  );
}
