import { describe, it, expect } from "vitest";
import { sanitizeForMdx } from "./sanitize-mdx.js";

describe("sanitizeForMdx", () => {
  // ── Curly braces ──────────────────────────────────────────────────────

  describe("curly braces", () => {
    it("escapes template-style double curly braces", () => {
      const result = sanitizeForMdx("Hello {{name}}");
      expect(result).toBe("Hello \\{\\{name\\}\\}");
    });

    it("escapes single curly braces in body text", () => {
      const result = sanitizeForMdx("Use {key: value} syntax");
      expect(result).toBe("Use \\{key: value\\} syntax");
    });

    it("preserves curly braces in JSX attribute expressions", () => {
      const result = sanitizeForMdx('<Card cols={2} title="test">');
      expect(result).toContain("cols={2}");
    });

    it("preserves JSX attribute expressions with string values", () => {
      const result = sanitizeForMdx('<Callout type={true}>');
      expect(result).toContain("type={true}");
    });

    it("preserves nested curly braces in JSX attribute expressions", () => {
      const result = sanitizeForMdx(
        'style={{ borderRadius: "0.5rem" }}'
      );
      expect(result).toBe('style={{ borderRadius: "0.5rem" }}');
    });

    it("preserves deeply nested curly braces in JSX attribute expressions", () => {
      const result = sanitizeForMdx("style={{ nested: { a: 1 } }}");
      expect(result).toBe("style={{ nested: { a: 1 } }}");
    });

    it("preserves nested braces in img with style attribute", () => {
      const input = `<img src="/images/example.png" style={{ borderRadius: '0.5rem' }} />`;
      const result = sanitizeForMdx(input);
      expect(result).toContain("style={{ borderRadius: '0.5rem' }}");
    });

    it("escapes non-attribute braces while preserving nested JSX attrs", () => {
      const input = `{literal} and style={{ color: "red" }}`;
      const result = sanitizeForMdx(input);
      expect(result).toContain("\\{literal\\}");
      expect(result).toContain('style={{ color: "red" }}');
    });
  });

  // ── Void elements ─────────────────────────────────────────────────────

  describe("void elements", () => {
    it("self-closes <br>", () => {
      const result = sanitizeForMdx("line1<br>line2");
      expect(result).toBe("line1<br />line2");
    });

    it("self-closes <hr>", () => {
      const result = sanitizeForMdx("above\n<hr>\nbelow");
      expect(result).toBe("above\n<hr />\nbelow");
    });

    it("self-closes <img> with attributes", () => {
      const result = sanitizeForMdx('<img src="photo.jpg" alt="A photo">');
      expect(result).toBe('<img src="photo.jpg" alt="A photo" />');
    });

    it("preserves already self-closed elements", () => {
      const result = sanitizeForMdx("<br />");
      expect(result).toBe("<br />");
    });

    it("self-closes <input> tags", () => {
      const result = sanitizeForMdx('<input type="text">');
      expect(result).toBe('<input type="text" />');
    });
  });

  // ── Angle brackets ────────────────────────────────────────────────────

  describe("angle brackets", () => {
    it("escapes < in comparison expressions", () => {
      const result = sanitizeForMdx("x < y");
      expect(result).toBe("x \\< y");
    });

    it("escapes < before digits", () => {
      const result = sanitizeForMdx("value < 10");
      expect(result).toBe("value \\< 10");
    });

    it("preserves valid HTML tags", () => {
      // <div> starts with a letter, so it's treated as a valid tag and preserved
      const result = sanitizeForMdx("<div>content</div>");
      expect(result).toBe("<div>content</div>");
    });

    it("preserves JSX component tags", () => {
      const result = sanitizeForMdx("<Callout>hello</Callout>");
      expect(result).toBe("<Callout>hello</Callout>");
    });

    it("preserves closing tags", () => {
      const result = sanitizeForMdx("</Callout>");
      expect(result).toBe("</Callout>");
    });

    it("preserves HTML comments", () => {
      const result = sanitizeForMdx("<!-- comment -->");
      expect(result).toBe("<!-- comment -->");
    });
  });

  // ── Code blocks (must NOT be sanitized) ───────────────────────────────

  describe("code blocks", () => {
    it("preserves content inside fenced code blocks", () => {
      const input = "before\n```\n{{template}} x < y <br>\n```\nafter";
      const result = sanitizeForMdx(input);
      expect(result).toContain("```\n{{template}} x < y <br>\n```");
      // The "before" and "after" should be sanitized normally
    });

    it("preserves content inside fenced code blocks with language", () => {
      const input = "text\n```js\nif (x < 10) { return; }\n```\nmore text";
      const result = sanitizeForMdx(input);
      expect(result).toContain("```js\nif (x < 10) { return; }\n```");
    });

    it("preserves content inside inline code", () => {
      const input = "Use `{key: value}` syntax";
      const result = sanitizeForMdx(input);
      expect(result).toContain("`{key: value}`");
    });
  });

  // ── Combined scenarios ────────────────────────────────────────────────

  describe("combined scenarios", () => {
    it("handles the example from the task description", () => {
      const result = sanitizeForMdx("Hello {{name}}, x < y and <br> here");
      expect(result).toBe("Hello \\{\\{name\\}\\}, x \\< y and <br /> here");
    });

    it("preserves already-valid MDX", () => {
      const input = '<Callout type="info">\nHello\n</Callout>';
      const result = sanitizeForMdx(input);
      expect(result).toBe('<Callout type="info">\nHello\n</Callout>');
    });

    it("handles mixed content with code blocks", () => {
      const input = [
        "Some text with {{template}}",
        "",
        "```",
        "{{preserved}}",
        "```",
        "",
        "More text with x < y",
      ].join("\n");
      const result = sanitizeForMdx(input);
      expect(result).toContain("\\{\\{template\\}\\}");
      expect(result).toContain("{{preserved}}");
      expect(result).toContain("\\< y");
    });
  });

  // ── LaTeX math (must NOT be sanitized) ──────────────────────────────

  describe("LaTeX math", () => {
    it("preserves curly braces inside inline math $...$", () => {
      const input = "The function $f(x) = x * e^{2 pi i \\xi x}$ is important";
      const result = sanitizeForMdx(input);
      expect(result).toContain("$f(x) = x * e^{2 pi i \\xi x}$");
    });

    it("preserves curly braces inside display math $$...$$", () => {
      const input = "The formula:\n$$\nf(x) = \\sum_{i=0}^{n} x_i\n$$\nend";
      const result = sanitizeForMdx(input);
      expect(result).toContain("$$\nf(x) = \\sum_{i=0}^{n} x_i\n$$");
    });

    it("preserves angle brackets inside inline math", () => {
      const input = "When $x < y$ we get";
      const result = sanitizeForMdx(input);
      expect(result).toContain("$x < y$");
    });

    it("sanitizes content outside math but not inside", () => {
      const input = "Text {var} and $e^{x}$ and more {var2}";
      const result = sanitizeForMdx(input);
      expect(result).toContain("\\{var\\}");
      expect(result).toContain("$e^{x}$");
      expect(result).toContain("\\{var2\\}");
    });

    it("handles display math with braces on same line", () => {
      const input = "$$\\frac{a}{b}$$";
      const result = sanitizeForMdx(input);
      expect(result).toBe("$$\\frac{a}{b}$$");
    });

    it("does not treat single $ as math when not paired", () => {
      const input = "Price is $5 and cost is $10";
      const result = sanitizeForMdx(input);
      // These are not math expressions ($ not paired properly)
      expect(result).toBe("Price is $5 and cost is $10");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(sanitizeForMdx("")).toBe("");
    });

    it("handles string with no problematic characters", () => {
      const input = "Just normal markdown text\n\n## Heading\n\nParagraph.";
      expect(sanitizeForMdx(input)).toBe(input);
    });

    it("handles markdown links with angle brackets in URLs", () => {
      // Angle brackets in markdown link URLs: [text](<url>)
      // The < in (<url>) is followed by a letter so it's preserved
      const input = "[link](<https://example.com>)";
      const result = sanitizeForMdx(input);
      expect(result).toContain("<https://example.com>");
    });
  });
});
