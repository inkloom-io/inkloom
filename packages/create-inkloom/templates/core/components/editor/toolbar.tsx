"use client";

import {
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
} from "@blocknote/react";

/**
 * Simplified formatting toolbar for the block editor.
 *
 * Provides basic formatting controls:
 * - Block type selection (paragraph, headings)
 * - Text styles: bold, italic, underline, strikethrough, code
 * - Text alignment: left, center, right
 * - Color pickers: text color, background color
 * - Nesting: indent, outdent
 * - Link creation
 *
 * Uses BlockNote's built-in FormattingToolbar components.
 */
export function EditorFormattingToolbar() {
  return (
    <FormattingToolbarController
      floatingUIOptions={{
        useDismissProps: { outsidePress: false },
      }}
      formattingToolbar={() => (
        <FormattingToolbar>
          <BlockTypeSelect key="blockTypeSelect" />
          <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
          <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
          <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
          <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
          <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
          <TextAlignButton textAlignment="left" key="textAlignLeftButton" />
          <TextAlignButton textAlignment="center" key="textAlignCenterButton" />
          <TextAlignButton textAlignment="right" key="textAlignRightButton" />
          <ColorStyleButton key="colorStyleButton" />
          <NestBlockButton key="nestBlockButton" />
          <UnnestBlockButton key="unnestBlockButton" />
          <CreateLinkButton key="createLinkButton" />
        </FormattingToolbar>
      )}
    />
  );
}
