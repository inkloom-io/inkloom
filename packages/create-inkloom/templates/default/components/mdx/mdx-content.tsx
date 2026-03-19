"use client";

import React from "react";
import {
  MDXRenderer,
  DocsRendererProvider,
} from "@inkloom/docs-renderer";
import type { ComponentOverrides } from "@inkloom/docs-renderer";
import { Link } from "react-router";
import { highlightCode as shikiHighlightCode } from "@/lib/syntax-highlighter";
import { ApiEndpoint } from "./api-endpoint";
import { ParamField } from "./param-field";
import { ResponseField } from "./response-field";
import { Expandable } from "./expandable";
import { MermaidDiagram } from "./mermaid-diagram";

// Wrapper to adapt react-router's Link (uses `to`) to docs-renderer's LinkComponent (uses `href`)
function RouterLink({
  href,
  children,
  className,
  target,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}) {
  // External links use a regular <a> tag
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    return (
      <a href={href} className={className} target={target || "_blank"} rel={rel || "noopener noreferrer"}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} target={target} rel={rel}>
      {children}
    </Link>
  );
}

// Wrapper to adapt the template's highlightCode (returns { html }) to docs-renderer's (returns string)
async function highlightCode(code: string, language: string): Promise<string> {
  const result = await shikiHighlightCode(code, language);
  return result.html;
}

// Published-site-specific component overrides with full implementations
const publishedOverrides: ComponentOverrides = {
  ApiEndpoint,
  ParamField,
  ResponseField,
  Expandable,
  MermaidDiagram,
};

interface MDXContentProps {
  source: string;
}

export function MDXContent({ source }: MDXContentProps) {
  return (
    <DocsRendererProvider LinkComponent={RouterLink} highlightCode={highlightCode}>
      <MDXRenderer content={source} componentOverrides={publishedOverrides} />
    </DocsRendererProvider>
  );
}
