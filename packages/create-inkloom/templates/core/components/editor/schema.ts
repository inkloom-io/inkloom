import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from "@blocknote/core";
import { Card, CardGroup } from "./custom-blocks/card";
import { Callout } from "./custom-blocks/callout";
import { Tabs, Tab } from "./custom-blocks/tabs";
import { Steps, Step } from "./custom-blocks/steps";
import { CodeGroup } from "./custom-blocks/code-group";
import { CodeBlock } from "./custom-blocks/code-block";
import { CustomImage } from "./custom-blocks/image";
import { Columns, Column } from "./custom-blocks/columns";
import { InlineIcon } from "./custom-inline-content/icon";
import { BadgeStyle } from "./custom-styles/badge-style";

// Create a copy of default specs without the built-in codeBlock and image
const { codeBlock: _defaultCodeBlock, image: _defaultImage, ...otherDefaultSpecs } = defaultBlockSpecs;

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...otherDefaultSpecs,
    image: CustomImage(),
    card: Card(),
    cardGroup: CardGroup(),
    callout: Callout(),
    tabs: Tabs(),
    tab: Tab(),
    steps: Steps(),
    step: Step(),
    codeGroup: CodeGroup(),
    codeBlock: CodeBlock(),
    columns: Columns(),
    column: Column(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    icon: InlineIcon,
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    badge: BadgeStyle,
  },
});

// Export typed variants for use throughout the app
export type CustomBlockNoteEditor = typeof schema.BlockNoteEditor;
export type CustomBlock = typeof schema.Block;
export type CustomPartialBlock = typeof schema.PartialBlock;
