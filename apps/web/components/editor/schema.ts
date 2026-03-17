import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { Card, CardGroup } from "./custom-blocks/card";
import { Callout } from "./custom-blocks/callout";
import { Tabs, Tab } from "./custom-blocks/tabs";
import { Steps, Step } from "./custom-blocks/steps";
import { Accordion, AccordionGroup } from "./custom-blocks/accordion";
import { CodeGroup } from "./custom-blocks/code-group";
import { CodeBlock } from "./custom-blocks/code-block";
import { CustomImage } from "./custom-blocks/image";
import { ResponseField } from "./custom-blocks/response-field";
import { Expandable } from "./custom-blocks/expandable";
import { Columns, Column } from "./custom-blocks/columns";
import { Frame, FrameContent } from "./custom-blocks/frame";
import { Latex } from "./custom-blocks/latex";
import { Video } from "./custom-blocks/video";
import { IFrame } from "./custom-blocks/iframe";

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
    accordion: Accordion(),
    accordionGroup: AccordionGroup(),
    codeGroup: CodeGroup(),
    codeBlock: CodeBlock(),
    responseField: ResponseField(),
    expandable: Expandable(),
    columns: Columns(),
    column: Column(),
    frame: Frame(),
    frameContent: FrameContent(),
    latex: Latex(),
    video: Video(),
    iframe: IFrame(),
  },
});

// Export typed variants for use throughout the app
export type CustomBlockNoteEditor = typeof schema.BlockNoteEditor;
export type CustomBlock = typeof schema.Block;
export type CustomPartialBlock = typeof schema.PartialBlock;
