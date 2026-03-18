import { describe, it, expect } from "vitest";
import { transformLatex } from "./latex.js";

describe("transformLatex", () => {
  // ─── Block $$...$$ fences ─────────────────────────────────────────

  describe("block $$ fences", () => {
    it("converts block $$ fences to <Latex> block", () => {
      const input = "$$\nf(x) = x * e^{2 pi i \\xi x}\n$$";
      const result = transformLatex(input);
      expect(result).toBe(
        "<Latex>\nf(x) = x * e^{2 pi i \\xi x}\n</Latex>",
      );
    });

    it("handles block $$ with surrounding content", () => {
      const input = "Some text before\n\n$$\na^2 + b^2 = c^2\n$$\n\nSome text after";
      const result = transformLatex(input);
      expect(result).toContain("<Latex>\na^2 + b^2 = c^2\n</Latex>");
      expect(result).toContain("Some text before");
      expect(result).toContain("Some text after");
    });

    it("handles block $$ with extra whitespace", () => {
      const input = "$$  \n  E = mc^2  \n  $$";
      const result = transformLatex(input);
      expect(result).toContain("<Latex>\nE = mc^2\n</Latex>");
    });

    it("handles multi-line block math", () => {
      const input = "$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$";
      const result = transformLatex(input);
      expect(result).toContain("<Latex>");
      expect(result).toContain("\\begin{align}");
      expect(result).toContain("</Latex>");
    });
  });

  // ─── Inline $$...$$ ──────────────────────────────────────────────

  describe("inline $$...$$", () => {
    it("converts inline $$...$$ to inline <Latex>", () => {
      const input =
        "The function $$f(x) = x * e^{2 pi i \\xi x}$$ is defined";
      const result = transformLatex(input);
      expect(result).toBe(
        "The function <Latex>f(x) = x * e^{2 pi i \\xi x}</Latex> is defined",
      );
    });

    it("handles multiple inline $$ on the same line", () => {
      const input = "where $$a^2$$ and $$b^2$$ are values";
      const result = transformLatex(input);
      expect(result).toBe(
        "where <Latex>a^2</Latex> and <Latex>b^2</Latex> are values",
      );
    });
  });

  // ─── Inline $...$ ────────────────────────────────────────────────

  describe("inline $...$", () => {
    it("converts inline $...$ with math content", () => {
      const input = "where $x^2$ is the squared value";
      const result = transformLatex(input);
      expect(result).toBe(
        "where <Latex>x^2</Latex> is the squared value",
      );
    });

    it("converts $...$ with backslash content", () => {
      const input = "the integral $\\int_0^1 f(x) dx$";
      const result = transformLatex(input);
      expect(result).toBe(
        "the integral <Latex>\\int_0^1 f(x) dx</Latex>",
      );
    });

    it("converts $...$ with braces", () => {
      const input = "set $\\{1, 2, 3\\}$ is finite";
      const result = transformLatex(input);
      expect(result).toContain("<Latex>");
    });

    it("converts $...$ with underscore (subscript)", () => {
      const input = "variable $x_i$ in the sum";
      const result = transformLatex(input);
      expect(result).toBe("variable <Latex>x_i</Latex> in the sum");
    });

    it("does NOT transform currency like $100", () => {
      const input = "The price is $100 and $200";
      const result = transformLatex(input);
      // Should remain unchanged — currency values have no matching closing $
      // or if matched, the digits-only content is skipped
      expect(result).not.toContain("<Latex>");
    });

    it("does NOT transform $100.50", () => {
      const input = "Costs $100.50 per unit";
      const result = transformLatex(input);
      expect(result).not.toContain("<Latex>");
    });

    it("handles multiple inline $ on the same line", () => {
      const input = "where $x$ and $y$ are inputs";
      const result = transformLatex(input);
      expect(result).toBe(
        "where <Latex>x</Latex> and <Latex>y</Latex> are inputs",
      );
    });
  });

  // ─── Code block protection ───────────────────────────────────────

  describe("code block protection", () => {
    it("does NOT transform $ inside inline code", () => {
      const input = "use `$variable` in bash";
      const result = transformLatex(input);
      expect(result).toBe("use `$variable` in bash");
    });

    it("does NOT transform $$ inside inline code", () => {
      const input = "use `$$display$$` syntax";
      const result = transformLatex(input);
      expect(result).toBe("use `$$display$$` syntax");
    });

    it("does NOT transform $ inside fenced code blocks", () => {
      const input = "```bash\necho $HOME\n$foo\n```";
      const result = transformLatex(input);
      expect(result).toBe("```bash\necho $HOME\n$foo\n```");
    });

    it("does NOT transform $$ inside fenced code blocks", () => {
      const input = "```\n$$x^2$$\n```";
      const result = transformLatex(input);
      expect(result).toBe("```\n$$x^2$$\n```");
    });

    it("handles mixed code and LaTeX", () => {
      const input =
        "Use `$x` for variables and $x^2$ for math\n\n```\n$code\n```";
      const result = transformLatex(input);
      expect(result).toContain("`$x`");
      expect(result).toContain("<Latex>x^2</Latex>");
      expect(result).toContain("```\n$code\n```");
    });
  });

  // ─── Escaped dollar signs ────────────────────────────────────────

  describe("escaped dollar signs", () => {
    it("does NOT transform escaped \\$", () => {
      const input = "Price is \\$100 each";
      const result = transformLatex(input);
      expect(result).toBe("Price is \\$100 each");
      expect(result).not.toContain("<Latex>");
    });

    it("does NOT transform escaped \\$...\\$", () => {
      const input = "between \\$10 and \\$20";
      const result = transformLatex(input);
      expect(result).toBe("between \\$10 and \\$20");
    });
  });

  // ─── Special characters ──────────────────────────────────────────

  describe("special characters", () => {
    it("handles expressions with braces", () => {
      const input = "$$e^{i\\pi} + 1 = 0$$";
      const result = transformLatex(input);
      expect(result).toBe("<Latex>e^{i\\pi} + 1 = 0</Latex>");
    });

    it("handles expressions with backslashes", () => {
      const input = "$$\\frac{1}{2}$$";
      const result = transformLatex(input);
      expect(result).toBe("<Latex>\\frac{1}{2}</Latex>");
    });

    it("handles expressions with caret", () => {
      const input = "$x^2 + y^2$";
      const result = transformLatex(input);
      expect(result).toBe("<Latex>x^2 + y^2</Latex>");
    });

    it("handles expressions with underscore", () => {
      const input = "$a_{ij}$";
      const result = transformLatex(input);
      expect(result).toBe("<Latex>a_{ij}</Latex>");
    });

    it("handles the example from the task description", () => {
      const input = "$$f(x) = x * e^{2 pi i \\xi x}$$";
      const result = transformLatex(input);
      expect(result).toBe(
        "<Latex>f(x) = x * e^{2 pi i \\xi x}</Latex>",
      );
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty content (no-op)", () => {
      const input = "";
      const result = transformLatex(input);
      expect(result).toBe("");
    });

    it("handles content with no LaTeX", () => {
      const input = "Just regular markdown content.";
      const result = transformLatex(input);
      expect(result).toBe("Just regular markdown content.");
    });

    it("handles single variable names with $...$", () => {
      const input = "variable $x$ is used";
      const result = transformLatex(input);
      expect(result).toBe("variable <Latex>x</Latex> is used");
    });
  });
});
