import { describe, it, expect } from "vitest";
import {
  parseAttributes,
  findBalancedCloseTag,
  findMDXComponents,
  preprocessCodeBlocks,
  preprocessInlineComponents,
} from "../mdx-parser";

// ---------------------------------------------------------------------------
// parseAttributes
// ---------------------------------------------------------------------------
describe("parseAttributes", () => {
  it("parses string attributes with double quotes", () => {
    const result = parseAttributes('title="Hello World" icon="star"');
    expect(result).toEqual({ title: "Hello World", icon: "star" });
  });

  it("parses numeric JSX expression attributes", () => {
    const result = parseAttributes("cols={3} width={200}");
    expect(result).toEqual({ cols: 3, width: 200 });
  });

  it("parses string JSX expression attributes", () => {
    const result = parseAttributes("type={info}");
    expect(result).toEqual({ type: "info" });
  });

  it("parses boolean attributes", () => {
    const result = parseAttributes("defaultOpen required");
    expect(result).toEqual({ defaultOpen: true, required: true });
  });

  it("handles mixed attribute types", () => {
    const result = parseAttributes(
      'title="My Card" cols={2} defaultOpen'
    );
    expect(result).toEqual({
      title: "My Card",
      cols: 2,
      defaultOpen: true,
    });
  });

  it("does not override key=value with boolean detection", () => {
    const result = parseAttributes('title="Hello"');
    expect(result.title).toBe("Hello");
  });

  it("returns empty object for empty string", () => {
    expect(parseAttributes("")).toEqual({});
  });

  it("handles attributes with special characters in values", () => {
    const result = parseAttributes('src="/images/test.png" alt="A & B"');
    expect(result).toEqual({ src: "/images/test.png", alt: "A & B" });
  });
});

// ---------------------------------------------------------------------------
// findBalancedCloseTag
// ---------------------------------------------------------------------------
describe("findBalancedCloseTag", () => {
  it("finds closing tag at correct position", () => {
    const content = "<Tab>content</Tab>";
    const result = findBalancedCloseTag(content, "Tab", 5);
    expect(result).toBe(12);
  });

  it("handles nested same-name tags", () => {
    const content =
      "<Accordion><Accordion>inner</Accordion></Accordion>";
    // searchFrom is after the first opening tag (index 11)
    const result = findBalancedCloseTag(content, "Accordion", 11);
    // The outer close tag starts at index 39
    expect(result).toBe(39);
  });

  it("handles deeply nested tags", () => {
    const content =
      "<Accordion><Accordion><Accordion>deep</Accordion></Accordion></Accordion>";
    const result = findBalancedCloseTag(content, "Accordion", 11);
    expect(result).toBe(61);
  });

  it("returns -1 when no closing tag is found", () => {
    const content = "<Tab>no closing tag";
    const result = findBalancedCloseTag(content, "Tab", 5);
    expect(result).toBe(-1);
  });

  it("handles content with self-closing tags inside", () => {
    // Self-closing tags should not increase depth
    const content = '<Tab><Image src="test.png" />text</Tab>';
    const result = findBalancedCloseTag(content, "Tab", 5);
    expect(result).toBe(33);
  });

  it("handles multiple siblings at same level", () => {
    const content = "<Tab>first</Tab><Tab>second</Tab>";
    // Finding close of first Tab (searchFrom after first opening tag)
    const result = findBalancedCloseTag(content, "Tab", 5);
    expect(result).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// findMDXComponents
// ---------------------------------------------------------------------------
describe("findMDXComponents", () => {
  it("detects self-closing components", () => {
    const content = 'Some text\n<Image src="test.png" />\nMore text';
    const result = findMDXComponents(content);
    expect(result).toHaveLength(1);
    const first = result[0];
    if (first) {
      expect(first.type).toBe("Image");
      expect(first.props.src).toBe("test.png");
      expect(first.children).toBe("");
    }
  });

  it("detects components with children", () => {
    const content = '<Callout type="info">This is a callout</Callout>';
    const result = findMDXComponents(content);
    expect(result).toHaveLength(1);
    const first = result[0];
    if (first) {
      expect(first.type).toBe("Callout");
      expect(first.props.type).toBe("info");
      expect(first.children).toBe("This is a callout");
    }
  });

  it("filters out nested components", () => {
    const content =
      '<Tabs><Tab title="First">Content</Tab><Tab title="Second">More</Tab></Tabs>';
    const result = findMDXComponents(content);
    // Only the outer Tabs should be returned, not the nested Tabs
    expect(result).toHaveLength(1);
    const first = result[0];
    if (first) {
      expect(first.type).toBe("Tabs");
    }
  });

  it("distinguishes Tab from Tabs", () => {
    // When Tab appears outside of Tabs, both should be detected
    const content =
      '<Tab title="Solo">Solo content</Tab>\n<Tabs><Tab title="Inside">Inside content</Tab></Tabs>';
    const result = findMDXComponents(content);
    // Solo Tab + Tabs (inner Tab is filtered as nested)
    expect(result).toHaveLength(2);
    const first = result[0];
    const second = result[1];
    if (first) {
      expect(first.type).toBe("Tab");
    }
    if (second) {
      expect(second.type).toBe("Tabs");
    }
  });

  it("detects multiple top-level components", () => {
    const content =
      '<Callout type="info">Note</Callout>\n\n<Card title="Test">Content</Card>';
    const result = findMDXComponents(content);
    expect(result).toHaveLength(2);
    const first = result[0];
    const second = result[1];
    if (first) {
      expect(first.type).toBe("Callout");
    }
    if (second) {
      expect(second.type).toBe("Card");
    }
  });

  it("returns sorted results by start index", () => {
    const content =
      '<Card title="First">A</Card>\n<Callout type="info">B</Callout>';
    const result = findMDXComponents(content);
    const first = result[0];
    const second = result[1];
    if (first && second) {
      expect(first.startIndex).toBeLessThan(second.startIndex);
    }
  });

  it("returns empty array for plain markdown", () => {
    const content = "# Hello\n\nThis is just regular markdown.";
    const result = findMDXComponents(content);
    expect(result).toHaveLength(0);
  });

  it("handles all supported component types", () => {
    const componentNames = [
      "Card",
      "CardGroup",
      "Callout",
      "Image",
      "Tabs",
      "Steps",
      "Accordion",
      "AccordionGroup",
      "Columns",
      "CodeGroup",
      "ApiEndpoint",
      "ParamField",
      "ResponseField",
      "Expandable",
      "Frame",
      "Latex",
      "Video",
      "IFrame",
    ];
    for (const name of componentNames) {
      const content = `<${name}>content</${name}>`;
      const result = findMDXComponents(content);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((c) => c.type === name)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// preprocessCodeBlocks
// ---------------------------------------------------------------------------
describe("preprocessCodeBlocks", () => {
  it("returns no code blocks for plain markdown", () => {
    const content = "# Hello\n\nJust text.";
    const result = preprocessCodeBlocks(content);
    expect(result.hasCodeBlocks).toBe(false);
    // When no code blocks with metadata are found, remaining content is still captured
    expect(result.segments).toHaveLength(1);
    const first = result.segments[0];
    if (first) {
      expect(first.type).toBe("markdown");
    }
  });

  it("extracts code blocks with language and title", () => {
    const content = '```javascript MyFile.js\nconsole.log("hello");\n```';
    const result = preprocessCodeBlocks(content);
    expect(result.hasCodeBlocks).toBe(true);
    expect(result.segments).toHaveLength(1);
    const seg = result.segments[0];
    if (seg && seg.type === "codeblock") {
      expect(seg.language).toBe("javascript");
      expect(seg.title).toBe("MyFile.js");
      expect(seg.code).toContain("console.log");
    }
  });

  it("extracts height metadata from code blocks", () => {
    const content = "```python script.py {height=300}\nprint('hi')\n```";
    const result = preprocessCodeBlocks(content);
    expect(result.hasCodeBlocks).toBe(true);
    const seg = result.segments[0];
    if (seg && seg.type === "codeblock") {
      expect(seg.height).toBe(300);
      expect(seg.title).toBe("script.py");
    }
  });

  it("preserves markdown before and after code blocks", () => {
    const content =
      "Before text\n\n```js title\ncode\n```\n\nAfter text";
    const result = preprocessCodeBlocks(content);
    expect(result.hasCodeBlocks).toBe(true);
    expect(result.segments).toHaveLength(3);
    const first = result.segments[0];
    const second = result.segments[1];
    const third = result.segments[2];
    if (first) {
      expect(first.type).toBe("markdown");
    }
    if (second) {
      expect(second.type).toBe("codeblock");
    }
    if (third) {
      expect(third.type).toBe("markdown");
    }
  });

  it("defaults height to 150 when not specified", () => {
    const content = "```ts file.ts\nconst x = 1;\n```";
    const result = preprocessCodeBlocks(content);
    const seg = result.segments[0];
    if (seg && seg.type === "codeblock") {
      expect(seg.height).toBe(150);
    }
  });
});

// ---------------------------------------------------------------------------
// preprocessInlineComponents
// ---------------------------------------------------------------------------
describe("preprocessInlineComponents", () => {
  it("converts Icon components to data-icon spans", () => {
    const source = 'Hello <Icon icon="star" /> world';
    const result = preprocessInlineComponents(source);
    expect(result).toContain('data-icon="star"');
    expect(result).toContain('data-size="16"');
    expect(result).not.toContain("<Icon");
  });

  it("handles Icon with custom size", () => {
    const source = '<Icon icon="check" size={24} />';
    const result = preprocessInlineComponents(source);
    expect(result).toContain('data-icon="check"');
    expect(result).toContain('data-size="24"');
  });

  it("converts inline Latex to KaTeX HTML", () => {
    const source = "The equation <Latex inline>x^2</Latex> is simple.";
    const result = preprocessInlineComponents(source);
    expect(result).toContain('class="latex-inline"');
    expect(result).not.toContain("<Latex inline>");
  });

  it("preserves block-level Latex tags", () => {
    const source = "<Latex>x^2 + y^2 = z^2</Latex>";
    const result = preprocessInlineComponents(source);
    expect(result).toContain("<Latex>");
    expect(result).toContain("</Latex>");
  });

  it("handles multiple inline components", () => {
    const source =
      '<Icon icon="star" /> and <Icon icon="heart" /> icons';
    const result = preprocessInlineComponents(source);
    expect(result).toContain('data-icon="star"');
    expect(result).toContain('data-icon="heart"');
  });

  it("returns source unchanged when no inline components present", () => {
    const source = "Just regular **markdown** text.";
    const result = preprocessInlineComponents(source);
    expect(result).toBe(source);
  });

  it("handles Icon with string size attribute", () => {
    const source = '<Icon icon="star" size="20" />';
    const result = preprocessInlineComponents(source);
    expect(result).toContain('data-size="20"');
  });
});
