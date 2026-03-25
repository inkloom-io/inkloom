export { DocsRendererProvider, useDocsRenderer } from "./context";
export type { DocsRendererConfig } from "./context";
export { cn } from "./utils";
export { Callout } from "./components/callout";
export { Card } from "./components/card";
export { CardGroup } from "./components/card-group";
export { Image } from "./components/image";
export { IconDisplay } from "./components/icon-display";
export { CodeBlock } from "./components/code-block";
export { CodeGroup } from "./components/code-group";
export { Heading } from "./components/heading";
export { CustomLink } from "./components/link";
export { Tabs, Tab } from "./components/tabs";
export { Steps, Step } from "./components/steps";
export { Columns } from "./components/columns";
export { Column } from "./components/column";
export { Badge } from "./components/badge";

// MDX parsing utilities
export {
  parseAttributes,
  findBalancedCloseTag,
  findMDXComponents,
  preprocessCodeBlocks,
  preprocessInlineComponents,
} from "./mdx-parser";
export type {
  ParsedComponent,
  CodeBlockSegment,
  MarkdownSegment,
  ContentSegment,
} from "./mdx-parser";

// MDX rendering
export {
  MDXRenderer,
  MarkdownWithCodeBlocks,
  getMarkdownComponents,
  renderComponent,
  renderTabChildren,
  renderStepChildren,
  renderColumnChildren,
} from "./mdx-renderer";
export type { ComponentOverrides, MDXRendererProps } from "./mdx-renderer";
