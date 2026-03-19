import { describe, it, expect } from "vitest";
import { blockNoteToMDX, mdxToBlockNote } from "../index";

describe("inline LaTeX: blockNoteToMDX", () => {
  it("converts inline $$...$$ to <Latex inline>expr</Latex>", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [{ type: "text", text: "The function $$f(x) = x^2$$ is quadratic." }],
      },
    ]);
    expect(mdx).toContain("<Latex inline>f(x) = x^2</Latex>");
    expect(mdx).not.toContain("<Latex>f(x) = x^2</Latex>");
  });

  it("converts inline $..$  to <Latex inline>expr</Latex>", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Let $x$ be a variable." }],
      },
    ]);
    expect(mdx).toContain("<Latex inline>x</Latex>");
    expect(mdx).not.toContain("<Latex>x</Latex>");
  });

  it("converts block-level latex type to <Latex>\\nexpr\\n</Latex> WITHOUT inline", () => {
    const mdx = blockNoteToMDX([
      { type: "latex", props: { expression: "E = mc^2" }, content: [] },
    ]);
    expect(mdx).toContain("<Latex>\nE = mc^2\n</Latex>");
    expect(mdx).not.toContain("<Latex inline>");
  });
});

describe("inline LaTeX: mdxToBlockNote", () => {
  it("parses <Latex inline>expr</Latex> into a paragraph with $expr$", () => {
    const blocks = mdxToBlockNote("<Latex inline>x^2</Latex>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const content = blocks[0].content as Array<{ type: string; text?: string }>;
    const hasLatexText = content.some((c) => c.text?.includes("x^2"));
    expect(hasLatexText).toBe(true);
  });

  it("parses <Latex>\\nexpr\\n</Latex> as a block latex block", () => {
    const blocks = mdxToBlockNote("<Latex>\nE = mc^2\n</Latex>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("latex");
    expect(blocks[0].props?.expression).toBe("E = mc^2");
  });
});

describe("inline LaTeX: roundtrip", () => {
  it("round-trips inline $...$ LaTeX through blockNoteToMDX and back", () => {
    const inputMdx = "<Latex inline>f(x) = x^2</Latex>";
    const blocks = mdxToBlockNote(inputMdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const outputMdx = blockNoteToMDX(blocks);
    // Re-parse must still yield a paragraph (not a block latex)
    const blocks2 = mdxToBlockNote(outputMdx);
    expect(blocks2).toHaveLength(1);
    expect(blocks2[0].type).toBe("paragraph");
  });

  it("round-trips block <Latex> without gaining an inline attribute", () => {
    const inputMdx = "<Latex>\nE = mc^2\n</Latex>";
    const blocks = mdxToBlockNote(inputMdx);
    expect(blocks[0].type).toBe("latex");
    const outputMdx = blockNoteToMDX(blocks);
    expect(outputMdx).not.toContain("<Latex inline>");
    const blocks2 = mdxToBlockNote(outputMdx);
    expect(blocks2[0].type).toBe("latex");
    expect(blocks2[0].props?.expression).toBe("E = mc^2");
  });
});
