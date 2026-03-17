import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { Card, CardGroup } from "./custom-blocks/card";
import { Callout } from "./custom-blocks/callout";
import { Tabs, Tab } from "./custom-blocks/tabs";
import { Steps, Step } from "./custom-blocks/steps";
import { Accordion, AccordionGroup } from "./custom-blocks/accordion";
import { CodeGroup } from "./custom-blocks/code-group";
import { CodeBlock } from "./custom-blocks/code-block";
import { ResponseField } from "./custom-blocks/response-field";
import { Expandable } from "./custom-blocks/expandable";
import { Columns, Column } from "./custom-blocks/columns";

// Create a copy of default specs without the built-in codeBlock
const { codeBlock: _defaultCodeBlock, ...otherDefaultSpecs } = defaultBlockSpecs;

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...otherDefaultSpecs,
    card: Card(),
    cardGroup: CardGroup(),
    callout: Callout(),
    tabs: Tabs(),
    tab: Tab(),
    steps: Steps(),
    step: Step(),
    accordion: Accordion(),
    accordionGroup: AccordionGroup(),
    codeGroup: CodeGroup(),
    codeBlock: CodeBlock(),
    responseField: ResponseField(),
    expandable: Expandable(),
    columns: Columns(),
    column: Column(),
  },
});

// Export typed variants for use throughout the app
export type CustomBlockNoteEditor = typeof schema.BlockNoteEditor;
export type CustomBlock = typeof schema.Block;
export type CustomPartialBlock = typeof schema.PartialBlock;
