import { describe, it, expect } from "vitest";
import {
  transformMintlifyMdx,
  transformFrontmatter,
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
