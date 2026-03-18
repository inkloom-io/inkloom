import katex from "katex";

interface LatexProps {
  expression?: string;
  children?: React.ReactNode;
  inline?: boolean;
}

export function Latex({ expression, children, inline }: LatexProps) {
  const expr =
    expression ||
    (typeof children === "string" ? children : "") ||
    "";
  const html = katex.renderToString(expr.trim(), {
    throwOnError: false, // Render error message instead of throwing
    displayMode: !inline, // false for inline, true for block-level (centered)
  });

  if (inline) {
    return (
      <span
        className="latex-inline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className="latex-block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
