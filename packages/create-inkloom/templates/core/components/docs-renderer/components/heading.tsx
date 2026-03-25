"use client";

import { type ReactNode } from "react";
import { Link as LinkIcon } from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText(node.props.children);
  }
  return "";
}

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({ level, children, id, ...props }: HeadingProps) {
  const Tag = `h${level}` as const;
  const headingId = id || slugify(extractText(children));

  return (
    <Tag
      id={headingId || undefined}
      className="group relative"
      {...props}
    >
      {children}
      {headingId && level > 1 && (
        <a
          href={`#${headingId}`}
          className="ml-2 inline-block opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Link to ${extractText(children)}`}
        >
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </a>
      )}
    </Tag>
  );
}
