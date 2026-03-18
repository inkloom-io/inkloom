"use client";

// Group container types and their child types
export const GROUP_MAPPINGS = {
  cardGroup: "card",
  tabs: "tab",
  steps: "step",
  codeGroup: "codeBlock",
  accordionGroup: "accordion",
  columns: "column",
  frame: "frameContent",
} as const;

export type GroupContainerType = keyof typeof GROUP_MAPPINGS;
export type GroupChildType = (typeof GROUP_MAPPINGS)[GroupContainerType];

// Set of all container types for quick lookup
const CONTAINER_TYPES = new Set(Object.keys(GROUP_MAPPINGS));

/**
 * Check if a block type is a group container type (tabs, codeGroup, etc.)
 */
export function isContainerType(blockType: string): boolean {
  return CONTAINER_TYPES.has(blockType);
}

// Set of all group child types for quick lookup
const GROUP_CHILD_TYPES = new Set(Object.values(GROUP_MAPPINGS));

// Generic block type for our purposes
interface GenericBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
}

/**
 * Check if a block type is a group child type (tab, step, codeBlock, etc.)
 */
export function isGroupChildType(blockType: string): boolean {
  return GROUP_CHILD_TYPES.has(blockType as GroupChildType);
}

/**
 * Get the group container for a child block (if it belongs to one)
 */
export function getGroupContainer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  block: GenericBlock
): { container: GenericBlock; index: number; siblings: GenericBlock[] } | null {
  const document = editor.document as GenericBlock[];
  const blockIndex = document.findIndex((b) => b.id === block.id);

  if (blockIndex === -1) return null;

  // Look backwards for a group container
  let containerIndex = -1;
  let containerType: GroupContainerType | null = null;

  // First, determine which container type we're looking for based on the block type
  let expectedContainerType: GroupContainerType | null = null;
  for (const [container, child] of Object.entries(GROUP_MAPPINGS)) {
    if (child === block.type) {
      expectedContainerType = container as GroupContainerType;
      break;
    }
  }

  // If this block type doesn't belong to any group, return null
  if (!expectedContainerType) return null;

  for (let i = blockIndex - 1; i >= 0; i--) {
    const prevBlock = document[i];
    if (!prevBlock) continue;

    const prevType = prevBlock.type;

    // Check if this is the group container we're looking for
    if (prevType === expectedContainerType) {
      containerIndex = i;
      containerType = prevType as GroupContainerType;
      break;
    }

    // Skip sibling blocks of the same type (other children in the group)
    if (prevType === block.type) {
      continue;
    }

    // Another container type breaks the group — this child belongs to a different group
    if (CONTAINER_TYPES.has(prevType)) {
      return null;
    }

    // Skip empty paragraphs
    if (prevType === "paragraph") {
      const content = prevBlock.content as Array<{ type: string; text?: string }> | undefined;
      const firstItem = content?.[0];
      if (!content || content.length === 0 ||
          (content.length === 1 && firstItem?.type === "text" && firstItem?.text === "")) {
        continue;
      }
    }

    // Skip non-container blocks (content blocks interleaved within the group,
    // e.g. a code block or image inserted inside a tab's content area)
    continue;
  }

  if (containerIndex === -1 || !containerType) return null;

  // Collect all siblings in this group
  const expectedChildType = GROUP_MAPPINGS[containerType];
  const siblings: GenericBlock[] = [];

  for (let i = containerIndex + 1; i < document.length; i++) {
    const nextBlock = document[i];
    if (!nextBlock) continue;

    const nextType = nextBlock.type;

    if (nextType === expectedChildType) {
      siblings.push(nextBlock);
    } else if (CONTAINER_TYPES.has(nextType)) {
      // Another container type ends the group
      break;
    }
    // Skip all other block types (empty paragraphs, content blocks interleaved
    // within the group like images or code blocks inserted into a tab)
  }

  const indexInGroup = siblings.findIndex(s => s.id === block.id);
  const containerBlock = document[containerIndex];

  if (!containerBlock) return null;

  return {
    container: containerBlock,
    index: indexInGroup,
    siblings,
  };
}

/**
 * Get all children of a group container
 */
export function getGroupChildren(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  containerBlock: GenericBlock
): GenericBlock[] {
  const containerType = containerBlock.type;

  if (!(containerType in GROUP_MAPPINGS)) {
    return [];
  }

  const expectedChildType = GROUP_MAPPINGS[containerType as GroupContainerType];
  const document = editor.document as GenericBlock[];
  const containerIndex = document.findIndex((b) => b.id === containerBlock.id);

  if (containerIndex === -1) return [];

  const children: GenericBlock[] = [];

  for (let i = containerIndex + 1; i < document.length; i++) {
    const nextBlock = document[i];
    if (!nextBlock) continue;

    const nextType = nextBlock.type;

    if (nextType === expectedChildType) {
      children.push(nextBlock);
    } else if (CONTAINER_TYPES.has(nextType)) {
      // Another container type ends the group
      break;
    }
    // Skip all other block types (empty paragraphs, content blocks interleaved
    // within the group like images or code blocks inserted into a tab)
  }

  return children;
}

/**
 * Get the position info for a block in its group
 */
export function getGroupPosition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  block: GenericBlock
): { isFirst: boolean; isLast: boolean; index: number; total: number } | null {
  const groupInfo = getGroupContainer(editor, block);

  if (!groupInfo) return null;

  return {
    isFirst: groupInfo.index === 0,
    isLast: groupInfo.index === groupInfo.siblings.length - 1,
    index: groupInfo.index,
    total: groupInfo.siblings.length,
  };
}

/**
 * Find a container block of a given type before a block
 */
export function findContainerBefore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  block: GenericBlock,
  containerType: string
): GenericBlock | null {
  const document = editor.document as GenericBlock[];
  const blockIndex = document.findIndex((b) => b.id === block.id);

  if (blockIndex === -1) return null;

  for (let i = blockIndex - 1; i >= 0; i--) {
    const prevBlock = document[i];
    if (prevBlock && prevBlock.type === containerType) {
      return prevBlock;
    }
  }

  return null;
}

/**
 * Insert blocks from the slash menu with group-awareness.
 *
 * When the cursor is inside a group child block (tab, frameContent, step, etc.),
 * this function inserts the new block(s) as flat siblings after the current child
 * block instead of trying to replace the current block. It also cleans up any
 * slash menu trigger text ("/") from the current block's inline content.
 *
 * Returns true if the insertion was handled (group context), false if the caller
 * should proceed with default insertion behavior.
 */
export function insertBlocksInGroupContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocksToInsert: any[],
): boolean {
  const cursorBlock = editor.getTextCursorPosition().block;
  if (!cursorBlock) return false;

  // Only intercept when cursor is in a group child block
  if (!isGroupChildType(cursorBlock.type)) return false;

  // Clean up slash menu trigger text ("/") from the current block's inline content
  const content = cursorBlock.content;
  if (Array.isArray(content)) {
    const hasOnlySlash =
      content.length === 0 ||
      (content.length === 1 &&
        content[0]?.type === "text" &&
        (content[0]?.text === "/" || content[0]?.text === ""));
    if (hasOnlySlash) {
      editor.updateBlock(cursorBlock, { content: [] });
    }
  }

  // Insert the new block(s) as flat siblings after the current group child
  const insertedBlocks = editor.insertBlocks(blocksToInsert, cursorBlock, "after");

  // Move cursor to the first inserted block that has content
  if (insertedBlocks && insertedBlocks.length > 0) {
    const firstInserted = insertedBlocks[0];
    try {
      editor.setTextCursorPosition(firstInserted, "end");
    } catch {
      // Some blocks (content: "none") can't receive cursor, that's fine
    }
  }

  return true;
}
