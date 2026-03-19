"use client";

import React from "react";
import {
  MDXRenderer,
  DocsRendererProvider,
} from "@inkloom/docs-renderer";
import type { ComponentOverrides } from "@inkloom/docs-renderer";
import { Link } from "react-router";
import { highlightCode as shikiHighlightCode } from "@/lib/syntax-highlighter";
import { useTheme } from "@/src/theme-provider";
import { ApiEndpoint } from "./api-endpoint";

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
};

interface MDXContentProps {
  source: string;
}

export function MDXContent({ source }: MDXContentProps) {
  const { resolvedTheme } = useTheme();

  return (
    <DocsRendererProvider LinkComponent={RouterLink} highlightCode={highlightCode} resolvedTheme={resolvedTheme}>
      <MDXRenderer content={source} componentOverrides={publishedOverrides} />
    </DocsRendererProvider>
  );
}
