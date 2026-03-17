"use client";

import { useState, useEffect, useId, useCallback } from "react";

interface MermaidDiagramProps {
  code: string;
}

const ELK_DIRECTIVE_PATTERN = /%%\{init:\s*\{[^}]*['"]flowchart['"]:\s*\{[^}]*['"]defaultRenderer['"]:\s*['"]elk['"]/;

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const uniqueId = useId();
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getTheme = useCallback((): string => {
    if (typeof document === "undefined") return "default";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "default";
  }, []);

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

      const theme = getTheme();
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
      const message = err instanceof Error ? err.message : "Failed to render mermaid diagram";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [code, uniqueId, getTheme]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // Re-render on theme change via MutationObserver
  useEffect(() => {
    if (typeof document === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
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
  }, [renderDiagram]);

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
        <div className="mermaid-diagram-error">Failed to render diagram: {error}</div>
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
