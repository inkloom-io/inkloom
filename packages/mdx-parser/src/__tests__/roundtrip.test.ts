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
    expect(blocks[0].type).toBe("responseField");
    expect(blocks[0].props?.name).toBe("navigation");
    expect(blocks[0].props?.type).toBe("Navigation[]");
    expect(blocks[0].props?.required).toBe(true);
    expect(blocks[1].type).toBe("expandable");
    expect(blocks[1].props?.title).toBe("Navigation");
    expect(blocks[2].type).toBe("responseField");
    expect(blocks[2].props?.name).toBe("group");
    expect(blocks[2].props?.type).toBe("string");
  });

  it("parses Expandable with ResponseField children", () => {
    const mdx = `<Expandable title="Properties">\n<ResponseField name="key" type="string">\nA key value.\n</ResponseField>\n</Expandable>`;
    const blocks = mdxToBlockNote(mdx);
    expect(blocks[0].type).toBe("expandable");
    expect(blocks[0].props?.title).toBe("Properties");
    expect(blocks[1].type).toBe("responseField");
    expect(blocks[1].props?.name).toBe("key");
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

  it("returns at least one block for empty input", () => {
    const blocks = mdxToBlockNote("");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
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
      { type: "image", props: { url: "https://img.com/pic.png", caption: "My pic", previewWidth: 300 } },
    ]);
    expect(mdx).toContain('<Image src="https://img.com/pic.png"');
    expect(mdx).toContain("width={300}");
  });

  it("converts image with default width using markdown", () => {
    const mdx = blockNoteToMDX([
      { type: "image", props: { url: "https://img.com/pic.png", caption: "My pic" } },
    ]);
    expect(mdx).toContain("![My pic](https://img.com/pic.png)");
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

  it("converts responseField with expandable children", () => {
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
});
