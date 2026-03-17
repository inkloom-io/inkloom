"use client";

// Group container types and their child types
export const GROUP_MAPPINGS = {
  cardGroup: "card",
  tabs: "tab",
  steps: "step",
  codeGroup: "codeBlock",
  accordionGroup: "accordion",
  columns: "column",
} as const;

export type GroupContainerType = keyof typeof GROUP_MAPPINGS;
export type GroupChildType = (typeof GROUP_MAPPINGS)[GroupContainerType];

// Generic block type for our purposes
interface GenericBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
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

    // Skip sibling blocks of the same type (other children in the group)
    if (prevType === block.type) {
      continue;
    }

    // Check if this is the group container we're looking for
    if (prevType === expectedContainerType) {
      containerIndex = i;
      containerType = prevType as GroupContainerType;
      break;
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
