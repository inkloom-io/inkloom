# @inkloom/mdx-parser

Convert between MDX and [BlockNote](https://www.blocknotejs.org/) editor JSON. Supports standard Markdown, GFM tables, and InkLoom's custom MDX components (Callout, Tabs, CardGroup, CodeGroup, and more).

## Installation

```bash
npm install @inkloom/mdx-parser
```

## API Reference

### `mdxToBlockNote(mdxContent: string): BlockNoteBlock[]`

Parse an MDX string into an array of BlockNote blocks.

```ts
import { mdxToBlockNote } from "@inkloom/mdx-parser";

const blocks = mdxToBlockNote(`
## Getting Started

Install the package and start converting:

\`\`\`bash
npm install @inkloom/mdx-parser
\`\`\`

<Callout type="info">
This parser supports all standard Markdown and GFM syntax.
</Callout>
`);
// Returns BlockNoteBlock[] with heading, paragraph, codeBlock, and callout blocks
```

### `blockNoteToMDX(blocks: BlockNoteBlock[]): string`

Convert BlockNote blocks back to an MDX string. Preserves InkLoom-specific components (`<Callout>`, `<Tabs>`, `<CardGroup>`, etc.), inline HTML formatting, and block-level styling (colors, alignment).

```ts
import { blockNoteToMDX } from "@inkloom/mdx-parser";

const mdx = blockNoteToMDX([
  {
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Hello World" }],
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "This is " },
      { type: "text", text: "bold", styles: { bold: true } },
      { type: "text", text: " text." },
    ],
  },
]);
// Returns:
// ## Hello World
//
// This is <strong>bold</strong> text.
```

### `blockNoteToMarkdown(blocks: BlockNoteBlock[]): string`

Convert BlockNote blocks to plain Markdown with no HTML tags or MDX components. Suitable for `llms.txt`, plain-text export, or any context where pure Markdown is required.

```ts
import { blockNoteToMarkdown } from "@inkloom/mdx-parser";

const markdown = blockNoteToMarkdown([
  {
    type: "callout",
    props: { type: "warning", title: "Heads up" },
    content: [{ type: "text", text: "Be careful with this API." }],
  },
]);
// Returns:
// > **Heads up:** Be careful with this API.
```

### `parseBlockNoteContent(content: string): BlockNoteBlock[]`

Parse a JSON string into an array of BlockNote blocks. Returns an empty array if the input is not valid JSON.

```ts
import { parseBlockNoteContent } from "@inkloom/mdx-parser";

const blocks = parseBlockNoteContent(
  '[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]'
);
```

## Type Exports

| Type | Description |
| --- | --- |
| `BlockNoteBlock` | A block-level element (paragraph, heading, list item, image, table, etc.) |
| `BlockNoteInlineContent` | Inline content within a block (text, links) with optional styles |
| `TableContent` | Table structure with rows, cells, column widths, and header configuration |
| `TableContentCell` | A single table cell with content and optional alignment/color props |
| `MdastNode` | MDAST (Markdown Abstract Syntax Tree) node used internally during parsing |
| `MdxAttribute` | An attribute on an MDX JSX element |

## Usage Examples

### MDX to BlockNote

```ts
import { mdxToBlockNote } from "@inkloom/mdx-parser";

const mdx = `
# Welcome

Here is a **bold** statement and some \`inline code\`.

- First item
- Second item
- Third item

| Feature | Status |
| --- | --- |
| Markdown | Supported |
| MDX Components | Supported |
| GFM Tables | Supported |

<Callout type="tip" title="Pro tip">
You can round-trip MDX through BlockNote and back.
</Callout>
`;

const blocks = mdxToBlockNote(mdx);
console.log(JSON.stringify(blocks, null, 2));
```

### BlockNote to MDX

```ts
import { blockNoteToMDX } from "@inkloom/mdx-parser";

const blocks = [
  {
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "API Reference" }],
  },
  {
    type: "codeBlock",
    props: {
      language: "typescript",
      code: 'import { mdxToBlockNote } from "@inkloom/mdx-parser";',
    },
  },
  {
    type: "callout",
    props: { type: "info" },
    content: [{ type: "text", text: "All functions are synchronous." }],
  },
];

const mdx = blockNoteToMDX(blocks);
console.log(mdx);
```

## Supported Block Types

- **Paragraph** — standard text with inline formatting (bold, italic, code, strikethrough, underline, colors)
- **Heading** — levels 1-6, with optional toggleable headings
- **Bullet list** / **Numbered list** / **Check list** — including nested items
- **Code block** — with language and optional height metadata
- **Image** — markdown images and `<Image>` components with custom width
- **Table** — GFM tables with alignment, header rows/columns, and cell-level styling
- **Divider** — horizontal rules
- **Callout** — `<Callout>` with type and title
- **Card / CardGroup** — `<Card>` and `<CardGroup>` components
- **Tabs / Tab** — `<Tabs>` and `<Tab>` components
- **CodeGroup** — `<CodeGroup>` wrapping multiple code blocks
- **Steps / Step** — `<Steps>` and `<Step>` components
- **Accordion / AccordionGroup** — `<Accordion>` and `<AccordionGroup>` components
- **Quote** — blockquotes
- **Toggle list** — collapsible list items

## Links

- [InkLoom GitHub Repository](https://github.com/inkloom-io/inkloom)
- [Report Issues](https://github.com/inkloom-io/inkloom/issues)

## License

MIT
