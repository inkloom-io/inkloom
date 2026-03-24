# @inkloom/mdx-parser

## 0.2.0

### Minor Changes

- [`eca0400`](https://github.com/inkloom-io/inkloom-private/commit/eca0400560a64af9246d283a525bf21f0b875855) Thanks [@notadamking](https://github.com/notadamking)! - Add title support for fenced code blocks. Titles in code block meta strings (e.g. ` ```java HelloWorld.java `) are now parsed into a `title` prop and serialized back correctly.

- [`57a049d`](https://github.com/inkloom-io/inkloom-private/commit/57a049dc2b5c9ac65238f86c5e342be5cf540878) Thanks [@notadamking](https://github.com/notadamking)! - Add MDX parser support for GitBook HTML figure elements and card-view tables. Figure elements (`<figure><img><figcaption>`) convert to frame + image blocks. Tables with `data-view="cards"` convert to cardGroup + card blocks.

- [`b582e7a`](https://github.com/inkloom-io/inkloom-private/commit/b582e7a372c7f44cee0ad7abae771537ef96f94b) Thanks [@notadamking](https://github.com/notadamking)! - Add Frame block type with group/container pattern for MDX↔BlockNote conversion. Frame uses a container + frameContent child pattern (like AccordionGroup/Columns) to support block-level content with optional hint and caption props.

- [`20439e1`](https://github.com/inkloom-io/inkloom-private/commit/20439e134afc80a1bcd392bade1a68137d5d4791) Thanks [@notadamking](https://github.com/notadamking)! - Add separate alt text property to image blocks, decoupling alt text from caption for proper accessibility support in MDX round-trips.

- [`82b2571`](https://github.com/inkloom-io/inkloom-private/commit/82b2571335ba7974708a2ef8f50a1d4b147b0aed) Thanks [@notadamking](https://github.com/notadamking)! - Add inline badge (`<mark>`) and inline icon (`<Icon>`) parsing and serialization support. Badges convert between `<mark style="color:...">text</mark>` MDX and BlockNote badge inline content. Icons convert between `<Icon icon="name" size={N} />` MDX and BlockNote icon inline content.

- [`384bc7b`](https://github.com/inkloom-io/inkloom-private/commit/384bc7b3e4c9038198220c93f152844ff95c576e) Thanks [@notadamking](https://github.com/notadamking)! - Add inline LaTeX support: detect `$...$` and `$$...$$` delimiters in paragraph text and convert them to `<Latex>` JSX tags during blocknote-to-mdx serialization.

- [`1f65ede`](https://github.com/inkloom-io/inkloom-private/commit/1f65ede41484364382390e8b585b5e9d4d8f9097) Thanks [@notadamking](https://github.com/notadamking)! - Add LaTeX block type support for MDX parsing and serialization. Parses `<Latex>` flow elements into `latex` blocks with expression prop, and serializes them back to `<Latex>` MDX components.

- [`878fda6`](https://github.com/inkloom-io/inkloom-private/commit/878fda66aa4b414895a3e757110c057bc83905ad) Thanks [@notadamking](https://github.com/notadamking)! - Add ResponseField and Expandable block types for MDX↔BlockNote conversion, enabling nested API response documentation structures.

- [`1a49e4d`](https://github.com/inkloom-io/inkloom-private/commit/1a49e4d448740996e1f3b5d4d8b27dabd45f541e) Thanks [@notadamking](https://github.com/notadamking)! - Add MDX parsing and serialization support for `<video>`, `<iframe>`, and `<br />` tags.

- [`a9e2cc9`](https://github.com/inkloom-io/inkloom-private/commit/a9e2cc94d2915ae504ce76a7c8b955fceb4c11c1) Thanks [@notadamking](https://github.com/notadamking)! - Handle block-level content (code blocks, tables, images) inside JSX components (Callout, Card, Tab, Step, Accordion). Block-level nodes now appear in the BlockNote `children` array instead of being silently flattened to plain text.

- [`0a227e2`](https://github.com/inkloom-io/inkloom-private/commit/0a227e2063124c1d114c8407dac4bc5b2d08d561) Thanks [@notadamking](https://github.com/notadamking)! - Enable block-level nesting for ResponseField and Expandable blocks. Nested elements are now stored as children instead of siblings, allowing the editor to visually represent the nesting hierarchy.

- [`31f502a`](https://github.com/inkloom-io/inkloom-private/commit/31f502a3acadf791ac1d628766ba49405bfa8da5) Thanks [@notadamking](https://github.com/notadamking)! - Add defaultOpen prop support for Expandable blocks in MDX serialization and parsing.

- [`fd202be`](https://github.com/inkloom-io/inkloom-private/commit/fd202bea5f201483bdd968c7d3203866889b3467) Thanks [@notadamking](https://github.com/notadamking)! - Convert markdown blockquotes to nested quote blocks during import instead of flattening to plain paragraphs. Supports simple, multi-paragraph, and nested blockquotes with proper roundtripping.

- [`6b1d077`](https://github.com/inkloom-io/inkloom-private/commit/6b1d077beba3bbf37d9354a088588ab0518bfecf) Thanks [@notadamking](https://github.com/notadamking)! - Redesign badge serialization: badges are now text items with a `badge` style instead of inline content nodes. MDX output format (`<mark>` tags) remains unchanged for backward compatibility.

### Patch Changes

- [`d445ff2`](https://github.com/inkloom-io/inkloom-private/commit/d445ff2fb7ed691665fcda9665d59ce4a3f70582) Thanks [@notadamking](https://github.com/notadamking)! - Add columns/column MDX parsing and serialization support. Columns with Card children produce cardGroup blocks (existing behavior), while mixed content produces columns/column blocks.

- [`e4e724f`](https://github.com/inkloom-io/inkloom-private/commit/e4e724f524ae46ab6e4426a9ce5928cb6cfa8e0f) Thanks [@notadamking](https://github.com/notadamking)! - Normalize bare icon names (e.g. "copy") to "lucide:copy" format during MDX import for Accordion, Card, Tab, and Step components.

- [`ab5433a`](https://github.com/inkloom-io/inkloom-private/commit/ab5433af7efe32d1790b6093d035ff07f2317359) Thanks [@notadamking](https://github.com/notadamking)! - Fix bullet list items inside container blocks (Tabs, Steps, Accordions) missing their `<ul>` wrapper, causing them to render without indentation or bullet markers.

- [`ca4b3b2`](https://github.com/inkloom-io/inkloom-private/commit/ca4b3b26ec0081306f80724e555036cc7446bdc5) Thanks [@notadamking](https://github.com/notadamking)! - Fix backslash escaping of curly braces in CodeGroup code blocks. Adjacent code blocks inside JSX elements were not recognized as protected regions by the sanitizer, causing `{` and `}` to be erroneously escaped as `\{` and `\}`. Also extract title/height metadata from code blocks inside CodeGroup.

- [`c920e4b`](https://github.com/inkloom-io/inkloom-private/commit/c920e4b214005c79d38ab99c8c82e0f2f61d4734) Thanks [@notadamking](https://github.com/notadamking)! - Fix CodeGroup tab titles lost during Gitbook import. Parse `title="..."` from code fence meta in CodeGroup blocks so tabs display original titles (e.g., "200"/"400") instead of language labels.

- [`6e0af5a`](https://github.com/inkloom-io/inkloom-private/commit/6e0af5a350964c1497c7a364ef50f767e2d3b7cc) Thanks [@notadamking](https://github.com/notadamking)! - Fix spurious empty paragraphs at the start of container block content areas (Tabs, Steps, Accordions, etc.) during MDX import. Whitespace-only text nodes between JSX container tags and content are now trimmed instead of being converted to empty paragraph blocks.

- [`e2298ee`](https://github.com/inkloom-io/inkloom-private/commit/e2298eebf5c26f740d69dd7402aeef8f811196cd) Thanks [@notadamking](https://github.com/notadamking)! - Fix figure/img import to nest the image block inside the frame's children instead of returning them as separate siblings.

- [`5aecef5`](https://github.com/inkloom-io/inkloom-private/commit/5aecef55fba9fdf0d6b304a731a38564dd1d821c) Thanks [@notadamking](https://github.com/notadamking)! - Fix Frame block children parsing so nested `<img>` elements are populated as image children in the BlockNote output, and serialized back to MDX correctly.

- [`f9bd541`](https://github.com/inkloom-io/inkloom-private/commit/f9bd5415827bfe029a7442d358b5c53032a9047f) Thanks [@notadamking](https://github.com/notadamking)! - Fix frameContent serialization to handle children directly and return early, preventing the default border-left div wrapper from being applied to frame content children.

- [`496a2e4`](https://github.com/inkloom-io/inkloom-private/commit/496a2e40c8d2c03d46f909a7989164f3027810ed) Thanks [@notadamking](https://github.com/notadamking)! - Fix Frame import to use frameContent sibling pattern instead of nested children, so imported frames render correctly in the editor with content inside the frame border.

- [`3061319`](https://github.com/inkloom-io/inkloom-private/commit/30613191110949bb69a3be5c9bb56f6d378a7452) Thanks [@notadamking](https://github.com/notadamking)! - Fix Frame block content not rendering inside frame when nested in Steps or other containers. The group-utils sibling lookup now searches nested children arrays, and the serializer properly handles frame/frameContent grouping within container blocks.

- [`493de3c`](https://github.com/inkloom-io/inkloom-private/commit/493de3c883970b429de376675e433a9a4d9b748a) Thanks [@notadamking](https://github.com/notadamking)! - Fix inline JSX detection in Steps, AccordionGroup, CardGroup, and other group handlers so child elements wrapped in paragraphs by the MDX parser (mdxJsxTextElement) are correctly recognized.

- [`2a5fdad`](https://github.com/inkloom-io/inkloom-private/commit/2a5fdad08c02140fd7160a314633ad2291f6d626) Thanks [@notadamking](https://github.com/notadamking)! - Add `inline` attribute to inline LaTeX tags (`<Latex inline>`) to reliably distinguish inline from block-level LaTeX, replacing heuristic detection.

- [`7516f63`](https://github.com/inkloom-io/inkloom-private/commit/7516f63a04aef68eadaea84cb34d944629d6a071) Thanks [@notadamking](https://github.com/notadamking)! - Fix regression where the last tab in a tabs block absorbed all subsequent content. Restored proper group boundary detection and tab serialization logic.

- [`18cdadc`](https://github.com/inkloom-io/inkloom-private/commit/18cdadc9d782e392922432327ae09c45817fb003) Thanks [@notadamking](https://github.com/notadamking)! - Fix block-level content ordering inside MDX containers (Steps, Accordions, Tabs, etc.). Previously, paragraphs surrounding lists/code blocks/images were merged together and block elements were pushed to the end. Now document order is preserved.

- [`3c6f08b`](https://github.com/inkloom-io/inkloom-private/commit/3c6f08b0c4aa1b93c91c3a5a1d856c5155d3073d) Thanks [@notadamking](https://github.com/notadamking)! - Fix MDX import: preserve paragraph breaks inside container blocks (Tabs, Callouts, etc.) and detect inline-format Tab elements that remark-mdx parses as text elements wrapped in paragraphs.

- [`d8d0606`](https://github.com/inkloom-io/inkloom-private/commit/d8d0606ad56e5290fd062ec7e966808b4ba219e8) Thanks [@notadamking](https://github.com/notadamking)! - Fix double quotes in component attribute values (e.g. accordion titles) being truncated during MDX serialization by escaping `"` as `&quot;` and decoding on import.

- [`413e299`](https://github.com/inkloom-io/inkloom-private/commit/413e299025da79572d82496216b72fdbd0b63b90) Thanks [@notadamking](https://github.com/notadamking)! - Fix multiline blockquotes importing as separate blocks instead of a single unified blockquote. Paragraph children are now merged into flat content with hardBreak separators.

- [`ed485f7`](https://github.com/inkloom-io/inkloom-private/commit/ed485f75f62bab3d3118655c46ddbed91018547a) Thanks [@notadamking](https://github.com/notadamking)! - Fix multiline blockquote rendering in the editor by using BlockNote-native newline text nodes instead of hardBreak inline content items. Previously, multiline blockquotes would render as separate quote blocks because BlockNote doesn't recognize `{ type: "hardBreak" }` as an inline content type — it uses `\n` characters within text nodes to represent line breaks.

- [`c8035b5`](https://github.com/inkloom-io/inkloom-private/commit/c8035b5c4495bbfbb60a7a9d2936201fc107905c) Thanks [@notadamking](https://github.com/notadamking)! - Fix Code Group and other group containers not serializing correctly when nested inside parent containers (Steps, Accordion, Tabs, etc.).

- [`e717a22`](https://github.com/inkloom-io/inkloom-private/commit/e717a224982a18b9a06ab3af750c7680eb72b178) Thanks [@notadamking](https://github.com/notadamking)! - Fix ordered list items dropping block-level content (code blocks, blockquotes, etc.) during MDX parsing, and fix serialization to include children blocks indented under numbered list items.

- [`1f7112e`](https://github.com/inkloom-io/inkloom-private/commit/1f7112edb31ed73dd5879693049789caea679d6e) Thanks [@notadamking](https://github.com/notadamking)! - Fix paragraph breaks being lost inside container blocks (Steps, Tabs, Accordions) when mixed with block-level elements like Frames, code blocks, or lists.

- [`1f74935`](https://github.com/inkloom-io/inkloom-private/commit/1f74935a8da1d2df91dccafa8ae3f0771ef97f69) Thanks [@notadamking](https://github.com/notadamking)! - Fix ResponseField required prop handling: editor stores required as string ("true"/"false") but serializer treated it as boolean, causing all ResponseFields to render with the required badge.

- [`49764f6`](https://github.com/inkloom-io/inkloom-private/commit/49764f65f30ff98b9825c39bd945a3064ba3a35c) Thanks [@notadamking](https://github.com/notadamking)! - Fix Steps, Step, AccordionGroup, and Accordion components being serialized as literal ellipsis text instead of being properly parsed into BlockNote blocks. Also fix the fallback serializer to recursively serialize children instead of outputting "..." placeholder text.

- [`1c2ba74`](https://github.com/inkloom-io/inkloom-private/commit/1c2ba74763a7e12f9faa9045f3b4c1795508dc20) Thanks [@notadamking](https://github.com/notadamking)! - Fix nested blocks inside tabs rendering below the tabs container by flattening block children as sibling blocks after the tab, matching the editor's sibling-based grouping pattern.

- [`f4db566`](https://github.com/inkloom-io/inkloom-private/commit/f4db566d8f6e12c9219fe7ed1d2f27c25165de4f) Thanks [@notadamking](https://github.com/notadamking)! - Fix content after `</Tabs>` being absorbed into the last tab during serialization. Headings, paragraphs, and other blocks that appear after the Tabs container now correctly render outside the Tabs block.

- [`7c7e4c2`](https://github.com/inkloom-io/inkloom-private/commit/7c7e4c24883dce25ab116dd3a9c1bf6643f9eb99) Thanks [@notadamking](https://github.com/notadamking)! - Fix tabs serialization to include flat sibling content blocks (quotes, images, paragraphs, etc.) within their parent Tab element in MDX output, matching the editor's CSS injection boundary logic.

- [`a2b93d5`](https://github.com/inkloom-io/inkloom-private/commit/a2b93d5ee602fef3f54da933d67921eaae88edab) Thanks [@notadamking](https://github.com/notadamking)! - Fix empty paragraph at start of tab/step/accordion content after MDX import by promoting the first paragraph to inline content when block-level elements cause all content to be placed in children.

- [`e24c535`](https://github.com/inkloom-io/inkloom-private/commit/e24c5358c4c1a22de470cea387637cf60871f710) Thanks [@notadamking](https://github.com/notadamking)! - Handle HTML `<img>` tags in MDX parser by setting the `alt` prop alongside `caption` on the image block, so alt text is preserved when converting `<img>` elements.

- [`1d2d680`](https://github.com/inkloom-io/inkloom-private/commit/1d2d680ba449ce0376af7d40c6b8351bb74e9aaa) Thanks [@notadamking](https://github.com/notadamking)! - Add img element handling in mdx-to-blocknote so Mintlify Frame children using <img> tags are correctly converted to image blocks during migration.

- [`f02a75d`](https://github.com/inkloom-io/inkloom-private/commit/f02a75decedcce052e4bf4a6f5cc0ebdcd450c78) Thanks [@notadamking](https://github.com/notadamking)! - Replace non-null assertions with truthiness narrowing in blocknote-to-mdx.
