import React from "react";
import {
  MDXRenderer,
  type ComponentOverrides,
} from "@/components/docs-renderer";

// ---------------------------------------------------------------------------
// Preview-specific component stubs
// ---------------------------------------------------------------------------

function PreviewApiEndpoint({ method, path, deprecated, children }: {
  method: string;
  path: string;
  deprecated?: boolean;
  children?: React.ReactNode;
}) {
  const methodUpper = method.toUpperCase();
  const badgeColors: Record<string, string> = {
    GET: "#22c55e",
    POST: "#3b82f6",
    PUT: "#f59e0b",
    PATCH: "#f59e0b",
    DELETE: "#ef4444",
  };
  const badgeColor = badgeColors[methodUpper] || "#6b7280";

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{ background: badgeColor, color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const }}>{methodUpper}</span>
        <code style={{ fontSize: "14px" }}>{path}</code>
        {deprecated && <span style={{ color: "#f59e0b", fontSize: "12px", fontWeight: 600 }}>Deprecated</span>}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component overrides wiring
// ---------------------------------------------------------------------------

const previewOverrides: ComponentOverrides = {
  ApiEndpoint: PreviewApiEndpoint as ComponentOverrides["ApiEndpoint"],
};

// ---------------------------------------------------------------------------
// MDXPreviewRenderer
// ---------------------------------------------------------------------------

export function MDXPreviewRenderer({ content }: { content: string }) {
  return <MDXRenderer content={content} componentOverrides={previewOverrides} />;
}
