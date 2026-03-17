import katex from "katex";

interface LatexProps {
  expression: string;
}

export function Latex({ expression }: LatexProps) {
  const html = katex.renderToString(expression, {
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
