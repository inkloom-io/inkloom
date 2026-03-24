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

  it("parses Tabs with nested blocks in tab children", () => {
    const mdx = `<Tabs>\n<Tab title="Example">\nSome text\n\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n</Tab>\n<Tab title="Other">\nOther content\n</Tab>\n</Tabs>`;
    const blocks = mdxToBlockNote(mdx);
    // Should be: [tabs, tab("Example" with codeBlock child), tab("Other")]
    expect(blocks[0].type).toBe("tabs");
    expect(blocks[1].type).toBe("tab");
    expect(blocks[1].props?.title).toBe("Example");
    // With mixed content, the first paragraph is promoted to inline content
    // so the editor doesn't show a spurious empty line at the start
    const tabContent = blocks[1].content as Array<{ type: string; text?: string }>;
    expect(tabContent.some((c) => c.text?.includes("Some text"))).toBe(true);
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children?.some((c) => c.type === "codeBlock")).toBe(true);
    const codeChild = blocks[1].children?.find((c) => c.type === "codeBlock");
    expect(codeChild?.props?.language).toBe("javascript");
    expect(codeChild?.props?.code).toBe("const x = 1;");
    // Second tab follows directly (no interleaved siblings)
    expect(blocks[2].type).toBe("tab");
    expect(blocks[2].props?.title).toBe("Other");
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

  it("parses inline (text-element) Steps with Step children", () => {
    // When JSX children appear without blank lines, remark-mdx may wrap them
    // as mdxJsxTextElement inside a paragraph instead of mdxJsxFlowElement
    const mdx = `<Steps>\n<Step title="Install">Run install.</Step>\n<Step title="Configure">Edit config.</Step>\n</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("steps");
    expect(blocks[1].type).toBe("step");
    expect(blocks[1].props?.title).toBe("Install");
    expect(blocks[2].type).toBe("step");
    expect(blocks[2].props?.title).toBe("Configure");
  });

  it("parses inline (text-element) AccordionGroup with Accordion children", () => {
    const mdx = `<AccordionGroup>\n<Accordion title="FAQ 1">Answer 1.</Accordion>\n<Accordion title="FAQ 2">Answer 2.</Accordion>\n</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("accordionGroup");
    expect(blocks[1].type).toBe("accordion");
    expect(blocks[1].props?.title).toBe("FAQ 1");
    expect(blocks[2].type).toBe("accordion");
    expect(blocks[2].props?.title).toBe("FAQ 2");
  });

  it("parses inline (text-element) CardGroup with Card children", () => {
    const mdx = `<CardGroup cols={2}>\n<Card title="First" href="/first">Desc</Card>\n<Card title="Second">Desc 2</Card>\n</CardGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("cardGroup");
    expect(blocks[1].type).toBe("card");
    expect(blocks[1].props?.title).toBe("First");
    expect(blocks[2].type).toBe("card");
    expect(blocks[2].props?.title).toBe("Second");
  });

  it("parses inline (text-element) Tabs with Tab children", () => {
    const mdx = `<Tabs>\n<Tab title="JS">JavaScript code.</Tab>\n<Tab title="PY">Python code.</Tab>\n</Tabs>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("tabs");
    expect(blocks[1].type).toBe("tab");
    expect(blocks[1].props?.title).toBe("JS");
    expect(blocks[2].type).toBe("tab");
    expect(blocks[2].props?.title).toBe("PY");
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

  it("parses CodeGroup with JSON braces without backslash-escaping (round-trip)", () => {
    const mdx = `<CodeGroup>
\`\`\`json title="200"
{
  "id": 1,
  "name": "John",
  "age": 30
}
\`\`\`

\`\`\`json title="400"
{
  "error": "Invalid request"
}
\`\`\`
</CodeGroup>`;
    // Parse MDX → BlockNote
    const blocks = mdxToBlockNote(mdx);
    // Serialize BlockNote → MDX
    const serialized = blockNoteToMDX(blocks);
    // Re-parse MDX → BlockNote
    const blocks2 = mdxToBlockNote(serialized);
    // Check that code content is preserved without backslash-escaping
    const codeBlocks2 = blocks2.filter((b) => b.type === "codeBlock");
    expect(codeBlocks2).toHaveLength(2);
    expect(codeBlocks2[0].props?.code).not.toContain("\\{");
    expect(codeBlocks2[0].props?.code).not.toContain("\\}");
    expect(codeBlocks2[0].props?.code).toContain('"id": 1');
    expect(codeBlocks2[1].props?.code).not.toContain("\\{");
    expect(codeBlocks2[1].props?.code).not.toContain("\\}");
    expect(codeBlocks2[1].props?.code).toContain('"error": "Invalid request"');
  });

  it("unescapes backslash-escaped braces in CodeGroup code blocks", () => {
    // Content that was previously stored with escaped braces
    // due to the sanitize-mdx bug should be unescaped during parsing
    const mdx = `<CodeGroup>
\`\`\`json title="200"
\\{
  "id": 1
\\}
\`\`\`

\`\`\`json title="400"
\\{
  "error": "Invalid request"
\\}
\`\`\`
</CodeGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const codeBlocks = blocks.filter((b) => b.type === "codeBlock");
    expect(codeBlocks).toHaveLength(2);
    expect(codeBlocks[0].props?.code).toBe('{\n  "id": 1\n}');
    expect(codeBlocks[1].props?.code).toBe('{\n  "error": "Invalid request"\n}');
  });

  it("parses CodeGroup with titled code blocks from meta", () => {
    const mdx = `<CodeGroup>\n\`\`\`json title="200"\n{ "ok": true }\n\`\`\`\n\`\`\`json title="400"\n{ "error": "bad" }\n\`\`\`\n</CodeGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("codeGroup");
    expect(blocks[1].type).toBe("codeBlock");
    expect(blocks[1].props?.language).toBe("json");
    expect(blocks[1].props?.title).toBe("200");
    expect(blocks[2].type).toBe("codeBlock");
    expect(blocks[2].props?.language).toBe("json");
    expect(blocks[2].props?.title).toBe("400");
  });

  it("parses CodeGroup with height in code block meta", () => {
    const mdx = `<CodeGroup>\n\`\`\`python title="Example" {height=500}\nprint("hi")\n\`\`\`\n</CodeGroup>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[1].type).toBe("codeBlock");
    expect(blocks[1].props?.title).toBe("Example");
    expect(blocks[1].props?.height).toBe("500");
  });

  it("parses CodeGroup inside a Step — siblings stay grouped", () => {
    const mdx = `<Steps>
<Step title="Install">
<CodeGroup>
\`\`\`bash npm
npm install foo
\`\`\`
\`\`\`bash yarn
yarn add foo
\`\`\`
\`\`\`bash pnpm
pnpm add foo
\`\`\`
</CodeGroup>
</Step>
</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    // Top-level: steps container + step sibling
    expect(blocks[0].type).toBe("steps");
    expect(blocks[1].type).toBe("step");
    expect(blocks[1].props?.title).toBe("Install");
    // Step's children should contain codeGroup + 3 codeBlock siblings
    const stepChildren = blocks[1].children as Array<{ type: string; props?: Record<string, unknown> }>;
    expect(stepChildren).toBeDefined();
    expect(stepChildren.length).toBeGreaterThanOrEqual(4);
    expect(stepChildren[0].type).toBe("codeGroup");
    expect(stepChildren[1].type).toBe("codeBlock");
    expect(stepChildren[1].props?.language).toBe("bash");
    expect(stepChildren[2].type).toBe("codeBlock");
    expect(stepChildren[3].type).toBe("codeBlock");
  });

  it("round-trips CodeGroup inside a Step", () => {
    const mdx = `<Steps>
<Step title="Install">
<CodeGroup>
\`\`\`bash npm
npm install foo
\`\`\`
\`\`\`bash yarn
yarn add foo
\`\`\`
\`\`\`bash pnpm
pnpm add foo
\`\`\`
</CodeGroup>
</Step>
</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    const serialized = blockNoteToMDX(blocks);
    // The serialized MDX should contain <CodeGroup> inside the <Step>
    expect(serialized).toContain("<CodeGroup>");
    expect(serialized).toContain("</CodeGroup>");
    // Code blocks should be inside the CodeGroup, not standalone
    const codeGroupStart = serialized.indexOf("<CodeGroup>");
    const codeGroupEnd = serialized.indexOf("</CodeGroup>");
    const codeGroupContent = serialized.slice(codeGroupStart, codeGroupEnd);
    expect(codeGroupContent).toContain("```bash npm");
    expect(codeGroupContent).toContain("```bash yarn");
    expect(codeGroupContent).toContain("```bash pnpm");
  });

  it("round-trips CodeGroup inside an Accordion", () => {
    const mdx = `<AccordionGroup>
<Accordion title="Setup">
<CodeGroup>
\`\`\`bash npm
npm install bar
\`\`\`
\`\`\`bash yarn
yarn add bar
\`\`\`
</CodeGroup>
</Accordion>
</AccordionGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const serialized = blockNoteToMDX(blocks);
    expect(serialized).toContain("<CodeGroup>");
    expect(serialized).toContain("</CodeGroup>");
    // Re-parse and verify structure is preserved
    const blocks2 = mdxToBlockNote(serialized);
    const accordion = blocks2.find(b => b.type === "accordion");
    expect(accordion).toBeDefined();
    const accChildren = accordion?.children as Array<{ type: string }> | undefined;
    expect(accChildren).toBeDefined();
    const codeGroupInAcc = accChildren?.find(c => c.type === "codeGroup");
    expect(codeGroupInAcc).toBeDefined();
    const codeBlocksInAcc = accChildren?.filter(c => c.type === "codeBlock");
    expect(codeBlocksInAcc?.length).toBe(2);
  });

  it("top-level CodeGroup still works (no regression)", () => {
    const mdx = `<CodeGroup>
\`\`\`javascript
const x = 1;
\`\`\`
\`\`\`python
x = 1
\`\`\`
</CodeGroup>`;
    const blocks = mdxToBlockNote(mdx);
    const serialized = blockNoteToMDX(blocks);
    expect(serialized).toContain("<CodeGroup>");
    expect(serialized).toContain("</CodeGroup>");
    // Re-parse and verify
    const blocks2 = mdxToBlockNote(serialized);
    expect(blocks2[0].type).toBe("codeGroup");
    expect(blocks2[1].type).toBe("codeBlock");
    expect(blocks2[2].type).toBe("codeBlock");
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
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("Yosemite National Park");
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children?.length).toBeGreaterThan(0);
  });

  it("parses Frame with hint prop", () => {
    const mdx = `<Frame hint="Important context">\n<img src="/images/photo.png" alt="Photo" />\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.hint).toBe("Important context");
    expect(blocks[1].type).toBe("frameContent");
  });

  it("parses Frame with both hint and caption", () => {
    const mdx = `<Frame hint="Plan ahead" caption="A beautiful park">\n<img src="/images/park.png" alt="Park" />\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.hint).toBe("Plan ahead");
    expect(blocks[0].props?.caption).toBe("A beautiful park");
    expect(blocks[1].type).toBe("frameContent");
  });

  it("parses Frame with code block child", () => {
    const mdx = '<Frame caption="Example code">\n\n```javascript\nconst x = 1;\n```\n\n</Frame>';
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children?.some((c) => c.type === "codeBlock")).toBe(true);
  });

  it("parses HTML figure with img and figcaption into frame with nested image (inline)", () => {
    const mdx = `<figure><img src=".gitbook/assets/screenshot.png" alt="image alt" /><figcaption><p>image caption</p></figcaption></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("image caption");
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children!.length).toBe(1);
    expect(blocks[1].children![0].type).toBe("image");
    expect(blocks[1].children![0].props?.url).toBe(".gitbook/assets/screenshot.png");
    expect(blocks[1].children![0].props?.alt).toBe("image alt");
  });

  it("parses HTML figure with img and figcaption into frame with nested image (flow)", () => {
    const mdx = `<figure>\n<img src=".gitbook/assets/screenshot.png" alt="image alt" />\n<figcaption>\n<p>image caption</p>\n</figcaption>\n</figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("image caption");
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children!.length).toBe(1);
    expect(blocks[1].children![0].type).toBe("image");
    expect(blocks[1].children![0].props?.url).toBe(".gitbook/assets/screenshot.png");
    expect(blocks[1].children![0].props?.alt).toBe("image alt");
  });

  it("parses figure without figcaption", () => {
    const mdx = `<figure><img src="photo.png" alt="A photo" /></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBeUndefined();
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children!.length).toBe(1);
    expect(blocks[1].children![0].type).toBe("image");
    expect(blocks[1].children![0].props?.url).toBe("photo.png");
  });

  it("parses figure without img", () => {
    const mdx = `<figure><figcaption><p>caption only</p></figcaption></figure>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("caption only");
    // No image means no frameContent sibling is created
  });

  it("parses Frame with image child inside a Step block", () => {
    const mdx = `<Steps>\n<Step title="Upload">\n\n<Frame caption="Screenshot">\n<img src="/images/test.png" alt="Test" />\n</Frame>\n\n</Step>\n</Steps>`;
    const blocks = mdxToBlockNote(mdx);
    // Top level: steps, step
    expect(blocks[0].type).toBe("steps");
    expect(blocks[1].type).toBe("step");
    expect(blocks[1].props?.title).toBe("Upload");
    // Step's children should contain frame + frameContent as siblings
    const children = blocks[1].children;
    expect(children).toBeDefined();
    expect(children!.length).toBe(2);
    expect(children![0].type).toBe("frame");
    expect(children![0].props?.caption).toBe("Screenshot");
    expect(children![1].type).toBe("frameContent");
    expect(children![1].children).toBeDefined();
    expect(children![1].children!.length).toBe(1);
    expect(children![1].children![0].type).toBe("image");
    expect(children![1].children![0].props?.url).toBe("/images/test.png");
  });

  it("parses Frame with multiple children", () => {
    const mdx = `<Frame caption="Multi">\n<img src="/a.png" alt="A" />\n\nSome text here\n</Frame>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("frame");
    expect(blocks[0].props?.caption).toBe("Multi");
    expect(blocks[1].type).toBe("frameContent");
    expect(blocks[1].children).toBeDefined();
    expect(blocks[1].children!.length).toBeGreaterThanOrEqual(1);
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

  it("parses inline mark as badge style", () => {
    const blocks = mdxToBlockNote('This is <mark style="color:green;">POST</mark> method');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    const content = blocks[0].content as Array<{ type: string; text?: string; styles?: Record<string, unknown> }>;
    const badgeItem = content.find((c) => c.type === "text" && c.styles?.badge);
    expect(badgeItem).toBeDefined();
    if (badgeItem) {
      expect(badgeItem.styles?.badge).toBe("green");
      expect(badgeItem.text).toBe("POST");
    }
  });

  it("parses inline mark without style as badge with default color", () => {
    const blocks = mdxToBlockNote("Use <mark>IMPORTANT</mark> here");
    expect(blocks).toHaveLength(1);
    const content = blocks[0].content as Array<{ type: string; text?: string; styles?: Record<string, unknown> }>;
    const badgeItem = content.find((c) => c.type === "text" && c.styles?.badge);
    expect(badgeItem).toBeDefined();
    if (badgeItem) {
      expect(badgeItem.styles?.badge).toBe("#6b7280");
      expect(badgeItem.text).toBe("IMPORTANT");
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
    it("parses a code block inside a Tab into children", () => {
      const mdx = `<Tabs>\n<Tab title="Example">\nSome intro text:\n\n\`\`\`javascript\nconst x = 1;\n\`\`\`\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      // First paragraph is promoted to inline content to avoid empty line
      const tabContent = tab?.content as Array<{ type: string; text?: string }>;
      expect(tabContent.some((c) => c.text?.includes("intro text"))).toBe(true);
      // Code block should be nested in children
      expect(tab?.children).toBeDefined();
      expect(tab?.children?.some((c) => c.type === "codeBlock")).toBe(true);
      const codeChild = tab?.children?.find((c) => c.type === "codeBlock");
      expect(codeChild?.props?.language).toBe("javascript");
      expect(codeChild?.props?.code).toBe("const x = 1;");
    });

    it("parses a code block inside a Step into children", () => {
      const mdx = `<Steps>\n<Step title="Initialize">\nCreate a client:\n\n\`\`\`typescript\nimport { Client } from "sdk";\n\`\`\`\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      // First paragraph is promoted to inline content
      const stepContent = step?.content as Array<{ type: string; text?: string }>;
      expect(stepContent.some((c) => c.text?.includes("Create a client"))).toBe(true);
      expect(step?.children).toBeDefined();
      expect(step?.children?.some((c) => c.type === "codeBlock")).toBe(true);
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

    it("handles table inside a Tab in children", () => {
      const mdx = `<Tabs>\n<Tab title="Data">\nThe data:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      // Table should be nested in children
      expect(tab?.children).toBeDefined();
      expect(tab?.children?.some((c) => c.type === "table")).toBe(true);
    });

    it("preserves paragraph → list → paragraph ordering in Step", () => {
      const mdx = `<Steps>\n<Step title="Create a new project">\nClick **Create Project**. You'll be prompted to:\n\n- **Name your project** — this also sets your default URL\n- **Choose a template** — pick a starter template\n\nTemplates include API documentation, developer guides, and product docs layouts.\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      // First paragraph is promoted to inline content
      const stepContent = step?.content as Array<{ type: string; text?: string }>;
      expect(stepContent.some((c) => c.text?.includes("Create Project"))).toBe(true);
      expect(step?.children).toBeDefined();
      const children = step?.children || [];
      // Should have: bulletListItem, bulletListItem, paragraph — in that order
      // (first paragraph promoted to inline content)
      expect(children.length).toBeGreaterThanOrEqual(3);
      expect(children[0].type).toBe("bulletListItem");
      expect(children[1].type).toBe("bulletListItem");
      const lastChild = children[children.length - 1];
      expect(lastChild.type).toBe("paragraph");
      const lastParaContent = lastChild.content as Array<{ type: string; text?: string }>;
      expect(lastParaContent.some((c) => c.text?.includes("Templates include"))).toBe(true);
    });

    it("preserves paragraph → list → paragraph ordering in Accordion", () => {
      const mdx = `<AccordionGroup>\n<Accordion title="Details">\nPages have:\n\n- Title\n- Description\n\nThese are required fields.\n</Accordion>\n</AccordionGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const accordion = blocks.find((b) => b.type === "accordion");
      expect(accordion).toBeDefined();
      // First paragraph is promoted to inline content
      const accContent = accordion?.content as Array<{ type: string; text?: string }>;
      expect(accContent.some((c) => c.text?.includes("Pages have"))).toBe(true);
      expect(accordion?.children).toBeDefined();
      const children = accordion?.children || [];
      // Should have: bulletListItem, bulletListItem, paragraph — in that order
      // (first paragraph promoted to inline content)
      expect(children.length).toBeGreaterThanOrEqual(3);
      expect(children[0].type).toBe("bulletListItem");
      expect(children[1].type).toBe("bulletListItem");
      const lastChild = children[children.length - 1];
      expect(lastChild.type).toBe("paragraph");
      const lastParaContent = lastChild.content as Array<{ type: string; text?: string }>;
      expect(lastParaContent.some((c) => c.text?.includes("required fields"))).toBe(true);
    });

    it("preserves ordering with multiple block types in nested containers", () => {
      const mdx = `<Steps>\n<Step title="Setup">\nFirst do this:\n\n\`\`\`bash\nnpm install\n\`\`\`\n\nThen check:\n\n- Item A\n- Item B\n\nAll done.\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      // First paragraph is promoted to inline content
      const stepContent = step?.content as Array<{ type: string; text?: string }>;
      expect(stepContent.some((c) => c.text?.includes("First do this"))).toBe(true);
      expect(step?.children).toBeDefined();
      const children = step?.children || [];
      // Should preserve: codeBlock, paragraph, bulletListItem, bulletListItem, paragraph
      // (first paragraph promoted to inline content)
      const types = children.map((c) => c.type);
      expect(types[0]).toBe("codeBlock");
      expect(types[1]).toBe("paragraph");
      expect(types[2]).toBe("bulletListItem");
      expect(types[3]).toBe("bulletListItem");
      expect(types[types.length - 1]).toBe("paragraph");
    });
  });

  describe("content after tabs is not absorbed (regression)", () => {
    it("content after Tabs block remains independent", () => {
      const mdx = `<Tabs>\n<Tab title="Tab 1">\nFirst tab content\n</Tab>\n<Tab title="Tab 2">\nSecond tab content\n</Tab>\n</Tabs>\n\n## Next Section\n\nSome paragraph after tabs.`;
      const blocks = mdxToBlockNote(mdx);
      // Tabs and tab blocks come first
      expect(blocks[0].type).toBe("tabs");
      expect(blocks[1].type).toBe("tab");
      expect(blocks[1].props?.title).toBe("Tab 1");
      expect(blocks[2].type).toBe("tab");
      expect(blocks[2].props?.title).toBe("Tab 2");
      // Content after tabs should NOT be inside the last tab
      const heading = blocks.find((b) => b.type === "heading");
      expect(heading).toBeDefined();
      // Heading should be a top-level block, not inside a tab's children
      const lastTab = blocks[2];
      const headingInChildren = lastTab.children?.some((c) => c.type === "heading");
      expect(headingInChildren).toBeFalsy();
    });

    it("multiple container blocks in sequence remain independent", () => {
      const mdx = `<Tabs>\n<Tab title="A">\nTab A\n</Tab>\n</Tabs>\n\n<AccordionGroup>\n<Accordion title="FAQ">\nAnswer\n</Accordion>\n</AccordionGroup>\n\n<Columns cols={2}>\n<Column>\nCol 1\n</Column>\n<Column>\nCol 2\n</Column>\n</Columns>`;
      const blocks = mdxToBlockNote(mdx);
      const types = blocks.map((b) => b.type);
      // All three container types should appear as independent top-level blocks
      expect(types).toContain("tabs");
      expect(types).toContain("accordionGroup");
      expect(types).toContain("columns");
      // Accordion and columns should NOT be inside a tab's children
      const tabIndex = types.indexOf("tab");
      const tab = blocks[tabIndex];
      expect(tab?.children?.some((c) => c.type === "accordionGroup" || c.type === "columns")).toBeFalsy();
    });

    it("content inside a tab via children still renders inside the tab", () => {
      const mdx = `<Tabs>\n<Tab title="Code">\nHere is code:\n\n\`\`\`python\nprint("hi")\n\`\`\`\n</Tab>\n</Tabs>\n\n## After Tabs`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      // Code block should be inside the tab's children
      expect(tab?.children).toBeDefined();
      expect(tab?.children?.some((c) => c.type === "codeBlock")).toBe(true);
      // Heading after tabs should be independent
      const heading = blocks.find((b) => b.type === "heading");
      expect(heading).toBeDefined();
      expect(tab?.children?.some((c) => c.type === "heading")).toBeFalsy();
    });

    it("two paragraphs in a Tab produce separate paragraph blocks", () => {
      const mdx = `<Tabs>\n<Tab title="Info">\nFirst paragraph text.\n\nSecond paragraph text.\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("tabs");
      const tab = blocks[1];
      expect(tab.type).toBe("tab");
      expect(tab.props?.title).toBe("Info");
      // First paragraph should be in content
      const content = tab.content as Array<{ type: string; text?: string }>;
      expect(content.some((c) => c.text === "First paragraph text.")).toBe(true);
      // Second paragraph should be a child block, not merged into content
      expect(tab.children).toBeDefined();
      expect(tab.children?.length).toBeGreaterThanOrEqual(1);
      const secondPara = tab.children?.find(
        (c) => c.type === "paragraph" && (c.content as Array<{ type: string; text?: string }>)?.some((ic) => ic.text === "Second paragraph text.")
      );
      expect(secondPara).toBeDefined();
    });

    it("inline-format Tab elements are detected inside Tabs", () => {
      const mdx = `<Tabs>\n  <Tab title="Tab 1">Content 1</Tab>\n  <Tab title="Tab 2">Content 2</Tab>\n</Tabs>\n\n## After Tabs`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("tabs");
      expect(blocks[1].type).toBe("tab");
      expect(blocks[1].props?.title).toBe("Tab 1");
      expect(blocks[2].type).toBe("tab");
      expect(blocks[2].props?.title).toBe("Tab 2");
      // Heading should be a top-level sibling, not inside tabs
      const heading = blocks.find((b) => b.type === "heading");
      expect(heading).toBeDefined();
      expect(blocks[2].children?.some((c) => c.type === "heading")).toBeFalsy();
    });

    it("round-trip: 3 tabs followed by heading and bullets keeps content outside Tabs", () => {
      const mdx = [
        "<Tabs>",
        '<Tab title="Simple Workflow">',
        "Simple content",
        "</Tab>",
        "",
        '<Tab title="Staging Workflow">',
        "Staging content",
        "</Tab>",
        "",
        '<Tab title="Branch Workflow">',
        "Branch content",
        "</Tab>",
        "</Tabs>",
        "",
        "## Best Practices",
        "",
        "- Preview before production",
        "- Batch related changes",
      ].join("\n");
      const blocks = mdxToBlockNote(mdx);
      const output = blockNoteToMDX(blocks);
      const tabsCloseIndex = output.indexOf("</Tabs>");
      const bestPracticesIndex = output.indexOf("Best Practices");
      expect(tabsCloseIndex).toBeGreaterThan(-1);
      expect(bestPracticesIndex).toBeGreaterThan(-1);
      // Best Practices heading must appear AFTER </Tabs>
      expect(bestPracticesIndex).toBeGreaterThan(tabsCloseIndex);
      // Bullet items must also be after </Tabs>
      expect(output.indexOf("Preview before production")).toBeGreaterThan(tabsCloseIndex);
      expect(output.indexOf("Batch related changes")).toBeGreaterThan(tabsCloseIndex);
    });

    it("Tab content has no spurious empty paragraph at start", () => {
      const mdx = `<Tabs>\n<Tab title="Simple Workflow">\nFor small teams or solo authors:\n\n1. Edit pages on the main branch\n2. Mark pages as published\n</Tab>\n</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      // The first paragraph should be promoted to inline content
      const content = tab?.content as Array<{ type: string; text?: string }>;
      expect(content.length).toBeGreaterThan(0);
      expect(content.some((c) => c.text?.includes("For small teams"))).toBe(true);
      // Children should NOT start with an empty paragraph — the first
      // child should be a numbered list item (the paragraph was promoted)
      expect(tab?.children).toBeDefined();
      expect(tab?.children?.[0]?.type).toBe("numberedListItem");
    });

    it("Step content has no spurious empty paragraph at start", () => {
      const mdx = `<Steps>\n<Step title="Install">\nRun the install command.\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      const content = step?.content as Array<{ type: string; text?: string }>;
      // Should have real content
      expect(content.some((c) => c.text && c.text.includes("Run the install command"))).toBe(true);
    });

    it("Accordion content has no spurious empty paragraph at start", () => {
      const mdx = `<AccordionGroup>\n<Accordion title="FAQ">\nThe answer is here.\n</Accordion>\n</AccordionGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const accordion = blocks.find((b) => b.type === "accordion");
      expect(accordion).toBeDefined();
      const content = accordion?.content as Array<{ type: string; text?: string }>;
      expect(content.some((c) => c.text && c.text.includes("The answer is here"))).toBe(true);
    });

    it("preserves intentional empty paragraphs in regular content", () => {
      const mdx = `First paragraph.\n\nSecond paragraph.`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("paragraph");
      expect(blocks[1].type).toBe("paragraph");
    });

    it("container block with mixed content has no leading empty paragraph", () => {
      const mdx = `<Steps>\n<Step title="Setup">\nFirst do this:\n\n\`\`\`bash\nnpm install\n\`\`\`\n</Step>\n</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      expect(step?.children).toBeDefined();
      // First child should not be an empty paragraph
      if (step?.children && step.children.length > 0) {
        const firstChild = step.children[0];
        if (firstChild.type === "paragraph") {
          const childContent = firstChild.content as Array<{ type: string; text?: string }>;
          const isEmpty = !childContent || childContent.length === 0 || childContent.every((c) => !c.text || c.text.trim() === "");
          expect(isEmpty).toBe(false);
        }
      }
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

  it("converts a frame with image child (sibling pattern)", () => {
    const mdx = blockNoteToMDX([
      {
        type: "frame",
        props: { caption: "A beautiful scene" },
        content: [],
      },
      {
        type: "frameContent",
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

  it("converts a frame with nested children (legacy pattern)", () => {
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
      },
      {
        type: "frameContent",
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
      },
      {
        type: "frameContent",
        content: [],
        children: [
          { type: "image", props: { url: "/img.png", caption: "Img" } },
        ],
      },
    ]);
    expect(mdx).toContain("<Frame>");
    expect(mdx).toContain("</Frame>");
  });

  it("converts a frame inside a step (nested sibling pattern)", () => {
    const mdx = blockNoteToMDX([
      { type: "steps", content: [] },
      {
        type: "step",
        props: { title: "Upload" },
        content: [],
        children: [
          {
            type: "frame",
            props: { caption: "Screenshot" },
            content: [],
          },
          {
            type: "frameContent",
            content: [],
            children: [
              { type: "image", props: { url: "/images/test.png", caption: "Test" } },
            ],
          },
        ],
      },
    ]);
    expect(mdx).toContain("<Steps>");
    expect(mdx).toContain('<Step title="Upload">');
    expect(mdx).toContain('<Frame caption="Screenshot">');
    expect(mdx).toContain("/images/test.png");
    expect(mdx).toContain("</Frame>");
    expect(mdx).toContain("</Step>");
    expect(mdx).toContain("</Steps>");
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

  it("converts badge style to mark element", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Method: " },
          {
            type: "text",
            text: "POST",
            styles: { badge: "green" },
          },
        ],
      },
    ]);
    expect(mdx).toContain('<mark style="color:green;">POST</mark>');
    expect(mdx).toContain("Method:");
  });

  it("does not wrap text in mark when badge style is empty", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "INFO",
            styles: { badge: "" },
          },
        ],
      },
    ]);
    expect(mdx).not.toContain("<mark>");
    expect(mdx).toContain("INFO");
  });

  it("converts badge style with default color to mark element", () => {
    const mdx = blockNoteToMDX([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "INFO",
            styles: { badge: "#6b7280" },
          },
        ],
      },
    ]);
    expect(mdx).toContain('<mark style="color:#6b7280;">INFO</mark>');
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
      name: "step with frame and image child",
      mdx: `<Steps>\n<Step title="Upload">\n\n<Frame caption="Screenshot">\n\n![Test](/images/test.png)\n\n</Frame>\n\n</Step>\n</Steps>`,
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
    const input = "> first paragraph\n>\n> second paragraph";
    const blocks = mdxToBlockNote(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    // All paragraphs are merged into flat content with newline text node separators
    const content = blocks[0].content as Array<{ type: string; text?: string }>;
    expect(content).toBeDefined();
    // Line breaks are "\n" text nodes (BlockNote's native format), not { type: "hardBreak" }
    expect(content.some((c) => c.type === "text" && c.text === "\n")).toBe(true);
    expect(content.filter((c) => c.type === "text" && c.text !== "\n").map((c) => c.text)).toEqual([
      "first paragraph",
      "second paragraph",
    ]);
    // No children for simple paragraph-only blockquotes
    expect(blocks[0].children).toBeUndefined();
    // Verify roundtrip
    const output = blockNoteToMDX(blocks);
    expect(output.trim()).toBe(input);
  });

  it("round-trips blockquote with 3+ paragraphs", () => {
    const input = "> paragraph one\n>\n> paragraph two\n>\n> paragraph three";
    const blocks = mdxToBlockNote(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("quote");
    const content = blocks[0].content as Array<{ type: string; text?: string }>;
    // Should have 3 content text nodes and 2 newline text nodes
    const contentTextNodes = content.filter((c) => c.type === "text" && c.text !== "\n");
    const newlineNodes = content.filter((c) => c.type === "text" && c.text === "\n");
    expect(contentTextNodes).toHaveLength(3);
    expect(newlineNodes).toHaveLength(2);
    expect(contentTextNodes.map((c) => c.text)).toEqual([
      "paragraph one",
      "paragraph two",
      "paragraph three",
    ]);
    expect(blocks[0].children).toBeUndefined();
    // Verify roundtrip
    const output = blockNoteToMDX(blocks);
    expect(output.trim()).toBe(input);
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

  describe("tabs serialization with flat sibling content blocks", () => {
    it("flat sibling content after the last tab is serialized OUTSIDE the Tabs", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "Tab 1" }, content: [{ type: "text", text: "First" }] },
        { type: "tab", props: { title: "Tab 2" }, content: [{ type: "text", text: "Second" }] },
        { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "After Tabs Heading" }] },
        { type: "paragraph", content: [{ type: "text", text: "After tabs content" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      const tabsCloseIndex = mdx.indexOf("</Tabs>");
      const headingIndex = mdx.indexOf("## After Tabs Heading");
      const paragraphIndex = mdx.indexOf("After tabs content");
      expect(tabsCloseIndex).toBeGreaterThan(-1);
      expect(headingIndex).toBeGreaterThan(-1);
      // Heading and paragraph should be AFTER </Tabs>, not inside any tab
      expect(headingIndex).toBeGreaterThan(tabsCloseIndex);
      expect(paragraphIndex).toBeGreaterThan(tabsCloseIndex);
    });

    it("quote block after the last tab is serialized OUTSIDE the Tabs", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "First Tab" }, content: [{ type: "text", text: "First" }] },
        { type: "tab", props: { title: "Second Tab" }, content: [{ type: "text", text: "Second" }] },
        { type: "quote", content: [{ type: "text", text: "A quote after tabs" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      const tabsCloseIndex = mdx.indexOf("</Tabs>");
      const quoteIndex = mdx.indexOf("A quote after tabs");
      expect(quoteIndex).toBeGreaterThan(-1);
      // Quote should be AFTER </Tabs>, not inside the last tab
      expect(quoteIndex).toBeGreaterThan(tabsCloseIndex);
    });

    it("image block after the last tab is serialized OUTSIDE the Tabs", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "My Tab" }, content: [{ type: "text", text: "Content" }] },
        { type: "image", props: { url: "test.png", alt: "test image" }, content: [] },
      ];
      const mdx = blockNoteToMDX(blocks);
      const tabsCloseIndex = mdx.indexOf("</Tabs>");
      const imageIndex = mdx.indexOf("test.png");
      expect(imageIndex).toBeGreaterThan(-1);
      // Image should be AFTER </Tabs>, not inside the tab
      expect(imageIndex).toBeGreaterThan(tabsCloseIndex);
    });

    it("content blocks between tabs are assigned to the preceding tab", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "Tab A" }, content: [{ type: "text", text: "Tab A text" }] },
        { type: "paragraph", content: [{ type: "text", text: "Extra content for A" }] },
        { type: "tab", props: { title: "Tab B" }, content: [{ type: "text", text: "Tab B text" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      // Extra content should be inside Tab A, before Tab B
      const tabAIndex = mdx.indexOf('<Tab title="Tab A">');
      const tabACloseIndex = mdx.indexOf("</Tab>", tabAIndex);
      const extraIndex = mdx.indexOf("Extra content for A");
      const tabBIndex = mdx.indexOf('<Tab title="Tab B">');
      expect(extraIndex).toBeGreaterThan(tabAIndex);
      expect(extraIndex).toBeLessThan(tabACloseIndex);
      expect(tabBIndex).toBeGreaterThan(tabACloseIndex);
    });

    it("tab with children serializes children inside the tab", () => {
      const blocks = [
        { type: "tabs", content: [] },
        {
          type: "tab",
          props: { title: "Code Tab" },
          content: [{ type: "text", text: "Example:" }],
          children: [
            { type: "codeBlock", props: { language: "js", code: "const x = 1;" } },
          ],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      expect(mdx).toContain("<Tabs>");
      expect(mdx).toContain('<Tab title="Code Tab">');
      expect(mdx).toContain("const x = 1;");
      expect(mdx).toContain("</Tab>");
      expect(mdx).toContain("</Tabs>");
    });

    it("sequential container blocks remain independent in output", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "A" }, content: [{ type: "text", text: "Tab A" }] },
        { type: "accordionGroup", content: [] },
        { type: "accordion", props: { title: "FAQ" }, content: [{ type: "text", text: "Answer" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      expect(mdx).toContain("<Tabs>");
      expect(mdx).toContain("</Tabs>");
      expect(mdx).toContain("<AccordionGroup>");
      expect(mdx).toContain("</AccordionGroup>");
      // Accordion should be outside Tabs
      const tabsCloseIndex = mdx.indexOf("</Tabs>");
      const accordionIndex = mdx.indexOf("<AccordionGroup>");
      expect(accordionIndex).toBeGreaterThan(tabsCloseIndex);
    });

    it("group child types act as boundaries and remain outside tabs", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "Tab 1" }, content: [{ type: "text", text: "Content" }] },
        { type: "step", props: { title: "Step 1" }, content: [{ type: "text", text: "Step content" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      const tabsCloseIndex = mdx.indexOf("</Tabs>");
      const stepIndex = mdx.indexOf("Step content");
      // Step (a group child type) should be outside Tabs
      expect(stepIndex).toBeGreaterThan(tabsCloseIndex);
    });

    it("normal tabs without interleaved content serialize correctly", () => {
      const blocks = [
        { type: "tabs", content: [] },
        { type: "tab", props: { title: "React" }, content: [{ type: "text", text: "React content" }] },
        { type: "tab", props: { title: "Vue" }, content: [{ type: "text", text: "Vue content" }] },
      ];
      const mdx = blockNoteToMDX(blocks);
      expect(mdx).toContain("<Tabs>");
      expect(mdx).toContain('<Tab title="React">');
      expect(mdx).toContain("React content");
      expect(mdx).toContain('<Tab title="Vue">');
      expect(mdx).toContain("Vue content");
      expect(mdx).toContain("</Tabs>");
    });
  });

  describe("attribute value escaping", () => {
    it("roundtrips accordion title with double quotes", () => {
      const blocks = [
        {
          type: "accordion" as const,
          props: { title: 'Error: Could not load the "sharp" module' },
          content: [{ type: "text" as const, text: "Some content" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      // The serialized MDX should escape the quotes
      expect(mdx).toContain("&quot;sharp&quot;");
      expect(mdx).not.toContain('title="Error: Could not load the "sharp"');

      // Parse it back
      const parsed = mdxToBlockNote(mdx);
      expect(parsed[0].type).toBe("accordion");
      expect(parsed[0].props?.title).toBe('Error: Could not load the "sharp" module');
    });

    it("roundtrips callout title with double quotes", () => {
      const blocks = [
        {
          type: "callout" as const,
          props: { type: "warning", title: 'Use "strict mode" always' },
          content: [{ type: "text" as const, text: "Details here" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      expect(parsed[0].props?.title).toBe('Use "strict mode" always');
    });

    it("roundtrips card title with double quotes", () => {
      const blocks = [
        {
          type: "cardGroup" as const,
          props: { cols: "2" },
          content: [],
        },
        {
          type: "card" as const,
          props: { title: 'Install "sharp" package' },
          content: [{ type: "text" as const, text: "Guide" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      const card = parsed.find((b) => b.type === "card");
      expect(card?.props?.title).toBe('Install "sharp" package');
    });

    it("roundtrips tab title with double quotes", () => {
      const blocks = [
        {
          type: "tabs" as const,
          props: {},
          content: [],
        },
        {
          type: "tab" as const,
          props: { title: 'Using "npm"' },
          content: [{ type: "text" as const, text: "npm install" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      const tab = parsed.find((b) => b.type === "tab");
      expect(tab?.props?.title).toBe('Using "npm"');
    });

    it("roundtrips step title with double quotes", () => {
      const blocks = [
        {
          type: "steps" as const,
          props: {},
          content: [],
        },
        {
          type: "step" as const,
          props: { title: 'Run "build" command' },
          content: [{ type: "text" as const, text: "Execute it" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      const step = parsed.find((b) => b.type === "step");
      expect(step?.props?.title).toBe('Run "build" command');
    });

    it("roundtrips title with ampersand", () => {
      const blocks = [
        {
          type: "accordion" as const,
          props: { title: "Pros & Cons" },
          content: [{ type: "text" as const, text: "Details" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      expect(mdx).toContain("&amp;");

      const parsed = mdxToBlockNote(mdx);
      expect(parsed[0].props?.title).toBe("Pros & Cons");
    });

    it("roundtrips title with both quotes and ampersand", () => {
      const blocks = [
        {
          type: "accordion" as const,
          props: { title: 'Error: "foo" & "bar" failed' },
          content: [{ type: "text" as const, text: "Details" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      expect(parsed[0].props?.title).toBe('Error: "foo" & "bar" failed');
    });

    it("roundtrips multiple components with quoted titles", () => {
      const blocks = [
        {
          type: "steps" as const,
          props: {},
          content: [],
        },
        {
          type: "step" as const,
          props: { title: 'Install "sharp"' },
          content: [{ type: "text" as const, text: "Step 1" }],
        },
        {
          type: "step" as const,
          props: { title: 'Configure "sharp"' },
          content: [{ type: "text" as const, text: "Step 2" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);
      const parsed = mdxToBlockNote(mdx);
      const steps = parsed.filter((b) => b.type === "step");
      expect(steps).toHaveLength(2);
      expect(steps[0].props?.title).toBe('Install "sharp"');
      expect(steps[1].props?.title).toBe('Configure "sharp"');
    });

    it("docs-renderer parseAttributes decodes &quot; from serialized MDX", () => {
      // Simulate the full pipeline: editor → blockNoteToMDX → docs-renderer parseAttributes
      // This verifies the cross-package roundtrip: mdx-parser serialization → docs-renderer parsing
      const blocks = [
        {
          type: "accordion" as const,
          props: { title: 'Error: Could not load the "sharp" module' },
          content: [{ type: "text" as const, text: "Some content" }],
        },
      ];
      const mdx = blockNoteToMDX(blocks);

      // The MDX should contain &quot; (escaped quotes)
      expect(mdx).toContain("&quot;sharp&quot;");

      // Now simulate what the docs-renderer does: regex-based attribute parsing
      // This is the same regex used in docs-renderer/src/mdx-parser.ts parseAttributes
      const attrRegex = /(\w+)=(?:"([^"]*)"|{([^}]*)})/g;
      const openTagMatch = mdx.match(/<Accordion\s+([^>]*)>/);
      expect(openTagMatch).toBeTruthy();

      const attrString = openTagMatch![1];
      let match;
      const attrs: Record<string, string> = {};
      while ((match = attrRegex.exec(attrString!)) !== null) {
        if (match[1] && match[2] !== undefined) {
          // Apply the same decodeAttrValue logic as docs-renderer
          attrs[match[1]] = match[2]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");
        }
      }

      expect(attrs.title).toBe('Error: Could not load the "sharp" module');
      expect(attrs.title).not.toContain("&quot;");
    });
  });

  describe("inline JSX detection (mdxJsxTextElement)", () => {
    it("parses Steps with inline Step children", () => {
      // When child elements lack blank-line separation, the MDX parser
      // produces mdxJsxTextElement instead of mdxJsxFlowElement.
      const mdx = `<Steps>
<Step title="First">Do this</Step>
<Step title="Second">Do that</Step>
</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const stepsBlock = blocks.find((b) => b.type === "steps");
      expect(stepsBlock).toBeDefined();
      const stepBlocks = blocks.filter((b) => b.type === "step");
      expect(stepBlocks.length).toBeGreaterThanOrEqual(2);
      expect(stepBlocks[0].props?.title).toBe("First");
      expect(stepBlocks[1].props?.title).toBe("Second");
    });

    it("parses AccordionGroup with inline Accordion children", () => {
      const mdx = `<AccordionGroup>
<Accordion title="Q1">Answer 1</Accordion>
<Accordion title="Q2">Answer 2</Accordion>
</AccordionGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const groupBlock = blocks.find((b) => b.type === "accordionGroup");
      expect(groupBlock).toBeDefined();
      const accordionBlocks = blocks.filter((b) => b.type === "accordion");
      expect(accordionBlocks.length).toBeGreaterThanOrEqual(2);
      expect(accordionBlocks[0].props?.title).toBe("Q1");
      expect(accordionBlocks[1].props?.title).toBe("Q2");
    });

    it("parses CardGroup with inline Card children", () => {
      const mdx = `<CardGroup cols={2}>
<Card title="Card A" href="/a">Desc A</Card>
<Card title="Card B" href="/b">Desc B</Card>
</CardGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const groupBlock = blocks.find((b) => b.type === "cardGroup");
      expect(groupBlock).toBeDefined();
      const cardBlocks = blocks.filter((b) => b.type === "card");
      expect(cardBlocks.length).toBeGreaterThanOrEqual(2);
      expect(cardBlocks[0].props?.title).toBe("Card A");
      expect(cardBlocks[1].props?.title).toBe("Card B");
    });
  });

  describe("paragraph breaks in mixed content containers (el-3jmj)", () => {
    it("two paragraphs + Frame inside a Step produce separate paragraph blocks", () => {
      const mdx = `<Steps>
<Step title="Sign up">
Go to inkloom.io and create an account. You can sign up with GitHub, Google, or email.

After signing up, you'll land on the Projects dashboard.

<Frame caption="Dashboard">

*Screenshot*

</Frame>
</Step>
</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      expect(blocks[0].type).toBe("steps");
      const step = blocks[1];
      expect(step.type).toBe("step");
      // First paragraph should be in content
      const content = step.content as Array<{ type: string; text?: string }>;
      expect(
        content.some((c) => c.text?.includes("create an account"))
      ).toBe(true);
      // Second paragraph should be a separate child block, NOT merged
      const children = step.children || [];
      const secondPara = children.find(
        (c) =>
          c.type === "paragraph" &&
          (c.content as Array<{ type: string; text?: string }>)?.some((ic) =>
            ic.text?.includes("After signing up")
          )
      );
      expect(secondPara).toBeDefined();
      // Frame should also be present
      expect(children.some((c) => c.type === "frame")).toBe(true);
    });

    it("two paragraphs + code block inside a Tab produce separate paragraph blocks", () => {
      const mdx = `<Tabs>
<Tab title="Example">
First paragraph.

Second paragraph.

\`\`\`js
console.log("hi")
\`\`\`
</Tab>
</Tabs>`;
      const blocks = mdxToBlockNote(mdx);
      const tab = blocks.find((b) => b.type === "tab");
      expect(tab).toBeDefined();
      const children = tab?.children || [];
      const secondPara = children.find(
        (c) =>
          c.type === "paragraph" &&
          (c.content as Array<{ type: string; text?: string }>)?.some((ic) =>
            ic.text?.includes("Second paragraph")
          )
      );
      expect(secondPara).toBeDefined();
      expect(children.some((c) => c.type === "codeBlock")).toBe(true);
    });

    it("two paragraphs + list inside an Accordion produce separate paragraph blocks", () => {
      const mdx = `<AccordionGroup>
<Accordion title="FAQ">
First paragraph.

Second paragraph.

- Item 1
- Item 2
</Accordion>
</AccordionGroup>`;
      const blocks = mdxToBlockNote(mdx);
      const accordion = blocks.find((b) => b.type === "accordion");
      expect(accordion).toBeDefined();
      const children = accordion?.children || [];
      const secondPara = children.find(
        (c) =>
          c.type === "paragraph" &&
          (c.content as Array<{ type: string; text?: string }>)?.some((ic) =>
            ic.text?.includes("Second paragraph")
          )
      );
      expect(secondPara).toBeDefined();
    });

    it("three paragraphs at top level produce three separate blocks", () => {
      const mdx = `First paragraph.

Second paragraph.

Third paragraph.`;
      const blocks = mdxToBlockNote(mdx);
      const paragraphs = blocks.filter((b) => b.type === "paragraph");
      expect(paragraphs.length).toBe(3);
      const texts = paragraphs.map(
        (p) =>
          (p.content as Array<{ type: string; text?: string }>)
            ?.map((c) => c.text)
            .join("") || ""
      );
      expect(texts[0]).toContain("First");
      expect(texts[1]).toContain("Second");
      expect(texts[2]).toContain("Third");
    });

    it("Quickstart Sign up step: paragraphs are not merged", () => {
      const mdx = `<Steps>
<Step title="Sign up">
Go to [inkloom.io](https://inkloom.io) and create an account. You can sign up with GitHub, Google, or email.

After signing up, you'll land on the Projects dashboard — your home base for managing documentation sites.

<Frame caption="The Projects dashboard after signing up">

*Screenshot: Projects dashboard*

</Frame>
</Step>
</Steps>`;
      const blocks = mdxToBlockNote(mdx);
      const step = blocks.find((b) => b.type === "step");
      expect(step).toBeDefined();
      // The first paragraph content should NOT contain "After signing up"
      const content = step?.content as Array<{ type: string; text?: string }>;
      const firstParaText = content?.map((c) => c.text || "").join("");
      expect(firstParaText).not.toContain("After signing up");
      // "After signing up" should be in a separate child paragraph block
      const children = step?.children || [];
      const afterPara = children.find(
        (c) =>
          c.type === "paragraph" &&
          (c.content as Array<{ type: string; text?: string }>)?.some((ic) =>
            ic.text?.includes("After signing up")
          )
      );
      expect(afterPara).toBeDefined();
    });
  });
});
