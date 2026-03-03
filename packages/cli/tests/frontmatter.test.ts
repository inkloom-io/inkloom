import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatter,
  serializeFrontmatter,
  type PageFrontmatter,
} from "../src/lib/frontmatter.ts";

describe("parseFrontmatter", () => {
  it("should parse complete frontmatter with all fields", () => {
    const input = `---
title: Getting Started
slug: getting-started
position: 0
isPublished: true
icon: book
description: Learn how to set up InkLoom
---

# Getting Started

Your content here...`;

    const { frontmatter, body } = parseFrontmatter(input);

    assert.equal(frontmatter.title, "Getting Started");
    assert.equal(frontmatter.slug, "getting-started");
    assert.equal(frontmatter.position, 0);
    assert.equal(frontmatter.isPublished, true);
    assert.equal(frontmatter.icon, "book");
    assert.equal(frontmatter.description, "Learn how to set up InkLoom");
    assert.equal(body, "# Getting Started\n\nYour content here...");
  });

  it("should return empty frontmatter when no delimiters found", () => {
    const input = "# Just a heading\n\nNo frontmatter here.";
    const { frontmatter, body } = parseFrontmatter(input);

    assert.deepEqual(frontmatter, {});
    assert.equal(body, input);
  });

  it("should return empty frontmatter when content is empty", () => {
    const { frontmatter, body } = parseFrontmatter("");
    assert.deepEqual(frontmatter, {});
    assert.equal(body, "");
  });

  it("should handle frontmatter with only some fields", () => {
    const input = `---
title: Quick Start
isPublished: false
---

Content body`;

    const { frontmatter, body } = parseFrontmatter(input);

    assert.equal(frontmatter.title, "Quick Start");
    assert.equal(frontmatter.isPublished, false);
    assert.equal(frontmatter.slug, undefined);
    assert.equal(frontmatter.position, undefined);
    assert.equal(frontmatter.icon, undefined);
    assert.equal(frontmatter.description, undefined);
    assert.equal(body, "Content body");
  });

  it("should handle quoted string values (double quotes)", () => {
    const input = `---
title: "A title with: colon"
description: "Has #hash and spaces"
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "A title with: colon");
    assert.equal(frontmatter.description, "Has #hash and spaces");
  });

  it("should handle quoted string values (single quotes)", () => {
    const input = `---
title: 'Single quoted title'
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "Single quoted title");
  });

  it("should coerce numeric values for position", () => {
    const input = `---
position: 42
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.position, 42);
    assert.equal(typeof frontmatter.position, "number");
  });

  it("should coerce boolean values for isPublished", () => {
    const input = `---
isPublished: true
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.isPublished, true);
    assert.equal(typeof frontmatter.isPublished, "boolean");
  });

  it("should handle isPublished: false", () => {
    const input = `---
isPublished: false
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.isPublished, false);
  });

  it("should ignore unknown frontmatter keys", () => {
    const input = `---
title: Known
unknownField: whatever
anotherUnknown: 123
---

Body`;

    const { frontmatter, body } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "Known");
    assert.equal(body, "Body");
    // Unknown keys shouldn't be in the result
    assert.equal(
      Object.keys(frontmatter).length,
      1,
      "Should only have 'title' key"
    );
  });

  it("should skip comment lines in frontmatter", () => {
    const input = `---
title: My Page
# This is a comment
slug: my-page
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "My Page");
    assert.equal(frontmatter.slug, "my-page");
  });

  it("should skip empty lines in frontmatter", () => {
    const input = `---
title: My Page

slug: my-page
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "My Page");
    assert.equal(frontmatter.slug, "my-page");
  });

  it("should handle frontmatter with no body content", () => {
    const input = `---
title: Empty Page
---
`;

    const { frontmatter, body } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "Empty Page");
    assert.equal(body, "");
  });

  it("should handle only opening delimiter (no closing)", () => {
    const input = `---
title: Incomplete
No closing delimiter here`;

    const { frontmatter, body } = parseFrontmatter(input);
    assert.deepEqual(frontmatter, {});
    assert.equal(body, input);
  });

  it("should handle content that has --- elsewhere in body", () => {
    const input = `---
title: My Page
---

Some content

---

A horizontal rule above`;

    const { frontmatter, body } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "My Page");
    assert.ok(body.includes("---"), "Body should contain the horizontal rule");
    assert.ok(body.includes("A horizontal rule above"));
  });

  it("should handle negative position values", () => {
    const input = `---
position: -1
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.position, -1);
  });

  it("should handle value with colon in unquoted string", () => {
    // Values after the first colon should be included
    const input = `---
description: This has: a colon in it
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.description, "This has: a colon in it");
  });

  it("should handle leading whitespace before frontmatter", () => {
    const input = `  ---
title: Indented
---

Body`;

    // Per the spec, frontmatter must be at the start of the file
    // But trimStart is applied, so leading whitespace is tolerated
    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.title, "Indented");
  });

  it("should handle position 0 correctly (falsy number)", () => {
    const input = `---
position: 0
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.position, 0);
    assert.equal(typeof frontmatter.position, "number");
  });

  it("should not interpret non-numeric strings as position", () => {
    const input = `---
position: abc
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.position, undefined);
  });

  it("should not interpret non-boolean strings as isPublished", () => {
    const input = `---
isPublished: yes
---

Body`;

    const { frontmatter } = parseFrontmatter(input);
    assert.equal(frontmatter.isPublished, undefined);
  });
});

describe("serializeFrontmatter", () => {
  it("should serialize complete frontmatter with all fields", () => {
    const frontmatter: PageFrontmatter = {
      title: "Getting Started",
      slug: "getting-started",
      position: 0,
      isPublished: true,
      icon: "book",
      description: "Learn how to set up InkLoom",
    };
    const body = "# Getting Started\n\nYour content here...";

    const result = serializeFrontmatter(frontmatter, body);

    assert.ok(result.startsWith("---\n"));
    assert.ok(result.includes("title: Getting Started\n"));
    assert.ok(result.includes("slug: getting-started\n"));
    assert.ok(result.includes("position: 0\n"));
    assert.ok(result.includes("isPublished: true\n"));
    assert.ok(result.includes("icon: book\n"));
    assert.ok(result.includes("description: Learn how to set up InkLoom\n"));
    assert.ok(result.includes("---\n\n# Getting Started"));
  });

  it("should omit undefined fields", () => {
    const frontmatter: PageFrontmatter = {
      title: "Just Title",
    };
    const body = "Content";

    const result = serializeFrontmatter(frontmatter, body);

    assert.ok(result.includes("title: Just Title"));
    assert.ok(!result.includes("slug:"));
    assert.ok(!result.includes("position:"));
    assert.ok(!result.includes("isPublished:"));
    assert.ok(!result.includes("icon:"));
    assert.ok(!result.includes("description:"));
  });

  it("should return body without delimiters when frontmatter is empty", () => {
    const result = serializeFrontmatter({}, "Just a body");
    assert.equal(result, "Just a body");
    assert.ok(!result.includes("---"));
  });

  it("should quote values containing colons", () => {
    const frontmatter: PageFrontmatter = {
      title: "Title: With Colon",
    };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes('title: "Title: With Colon"'));
  });

  it("should quote values containing hash symbols", () => {
    const frontmatter: PageFrontmatter = {
      description: "Has #hash tag",
    };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes('description: "Has #hash tag"'));
  });

  it("should quote values that look like booleans", () => {
    const frontmatter: PageFrontmatter = {
      title: "true",
      slug: "false",
    };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes('title: "true"'));
    assert.ok(result.includes('slug: "false"'));
  });

  it("should quote values that look like numbers", () => {
    const frontmatter: PageFrontmatter = {
      title: "123",
      slug: "45.6",
    };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes('title: "123"'));
    assert.ok(result.includes('slug: "45.6"'));
  });

  it("should preserve field order: title, slug, position, isPublished, icon, description", () => {
    const frontmatter: PageFrontmatter = {
      description: "Desc",
      icon: "star",
      isPublished: false,
      position: 3,
      slug: "my-slug",
      title: "My Title",
    };
    const result = serializeFrontmatter(frontmatter, "Body");
    const lines = result.split("\n");

    // Find field lines (between the --- delimiters)
    const fieldLines = lines.filter(
      (l) => l && l !== "---" && !l.startsWith("#") && l.includes(":")
    );
    assert.equal(fieldLines.length, 6);
    assert.ok(fieldLines[0].startsWith("title:"));
    assert.ok(fieldLines[1].startsWith("slug:"));
    assert.ok(fieldLines[2].startsWith("position:"));
    assert.ok(fieldLines[3].startsWith("isPublished:"));
    assert.ok(fieldLines[4].startsWith("icon:"));
    assert.ok(fieldLines[5].startsWith("description:"));
  });

  it("should handle empty body", () => {
    const frontmatter: PageFrontmatter = {
      title: "Empty",
    };
    const result = serializeFrontmatter(frontmatter, "");
    assert.ok(result.startsWith("---\n"));
    assert.ok(result.endsWith("---\n\n"));
  });

  it("should handle position: 0 (falsy value) correctly", () => {
    const frontmatter: PageFrontmatter = { position: 0 };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes("position: 0"));
  });

  it("should handle isPublished: false correctly", () => {
    const frontmatter: PageFrontmatter = { isPublished: false };
    const result = serializeFrontmatter(frontmatter, "Body");
    assert.ok(result.includes("isPublished: false"));
  });
});

describe("roundtrip: parse → serialize → parse", () => {
  it("should roundtrip complete frontmatter", () => {
    const original: PageFrontmatter = {
      title: "Getting Started",
      slug: "getting-started",
      position: 0,
      isPublished: true,
      icon: "book",
      description: "Learn how to set up InkLoom",
    };
    const originalBody = "# Getting Started\n\nYour content here...";

    const serialized = serializeFrontmatter(original, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.deepEqual(frontmatter, original);
    assert.equal(body, originalBody);
  });

  it("should roundtrip partial frontmatter", () => {
    const original: PageFrontmatter = {
      title: "Quick Start",
      isPublished: false,
    };
    const originalBody = "Content";

    const serialized = serializeFrontmatter(original, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.equal(frontmatter.title, original.title);
    assert.equal(frontmatter.isPublished, original.isPublished);
    assert.equal(frontmatter.slug, undefined);
    assert.equal(body, originalBody);
  });

  it("should roundtrip empty frontmatter", () => {
    const originalBody = "Just a body";

    const serialized = serializeFrontmatter({}, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.deepEqual(frontmatter, {});
    assert.equal(body, originalBody);
  });

  it("should roundtrip frontmatter with special characters in values", () => {
    const original: PageFrontmatter = {
      title: "Title: With Colon",
      description: "Has #hash and special chars",
    };
    const originalBody = "Body content";

    const serialized = serializeFrontmatter(original, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.equal(frontmatter.title, original.title);
    assert.equal(frontmatter.description, original.description);
    assert.equal(body, originalBody);
  });

  it("should roundtrip multiline body content", () => {
    const original: PageFrontmatter = {
      title: "Complex Page",
    };
    const originalBody = `# Heading

Paragraph one.

## Subheading

- List item 1
- List item 2

\`\`\`javascript
const x = 1;
\`\`\`

---

Final section.`;

    const serialized = serializeFrontmatter(original, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.equal(frontmatter.title, original.title);
    assert.equal(body, originalBody);
  });

  it("should roundtrip body containing --- (horizontal rules)", () => {
    const original: PageFrontmatter = { title: "Has HR" };
    const originalBody = "Before\n\n---\n\nAfter";

    const serialized = serializeFrontmatter(original, originalBody);
    const { frontmatter, body } = parseFrontmatter(serialized);

    assert.equal(frontmatter.title, "Has HR");
    assert.equal(body, originalBody);
  });
});
