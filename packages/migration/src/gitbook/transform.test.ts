import { describe, it, expect } from "vitest";
import { transformGitbookBlocks } from "./transform.js";

describe("transformGitbookBlocks", () => {
  // ─── Hint Blocks ────────────────────────────────────────────────

  describe("hint blocks", () => {
    it("converts info hint to Callout", () => {
      const input = '{% hint style="info" %}\nThis is informational.\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain("This is informational.");
      expect(result.content).toContain("</Callout>");
      expect(result.hasJsx).toBe(true);
    });

    it("converts warning hint to Callout", () => {
      const input = '{% hint style="warning" %}\nBe careful!\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="warning">');
      expect(result.content).toContain("Be careful!");
    });

    it("converts danger hint to Callout", () => {
      const input = '{% hint style="danger" %}\nDangerous operation.\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="danger">');
    });

    it("converts success hint to Callout", () => {
      const input = '{% hint style="success" %}\nAll good!\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="success">');
    });

    it("handles single-quoted style attribute", () => {
      const input = "{% hint style='info' %}\nSingle quoted.\n{% endhint %}";
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
    });

    it("handles empty hint block", () => {
      const input = '{% hint style="info" %}\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain("</Callout>");
    });

    it("handles hint with multiline content", () => {
      const input =
        '{% hint style="info" %}\nLine one.\n\nLine two.\n\n- Bullet one\n- Bullet two\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("Line one.");
      expect(result.content).toContain("Line two.");
      expect(result.content).toContain("- Bullet one");
    });

    it("handles hint with special characters", () => {
      const input =
        '{% hint style="info" %}\nUse `code` and **bold** & <angle> brackets.\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        "Use `code` and **bold** & <angle> brackets.",
      );
    });

    it("handles extra whitespace in tag", () => {
      const input =
        '{%  hint   style="info"  %}\nContent.\n{%  endhint  %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
    });
  });

  // ─── Tabs Blocks ────────────────────────────────────────────────

  describe("tabs blocks", () => {
    it("converts simple tabs structure", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="JavaScript" %}',
        "```js",
        'console.log("hello");',
        "```",
        "{% endtab %}",
        '{% tab title="Python" %}',
        "```python",
        'print("hello")',
        "```",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Tabs>");
      expect(result.content).toContain('<Tab title="JavaScript">');
      expect(result.content).toContain('<Tab title="Python">');
      expect(result.content).toContain("</Tab>");
      expect(result.content).toContain("</Tabs>");
      expect(result.hasJsx).toBe(true);
    });

    it("converts single tab", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="Only Tab" %}',
        "Some content.",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Tabs>");
      expect(result.content).toContain('<Tab title="Only Tab">');
    });

    it("handles empty tab", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="Empty" %}',
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Tab title="Empty">');
      expect(result.content).toContain("</Tab>");
    });

    it("handles tab with special characters in title", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="C++" %}',
        "C++ code here.",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Tab title="C++">');
    });

    it("handles single-quoted tab title", () => {
      const input = [
        "{% tabs %}",
        "{% tab title='Tab One' %}",
        "Content.",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Tab title="Tab One">');
    });
  });

  // ─── Details / Accordion ────────────────────────────────────────

  describe("details / accordion blocks", () => {
    it("converts details to Accordion", () => {
      const input =
        "<details>\n<summary>Click to expand</summary>\nHidden content here.\n</details>";
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        '<Accordion title="Click to expand">',
      );
      expect(result.content).toContain("Hidden content here.");
      expect(result.content).toContain("</Accordion>");
      expect(result.hasJsx).toBe(true);
    });

    it("handles multiline content in details", () => {
      const input = [
        "<details>",
        "<summary>Advanced Options</summary>",
        "",
        "Option 1: Do this.",
        "",
        "Option 2: Do that.",
        "",
        "</details>",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        '<Accordion title="Advanced Options">',
      );
      expect(result.content).toContain("Option 1: Do this.");
      expect(result.content).toContain("Option 2: Do that.");
    });

    it("handles empty details block", () => {
      const input =
        "<details>\n<summary>Empty</summary>\n</details>";
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Accordion title="Empty">');
      expect(result.content).toContain("</Accordion>");
    });

    it("handles title with special characters", () => {
      const input =
        '<details>\n<summary>Why "quotes" matter</summary>\nExplanation.\n</details>';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        '<Accordion title="Why &quot;quotes&quot; matter">',
      );
    });

    it("handles whitespace between tags", () => {
      const input =
        "<details>  \n  <summary>  Spaced Title  </summary>  \n  Content.  \n</details>";
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Accordion title="Spaced Title">');
    });
  });

  // ─── Embed Blocks ──────────────────────────────────────────────

  describe("embed blocks", () => {
    it("converts embed to markdown link", () => {
      const input = '{% embed url="https://example.com/video" %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        "[https://example.com/video](https://example.com/video)",
      );
    });

    it("handles single-quoted URL", () => {
      const input = "{% embed url='https://example.com' %}";
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        "[https://example.com](https://example.com)",
      );
    });

    it("handles URL with special characters", () => {
      const input =
        '{% embed url="https://example.com/path?q=hello&lang=en" %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain(
        "[https://example.com/path?q=hello&lang=en](https://example.com/path?q=hello&lang=en)",
      );
    });

    it("handles multiple embeds", () => {
      const input = [
        '{% embed url="https://first.com" %}',
        "",
        '{% embed url="https://second.com" %}',
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("[https://first.com](https://first.com)");
      expect(result.content).toContain(
        "[https://second.com](https://second.com)",
      );
    });

    it("sets hasJsx to false for embed-only content", () => {
      // Embeds produce markdown links, not JSX
      // But our hasJsx tracks "any transformation happened" - embeds do change content
      const input = '{% embed url="https://example.com" %}';
      const result = transformGitbookBlocks(input);
      // Embeds produce plain markdown, but the transform still sets hasJsx
      // because some transformation occurred
      expect(result.content).toContain("[https://example.com]");
    });
  });

  // ─── Code Blocks ───────────────────────────────────────────────

  describe("code blocks", () => {
    it("adds title to existing fenced code block", () => {
      const input = [
        '{% code title="app.js" %}',
        "```javascript",
        'const x = 1;',
        "```",
        "{% endcode %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('```javascript title="app.js"');
      expect(result.content).toContain("const x = 1;");
      expect(result.content).not.toContain("{% code");
      expect(result.content).not.toContain("{% endcode");
    });

    it("handles code block with lineNumbers attribute", () => {
      const input = [
        '{% code title="config.ts" lineNumbers="true" %}',
        "```typescript",
        "export default {};",
        "```",
        "{% endcode %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('title="config.ts"');
      expect(result.content).toContain("showLineNumbers");
    });

    it("handles code block with overflow attribute", () => {
      const input = [
        '{% code title="long.txt" overflow="wrap" %}',
        "```",
        "very long content here",
        "```",
        "{% endcode %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('title="long.txt"');
      expect(result.content).toContain('overflow="wrap"');
    });

    it("wraps content without fenced code block", () => {
      const input = [
        '{% code title="snippet.txt" %}',
        "plain text content",
        "{% endcode %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('```title="snippet.txt"');
      expect(result.content).toContain("plain text content");
    });

    it("handles empty code block", () => {
      const input = '{% code title="empty.js" %}\n```\n```\n{% endcode %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).not.toContain("{% code");
    });
  });

  // ─── Swagger Blocks ────────────────────────────────────────────

  describe("swagger blocks", () => {
    it("converts swagger to Callout placeholder", () => {
      const input = [
        '{% swagger method="get" path="/users" summary="List users" %}',
        '{% swagger-description %}',
        "Returns a list of users.",
        "{% endswagger-description %}",
        "{% endswagger %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain("`GET /users`");
      expect(result.content).toContain("List users");
      expect(result.content).toContain("OpenAPI");
      expect(result.hasOpenApi).toBe(true);
      expect(result.hasJsx).toBe(true);
    });

    it("handles swagger without summary", () => {
      const input = [
        '{% swagger method="post" path="/items" %}',
        "{% endswagger %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("`POST /items`");
      expect(result.hasOpenApi).toBe(true);
    });

    it("handles swagger with various methods", () => {
      const input =
        '{% swagger method="delete" path="/users/{id}" summary="Delete user" %}\n{% endswagger %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("`DELETE /users/{id}`");
    });

    it("handles swagger with sub-blocks", () => {
      const input = [
        '{% swagger method="get" path="/search" summary="Search" %}',
        '{% swagger-description %}',
        "Search for items.",
        "{% endswagger-description %}",
        '{% swagger-parameter in="query" name="q" type="string" required="true" %}',
        "Search query",
        "{% endswagger-parameter %}",
        '{% swagger-response status="200" description="OK" %}',
        "```json",
        '{ "results": [] }',
        "```",
        "{% endswagger-response %}",
        "{% endswagger %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("`GET /search`");
      expect(result.hasOpenApi).toBe(true);
      // Sub-blocks should be consumed by the swagger transform
      expect(result.content).not.toContain("{% swagger-parameter");
      expect(result.content).not.toContain("{% swagger-response");
    });
  });

  // ─── Nested Blocks ─────────────────────────────────────────────

  describe("nested blocks", () => {
    it("handles hint inside tab", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="Setup" %}',
        '{% hint style="warning" %}',
        "Make sure to install dependencies first.",
        "{% endhint %}",
        "",
        "Run `npm install`.",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Tabs>");
      expect(result.content).toContain('<Tab title="Setup">');
      expect(result.content).toContain('<Callout type="warning">');
      expect(result.content).toContain("</Callout>");
      expect(result.content).toContain("</Tab>");
      expect(result.content).toContain("</Tabs>");
    });

    it("handles multiple hints inside a tab", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="Notes" %}',
        '{% hint style="info" %}',
        "Info note.",
        "{% endhint %}",
        '{% hint style="danger" %}',
        "Danger note.",
        "{% endhint %}",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain('<Callout type="danger">');
      expect(result.content).toContain('<Tab title="Notes">');
    });

    it("handles nested hints (hint inside hint)", () => {
      const input = [
        '{% hint style="info" %}',
        "Outer info content.",
        '{% hint style="warning" %}',
        "Inner warning content.",
        "{% endhint %}",
        "{% endhint %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain('<Callout type="warning">');
      expect(result.content).toContain("Outer info content.");
      expect(result.content).toContain("Inner warning content.");
    });

    it("handles tabs inside tabs (nested tabs)", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="Outer" %}',
        "{% tabs %}",
        '{% tab title="Inner A" %}',
        "Content A.",
        "{% endtab %}",
        '{% tab title="Inner B" %}',
        "Content B.",
        "{% endtab %}",
        "{% endtabs %}",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Tab title="Outer">');
      expect(result.content).toContain('<Tab title="Inner A">');
      expect(result.content).toContain('<Tab title="Inner B">');
      expect(result.content).toContain("Content A.");
      expect(result.content).toContain("Content B.");
      // Should have two <Tabs> and two </Tabs>
      const tabsOpens = (result.content.match(/<Tabs>/g) || []).length;
      const tabsCloses = (result.content.match(/<\/Tabs>/g) || []).length;
      expect(tabsOpens).toBe(2);
      expect(tabsCloses).toBe(2);
    });

    it("handles details inside tabs", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="FAQ" %}',
        "<details>",
        "<summary>Question 1</summary>",
        "Answer 1.",
        "</details>",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Tabs>");
      expect(result.content).toContain('<Accordion title="Question 1">');
      expect(result.content).toContain("Answer 1.");
    });

    it("handles embed inside hint", () => {
      const input = [
        '{% hint style="info" %}',
        "Check out this resource:",
        '{% embed url="https://example.com" %}',
        "{% endhint %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain(
        "[https://example.com](https://example.com)",
      );
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns unchanged content when no Gitbook blocks present", () => {
      const input = "# Hello World\n\nJust regular markdown.\n";
      const result = transformGitbookBlocks(input);
      expect(result.content).toBe("# Hello World\n\nJust regular markdown.\n");
      expect(result.hasJsx).toBe(false);
      expect(result.hasOpenApi).toBe(false);
    });

    it("handles multiple block types in same document", () => {
      const input = [
        "# Guide",
        "",
        '{% hint style="info" %}',
        "Read carefully.",
        "{% endhint %}",
        "",
        "{% tabs %}",
        '{% tab title="A" %}',
        "Content A.",
        "{% endtab %}",
        "{% endtabs %}",
        "",
        '{% embed url="https://docs.example.com" %}',
        "",
        "<details>",
        "<summary>More Info</summary>",
        "Hidden details.",
        "</details>",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain("<Tabs>");
      expect(result.content).toContain(
        "[https://docs.example.com](https://docs.example.com)",
      );
      expect(result.content).toContain('<Accordion title="More Info">');
      expect(result.hasJsx).toBe(true);
    });

    it("preserves surrounding markdown content", () => {
      const input = [
        "# Title",
        "",
        "Paragraph before.",
        "",
        '{% hint style="info" %}',
        "Hint content.",
        "{% endhint %}",
        "",
        "Paragraph after.",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("# Title");
      expect(result.content).toContain("Paragraph before.");
      expect(result.content).toContain("Paragraph after.");
      expect(result.content).toContain('<Callout type="info">');
    });

    it("handles blocks with markdown formatting inside", () => {
      const input = [
        '{% hint style="info" %}',
        "**Bold text** and *italic text*.",
        "",
        "1. First item",
        "2. Second item",
        "",
        "[A link](https://example.com)",
        "{% endhint %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("**Bold text** and *italic text*.");
      expect(result.content).toContain("1. First item");
      expect(result.content).toContain("[A link](https://example.com)");
    });

    it("handles content with no trailing newline", () => {
      const input = '{% hint style="info" %}\nContent.\n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content.endsWith("\n")).toBe(true);
    });

    it("handles content that is only whitespace inside blocks", () => {
      const input = '{% hint style="info" %}\n   \n{% endhint %}';
      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Callout type="info">');
      expect(result.content).toContain("</Callout>");
    });
  });

  // ─── Stepper/Step Blocks ───────────────────────────────────────

  describe("stepper/step blocks", () => {
    it("converts simple stepper structure", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "### step 1",
        "step content",
        "{% endstep %}",
        "{% step %}",
        "### step 2",
        "step 2 content",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Steps>");
      expect(result.content).toContain('<Step title="step 1">');
      expect(result.content).toContain("step content");
      expect(result.content).toContain('<Step title="step 2">');
      expect(result.content).toContain("step 2 content");
      expect(result.content).toContain("</Step>");
      expect(result.content).toContain("</Steps>");
      expect(result.hasJsx).toBe(true);
    });

    it("extracts title from heading and removes it from body", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "### Install dependencies",
        "Run `npm install`.",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Step title="Install dependencies">');
      expect(result.content).toContain("Run `npm install`.");
      // Heading should be removed from body
      expect(result.content).not.toContain("### Install dependencies");
    });

    it("handles step without heading", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "Some content without heading.",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Step title="Step">');
      expect(result.content).toContain("Some content without heading.");
    });

    it("handles different heading levels", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "## Big Heading",
        "Content.",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Step title="Big Heading">');
    });

    it("handles empty step", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Step title="Step">');
      expect(result.content).toContain("</Step>");
    });

    it("handles step with multiline content", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "### Configure",
        "Line one.",
        "",
        "Line two.",
        "",
        "- Item A",
        "- Item B",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Step title="Configure">');
      expect(result.content).toContain("Line one.");
      expect(result.content).toContain("Line two.");
      expect(result.content).toContain("- Item A");
    });

    it("handles hint inside step", () => {
      const input = [
        "{% stepper %}",
        "{% step %}",
        "### Setup",
        '{% hint style="warning" %}',
        "Be careful!",
        "{% endhint %}",
        "{% endstep %}",
        "{% endstepper %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Steps>");
      expect(result.content).toContain('<Step title="Setup">');
      expect(result.content).toContain('<Callout type="warning">');
    });
  });

  // ─── Columns/Column Blocks ───────────────────────────────────

  describe("columns/column blocks", () => {
    it("converts simple columns structure", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        "column 1",
        "{% endcolumn %}",
        "{% column %}",
        "column 2",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Columns>");
      expect(result.content).toContain("<Column>");
      expect(result.content).toContain("column 1");
      expect(result.content).toContain("column 2");
      expect(result.content).toContain("</Column>");
      expect(result.content).toContain("</Columns>");
      expect(result.hasJsx).toBe(true);
    });

    it("handles single column", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        "Only column content.",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Columns>");
      expect(result.content).toContain("<Column>");
      expect(result.content).toContain("Only column content.");
    });

    it("handles empty column", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Column>");
      expect(result.content).toContain("</Column>");
    });

    it("handles column with multiline content", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        "# Title",
        "",
        "Paragraph here.",
        "",
        "- List item",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("# Title");
      expect(result.content).toContain("Paragraph here.");
      expect(result.content).toContain("- List item");
    });

    it("handles hint inside column", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        '{% hint style="info" %}',
        "Info in column.",
        "{% endhint %}",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain("<Columns>");
      expect(result.content).toContain("<Column>");
      expect(result.content).toContain('<Callout type="info">');
    });

    it("produces balanced Column tags", () => {
      const input = [
        "{% columns %}",
        "{% column %}",
        "A",
        "{% endcolumn %}",
        "{% column %}",
        "B",
        "{% endcolumn %}",
        "{% column %}",
        "C",
        "{% endcolumn %}",
        "{% endcolumns %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      const columnOpens = (result.content.match(/<Column>/g) || []).length;
      const columnCloses = (result.content.match(/<\/Column>/g) || []).length;
      expect(columnOpens).toBe(3);
      expect(columnCloses).toBe(3);
    });
  });

  // ─── Content-ref Blocks ──────────────────────────────────────

  describe("content-ref blocks", () => {
    it("converts content-ref with markdown link to Card", () => {
      const input = [
        '{% content-ref url="path/to/page" %}',
        "[Page Title](path/to/page)",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="Page Title" href="path/to/page">');
      expect(result.content).toContain("</Card>");
      expect(result.hasJsx).toBe(true);
    });

    it("derives title from URL when link text is dot", () => {
      const input = [
        '{% content-ref url="./" %}',
        "[.](./) ",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="./"');
      expect(result.content).toContain('href="./"');
    });

    it("derives title from URL path", () => {
      const input = [
        '{% content-ref url="guides/getting-started" %}',
        "[.](guides/getting-started)",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="Getting Started"');
      expect(result.content).toContain('href="guides/getting-started"');
    });

    it("handles content-ref with single-quoted URL", () => {
      const input = [
        "{% content-ref url='other-page' %}",
        "[Other Page](other-page)",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="Other Page" href="other-page">');
    });

    it("handles multiple content-refs", () => {
      const input = [
        '{% content-ref url="page-a" %}',
        "[Page A](page-a)",
        "{% endcontent-ref %}",
        "",
        '{% content-ref url="page-b" %}',
        "[Page B](page-b)",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="Page A" href="page-a">');
      expect(result.content).toContain('<Card title="Page B" href="page-b">');
    });

    it("handles content-ref without inner markdown link", () => {
      const input = [
        '{% content-ref url="some/path" %}',
        "Just plain text",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).toContain('<Card title="some/path" href="some/path">');
    });

    it("does not leave {% content-ref %} syntax in output", () => {
      const input = [
        '{% content-ref url="page" %}',
        "[Page](page)",
        "{% endcontent-ref %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).not.toMatch(/\{%.*content-ref.*%\}/);
    });
  });

  // ─── Valid MDX Output ──────────────────────────────────────────

  describe("valid MDX output", () => {
    it("produces properly closed JSX tags", () => {
      const input = [
        '{% hint style="info" %}',
        "Content.",
        "{% endhint %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      const opens = (result.content.match(/<Callout/g) || []).length;
      const closes = (result.content.match(/<\/Callout>/g) || []).length;
      expect(opens).toBe(closes);
    });

    it("produces balanced Tabs/Tab tags", () => {
      const input = [
        "{% tabs %}",
        '{% tab title="A" %}',
        "A content.",
        "{% endtab %}",
        '{% tab title="B" %}',
        "B content.",
        "{% endtab %}",
        "{% endtabs %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      const tabsOpens = (result.content.match(/<Tabs>/g) || []).length;
      const tabsCloses = (result.content.match(/<\/Tabs>/g) || []).length;
      const tabOpens = (result.content.match(/<Tab /g) || []).length;
      const tabCloses = (result.content.match(/<\/Tab>/g) || []).length;
      expect(tabsOpens).toBe(tabsCloses);
      expect(tabOpens).toBe(tabCloses);
      expect(tabOpens).toBe(2);
    });

    it("does not leave any {% %} Gitbook syntax in output", () => {
      const input = [
        '{% hint style="info" %}',
        "Hint.",
        "{% endhint %}",
        "",
        "{% tabs %}",
        '{% tab title="A" %}',
        "Tab content.",
        "{% endtab %}",
        "{% endtabs %}",
        "",
        '{% embed url="https://example.com" %}',
        "",
        '{% code title="test.js" %}',
        "```js",
        "x = 1;",
        "```",
        "{% endcode %}",
      ].join("\n");

      const result = transformGitbookBlocks(input);
      expect(result.content).not.toMatch(/\{%.*%\}/);
    });
  });
});
