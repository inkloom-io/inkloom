import { describe, it, expect } from "vitest";
import { mdxToBlockNote } from "../mdx-to-blocknote.js";
import { blockNoteToMDX } from "../blocknote-to-mdx.js";

describe("mdxToBlockNote", () => {
  it("parses a heading", () => {
    const blocks = mdxToBlockNote("## Hello World");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("heading");
    expect(blocks[0].props?.level).toBe(2);
    expect(blocks[0].content).toEqual([{ type: "text", text: "Hello World" }]);
  });

  it("parses a paragraph with inline formatting", () => {
    const blocks = mdxToBlockNote("Hello **bold** and *italic* text");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const content = blocks[0].content as Array<{ type: string; text?: string; styles?: Record<string, boolean> }>;
    expect(content.some((c) => c.styles?.bold)).toBe(true);
    expect(content.some((c) => c.styles?.italic)).toBe(true);
  });

  it("parses inline code", () => {
    const blocks = mdxToBlockNote("Use `myFunction()` here");
    const content = blocks[0].content as Array<{ type: string; text?: string; styles?: Record<string, boolean> }>;
    const codeItem = content.find((c) => c.styles?.code);
    expect(codeItem).toBeDefined();
    expect(codeItem?.text).toBe("myFunction()");
  });

  it("parses a code block", () => {
    const blocks = mdxToBlockNote("```javascript\nconst x = 1;\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("codeBlock");
    expect(blocks[0].props?.language).toBe("javascript");
    expect(blocks[0].props?.code).toBe("const x = 1;");
  });

  it("parses a code block with height meta", () => {
    const blocks = mdxToBlockNote("```typescript {height=300}\ntype Foo = string;\n```");
    expect(blocks[0].props?.height).toBe("300");
  });

  it("parses a code block with title", () => {
    const blocks = mdxToBlockNote("```java HelloWorld.java\nclass HelloWorld {}\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("codeBlock");
    expect(blocks[0].props?.language).toBe("java");
    expect(blocks[0].props?.title).toBe("HelloWorld.java");
    expect(blocks[0].props?.code).toBe("class HelloWorld {}");
  });

  it("parses a code block with title and height", () => {
    const blocks = mdxToBlockNote("```typescript src/index.ts {height=300}\nconst x = 1;\n```");
    expect(blocks[0].props?.title).toBe("src/index.ts");
    expect(blocks[0].props?.height).toBe("300");
  });

  it("does not set title when only height meta exists", () => {
    const blocks = mdxToBlockNote("```python {height=200}\nprint('hello')\n```");
    expect(blocks[0].props?.title).toBeUndefined();
    expect(blocks[0].props?.height).toBe("200");
  });

  it("parses a Callout component", () => {
    const mdx = `<Callout type="warning" title="Watch out">\nBe careful here.\n</Callout>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("callout");
    expect(blocks[0].props?.type).toBe("warning");
    expect(blocks[0].props?.title).toBe("Watch out");
  });

  it("parses a CardGroup with Cards", () => {
    const mdx = `<CardGroup cols={2}>\n<Card title="First" href="/first">\nDescription\n</Card>\n<Card title="Second" />\n</CardGroup>`;
    const blocks = mdxToBlockNote(mdx);
    // Should have cardGroup + 2 cards
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0].type).toBe("cardGroup");
    expect(blocks[1].type).toBe("card");
    expect(blocks[1].props?.title).toBe("First");
  });

  it("parses Columns with Card children as cardGroup (backward-compatible)", () => {
    const mdx = `<Columns cols={2}>\n<Card title="A">\nDesc A\n</Card>\n<Card title="B">\nDesc B\n</Card>\n</Columns>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0].type).toBe("cardGroup");
    expect(blocks[0].props?.cols).toBe("2");
    expect(blocks[1].type).toBe("card");
    expect(blocks[1].props?.title).toBe("A");
    expect(blocks[2].type).toBe("card");
    expect(blocks[2].props?.title).toBe("B");
  });

  it("parses Columns with non-card content as columns + column blocks", () => {
    const mdx = `<Columns cols={2}>\n<div>\ntext1\n</div>\n<div>\ntext2\n</div>\n</Columns>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0].type).toBe("columns");
    expect(blocks[0].props?.cols).toBe("2");
    expect(blocks[1].type).toBe("column");
    const col1Content = blocks[1].content as Array<{ type: string; text?: string }>;
    expect(col1Content.some((c) => c.text === "text1")).toBe(true);
    expect(blocks[2].type).toBe("column");
    const col2Content = blocks[2].content as Array<{ type: string; text?: string }>;
    expect(col2Content.some((c) => c.text === "text2")).toBe(true);
  });

  it("parses Columns with cols={3}", () => {
    const mdx = `<Columns cols={3}>\n<div>\na\n</div>\n<div>\nb\n</div>\n<div>\nc\n</div>\n</Columns>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("columns");
    expect(blocks[0].props?.cols).toBe("3");
    const columnBlocks = blocks.filter((b) => b.type === "column");
    expect(columnBlocks).toHaveLength(3);
  });

  it("parses Columns with cols={4}", () => {
    const mdx = `<Columns cols={4}>\n<div>\n1\n</div>\n<div>\n2\n</div>\n<div>\n3\n</div>\n<div>\n4\n</div>\n</Columns>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("columns");
    expect(blocks[0].props?.cols).toBe("4");
    const columnBlocks = blocks.filter((b) => b.type === "column");
    expect(columnBlocks).toHaveLength(4);
  });

  it("parses a bullet list", () => {
    const mdx = "- Item 1\n- Item 2\n- Item 3";
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("bulletListItem");
    expect(blocks[1].type).toBe("bulletListItem");
    expect(blocks[2].type).toBe("bulletListItem");
  });

  it("parses an ordered list", () => {
    const mdx = "1. First\n2. Second";
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("numberedListItem");
  });

  it("parses ordered list with code block children", () => {
    const mdx = "1. First item:\n\n   ```javascript\n   const x = 1;\n   ```\n\n2. Second item";
    const blocks = mdxToBlockNote(mdx);
    // First item should have code block as child
    expect(blocks[0].type).toBe("numberedListItem");
    expect(blocks[0].children).toBeDefined();
    if (blocks[0].children) {
      expect(blocks[0].children.length).toBeGreaterThan(0);
      expect(blocks[0].children[0].type).toBe("codeBlock");
    }
    // Second item should be numbered correctly
    expect(blocks[1].type).toBe("numberedListItem");
  });

  it("parses a checklist", () => {
    const mdx = "- [x] Done\n- [ ] Not done";
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("checkListItem");
    expect(blocks[0].props?.checked).toBe(true);
    expect(blocks[1].props?.checked).toBe(false);
  });

  it("parses a table", () => {
    const mdx = "| Name | Value |\n| --- | --- |\n| foo | bar |";
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("table");
  });

  it("parses a thematic break as divider", () => {
    const blocks = mdxToBlockNote("---");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("divider");
  });

  it("parses an image", () => {
    const blocks = mdxToBlockNote("![Alt text](https://example.com/img.png)");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/img.png");
    expect(blocks[0].props?.alt).toBe("Alt text");
  });

  it("parses an Image component with separate alt and caption", () => {
    const blocks = mdxToBlockNote('<Image src="https://example.com/img.png" alt="descriptive text" caption="Figure 1" />');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/img.png");
    expect(blocks[0].props?.alt).toBe("descriptive text");
    expect(blocks[0].props?.caption).toBe("Figure 1");
  });

  it("parses an HTML img tag", () => {
    const blocks = mdxToBlockNote('<img src="https://example.com/photo.jpg" alt="A photo" />');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/photo.jpg");
    expect(blocks[0].props?.alt).toBe("A photo");
    expect(blocks[0].props?.caption).toBe("A photo");
  });

  it("parses an HTML img tag with width", () => {
    const blocks = mdxToBlockNote('<img src="https://example.com/photo.jpg" alt="A photo" width="400" />');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/photo.jpg");
    expect(blocks[0].props?.alt).toBe("A photo");
    expect(blocks[0].props?.previewWidth).toBe(400);
  });

  it("parses an HTML img tag without alt text", () => {
    const blocks = mdxToBlockNote('<img src="https://example.com/photo.jpg" />');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/photo.jpg");
    expect(blocks[0].props?.alt).toBeUndefined();
  });

  it("parses an image without alt text", () => {
    const blocks = mdxToBlockNote("![](https://example.com/img.png)");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props?.url).toBe("https://example.com/img.png");
    expect(blocks[0].props?.alt).toBeUndefined();
  });

  it("parses a link", () => {
    const blocks = mdxToBlockNote("[Click here](https://example.com)");
    const content = blocks[0].content as Array<{ type: string; href?: string }>;
    const link = content.find((c) => c.type === "link");
    expect(link).toBeDefined();
    expect(link?.href).toBe("https://example.com");
  });

  it("parses Tabs with Tab children", () => {
    const mdx = `<Tabs>\n<Tab title="React">\nReact content\n</Tab>\n<Tab title="Vue">\nVue content\n</Tab>\n</Tabs>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("tabs");
    expect(blocks[1].type).toBe("tab");
    expect(blocks[1].props?.title).toBe("React");
    expect(blocks[2].type).toBe("tab");
    expect(blocks[2].props?.title).toBe("Vue");
  });

  it("parses Tabs with nested blocks as flat sibling array", () => {
    const mdx = `<Tabs>\n<Tab title="Example">\nSome text\n\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n</Tab>\n<Tab title="Other">\nOther content\n</Tab>\n</Tabs>`;
    const blocks = mdxToBlockNote(mdx);
    // Should be: [tabs, tab("Example"), codeBlock, tab("Other")]
    expect(blocks[0].type).toBe("tabs");
    expect(blocks[1].type).toBe("tab");
    expect(blocks[1].props?.title).toBe("Example");
    expect(blocks[1].children).toBeUndefined();
    // Inline content stays in tab's content
    const content = blocks[1].content as Array<{ type: string; text?: string }>;
    expect(content.some((c) => c.text?.includes("Some text"))).toBe(true);
    // Code block is a flat sibling, NOT nested in children
    expect(blocks[2].type).toBe("codeBlock");
    expect(blocks[2].props?.language).toBe("javascript");
    expect(blocks[2].props?.code).toBe("const x = 1;");
    // Second tab follows the code block
    expect(blocks[3].type).toBe("tab");
    expect(blocks[3].props?.title).toBe("Other");
  });

  it("parses Steps with Step children", () => {
    const mdx = `<Steps>\n<Step title="Install">\nRun the install command.\n</Step>\n<Step title="Configure">\nEdit the config file.\n</Step>\n</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("steps");
    expect(blocks[1].type).toBe("step");
    expect(blocks[1].props?.title).toBe("Install");
    expect(blocks[2].type).toBe("step");
    expect(blocks[2].props?.title).toBe("Configure");
    // Ensure no block contains literal "..." placeholder text
    for (const block of blocks) {
      if (Array.isArray(block.content)) {
        for (const item of block.content) {
          if ("text" in item) {
            expect(item.text).not.toBe("...");
          }
        }
      }
    }
  });

  it("parses AccordionGroup with Accordion children", () => {
    const mdx = `<AccordionGroup>\n<Accordion title="FAQ 1">\nAnswer to FAQ 1.\n</Accordion>\n<Accordion title="FAQ 2">\nAnswer to FAQ 2.\n</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("accordionGroup");
    expect(blocks[1].type).toBe("accordion");
    expect(blocks[1].props?.title).toBe("FAQ 1");
    expect(blocks[2].type).toBe("accordion");
    expect(blocks[2].props?.title).toBe("FAQ 2");
  });

  it("parses CodeGroup with code blocks", () => {
    const mdx = `<CodeGroup>\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n\`\`\`python\nx = 1\n\`\`\`\n</CodeGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("codeGroup");
    expect(blocks[1].type).toBe("codeBlock");
    expect(blocks[1].props?.language).toBe("javascript");
    expect(blocks[2].type).toBe("codeBlock");
    expect(blocks[2].props?.language).toBe("python");
  });

  it("parses a simple ResponseField", () => {
    const mdx = `<ResponseField name="id" type="string" required>\nThe unique identifier.\n</ResponseField>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("responseField");
    expect(blocks[0].props?.name).toBe("id");
    expect(blocks[0].props?.type).toBe("string");
    expect(blocks[0].props?.required).toBe(true);
    const content = blocks[0].content as Array<{ type: string; text?: string }>;
    expect(content.some((c) => c.text?.includes("unique identifier"))).toBe(true);
  });

  it("parses ResponseField with nested Expandable and child ResponseFields", () => {
    const mdx = `<ResponseField name="navigation" type="Navigation[]" required>\nDescription text here\n<Expandable title="Navigation">\n<ResponseField name="group" type="string">\nNested description\n</ResponseField>\n</Expandable>\n</ResponseField>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("responseField");
    expect(blocks[0].props?.name).toBe("navigation");
    expect(blocks[0].props?.type).toBe("Navigation[]");
    expect(blocks[0].props?.required).toBe(true);
    // Expandable is a child of the ResponseField, not a sibling
    const rfChildren = blocks[0].children as Array<{ type: string; props?: Record<string, unknown>; children?: unknown[] }>;
    expect(rfChildren).toHaveLength(1);
    expect(rfChildren[0].type).toBe("expandable");
    expect(rfChildren[0].props?.title).toBe("Navigation");
    // ResponseField is a child of the Expandable
    const expChildren = rfChildren[0].children as Array<{ type: string; props?: Record<string, unknown> }>;
    expect(expChildren).toHaveLength(1);
    expect(expChildren[0].type).toBe("responseField");
    expect(expChildren[0].props?.name).toBe("group");
    expect(expChildren[0].props?.type).toBe("string");
  });

  it("parses Expandable with ResponseField children", () => {
    const mdx = `<Expandable title="Properties">\n<ResponseField name="key" type="string">\nA key value.\n</ResponseField>\n</Expandable>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("expandable");
    expect(blocks[0].props?.title).toBe("Properties");
    // ResponseField is a child of the Expandable, not a sibling
    const expChildren = blocks[0].children as Array<{ type: string; props?: Record<string, unknown> }>;
    expect(expChildren).toHaveLength(1);
    expect(expChildren[0].type).toBe("responseField");
    expect(expChildren[0].props?.name).toBe("key");
  });

  it("parses Frame with image child", () => {
    const mdx = `<Frame caption="Yosemite National Park">\n<img src="/images/yosemite.png" alt="Yosemite" />\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("Yosemite National Park");
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children?.length).toBeGreaterThan(0);
  });

  it("parses Frame with hint prop", () => {
    const mdx = `<Frame hint="Important context">\n<img src="/images/photo.png" alt="Photo" />\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.hint).toBe("Important context");
  });

  it("parses Frame with both hint and caption", () => {
    const mdx = `<Frame hint="Plan ahead" caption="A beautiful park">\n<img src="/images/park.png" alt="Park" />\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.hint).toBe("Plan ahead");
    expect(blocks[0].props?.caption).toBe("A beautiful park");
  });

  it("parses Frame with code block child", () => {
    const mdx = '<Frame caption="Example code">\n\n```javascript\nconst x = 1;\n```\n\n</Frame>';
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].children?.some((c) => c.type === "codeBlock")).toBe(true);
  });

  it("parses HTML figure with img and figcaption into frame with nested image (inline)", () => {
    const mdx = `<figure><img src=".gitbook/assets/screenshot.png" alt="image alt" /><figcaption><p>image caption</p></figcaption></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("image caption");
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!.length).toBe(1);
    expect(blocks[0].children![0].type).toBe("image");
    expect(blocks[0].children![0].props?.url).toBe(".gitbook/assets/screenshot.png");
    expect(blocks[0].children![0].props?.alt).toBe("image alt");
  });

  it("parses HTML figure with img and figcaption into frame with nested image (flow)", () => {
    const mdx = `<figure>\n<img src=".gitbook/assets/screenshot.png" alt="image alt" />\n<figcaption>\n<p>image caption</p>\n</figcaption>\n</figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("image caption");
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!.length).toBe(1);
    expect(blocks[0].children![0].type).toBe("image");
    expect(blocks[0].children![0].props?.url).toBe(".gitbook/assets/screenshot.png");
    expect(blocks[0].children![0].props?.alt).toBe("image alt");
  });

  it("parses figure without figcaption", () => {
    const mdx = `<figure><img src="photo.png" alt="A photo" /></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBeUndefined();
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!.length).toBe(1);
    expect(blocks[0].children![0].type).toBe("image");
    expect(blocks[0].children![0].props?.url).toBe("photo.png");
  });

  it("parses figure without img", () => {
    const mdx = `<figure><figcaption><p>caption only</p></figcaption></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("caption only");
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!.length).toBe(0);
  });

  it("parses GitBook card-view table into cardGroup + cards (inline)", () => {
    const mdx = `<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-cover data-type="image">Cover image</th></tr></thead><tbody><tr><td>card</td><td></td><td><a href=".gitbook/assets/screenshot.png">screenshot.png</a></td></tr><tr><td>card 2 column 2</td><td>no image</td><td></td></tr></tbody></table>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0].type).toBe("cardGroup");
    expect(blocks[0].props?.cols).toBe("2");
    expect(blocks[1].type).toBe("card");
    expect(blocks[1].props?.title).toBe("card");
    expect(blocks[2].type).toBe("card");
    expect(blocks[2].props?.title).toBe("card 2 column 2");
    // Second card has "no image" as content
    expect(blocks[2].content).toBeDefined();
    if (Array.isArray(blocks[2].content)) {
      expect(blocks[2].content.some((c: { type: string; text?: string }) => c.text === "no image")).toBe(true);
    }
  });

  it("parses GitBook card-view table into cardGroup + cards (flow)", () => {
    const mdx = `<table data-view="cards">\n<thead>\n<tr><th></th><th></th><th data-hidden data-card-cover data-type="image">Cover image</th></tr>\n</thead>\n<tbody>\n<tr><td>card title</td><td>description</td><td></td></tr>\n</tbody>\n</table>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0].type).toBe("cardGroup");
    expect(blocks[1].type).toBe("card");
    expect(blocks[1].props?.title).toBe("card title");
  });

  it("returns at least one block for empty input", () => {
    const blocks = mdxToBlockNote("");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });

  it("parses a LaTeX block", () => {
    const blocks = mdxToBlockNote("<Latex>\nx^2 + y^2 = z^2\n</Latex>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("latex");
    expect(blocks[0].props?.expression).toBe("x^2 + y^2 = z^2");
  });

  it("parses LaTeX with special chars", () => {
    const blocks = mdxToBlockNote("<Latex>\n\\alpha^2 + \\beta^2 = \\gamma^2\n</Latex>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("latex");
    expect(blocks[0].props?.expression).toBe("\\alpha^2 + \\beta^2 = \\gamma^2");
  });

  it("parses empty LaTeX", () => {
    const blocks = mdxToBlockNote("<Latex>\n\n</Latex>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("latex");
    expect(blocks[0].props?.expression).toBe("");
  });

  it("parses inline mark as badge", () => {
    const blocks = mdxToBlockNote('This is <mark style="color:green;">POST</mark> method');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const content = blocks[0].content as Array<{ type: string; props?: Record<string, string>; content?: Array<{ type: string; text?: string }> }>;
    const badge = content.find((c) => c.type === "badge");
    expect(badge).toBeDefined();
    if (badge) {
      expect(badge.props?.color).toBe("green");
      expect(badge.content?.[0]?.text).toBe("POST");
    }
  });

  it("parses inline mark without style", () => {
    const blocks = mdxToBlockNote("Use <mark>IMPORTANT</mark> here");
    expect(blocks).toHaveLength(1);
    const content = blocks[0].content as Array<{ type: string; props?: Record<string, string>; content?: Array<{ type: string; text?: string }> }>;
    const badge = content.find((c) => c.type === "badge");
    expect(badge).toBeDefined();
    if (badge) {
      expect(badge.props?.color).toBe("");
      expect(badge.content?.[0]?.text).toBe("IMPORTANT");
    }
  });

  it("parses inline Icon element", () => {
    const blocks = mdxToBlockNote('Text with <Icon icon="flag" size={32} /> icon');
    expect(blocks).toHaveLength(1);
    const content = blocks[0].content as Array<{ type: string; props?: Record<string, string> }>;
    const icon = content.find((c) => c.type === "icon");
    expect(icon).toBeDefined();
    if (icon) {
      expect(icon.props?.icon).toBe("flag");
      expect(icon.props?.size).toBe("32");
    }
  });

  it("parses inline Icon element without size", () => {
    const blocks = mdxToBlockNote('Check <Icon icon="star" /> this');
    expect(blocks).toHaveLength(1);
    const content = blocks[0].content as Array<{ type: string; props?: Record<string, string> }>;
    const icon = content.find((c) => c.type === "icon");
    expect(icon).toBeDefined();
    if (icon) {
      expect(icon.props?.icon).toBe("star");
      expect(icon.props?.size).toBeUndefined();
    }
  });

  it("parses block-level Icon element", () => {
    const blocks = mdxToBlockNote('<Icon icon="rocket" size={48} />');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const content = blocks[0].content as Array<{ type: string; props?: Record<string, string> }>;
    const icon = content.find((c) => c.type === "icon");
    expect(icon).toBeDefined();
    if (icon) {
      expect(icon.props?.icon).toBe("rocket");
      expect(icon.props?.size).toBe("48");
    }
  });

  it("parses iframe basic", () => {
    const blocks = mdxToBlockNote('<iframe src="https://youtube.com/embed/abc"></iframe>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("iframe");
    expect(blocks[0].props?.src).toBe("https://youtube.com/embed/abc");
  });

  it("parses iframe with full attributes", () => {
    const mdx = '<iframe src="https://youtube.com/embed/abc" title="YouTube" width="560" height="315" allow="accelerometer; autoplay" allowFullScreen></iframe>';
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("iframe");
    expect(blocks[0].props?.src).toBe("https://youtube.com/embed/abc");
    expect(blocks[0].props?.title).toBe("YouTube");
    expect(blocks[0].props?.width).toBe("560");
    expect(blocks[0].props?.height).toBe("315");
    expect(blocks[0].props?.allow).toBe("accelerometer; autoplay");
    expect(blocks[0].props?.allowFullScreen).toBe("true");
  });

  it("parses video basic with controls", () => {
    const blocks = mdxToBlockNote('<video src="/demo.mp4" controls></video>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("video");
    expect(blocks[0].props?.src).toBe("/demo.mp4");
    expect(blocks[0].props?.controls).toBe("true");
  });

  it("parses video with all boolean props", () => {
    const blocks = mdxToBlockNote('<video autoPlay muted loop playsInline src="/demo.mp4"></video>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("video");
    expect(blocks[0].props?.src).toBe("/demo.mp4");
    expect(blocks[0].props?.autoPlay).toBe("true");
    expect(blocks[0].props?.muted).toBe("true");
    expect(blocks[0].props?.loop).toBe("true");
    expect(blocks[0].props?.playsInline).toBe("true");
  });

  it("parses br tag as empty paragraph", () => {
    const blocks = mdxToBlockNote("<br />");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].content).toEqual([]);
  });

  it("parses br between content as paragraph, empty paragraph, paragraph", () => {
    const mdx = "text before\n\n<br />\n\ntext after";
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("paragraph");
    const firstContent = blocks[0].content as Array<{ type: string; text?: string }>;
    expect(firstContent.some((c) => c.text === "text before")).toBe(true);
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[1].content).toEqual([]);
    expect(blocks[2].type).toBe("paragraph");
    const lastContent = blocks[2].content as Array<{ type: string; text?: string }>;
    expect(lastContent.some((c) => c.text === "text after")).toBe(true);
  });

  it("skips import/export statements", () => {
    const mdx = `import Component from './component'\n\n## Title`;
    const blocks = mdxToBlockNote(mdx);
    const heading = blocks.find((b) => b.type === "heading");
    expect(heading).toBeDefined();
    // No paragraph with "import" text
    const importBlock = blocks.find(
      (b) => b.type === "paragraph" &&
        Array.isArray(b.content) &&
        b.content.some((c: { text?: string }) => c.text?.includes("import"))
    );
    expect(importBlock).toBeUndefined();
  });

  describe("block-level content inside JSX components", () => {
    it("parses a code block inside a Tab as flat siblings", () => {
      const mdx = `<Tabs>\n<Tab title="Example">\nSome intro text:\n\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      // Inline text should be in content
      const content = tab?.content as Array<{ type: string; text?: string }>;
      expect(content.some((c) => c.text?.includes("intro text"))).toBe(true);
      // Code block should be a flat sibling after the tab, not nested in children
      expect(tab?.children).toBeUndefined();
      const codeBlock = blocks.find((b) => b.type === "codeBlock");
      expect(codeBlock).toBeDefined();
      expect(codeBlock?.props?.language).toBe("javascript");
      expect(codeBlock?.props?.code).toBe("const x = 1;");
    });

    it("parses a code block inside a Step into children", () => {
      const mdx = `<Steps>\n<Step title="Initialize">\nCreate a client:\n\n\`\`\`typescript\nimport { Client } from "sdk";\n\`\`\`\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      expect(step?.children).toBeDefined();
      expect(step?.children?.some((c) => c.type === "codeBlock")).toBe(true);
      const content = step?.content as Array<{ type: string; text?: string }>;
      expect(content.some((c) => c.text?.includes("Create a client"))).toBe(true);
    });

    it("parses a code block inside a Callout into children", () => {
      const mdx = `<Callout type="info">\nSee example:\n\n\`\`\`python\nprint("hello")\n\`\`\`\n</Callout>`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("callout");
      expect(blocks[0].children).toBeDefined();
      expect(blocks[0].children?.some((c) => c.type === "codeBlock")).toBe(true);
    });

    it("parses a code block inside an Accordion into children", () => {
      const mdx = `<AccordionGroup>\n<Accordion title="Show code">\nHere is the code:\n\n\`\`\`ruby\nputs "hi"\n\`\`\`\n</Accordion>\n</AccordionGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const accordion = blocks.find((b) => b.type === "accordion");
      expect(accordion).toBeDefined();
      expect(accordion?.children).toBeDefined();
      expect(accordion?.children?.some((c) => c.type === "codeBlock")).toBe(true);
    });

    it("parses a code block inside a Card into children", () => {
      const mdx = `<Card title="Example">\nSample usage:\n\n\`\`\`go\nfmt.Println("hi")\n\`\`\`\n</Card>`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("card");
      expect(blocks[0].children).toBeDefined();
      expect(blocks[0].children?.some((c) => c.type === "codeBlock")).toBe(true);
    });

    it("handles components with only inline content (no children array)", () => {
      const mdx = `<Callout type="warning">\nJust some text here.\n</Callout>`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("callout");
      const content = blocks[0].content as Array<{ type: string; text?: string }>;
      expect(content.some((c) => c.text?.includes("Just some text"))).toBe(true);
      // No children since there are no block-level nodes
      expect(blocks[0].children).toBeUndefined();
    });

    it("handles image inside a Step", () => {
      const mdx = `<Steps>\n<Step title="Result">\nYou should see:\n\n![Screenshot](https://example.com/img.png)\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      expect(step?.children).toBeDefined();
      expect(step?.children?.some((c) => c.type === "image")).toBe(true);
    });

    it("handles table inside a Tab as flat sibling", () => {
      const mdx = `<Tabs>\n<Tab title="Data">\nThe data:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      expect(tab?.children).toBeUndefined();
      const table = blocks.find((b) => b.type === "table");
      expect(table).toBeDefined();
    });
  });
});

describe("blockNoteToMDX", () => {
  it("converts a heading", () => {
    const mdx = blockNoteToMDX([
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
    ]);
    expect(mdx).toBe("## Hello\n");
  });

  it("converts a paragraph with bold text", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "bold", styles: { bold: true } },
        ],
      },
    ]);
    expect(mdx).toContain("<strong>bold</strong>");
  });

  it("converts a code block", () => {
    const mdx = blockNoteToMDX([
      { type: "codeBlock", props: { language: "typescript", code: "const x: number = 1;" } },
    ]);
    expect(mdx).toContain("```typescript");
    expect(mdx).toContain("const x: number = 1;");
    expect(mdx).toContain("```");
  });

  it("serializes a code block with title", () => {
    const mdx = blockNoteToMDX([
      { type: "codeBlock", props: { language: "java", code: "class Foo {}", title: "Foo.java" } },
    ]);
    expect(mdx).toContain("```java Foo.java");
  });

  it("serializes a code block with title and height", () => {
    const mdx = blockNoteToMDX([
      { type: "codeBlock", props: { language: "typescript", code: "const x = 1;", title: "example.ts", height: "300" } },
    ]);
    expect(mdx).toContain("```typescript example.ts {height=300}");
  });

  it("converts a callout", () => {
    const mdx = blockNoteToMDX([
      {
        type: "callout",
        props: { type: "warning", title: "Caution" },
        content: [{ type: "text", text: "Be careful" }],
      },
    ]);
    expect(mdx).toContain('<Callout type="warning" title="Caution">');
    expect(mdx).toContain("Be careful");
    expect(mdx).toContain("</Callout>");
  });

  it("converts bullet list items wrapped in <ul>", () => {
    const mdx = blockNoteToMDX([
      { type: "bulletListItem", content: [{ type: "text", text: "Item 1" }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Item 2" }] },
    ]);
    expect(mdx).toContain("<ul>");
    expect(mdx).toContain("<li>Item 1</li>");
    expect(mdx).toContain("<li>Item 2</li>");
    expect(mdx).toContain("</ul>");
  });

  it("converts a divider", () => {
    const mdx = blockNoteToMDX([{ type: "divider" }]);
    expect(mdx).toContain("<hr />");
  });

  it("converts tabs container with tab children", () => {
    const mdx = blockNoteToMDX([
      { type: "tabs", content: [] },
      { type: "tab", props: { title: "React" }, content: [{ type: "text", text: "React content" }] },
      { type: "tab", props: { title: "Vue" }, content: [{ type: "text", text: "Vue content" }] },
    ]);
    expect(mdx).toContain("<Tabs>");
    expect(mdx).toContain('<Tab title="React">');
    expect(mdx).toContain("React content");
    expect(mdx).toContain('<Tab title="Vue">');
    expect(mdx).toContain("</Tabs>");
  });

  it("converts cardGroup with cards", () => {
    const mdx = blockNoteToMDX([
      { type: "cardGroup", props: { cols: "3" }, content: [] },
      { type: "card", props: { title: "First", href: "/first" }, content: [{ type: "text", text: "Desc" }] },
    ]);
    expect(mdx).toContain("<CardGroup cols={3}>");
    expect(mdx).toContain('<Card title="First" href="/first">');
    expect(mdx).toContain("</CardGroup>");
  });

  it("converts a link", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          { type: "link", href: "https://example.com", content: [{ type: "text", text: "Click" }] },
        ],
      },
    ]);
    expect(mdx).toContain('<a href="https://example.com">Click</a>');
  });

  it("converts image with custom width using Image component", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png", alt: "My pic", previewWidth: 300 } },
    ]);
    expect(mdx).toContain('<Image src="https://img.com/pic.png"');
    expect(mdx).toContain('alt="My pic"');
    expect(mdx).toContain("width={300}");
  });

  it("converts image with default width using markdown", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png", alt: "My pic" } },
    ]);
    expect(mdx).toContain("![My pic](https://img.com/pic.png)");
  });

  it("converts image with separate alt and caption", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png", alt: "A descriptive alt", caption: "Figure 1" } },
    ]);
    expect(mdx).toContain('<Image src="https://img.com/pic.png"');
    expect(mdx).toContain('alt="A descriptive alt"');
    expect(mdx).toContain('caption="Figure 1"');
  });

  it("converts image without alt falls back to caption", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png", caption: "My caption" } },
    ]);
    // Caption triggers Image component, alt falls back to caption
    expect(mdx).toContain('<Image src="https://img.com/pic.png"');
    expect(mdx).toContain('alt="My caption"');
    expect(mdx).toContain('caption="My caption"');
  });

  it("converts image without alt or caption using default alt", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png" } },
    ]);
    expect(mdx).toContain("![Image](https://img.com/pic.png)");
  });

  it("converts a simple responseField", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "id", type: "string", required: true },
        content: [{ type: "text", text: "The unique identifier" }],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="id" type="string" required>');
    expect(mdx).toContain("The unique identifier");
    expect(mdx).toContain("</ResponseField>");
  });

  it("converts responseField with expandable children (children-based)", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "navigation", type: "Navigation[]", required: true },
        content: [{ type: "text", text: "Description text" }],
        children: [
          {
            type: "expandable",
            props: { title: "Navigation" },
            content: [],
            children: [
              {
                type: "responseField",
                props: { name: "group", type: "string" },
                content: [{ type: "text", text: "Nested description" }],
              },
            ],
          },
        ],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="navigation" type="Navigation[]" required>');
    expect(mdx).toContain("Description text");
    expect(mdx).toContain('<Expandable title="Navigation">');
    expect(mdx).toContain('<ResponseField name="group" type="string">');
    expect(mdx).toContain("Nested description");
    expect(mdx).toContain("</Expandable>");
    expect(mdx).toContain("</ResponseField>");
  });

  it("converts responseField with expandable children (legacy sibling-based)", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "navigation", type: "Navigation[]", required: true },
        content: [{ type: "text", text: "Description text" }],
      },
      {
        type: "expandable",
        props: { title: "Navigation" },
        content: [],
      },
      {
        type: "responseField",
        props: { name: "group", type: "string" },
        content: [{ type: "text", text: "Nested description" }],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="navigation" type="Navigation[]" required>');
    expect(mdx).toContain("Description text");
    expect(mdx).toContain('<Expandable title="Navigation">');
    expect(mdx).toContain('<ResponseField name="group" type="string">');
    expect(mdx).toContain("Nested description");
    expect(mdx).toContain("</Expandable>");
    expect(mdx).toContain("</ResponseField>");
  });

  it("converts a frame with image child", () => {
    const mdx = blockNoteToMDX([
      {
        type: "frame",
        props: { caption: "A beautiful scene" },
        content: [],
        children: [
          { type: "image", props: { url: "https://img.com/pic.png", caption: "Photo" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Frame caption="A beautiful scene">');
    expect(mdx).toContain("</Frame>");
    expect(mdx).toContain("pic.png");
  });

  it("converts a frame with hint and caption", () => {
    const mdx = blockNoteToMDX([
      {
        type: "frame",
        props: { hint: "Pro tip", caption: "Example" },
        content: [],
        children: [
          { type: "image", props: { url: "/img.png", caption: "Img" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Frame hint="Pro tip" caption="Example">');
    expect(mdx).toContain("</Frame>");
  });

  it("converts a frame with no props", () => {
    const mdx = blockNoteToMDX([
      {
        type: "frame",
        content: [],
        children: [
          { type: "image", props: { url: "/img.png", caption: "Img" } },
        ],
      },
    ]);
    expect(mdx).toContain("<Frame>");
    expect(mdx).toContain("</Frame>");
  });

  it("converts a LaTeX block", () => {
    const mdx = blockNoteToMDX([
      { type: "latex", props: { expression: "E = mc^2" }, content: [] },
    ]);
    expect(mdx).toContain("<Latex>");
    expect(mdx).toContain("E = mc^2");
    expect(mdx).toContain("</Latex>");
  });

  it("converts inline $$...$$ LaTeX delimiters to <Latex inline> tags", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [{ type: "text", text: "The function $$f(x) = x^2$$ is quadratic." }],
      },
    ]);
    expect(mdx).toContain("<Latex inline>f(x) = x^2</Latex>");
    expect(mdx).toContain("The function ");
    expect(mdx).toContain(" is quadratic.");
  });

  it("converts inline $...$ LaTeX delimiters to <Latex inline> tags", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Let $x$ be a variable." }],
      },
    ]);
    expect(mdx).toContain("<Latex inline>x</Latex>");
  });

  it("does not convert $...$ inside code spans", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [{ type: "text", text: "$x^2$", styles: { code: true } }],
      },
    ]);
    expect(mdx).not.toContain("<Latex>");
    expect(mdx).toContain("<code>$x^2$</code>");
  });

  it("converts columns with column blocks", () => {
    const mdx = blockNoteToMDX([
      { type: "columns", props: { cols: "2" }, content: [] },
      { type: "column", content: [{ type: "text", text: "Left side" }] },
      { type: "column", content: [{ type: "text", text: "Right side" }] },
    ]);
    expect(mdx).toContain("<Columns cols={2}>");
    expect(mdx).toContain("Left side");
    expect(mdx).toContain("Right side");
    expect(mdx).toContain("</Columns>");
  });

  it("converts columns with cols={3}", () => {
    const mdx = blockNoteToMDX([
      { type: "columns", props: { cols: "3" }, content: [] },
      { type: "column", content: [{ type: "text", text: "A" }] },
      { type: "column", content: [{ type: "text", text: "B" }] },
      { type: "column", content: [{ type: "text", text: "C" }] },
    ]);
    expect(mdx).toContain("<Columns cols={3}>");
    expect(mdx).toContain("A");
    expect(mdx).toContain("B");
    expect(mdx).toContain("C");
    expect(mdx).toContain("</Columns>");
  });

  it("converts an iframe block to MDX", () => {
    const mdx = blockNoteToMDX([
      {
        type: "iframe",
        props: {
          src: "https://youtube.com/embed/abc",
          title: "YouTube",
          width: "560",
          height: "315",
          allow: "accelerometer; autoplay",
          allowFullScreen: "true",
        },
      },
    ]);
    expect(mdx).toContain('src="https://youtube.com/embed/abc"');
    expect(mdx).toContain('title="YouTube"');
    expect(mdx).toContain('width="560"');
    expect(mdx).toContain('height="315"');
    expect(mdx).toContain('allow="accelerometer; autoplay"');
    expect(mdx).toContain("allowFullScreen");
    expect(mdx).not.toContain('allowFullScreen="true"');
    expect(mdx).toContain("</iframe>");
  });

  it("converts a video block to MDX", () => {
    const mdx = blockNoteToMDX([
      {
        type: "video",
        props: {
          src: "/demo.mp4",
          autoPlay: "true",
          muted: "true",
          loop: "true",
          playsInline: "true",
          controls: "false",
        },
      },
    ]);
    expect(mdx).toContain('src="/demo.mp4"');
    expect(mdx).toContain("autoPlay");
    expect(mdx).toContain("muted");
    expect(mdx).toContain("loop");
    expect(mdx).toContain("playsInline");
    expect(mdx).not.toContain("controls");
    expect(mdx).not.toContain('autoPlay="true"');
    expect(mdx).toContain("</video>");
  });

  it("converts inline badge to mark element", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Method: " },
          {
            type: "badge",
            props: { color: "green" },
            content: [{ type: "text", text: "POST" }],
          },
        ],
      },
    ]);
    expect(mdx).toContain('<mark style="color:green;">POST</mark>');
    expect(mdx).toContain("Method:");
  });

  it("converts inline badge without color", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          {
            type: "badge",
            props: { color: "" },
            content: [{ type: "text", text: "INFO" }],
          },
        ],
      },
    ]);
    expect(mdx).toContain("<mark>INFO</mark>");
    expect(mdx).not.toContain("style");
  });

  it("converts inline icon to Icon element", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Flag: " },
          {
            type: "icon",
            props: { icon: "flag", size: "32" },
          },
        ],
      },
    ]);
    expect(mdx).toContain('<Icon icon="flag" size={32} />');
  });

  it("converts inline icon without size", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          {
            type: "icon",
            props: { icon: "star" },
          },
        ],
      },
    ]);
    expect(mdx).toContain('<Icon icon="star" />');
    expect(mdx).not.toContain("size");
  });

  it("converts a step with block children", () => {
    const mdx = blockNoteToMDX([
      { type: "steps", content: [] },
      {
        type: "step",
        props: { title: "Install" },
        content: [{ type: "text", text: "Run this:" }],
        children: [
          { type: "codeBlock", props: { language: "bash", code: "npm install" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Step title="Install">');
    expect(mdx).toContain("Run this:");
    expect(mdx).toContain("```bash");
    expect(mdx).toContain("npm install");
    expect(mdx).toContain("</Step>");
  });

  it("converts a tab with block children (backward compat)", () => {
    const mdx = blockNoteToMDX([
      { type: "tabs", content: [] },
      {
        type: "tab",
        props: { title: "JS" },
        content: [{ type: "text", text: "Example:" }],
        children: [
          { type: "codeBlock", props: { language: "javascript", code: "const x = 1;" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Tab title="JS">');
    expect(mdx).toContain("Example:");
    expect(mdx).toContain("```javascript");
    expect(mdx).toContain("const x = 1;");
    expect(mdx).toContain("</Tab>");
  });

  it("converts a tab with flat sibling block children", () => {
    const mdx = blockNoteToMDX([
      { type: "tabs", content: [] },
      {
        type: "tab",
        props: { title: "Example" },
        content: [{ type: "text", text: "Some text" }],
      },
      { type: "codeBlock", props: { language: "json", code: '{ "key": "value" }' } },
    ]);
    expect(mdx).toContain('<Tab title="Example">');
    expect(mdx).toContain("Some text");
    expect(mdx).toContain("```json");
    expect(mdx).toContain('{ "key": "value" }');
    expect(mdx).toContain("</Tab>");
    expect(mdx).toContain("</Tabs>");
  });

  it("converts a callout with block children", () => {
    const mdx = blockNoteToMDX([
      {
        type: "callout",
        props: { type: "info" },
        content: [{ type: "text", text: "See below:" }],
        children: [
          { type: "codeBlock", props: { language: "python", code: "print('hi')" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Callout type="info">');
    expect(mdx).toContain("See below:");
    expect(mdx).toContain("```python");
    expect(mdx).toContain("</Callout>");
  });

  it("converts a card with block children", () => {
    const mdx = blockNoteToMDX([
      {
        type: "cardGroup",
        props: { cols: "2" },
        content: [],
      },
      {
        type: "card",
        props: { title: "Setup" },
        content: [{ type: "text", text: "Follow these steps:" }],
        children: [
          { type: "codeBlock", props: { language: "bash", code: "npm init" } },
        ],
      },
    ]);
    expect(mdx).toContain('<Card title="Setup">');
    expect(mdx).toContain("Follow these steps:");
    expect(mdx).toContain("```bash");
    expect(mdx).toContain("npm init");
    expect(mdx).toContain("</Card>");
  });

  it("converts an accordion with block children", () => {
    const mdx = blockNoteToMDX([
      {
        type: "accordionGroup",
        content: [],
      },
      {
        type: "accordion",
        props: { title: "Details" },
        content: [{ type: "text", text: "More info:" }],
        children: [
          { type: "codeBlock", props: { language: "json", code: '{ "key": "value" }' } },
        ],
      },
    ]);
    expect(mdx).toContain('<Accordion title="Details">');
    expect(mdx).toContain("More info:");
    expect(mdx).toContain("```json");
    expect(mdx).toContain('{ "key": "value" }');
    expect(mdx).toContain("</Accordion>");
  });

  it("converts responseField with string 'true' required prop (editor format)", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "id", type: "string", required: "true" },
        content: [{ type: "text", text: "The unique identifier" }],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="id" type="string" required>');
  });

  it("converts responseField with string 'false' required prop without required attr", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "id", type: "string", required: "false" },
        content: [{ type: "text", text: "The unique identifier" }],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="id" type="string">');
    expect(mdx).not.toContain("required");
  });

  it("converts responseField with boolean false required prop without required attr", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "id", type: "string", required: false },
        content: [{ type: "text", text: "The unique identifier" }],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="id" type="string">');
    expect(mdx).not.toContain("required");
  });

  it("converts empty responseField as self-closing", () => {
    const mdx = blockNoteToMDX([
      {
        type: "responseField",
        props: { name: "id", type: "string" },
        content: [],
      },
    ]);
    expect(mdx).toContain('<ResponseField name="id" type="string" />');
  });
});

describe("round-trip: MDX → BlockNote → MDX", () => {
  const testCases = [
    {
      name: "heading",
      mdx: "## Getting Started",
    },
    {
      name: "paragraph with bold",
      mdx: "Hello <strong>world</strong>",
    },
    {
      name: "code block",
      mdx: "```typescript\nconst x = 1;\n```",
    },
    {
      name: "callout",
      mdx: `<Callout type="info">\nSome info here\n</Callout>`,
    },
    {
      name: "divider",
      mdx: "<hr />",
    },
    {
      name: "steps with step children",
      mdx: `<Steps>\n<Step title="First">\nDo the first thing.\n</Step>\n<Step title="Second">\nDo the second thing.\n</Step>\n</Steps>`,
    },
    {
      name: "accordion group",
      mdx: `<AccordionGroup>\n<Accordion title="Question 1">\nAnswer 1.\n</Accordion>\n</AccordionGroup>`,
    },
    {
      name: "simple responseField",
      mdx: `<ResponseField name="id" type="string" required>\nThe unique identifier.\n</ResponseField>`,
    },
    {
      name: "frame with image",
      mdx: `<Frame caption="A beautiful park">\n\n![Yosemite](https://example.com/yosemite.png)\n\n</Frame>`,
    },
    {
      name: "frame with hint and caption",
      mdx: `<Frame hint="Plan ahead" caption="Visit info">\n\n![Park](https://example.com/park.png)\n\n</Frame>`,
    },
    {
      name: "responseField with expandable",
      mdx: `<ResponseField name="navigation" type="Navigation[]" required>\nDescription text here\n<Expandable title="Navigation">\n<ResponseField name="group" type="string">\nNested description\n</ResponseField>\n</Expandable>\n</ResponseField>`,
    },
    {
      name: "tab with code block child",
      mdx: `<Tabs>\n<Tab title="Example">\nSome text\n\n\`\`\`json\n{ "key": "value" }\n\`\`\`\n\n</Tab>\n</Tabs>`,
    },
    {
      name: "step with code block child",
      mdx: `<Steps>\n<Step title="Install">\nRun this:\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n</Step>\n</Steps>`,
    },
    {
      name: "callout with code block child",
      mdx: `<Callout type="warning">\nImportant:\n\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n\n</Callout>`,
    },
    {
      name: "accordion with code block child",
      mdx: `<AccordionGroup>\n<Accordion title="Show code">\nHere is the code:\n\n\`\`\`python\nprint("hello")\n\`\`\`\n\n</Accordion>\n</AccordionGroup>`,
    },
    {
      name: "columns with cards (backward-compatible cardGroup)",
      mdx: `<Columns cols={2}>\n<Card title="A">\nDesc A\n</Card>\n<Card title="B">\nDesc B\n</Card>\n</Columns>`,
    },
    {
      name: "latex block",
      mdx: `<Latex>\nE = mc^2\n</Latex>`,
    },
    {
      name: "inline badge",
      mdx: `This is <mark style="color:green;">POST</mark> method`,
    },
    {
      name: "inline icon",
      mdx: `Text with <Icon icon="flag" size={32} /> here`,
    },
  ];

  for (const { name, mdx } of testCases) {
    it(`round-trips: ${name}`, () => {
      const blocks = mdxToBlockNote(mdx);
      expect(blocks.length).toBeGreaterThan(0);
      const output = blockNoteToMDX(blocks);
      // Re-parse the output and verify we get the same blocks
      const blocks2 = mdxToBlockNote(output);
      expect(blocks2.length).toBe(blocks.length);
      expect(blocks2[0].type).toBe(blocks[0].type);
    });
  }

  it("round-trips iframe with all props preserved", () => {
    const blocks = [
      {
        type: "iframe",
        props: {
          src: "https://youtube.com/embed/abc",
          title: "YouTube",
          width: "560",
          height: "315",
          allow: "accelerometer; autoplay",
          allowFullScreen: "true",
        },
      },
    ];
    const mdx = blockNoteToMDX(blocks);
    const parsed = mdxToBlockNote(mdx);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("iframe");
    expect(parsed[0].props?.src).toBe("https://youtube.com/embed/abc");
    expect(parsed[0].props?.title).toBe("YouTube");
    expect(parsed[0].props?.width).toBe("560");
    expect(parsed[0].props?.height).toBe("315");
    expect(parsed[0].props?.allow).toBe("accelerometer; autoplay");
    expect(parsed[0].props?.allowFullScreen).toBe("true");
  });

  it("round-trips video with boolean props preserved", () => {
    const blocks = [
      {
        type: "video",
        props: {
          src: "/demo.mp4",
          autoPlay: "true",
          muted: "true",
          loop: "true",
          playsInline: "true",
          controls: "false",
        },
      },
    ];
    const mdx = blockNoteToMDX(blocks);
    const parsed = mdxToBlockNote(mdx);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("video");
    expect(parsed[0].props?.src).toBe("/demo.mp4");
    expect(parsed[0].props?.autoPlay).toBe("true");
    expect(parsed[0].props?.muted).toBe("true");
    expect(parsed[0].props?.loop).toBe("true");
    expect(parsed[0].props?.playsInline).toBe("true");
    expect(parsed[0].props?.controls).toBe("false");
  });

  it("round-trips ordered list with block content", () => {
    const input = "1. Step one:\n\n   ```bash\n   npm install\n   ```\n\n1. Step two:\n\n   ```bash\n   npm start\n   ```\n";
    const blocks = mdxToBlockNote(input);
    const output = blockNoteToMDX(blocks);
    // Both items should be numbered list items
    const numberedItems = blocks.filter(b => b.type === "numberedListItem");
    expect(numberedItems).toHaveLength(2);
    // Each should have a code block child
    for (const item of numberedItems) {
      if (item.children) {
        expect(item.children.some(c => c.type === "codeBlock")).toBe(true);
      }
    }
    // Re-parse should produce same structure
    const blocks2 = mdxToBlockNote(output);
    const numberedItems2 = blocks2.filter(b => b.type === "numberedListItem");
    expect(numberedItems2).toHaveLength(2);
  });

  it("round-trips code block with title", () => {
    const input = "```java HelloWorld.java\nclass HelloWorld {}\n```";
    const blocks = mdxToBlockNote(input);
    const output = blockNoteToMDX(blocks);
    expect(output.trim()).toBe(input);
  });

  it("parses simple blockquote to quote block", () => {
    const blocks = mdxToBlockNote("> hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    expect(blocks[0].content).toEqual([
      { type: "text", text: "hello world" },
    ]);
  });

  it("round-trips simple blockquote", () => {
    const input = "> hello world";
    const blocks = mdxToBlockNote(input);
    const output = blockNoteToMDX(blocks);
    expect(output.trim()).toBe(input);
  });

  it("round-trips multi-line blockquote", () => {
    const input = "> first paragraph\n> \n> second paragraph";
    const blocks = mdxToBlockNote(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    // First paragraph is the quote content, second is a child
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!.length).toBeGreaterThan(0);
  });

  it("parses nested blockquote", () => {
    const blocks = mdxToBlockNote("> > deeply nested");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    // The nested blockquote should be a child quote block
    expect(blocks[0].children).toBeDefined();
    const nestedQuote = blocks[0].children!.find(
      (c) => c.type === "quote"
    );
    expect(nestedQuote).toBeDefined();
  });

  it("round-trips blockquote with inline formatting", () => {
    const input = "> **bold** and *italic*";
    const blocks = mdxToBlockNote(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    const content = blocks[0].content as Array<{
      type: string;
      text?: string;
      styles?: Record<string, boolean>;
    }>;
    expect(content.some((c) => c.styles?.bold)).toBe(true);
    expect(content.some((c) => c.styles?.italic)).toBe(true);
    // Verify roundtrip
    const output = blockNoteToMDX(blocks);
    const blocks2 = mdxToBlockNote(output);
    expect(blocks2[0].type).toBe("quote");
  });
});
