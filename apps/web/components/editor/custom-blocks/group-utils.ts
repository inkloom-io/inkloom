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
  children?: GenericBlock[];
}

/**
 * Find the array (scope) containing a block by its ID.
 * Searches the top-level document first, then recursively checks nested children.
 * Returns the array that directly contains the block, enabling group operations
 * to work correctly even when blocks are nested inside containers like Steps.
 */
function findBlockScope(document: GenericBlock[], blockId: string): GenericBlock[] | null {
  // Check top-level
  if (document.some(b => b.id === blockId)) {
    return document;
  }
  // Check children recursively
  for (const block of document) {
    if (block.children && block.children.length > 0) {
      const result = findBlockScope(block.children as GenericBlock[], blockId);
      if (result) return result;
    }
  }
  return null;
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
  const topDocument = editor.document as GenericBlock[];
  const document = findBlockScope(topDocument, block.id) || topDocument;
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

    // Skip empty paragraphs
    if (prevType === "paragraph") {
      const content = prevBlock.content as Array<{ type: string; text?: string }> | undefined;
      const firstItem = content?.[0];
      if (!content || content.length === 0 ||
          (content.length === 1 && firstItem?.type === "text" && firstItem?.text === "")) {
        continue;
      }
      // Non-empty paragraph breaks the group
      return null;
    }

    // Any other block type breaks the group
    return null;
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
    } else if (nextType === "paragraph") {
      const content = nextBlock.content as Array<{ type: string; text?: string }> | undefined;
      const firstItem = content?.[0];
      if (!content || content.length === 0 ||
          (content.length === 1 && firstItem?.type === "text" && firstItem?.text === "")) {
        continue; // Skip empty paragraphs
      }
      break; // Non-empty paragraph breaks the group
    } else {
      break; // Any other block type breaks the group
    }
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
  const topDocument = editor.document as GenericBlock[];
  const document = findBlockScope(topDocument, containerBlock.id) || topDocument;
  const containerIndex = document.findIndex((b) => b.id === containerBlock.id);

  if (containerIndex === -1) return [];

  const children: GenericBlock[] = [];

  for (let i = containerIndex + 1; i < document.length; i++) {
    const nextBlock = document[i];
    if (!nextBlock) continue;

    const nextType = nextBlock.type;

    if (nextType === expectedChildType) {
      children.push(nextBlock);
    } else if (nextType === "paragraph") {
      const content = nextBlock.content as Array<{ type: string; text?: string }> | undefined;
      const firstItem = content?.[0];
      if (!content || content.length === 0 ||
          (content.length === 1 && firstItem?.type === "text" && firstItem?.text === "")) {
        continue; // Skip empty paragraphs
      }
      break; // Non-empty paragraph breaks the group
    } else {
      break; // Any other block type breaks the group
    }
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
  const topDocument = editor.document as GenericBlock[];
  const document = findBlockScope(topDocument, block.id) || topDocument;
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
 * this function inserts the new block(s) as children of the current group child
 * block. This ensures they render inside the container's visual panel area
 * rather than as flat siblings outside the container.
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

  // Insert the new block(s) as children of the current group child so they
  // render inside the container's content area
  const existingChildren = cursorBlock.children || [];
  try {
    editor.updateBlock(cursorBlock, {
      children: [...existingChildren, ...blocksToInsert],
    });

    // Get the refreshed block to find the new child IDs
    const refreshed = editor.getBlock(cursorBlock.id);
    const newChildren = refreshed?.children?.slice(-blocksToInsert.length) || [];

    // Move cursor to the first inserted child that has content
    if (newChildren.length > 0) {
      const firstChild = newChildren[0];
      if (firstChild) {
        try {
          editor.setTextCursorPosition(firstChild, "end");
        } catch {
          // Some blocks (content: "none") can't receive cursor, that's fine
        }
      }
    }
  } catch {
    // Fallback: insert as flat siblings if children approach fails
    const insertedBlocks = editor.insertBlocks(blocksToInsert, cursorBlock, "after");
    if (insertedBlocks && insertedBlocks.length > 0) {
      const firstInserted = insertedBlocks[0];
      if (firstInserted) {
        try {
          editor.setTextCursorPosition(firstInserted, "end");
        } catch {
          // Some blocks (content: "none") can't receive cursor, that's fine
        }
      }
    }
  }

  return true;
}
