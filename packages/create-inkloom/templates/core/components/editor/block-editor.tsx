"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import { generateEditorThemeCSS, getEditorFontUrl } from "@/lib/generate-editor-theme";
import type { ThemePreset } from "@/lib/theme-presets";
import { BlockNoteView } from "./custom-blocknote-view";
import "@blocknote/mantine/style.css";
import "./editor-theme.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  FilePanelController,
  SideMenuController,
} from "@blocknote/react";
import {
  RiInfoCardLine,
  RiLayoutGridLine,
  RiAlarmWarningLine,
  RiWindow2Line,
  RiListOrdered,
  RiBracesLine,
  RiLayoutColumnLine,
} from "react-icons/ri";
import { Tag, Smile } from "lucide-react";
import { schema, type CustomBlockNoteEditor, type CustomPartialBlock } from "./schema";
import {
  isGroupChildType,
  isContainerType,
  GROUP_MAPPINGS,
  getGroupContainer,
  getGroupChildren,
} from "./custom-blocks/group-utils";
import { EditorFormattingToolbar } from "./toolbar";

// Migrate old code blocks (with inline content) to new format (with code prop)
function migrateCodeBlocks(blocks: CustomPartialBlock[]): CustomPartialBlock[] {
  return blocks.map((block: CustomPartialBlock) => {
    // Recursively migrate children
    if (block.children && block.children.length > 0) {
      block = {
        ...block,
        children: migrateCodeBlocks(block.children as CustomPartialBlock[]),
      };
    }

    // Migrate codeBlock with inline content to use code prop
    if (block.type === "codeBlock") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = (block as any).content;
      if (Array.isArray(content) && content.length > 0) {
        const codeText = content
          .map((item: { type: string; text?: string }) =>
            item.type === "text" ? item.text || "" : ""
          )
          .join("");

        return {
          ...block,
          props: {
            ...block.props,
            code: codeText,
          },
          content: undefined,
        };
      }
    }

    return block;
  });
}

interface BlockEditorProps {
  content: string | null;
  onChange: (content: string) => void;
  editable?: boolean;
  themePreset?: ThemePreset;
  customPrimaryColor?: string;
  customFonts?: { heading?: string; body?: string; code?: string };
}

export function BlockEditor({
  content,
  onChange,
  editable = true,
  themePreset = "default",
  customPrimaryColor,
  customFonts,
}: BlockEditorProps) {
  // Generate theme CSS for the editor wrapper
  const themeCSS = useMemo(
    () => generateEditorThemeCSS("editor-theme-wrapper", themePreset, customPrimaryColor),
    [themePreset, customPrimaryColor]
  );

  const fontUrl = useMemo(() => getEditorFontUrl(themePreset), [themePreset]);

  // Inject the font link tag — avoid duplicates by tracking via a ref
  const fontLinkRef = useRef<HTMLLinkElement | null>(null);
  useEffect(() => {
    if (!fontUrl) return;
    // Remove previous link if font URL changed
    if (fontLinkRef.current) {
      fontLinkRef.current.remove();
      fontLinkRef.current = null;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontUrl;
    document.head.appendChild(link);
    fontLinkRef.current = link;
    return () => {
      if (fontLinkRef.current) {
        fontLinkRef.current.remove();
        fontLinkRef.current = null;
      }
    };
  }, [fontUrl]);
  const parsedContent = useMemo(() => {
    if (!content) {
      return undefined;
    }
    try {
      const blocks = JSON.parse(content) as CustomPartialBlock[];
      // BlockNote requires at least one block — treat empty arrays as undefined
      if (blocks.length === 0) return undefined;
      // Migrate old code blocks to new format
      return migrateCodeBlocks(blocks);
    } catch {
      return undefined;
    }
  }, [content]);

  const editor = useCreateBlockNote({
    schema,
    initialContent: parsedContent,
    // Enable header row/column toggles on tables
    tables: { headers: true },
  });

  // Defensive: if the editor somehow initialized empty despite having content,
  // force-replace the document.
  useEffect(() => {
    const docBlocks = editor.document;

    if (!parsedContent || parsedContent.length <= 1) return;

    // Check if the editor's document is effectively empty (only default paragraph)
    const isEffectivelyEmpty =
      docBlocks.length <= 1 &&
      docBlocks[0]?.type === "paragraph" &&
      (!docBlocks[0]?.content || (Array.isArray(docBlocks[0].content) && docBlocks[0].content.length === 0));

    if (isEffectivelyEmpty) {
      editor.replaceBlocks(editor.document, parsedContent);

      // Clear undo/redo history so the content load isn't undoable
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bnEditor = editor as any;
        const tiptapEditor = bnEditor._tiptapEditor;
        if (tiptapEditor) {
          const { tr } = tiptapEditor.state;
          tr.setMeta("addToHistory", false);
          tiptapEditor.view.dispatch(tr);
        }
        // Clear BlockNote's _stateManager transaction history
        if (bnEditor._stateManager) {
          const sm = bnEditor._stateManager;
          if (sm._undoStack) sm._undoStack.length = 0;
          if (sm._redoStack) sm._redoStack.length = 0;
          if (sm.undoStack && Array.isArray(sm.undoStack)) sm.undoStack.length = 0;
          if (sm.redoStack && Array.isArray(sm.redoStack)) sm.redoStack.length = 0;
        }
      });
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monkey-patch updateBlock and insertBlocks to handle block creation within group
  // children (tab, step, etc.). When the slash menu is used inside a group child's
  // content area, new blocks must be inserted as CHILDREN of the group child so they
  // render inside the container's visual panel area.
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bnEditor = editor as any;
    if (bnEditor.__groupAwareUpdateBlockPatched) return;
    bnEditor.__groupAwareUpdateBlockPatched = true;

    const originalUpdateBlock = bnEditor.updateBlock.bind(bnEditor);
    const originalInsertBlocks = bnEditor.insertBlocks.bind(bnEditor);

    // Patch updateBlock: intercept type conversions on group children.
    bnEditor.updateBlock = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockToUpdate: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: any,
    ) => {
      const block = typeof blockToUpdate === "string"
        ? bnEditor.getBlock(blockToUpdate)
        : blockToUpdate;

      if (
        block &&
        update.type &&
        update.type !== block.type &&
        isGroupChildType(block.type)
      ) {
        const existingChildren = block.children || [];
        try {
          const updatedBlock = originalUpdateBlock(block, {
            content: [],
            children: [...existingChildren, update],
          });

          const refreshed = bnEditor.getBlock(block.id);
          if (refreshed && refreshed.children && refreshed.children.length > 0) {
            const lastChild = refreshed.children[refreshed.children.length - 1];
            if (lastChild) {
              try {
                bnEditor.setTextCursorPosition(lastChild, "end");
              } catch {
                // Some blocks (content: "none") can't receive cursor
              }
              return lastChild;
            }
          }
          return updatedBlock;
        } catch {
          try {
            originalUpdateBlock(block, { content: [] });
          } catch {
            // Ignore errors from content clearing
          }
          const insertedBlocks = originalInsertBlocks(
            [update],
            block,
            "after",
          );
          const newBlock = insertedBlocks?.[0];
          if (newBlock) {
            try {
              bnEditor.setTextCursorPosition(newBlock, "end");
            } catch {
              // Some blocks (content: "none") can't receive cursor
            }
          }
          return newBlock || block;
        }
      }

      return originalUpdateBlock(blockToUpdate, update);
    };

    // Patch insertBlocks: when inserting "after" a group child, redirect to
    // insert as children of the group child.
    const groupRelatedTypes = new Set([
      ...Object.keys(GROUP_MAPPINGS),
      ...Object.values(GROUP_MAPPINGS),
    ]);

    bnEditor.insertBlocks = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocksToInsert: any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      referenceBlock: any,
      placement: "before" | "after",
    ) => {
      const ref = typeof referenceBlock === "string"
        ? bnEditor.getBlock(referenceBlock)
        : referenceBlock;

      const isGroupRelatedInsertion = blocksToInsert.some(
        (b: { type?: string }) => b.type && groupRelatedTypes.has(b.type)
      );

      if (
        ref &&
        placement === "after" &&
        isGroupChildType(ref.type) &&
        !isGroupRelatedInsertion
      ) {
        const existingChildren = ref.children || [];
        try {
          originalUpdateBlock(ref, {
            children: [...existingChildren, ...blocksToInsert],
          });

          const refreshed = bnEditor.getBlock(ref.id);
          const newChildren = refreshed?.children?.slice(-blocksToInsert.length) || [];

          if (newChildren.length > 0) {
            const firstChild = newChildren[0];
            if (firstChild) {
              try {
                bnEditor.setTextCursorPosition(firstChild, "end");
              } catch {
                // Some blocks (content: "none") can't receive cursor
              }
            }
          }

          return newChildren;
        } catch {
          // Fallback to normal insertion
        }
      }

      return originalInsertBlocks(blocksToInsert, referenceBlock, placement);
    };
  }, [editor]);

  // Custom slash menu items for custom blocks
  const getCustomSlashMenuItems = useMemo(() => {
    return (editorInstance: CustomBlockNoteEditor) => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...getDefaultReactSlashMenuItems(editorInstance as any),
      {
        title: "Card",
        subtext: "A highlighted card with a title",
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "card" as const, props: { title: "Card Title" } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["card", "box"],
        group: "Components",
        icon: <RiInfoCardLine size={18} />,
      },
      {
        title: "Card Group",
        subtext: "A grid of cards",
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "cardGroup" as const, props: { cols: "2" as const } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["cardgroup", "cards", "grid"],
        group: "Components",
        icon: <RiLayoutGridLine size={18} />,
      },
      {
        title: "Callout",
        subtext: "A callout block for important info",
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "callout" as const, props: { type: "info" as const } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["callout", "note", "info", "warning", "tip", "alert"],
        group: "Components",
        icon: <RiAlarmWarningLine size={18} />,
      },
      {
        title: "Tabs",
        subtext: "Tabbed content sections",
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "tabs" as const },
              { type: "tab" as const, props: { title: "Tab 1" } },
              { type: "tab" as const, props: { title: "Tab 2" } },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["tabs", "tabbed", "sections"],
        group: "Components",
        icon: <RiWindow2Line size={18} />,
      },
      {
        title: "Steps",
        subtext: "A numbered step-by-step guide",
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "steps" as const },
              { type: "step" as const, props: { title: "Step 1" } },
              { type: "step" as const, props: { title: "Step 2" } },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["steps", "procedure", "tutorial", "guide"],
        group: "Components",
        icon: <RiListOrdered size={18} />,
      },
      {
        title: "Code Group",
        subtext: "Grouped code blocks with tabs",
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "codeGroup" as const }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["codegroup", "code", "snippet"],
        group: "Components",
        icon: <RiBracesLine size={18} />,
      },
      {
        title: "Columns",
        subtext: "Side-by-side column layout",
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "columns" as const, props: { cols: "2" as const } },
              { type: "column" as const },
              { type: "column" as const },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["columns", "grid", "layout"],
        group: "Components",
        icon: <RiLayoutColumnLine size={18} />,
      },
      {
        title: "Badge",
        subtext: "Inline badge or label",
        onItemClick: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editorInstance as any).insertInlineContent([
            {
              type: "text",
              text: "Badge",
              styles: { badge: "#6b7280" },
            },
          ]);
        },
        aliases: ["badge", "tag", "label", "chip", "pill"],
        group: "Inline",
        icon: <Tag size={18} />,
      },
      {
        title: "Icon",
        subtext: "Insert an inline icon",
        onItemClick: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editorInstance as any).insertInlineContent([
            {
              type: "icon",
              props: { icon: "lucide:star", size: "16" },
            },
            " ",
          ]);
        },
        aliases: ["icon", "emoji", "symbol"],
        group: "Inline",
        icon: <Smile size={18} />,
      },
    ];
  }, []);

  // Handle Backspace/Delete for custom blocks
  useEffect(() => {
    if (!editor?.domElement) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bnEditor = editor as any;

    const handleCustomBlockDeletion = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;

      const tiptap = bnEditor._tiptapEditor;
      if (!tiptap) return;

      const state = tiptap.state;
      const { selection } = state;

      if (!selection.empty) return;

      let cursorPos;
      try {
        cursorPos = editor.getTextCursorPosition();
      } catch {
        return;
      }

      const { block, prevBlock, nextBlock } = cursorPos;
      const { $from } = selection;

      const isDeletableCustomBlock = (blockType: string): boolean => {
        return isGroupChildType(blockType) || isContainerType(blockType) ||
          blockType === "callout";
      };

      const removeBlockWithChildren = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blockToRemove: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adjacentBlock: any,
        insertDirection: "before" | "after",
      ) => {
        const children = blockToRemove.children || [];
        if (children.length > 0) {
          if (insertDirection === "before") {
            for (const child of children) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (editor as any).insertBlocks(
                [{ ...child, id: undefined }],
                adjacentBlock,
                "before",
              );
            }
          } else {
            for (let i = children.length - 1; i >= 0; i--) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (editor as any).insertBlocks(
                [{ ...children[i], id: undefined }],
                adjacentBlock,
                "after",
              );
            }
          }
        }

        const blockIdsToRemove: string[] = [blockToRemove.id];
        if (isGroupChildType(blockToRemove.type)) {
          const containerInfo = getGroupContainer(editor, blockToRemove);
          if (containerInfo && containerInfo.siblings.length <= 1) {
            blockIdsToRemove.push(containerInfo.container.id);
          }
        }

        editor.removeBlocks(blockIdsToRemove);
      };

      if (e.key === "Backspace") {
        const atStart = $from.parentOffset === 0;

        if (atStart && prevBlock && isDeletableCustomBlock(prevBlock.type)) {
          if (isGroupChildType(prevBlock.type)) {
            const containerInfo = getGroupContainer(editor, prevBlock);
            if (containerInfo) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          if (isContainerType(prevBlock.type)) {
            const groupChildren = getGroupChildren(editor, prevBlock);
            if (groupChildren.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          e.preventDefault();
          e.stopPropagation();
          removeBlockWithChildren(prevBlock, block, "before");
          return;
        }

        if (atStart && isDeletableCustomBlock(block.type)) {
          const blockContent = block.content;
          const isEmpty = !blockContent || (Array.isArray(blockContent) &&
            (blockContent.length === 0 ||
              (blockContent.length === 1 && blockContent[0]?.type === "text" &&
                (!blockContent[0]?.text || blockContent[0]?.text === ""))));

          if (isEmpty) {
            if (isGroupChildType(block.type)) {
              const containerInfo = getGroupContainer(editor, block);
              if (containerInfo) {
                const hasChildren = block.children && block.children.length > 0;
                if (hasChildren || containerInfo.siblings.length > 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
              }
            }

            e.preventDefault();
            e.stopPropagation();

            const children = block.children || [];
            const insertRef = nextBlock || prevBlock;
            if (children.length > 0 && insertRef) {
              const dir = nextBlock ? "before" : "after";
              if (dir === "before") {
                for (const child of children) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor as any).insertBlocks(
                    [{ ...child, id: undefined }],
                    insertRef,
                    "before",
                  );
                }
              } else {
                for (let i = children.length - 1; i >= 0; i--) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor as any).insertBlocks(
                    [{ ...children[i], id: undefined }],
                    insertRef,
                    "after",
                  );
                }
              }
            }

            const blockIdsToRemove: string[] = [block.id];
            if (isGroupChildType(block.type)) {
              const containerInfo = getGroupContainer(editor, block);
              if (containerInfo && containerInfo.siblings.length <= 1) {
                blockIdsToRemove.push(containerInfo.container.id);
              }
            }

            editor.removeBlocks(blockIdsToRemove);

            if (nextBlock) {
              try {
                editor.setTextCursorPosition(nextBlock, "start");
              } catch { /* block may not accept cursor */ }
            } else if (prevBlock) {
              try {
                editor.setTextCursorPosition(prevBlock, "end");
              } catch { /* block may not accept cursor */ }
            }
            return;
          }
        }
      }

      if (e.key === "Delete") {
        const atEnd = $from.parentOffset === $from.parent.content.size;

        if (atEnd && nextBlock && isDeletableCustomBlock(nextBlock.type)) {
          if (isGroupChildType(nextBlock.type)) {
            const containerInfo = getGroupContainer(editor, nextBlock);
            if (containerInfo) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          if (isContainerType(nextBlock.type)) {
            const groupChildren = getGroupChildren(editor, nextBlock);
            if (groupChildren.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          e.preventDefault();
          e.stopPropagation();
          removeBlockWithChildren(nextBlock, block, "after");
          return;
        }
      }
    };

    editor.domElement.addEventListener("keydown", handleCustomBlockDeletion, true);
    return () => {
      editor.domElement?.removeEventListener("keydown", handleCustomBlockDeletion, true);
    };
  }, [editor?.domElement]);

  const handleChange = useCallback(() => {
    const serialized = JSON.stringify(editor.document);
    onChange(serialized);
  }, [editor, onChange]);

  return (
    <div className="editor-theme-wrapper min-h-full">
      {/* Inject theme CSS variables for the editor */}
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleChange}
        className="min-h-[500px]"
        slashMenu={false}
        formattingToolbar={false}
      >
        <FilePanelController />
        <SideMenuController />
        <SuggestionMenuController
          triggerCharacter="/"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getItems={async (query: string) => {
            const items = getCustomSlashMenuItems(editor as unknown as CustomBlockNoteEditor);
            return items.filter(
              (item: { title: string; aliases?: string[] }) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.aliases?.some((alias: string) =>
                  alias.toLowerCase().includes(query.toLowerCase())
                )
            );
          }}
        />
        <EditorFormattingToolbar />
      </BlockNoteView>
    </div>
  );
}
