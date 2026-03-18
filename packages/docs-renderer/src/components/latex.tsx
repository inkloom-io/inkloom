import katex from "katex";

interface LatexProps {
  expression?: string;
  children?: React.ReactNode;
}

export function Latex({ expression, children }: LatexProps) {
  const expr =
    expression ||
    (typeof children === "string" ? children : "") ||
    "";
  const html = katex.renderToString(expr.trim(), {
    throwOnError: false, // Render error message instead of throwing
    displayMode: true, // Block-level (centered) display
  });

  return (
    <div
      className="latex-block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
