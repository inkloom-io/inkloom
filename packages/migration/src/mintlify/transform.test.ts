import { describe, it, expect } from "vitest";
import {
  transformMintlifyMdx,
  transformFrontmatter,
  extractSnippetImports,
} from "./transform.js";
import { mdxToBlockNote } from "@inkloom/mdx-parser";

describe("transformMintlifyMdx", () => {
  describe("component renames", () => {
    it("renames <Note> to <Callout type=\"info\">", async () => {
      const input = `<Note>This is a note</Note>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Callout");
      expect(mdx).toContain('type="info"');
      expect(mdx).toContain("This is a note");
      expect(mdx).not.toContain("<Note");
    });

    it("renames <Warning> to <Callout type=\"warning\">", async () => {
      const input = `<Warning>Watch out!</Warning>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Callout");
      expect(mdx).toContain('type="warning"');
      expect(mdx).toContain("Watch out!");
      expect(mdx).not.toContain("<Warning");
    });

    it("renames <Tip> to <Callout type=\"tip\">", async () => {
      const input = `<Tip>Here is a tip</Tip>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Callout");
      expect(mdx).toContain('type="tip"');
      expect(mdx).toContain("Here is a tip");
      expect(mdx).not.toContain("<Tip");
    });

    it("renames <Info> to <Callout type=\"info\">", async () => {
      const input = `<Info>Information here</Info>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Callout");
      expect(mdx).toContain('type="info"');
      expect(mdx).toContain("Information here");
      expect(mdx).not.toContain("<Info");
    });

    it("renames <Check> to <Callout type=\"success\">", async () => {
      const input = `<Check>All good!</Check>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Callout");
      expect(mdx).toContain('type="success"');
      expect(mdx).toContain("All good!");
      expect(mdx).not.toContain("<Check");
    });
  });

  describe("passthrough components", () => {
    it("leaves Card unchanged", async () => {
      const input = `<Card title="My Card">Card content</Card>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Card");
      expect(mdx).toContain('title="My Card"');
    });

    it("leaves CardGroup unchanged", async () => {
      const input = `<CardGroup cols={2}>\n  <Card title="A">Content A</Card>\n  <Card title="B">Content B</Card>\n</CardGroup>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<CardGroup");
      expect(mdx).toContain("<Card");
    });

    it("leaves Tabs and Tab unchanged", async () => {
      const input = `<Tabs>\n  <Tab title="First">Content 1</Tab>\n  <Tab title="Second">Content 2</Tab>\n</Tabs>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Tabs");
      expect(mdx).toContain("<Tab");
    });

    it("leaves Steps and Step unchanged", async () => {
      const input = `<Steps>\n  <Step title="Step 1">Do thing 1</Step>\n  <Step title="Step 2">Do thing 2</Step>\n</Steps>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Steps");
      expect(mdx).toContain("<Step");
    });

    it("leaves Accordion and AccordionGroup unchanged", async () => {
      const input = `<AccordionGroup>\n  <Accordion title="FAQ 1">Answer 1</Accordion>\n</AccordionGroup>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<AccordionGroup");
      expect(mdx).toContain("<Accordion");
    });

    it("leaves CodeGroup unchanged", async () => {
      const input = "<CodeGroup>\n\n```python\nprint('hello')\n```\n\n</CodeGroup>";
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<CodeGroup");
    });

    it("leaves Columns unchanged (not renamed by renameComponents)", async () => {
      const input = `<Columns cols={2}>\n<Card title="A">Content A</Card>\n<Card title="B">Content B</Card>\n</Columns>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Columns");
      expect(mdx).toContain("cols={2}");
      expect(mdx).toContain("<Card");
      expect(mdx).not.toContain("<CardGroup");
    });

    it("leaves Latex unchanged", async () => {
      const input = `<Latex>x^2 + y^2 = z^2</Latex>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Latex>");
      expect(mdx).toContain("x^2 + y^2 = z^2");
      expect(mdx).toContain("</Latex>");
    });

    it("leaves Columns with non-card children unchanged", async () => {
      const input = `<Columns cols={3}>\n<div>col1</div>\n<div>col2</div>\n<div>col3</div>\n</Columns>`;
      const { mdx } = await transformMintlifyMdx(input);
      expect(mdx).toContain("<Columns");
      expect(mdx).toContain("cols={3}");
      expect(mdx).toContain("col1");
      expect(mdx).toContain("col2");
      expect(mdx).toContain("col3");
    });
  });

  describe("frontmatter handling", () => {
    it("strips Mintlify-only fields (openapi, api, mode)", async () => {
      const input = `---
title: My Page
openapi: get /users
api: POST /create
mode: wide
description: A page
---

Some content here.`;
      const { frontmatter } = await transformMintlifyMdx(input);
      expect(frontmatter).toContain("title: My Page");
      expect(frontmatter).toContain("description: A page");
      expect(frontmatter).not.toContain("openapi");
      expect(frontmatter).not.toContain("api:");
      expect(frontmatter).not.toContain("mode:");
    });

    it("preserves title, description, and icon", async () => {
      const input = `---
title: Getting Started
description: Learn how to get started
icon: rocket
---

Content here.`;
      const { frontmatter, metadata } = await transformMintlifyMdx(input);
      expect(frontmatter).toContain("title: Getting Started");
      expect(frontmatter).toContain("description: Learn how to get started");
      expect(frontmatter).toContain("icon: rocket");
      expect(metadata["title"]).toBe("Getting Started");
      expect(metadata["description"]).toBe("Learn how to get started");
      expect(metadata["icon"]).toBe("rocket");
    });

    it("maps sidebarTitle to title when no title present", async () => {
      const input = `---
sidebarTitle: Sidebar Name
description: A page
---

Content.`;
      const { frontmatter, metadata } = await transformMintlifyMdx(input);
      expect(frontmatter).toContain("title: Sidebar Name");
      expect(metadata["title"]).toBe("Sidebar Name");
      expect(frontmatter).not.toContain("sidebarTitle");
    });

    it("does not override existing title with sidebarTitle", async () => {
      const input = `---
title: Real Title
sidebarTitle: Sidebar Name
---

Content.`;
      const { frontmatter, metadata } = await transformMintlifyMdx(input);
      expect(frontmatter).toContain("title: Real Title");
      expect(metadata["title"]).toBe("Real Title");
      expect(frontmatter).not.toContain("sidebarTitle");
    });

    it("handles content with no frontmatter", async () => {
      const input = `# Hello World\n\nSome content.`;
      const { mdx, frontmatter, metadata } = await transformMintlifyMdx(input);
      expect(mdx).toContain("# Hello World");
      expect(frontmatter).toBeUndefined();
      expect(Object.keys(metadata)).toHaveLength(0);
    });
  });

  describe("integration: mixed content", () => {
    it("transforms a full Mintlify page with frontmatter and multiple components", async () => {
      const input = `---
title: Authentication
description: How to authenticate
openapi: get /auth
icon: lock
---

# Authentication

<Note>You need an API key to authenticate.</Note>

## Getting Started

<Steps>
  <Step title="Get API Key">
    Go to the dashboard and create an API key.
  </Step>
  <Step title="Set Header">
    Include the key in your request headers.
  </Step>
</Steps>

<Warning>Never share your API key publicly.</Warning>

<Tip>Use environment variables to store your key.</Tip>

<Card title="API Reference" href="/api">
  View the full API reference.
</Card>`;

      const { mdx, frontmatter, metadata } = await transformMintlifyMdx(input);

      // Frontmatter
      expect(frontmatter).toContain("title: Authentication");
      expect(frontmatter).toContain("description: How to authenticate");
      expect(frontmatter).toContain("icon: lock");
      expect(frontmatter).not.toContain("openapi");
      expect(metadata["title"]).toBe("Authentication");

      // Component renames
      expect(mdx).not.toContain("<Note");
      expect(mdx).not.toContain("<Warning");
      expect(mdx).not.toContain("<Tip");

      // Callout replacements
      expect(mdx).toContain("<Callout");

      // Passthrough components
      expect(mdx).toContain("<Steps");
      expect(mdx).toContain("<Step");
      expect(mdx).toContain("<Card");

      // Content preserved
      expect(mdx).toContain("# Authentication");
      expect(mdx).toContain("You need an API key");
    });
  });
});

describe("integration: transform -> mdxToBlockNote", () => {
  it("transforms Mintlify MDX with all component types into valid BlockNote JSON", async () => {
    const mintlifyInput = `---
title: Full Example
description: Integration test page
openapi: get /test
icon: book
---

# Welcome

<Note>This is a note callout.</Note>

<Warning>This is a warning callout.</Warning>

<Tip>This is a tip callout.</Tip>

<Info>This is an info callout.</Info>

<Check>This is a success callout.</Check>

<Card title="Example Card" href="/example">
  Card description here.
</Card>

<Tabs>
  <Tab title="Tab 1">
    Tab 1 content
  </Tab>
  <Tab title="Tab 2">
    Tab 2 content
  </Tab>
</Tabs>

<Steps>
  <Step title="First">
    Do the first thing.
  </Step>
  <Step title="Second">
    Do the second thing.
  </Step>
</Steps>

<AccordionGroup>
  <Accordion title="FAQ">
    Answer here.
  </Accordion>
</AccordionGroup>
`;

    // Step 1: Transform Mintlify MDX
    const { mdx, metadata } = await transformMintlifyMdx(mintlifyInput);

    // Verify transform output
    expect(metadata["title"]).toBe("Full Example");
    expect(mdx).not.toContain("openapi");
    expect(mdx).not.toContain("<Note");
    expect(mdx).not.toContain("<Warning");
    expect(mdx).not.toContain("<Tip");
    expect(mdx).not.toContain("<Info>");
    expect(mdx).not.toContain("<Check");

    // Step 2: Pass to mdxToBlockNote (MDX body without frontmatter)
    const blocks = mdxToBlockNote(mdx);

    // Verify we get valid BlockNote JSON
    expect(blocks).toBeDefined();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);

    // Verify callout blocks exist with correct types
    const calloutBlocks = blocks.filter((b: { type: string }) => b.type === "callout");
    expect(calloutBlocks.length).toBe(5);

    const calloutTypes = calloutBlocks.map((b) => b.props?.["type"]);
    expect(calloutTypes).toContain("info");
    expect(calloutTypes).toContain("warning");
    expect(calloutTypes).toContain("tip");
    expect(calloutTypes).toContain("success");

    // Verify passthrough components also converted correctly
    const blockTypes = blocks.map((b: { type: string }) => b.type);
    expect(blockTypes).toContain("card");
    expect(blockTypes).toContain("tabs");
    expect(blockTypes).toContain("tab");
    expect(blockTypes).toContain("steps");
    expect(blockTypes).toContain("step");
    expect(blockTypes).toContain("accordionGroup");
    expect(blockTypes).toContain("accordion");
  });
});

describe("integration: Columns migration", () => {
  it("converts Mintlify Columns with Card children to cardGroup blocks", async () => {
    const mintlifyInput = `
<Columns cols={2}>
<Card title="Feature A">
Description A
</Card>
<Card title="Feature B">
Description B
</Card>
</Columns>
`;

    const { mdx } = await transformMintlifyMdx(mintlifyInput);

    // Columns passes through unchanged
    expect(mdx).toContain("<Columns");
    expect(mdx).toContain("cols={2}");

    // Parse to BlockNote — should produce cardGroup (backward-compatible)
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toBeDefined();

    const cardGroupBlock = blocks.find((b: { type: string }) => b.type === "cardGroup");
    expect(cardGroupBlock).toBeDefined();
    expect(cardGroupBlock?.props?.cols).toBe("2");

    const cardBlocks = blocks.filter((b: { type: string }) => b.type === "card");
    expect(cardBlocks).toHaveLength(2);
    expect(cardBlocks[0]?.props?.title).toBe("Feature A");
    expect(cardBlocks[1]?.props?.title).toBe("Feature B");
  });

  it("converts Mintlify Columns with non-card children to columns + column blocks", async () => {
    const mintlifyInput = `
<Columns cols={2}>
<div>
Left column content
</div>
<div>
Right column content
</div>
</Columns>
`;

    const { mdx } = await transformMintlifyMdx(mintlifyInput);

    // Columns passes through unchanged
    expect(mdx).toContain("<Columns");

    // Parse to BlockNote — should produce columns + column blocks
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toBeDefined();

    const columnsBlock = blocks.find((b: { type: string }) => b.type === "columns");
    expect(columnsBlock).toBeDefined();
    expect(columnsBlock?.props?.cols).toBe("2");

    const columnBlocks = blocks.filter((b: { type: string }) => b.type === "column");
    expect(columnBlocks).toHaveLength(2);
  });
});

describe("integration: Frame migration", () => {
  it("converts Mintlify Frame with caption, hint, and inner <img> to frame + image blocks", async () => {
    const mintlifyInput = `
<Frame caption="Dashboard overview" hint="Click to enlarge">
  <img src="/images/dashboard.png" alt="Dashboard screenshot" />
</Frame>
`;

    const { mdx } = await transformMintlifyMdx(mintlifyInput);

    // Frame passes through unchanged (same name in Mintlify and InkLoom)
    expect(mdx).toContain("<Frame");
    expect(mdx).toContain('caption="Dashboard overview"');
    expect(mdx).toContain('hint="Click to enlarge"');

    // Parse to BlockNote
    const blocks = mdxToBlockNote(mdx);
    expect(blocks).toBeDefined();

    const frameBlock = blocks.find((b: { type: string }) => b.type === "frame");
    expect(frameBlock).toBeDefined();
    expect(frameBlock?.props?.caption).toBe("Dashboard overview");
    expect(frameBlock?.props?.hint).toBe("Click to enlarge");

    // Frame should have an image child block
    const children = frameBlock?.children;
    expect(children).toBeDefined();
    expect(children?.length).toBeGreaterThanOrEqual(1);
    const imageChild = children?.find((b: { type: string }) => b.type === "image");
    expect(imageChild).toBeDefined();
    expect(imageChild?.props?.url).toBe("/images/dashboard.png");
    expect(imageChild?.props?.caption).toBe("Dashboard screenshot");
  });

  it("drops style props (borderRadius) from inner <img> tags", async () => {
    const mintlifyInput = `
<Frame caption="Styled image">
  <img src="/images/example.png" style={{ borderRadius: '0.5rem' }} />
</Frame>
`;

    const { mdx } = await transformMintlifyMdx(mintlifyInput);
    const blocks = mdxToBlockNote(mdx);

    const frameBlock = blocks.find((b: { type: string }) => b.type === "frame");
    expect(frameBlock).toBeDefined();

    const imageChild = frameBlock?.children?.find((b: { type: string }) => b.type === "image");
    expect(imageChild).toBeDefined();
    expect(imageChild?.props?.url).toBe("/images/example.png");
    // style prop should not appear in the image block props
    expect(imageChild?.props?.style).toBeUndefined();
    expect(imageChild?.props?.borderRadius).toBeUndefined();
  });

  it("handles Frame with no props and bare <img>", async () => {
    const mintlifyInput = `
<Frame>
  <img src="/images/simple.png" />
</Frame>
`;

    const { mdx } = await transformMintlifyMdx(mintlifyInput);
    const blocks = mdxToBlockNote(mdx);

    const frameBlock = blocks.find((b: { type: string }) => b.type === "frame");
    expect(frameBlock).toBeDefined();
    expect(frameBlock?.props?.caption).toBeUndefined();
    expect(frameBlock?.props?.hint).toBeUndefined();

    const imageChild = frameBlock?.children?.find((b: { type: string }) => b.type === "image");
    expect(imageChild).toBeDefined();
    expect(imageChild?.props?.url).toBe("/images/simple.png");
  });
});

describe("extractSnippetImports", () => {
  it("extracts single snippet import", () => {
    const body = `import Foo from '/snippets/foo.mdx';\n\n<Foo />`;
    const { snippetImports, bodyWithoutImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({ Foo: "/snippets/foo.mdx" });
    expect(bodyWithoutImports).not.toContain("import");
    expect(bodyWithoutImports).toContain("<Foo />");
  });

  it("extracts multiple snippet imports", () => {
    const body = `import Foo from '/snippets/foo.mdx';\nimport Bar from '/snippets/bar.mdx';\n\n<Foo />\n<Bar />`;
    const { snippetImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({
      Foo: "/snippets/foo.mdx",
      Bar: "/snippets/bar.mdx",
    });
  });

  it("handles imports without .mdx extension", () => {
    const body = `import Intro from '/snippets/intro';\n\n<Intro />`;
    const { snippetImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({ Intro: "/snippets/intro" });
  });

  it("handles nested snippet paths", () => {
    const body = `import Deep from '/snippets/nested/deep.mdx';\n\n<Deep />`;
    const { snippetImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({ Deep: "/snippets/nested/deep.mdx" });
  });

  it("returns empty map when no imports present", () => {
    const body = `# Hello\n\nSome content.`;
    const { snippetImports, bodyWithoutImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({});
    expect(bodyWithoutImports).toBe(body);
  });

  it("handles imports with single quotes", () => {
    const body = `import Foo from '/snippets/foo.mdx';\n\n<Foo />`;
    const { snippetImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({ Foo: "/snippets/foo.mdx" });
  });

  it("handles imports with double quotes", () => {
    const body = `import Foo from "/snippets/foo.mdx";\n\n<Foo />`;
    const { snippetImports } = extractSnippetImports(body);
    expect(snippetImports).toEqual({ Foo: "/snippets/foo.mdx" });
  });
});

describe("transformMintlifyMdx snippet imports", () => {
  it("returns snippetImports in the result", async () => {
    const input = `---
title: Test
---

import Foo from '/snippets/foo.mdx';

# Hello

<Foo />`;
    const result = await transformMintlifyMdx(input);
    expect(result.snippetImports).toEqual({ Foo: "/snippets/foo.mdx" });
    expect(result.mdx).not.toContain("import Foo");
    expect(result.mdx).toContain("<Foo />");
  });

  it("returns empty snippetImports when no imports", async () => {
    const input = `# No imports here`;
    const result = await transformMintlifyMdx(input);
    expect(result.snippetImports).toEqual({});
  });
});

describe("transformFrontmatter", () => {
  it("returns empty frontmatter when all fields are stripped", () => {
    const result = transformFrontmatter("openapi: get /users\napi: POST /create");
    expect(result.frontmatter).toBe("");
  });

  it("preserves unknown fields (not in strip list)", () => {
    const result = transformFrontmatter("title: Test\ncustomField: value");
    expect(result.frontmatter).toContain("customField: value");
  });
});
