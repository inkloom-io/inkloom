import React, { useState } from "react";
import {
  MDXRenderer,
  type ComponentOverrides,
} from "@inkloom/docs-renderer";

// ---------------------------------------------------------------------------
// Preview-specific component stubs
// ---------------------------------------------------------------------------

// Minimal preview-only ApiEndpoint component
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

// Minimal preview-only ParamField component
function PreviewParamField({ name, type, location, required, children }: {
  name: string;
  type?: string;
  location?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <code style={{ fontWeight: 600 }}>{name}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
        {location && <span style={{ color: "#6b7280", fontSize: "12px", background: "var(--muted, #f3f4f6)", padding: "1px 6px", borderRadius: "4px" }}>{location}</span>}
        {required && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>required</span>}
      </div>
      {children && <div style={{ marginTop: "4px", fontSize: "14px", color: "var(--muted-foreground, #6b7280)" }}>{children}</div>}
    </div>
  );
}

// Minimal preview-only ResponseField component
function PreviewResponseField({ name, type, required, children }: {
  name: string;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <code style={{ fontWeight: 600 }}>{name}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
        {required && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>required</span>}
      </div>
      {children && <div style={{ marginTop: "4px", fontSize: "14px", color: "var(--muted-foreground, #6b7280)" }}>{children}</div>}
    </div>
  );
}

// Minimal preview-only Expandable component
function PreviewExpandable({ title, type, children }: {
  title: string;
  type?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "6px", marginBottom: "8px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const, fontSize: "14px" }}
      >
        <span>{open ? "\u25BC" : "\u25B6"}</span>
        <code style={{ fontWeight: 600 }}>{title}</code>
        {type && <span style={{ color: "#6b7280", fontSize: "13px" }}>{type}</span>}
      </button>
      {open && <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border, #e5e7eb)" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component overrides wiring
// ---------------------------------------------------------------------------

const previewOverrides: ComponentOverrides = {
  ApiEndpoint: PreviewApiEndpoint as ComponentOverrides["ApiEndpoint"],
  ParamField: PreviewParamField as ComponentOverrides["ParamField"],
  ResponseField: PreviewResponseField as ComponentOverrides["ResponseField"],
  Expandable: PreviewExpandable as ComponentOverrides["Expandable"],
};

// ---------------------------------------------------------------------------
// MDXPreviewRenderer — thin wrapper around the shared MDXRenderer
// ---------------------------------------------------------------------------

export function MDXPreviewRenderer({ content }: { content: string }) {
  return <MDXRenderer content={content} componentOverrides={previewOverrides} />;
}
