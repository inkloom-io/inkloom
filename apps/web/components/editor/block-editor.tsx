"use client";

// Initialize linkifyjs with custom protocols before BlockNote loads
// This prevents the "already initialized" warning
import "@/lib/linkify-init";

import { useCallback, useMemo, useId, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { en as defaultDictionary } from "@blocknote/core/locales";
// Use custom BlockNoteView with portal fix for link creation popover
import { BlockNoteView } from "./custom-blocknote-view";
import "@blocknote/mantine/style.css";
import "./editor-theme.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
  FilePanelController,
  SideMenuController,
} from "@blocknote/react";
import { CustomFilePanel } from "./custom-file-panel";
import { StickyHoverSideMenu } from "./custom-side-menu";
import { useMutation } from "convex/react";
import * as Y from "yjs";
import { MessageSquarePlus, Tag, Smile } from "lucide-react";
import {
  RiInfoCardLine,
  RiLayoutGridLine,
  RiAlarmWarningLine,
  RiWindow2Line,
  RiListOrdered,
  RiBracesLine,
  RiExpandUpDownLine,
  RiStackLine,
  RiFileList3Line,
  RiArrowDownSLine,
  RiLayoutColumnLine,
  RiCropLine,
  RiFunctionLine,
  RiVideoLine,
  RiCodeBoxLine,
} from "react-icons/ri";
import { ActionIcon as MantineActionIcon, Tooltip as MantineTooltip } from "@mantine/core";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemePreset } from "@/lib/theme-presets";
import {
  generateEditorThemeCSS,
  getEditorFontUrl,
} from "@/lib/generate-editor-theme";
import { schema, type CustomBlockNoteEditor, type CustomPartialBlock } from "./schema";
import { CommentHoverTooltip } from "./comments/comment-hover-tooltip";
import { BadgeToolbarButton } from "./toolbar/badge-toolbar-button";
import { IconToolbarButton } from "./toolbar/icon-toolbar-button";
import { isGroupChildType, isContainerType, GROUP_MAPPINGS, getGroupContainer } from "./custom-blocks/group-utils";

// Collaboration configuration for real-time editing
export interface CollaborationConfig {
  // Yjs XML fragment for document content
  fragment: Y.XmlFragment;
  // User info for cursors
  user?: {
    name: string;
    color: string;
  };
  // Provider for awareness (cursor positions)
  provider: unknown;
}

// Comment thread for inline highlighting
export interface CommentThread {
  _id: string;
  blockId: string;
  quotedText?: string;
  status: "open" | "resolved";
  // Position offsets for disambiguating multiple occurrences of same text
  inlineStart?: number;
  inlineEnd?: number;
  // Additional data for hover tooltip
  authorName?: string;
  authorAvatar?: string | null;
  commentContent?: string;
  commentCount?: number;
  createdAt?: number;
}

// Migrate old code blocks (with inline content) to new format (with code prop)
function migrateCodeBlocks(blocks: CustomPartialBlock[]): CustomPartialBlock[] {
  return blocks.map((block: any) => {
    // Recursively migrate children
    if (block.children && block.children.length > 0) {
      block = {
        ...block,
        children: migrateCodeBlocks(block.children as CustomPartialBlock[]),
      };
    }

    // Migrate codeBlock with inline content to use code prop
    if (block.type === "codeBlock") {
      // Check if this is an old-style code block with inline content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = (block as any).content;
      if (Array.isArray(content) && content.length > 0) {
        // Extract text from inline content
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
          content: undefined, // Remove inline content
        };
      }
    }

    return block;
  });
}

interface BlockEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditorReady?: (editor: any) => void;
  editable?: boolean;
  themePreset?: ThemePreset;
  customPrimaryColor?: string;
  customBackgroundColorLight?: string;
  customBackgroundColorDark?: string;
  customBackgroundSubtleColorLight?: string;
  customBackgroundSubtleColorDark?: string;
  projectId?: Id<"projects">;
  // Optional collaboration configuration for real-time editing
  collaboration?: CollaborationConfig | null;
  // Comment functionality
  pageId?: Id<"pages">;
  currentUserId?: Id<"users">;
  onAddComment?: (selection: {
    blockId: string;
    quotedText?: string;
    inlineStart?: number;
    inlineEnd?: number;
  }) => void;
  // Comment threads for inline highlighting
  commentThreads?: CommentThread[];
  onThreadClick?: (threadId: string) => void;
}

export function BlockEditor({
  initialContent,
  onChange,
  onEditorReady,
  editable = true,
  themePreset = "default",
  customPrimaryColor,
  customBackgroundColorLight,
  customBackgroundColorDark,
  customBackgroundSubtleColorLight,
  customBackgroundSubtleColorDark,
  projectId,
  collaboration,
  pageId,
  currentUserId,
  onAddComment,
  commentThreads,
  onThreadClick,
}: BlockEditorProps) {
  const t = useTranslations("editor.blockEditor");
  const editorId = useId();

  const createAsset = useMutation(api.assets.createAsset);

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      if (!projectId) {
        throw new Error("Project ID is required for file uploads");
      }

      // Get a presigned URL from our API
      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          projectId,
        }),
      });

      if (!presignResponse.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { presignedUrl, r2Key, publicUrl } = await presignResponse.json();

      // Upload the file directly to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Create an asset record
      const { url } = await createAsset({
        projectId,
        r2Key,
        url: publicUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      if (!url) {
        throw new Error("Failed to create asset record");
      }

      return url;
    },
    [projectId, createAsset]
  );

  const parsedContent = useMemo(() => {
    if (!initialContent) {
      return undefined;
    }
    try {
      const blocks = JSON.parse(initialContent) as CustomPartialBlock[];
      // BlockNote requires at least one block — treat empty arrays as undefined
      if (blocks.length === 0) return undefined;
      // Migrate old code blocks to new format
      return migrateCodeBlocks(blocks);
    } catch {
      return undefined;
    }
  }, [initialContent]);

  const customDictionary = useMemo(
    () => ({
      ...defaultDictionary,
      formatting_toolbar: {
        ...defaultDictionary.formatting_toolbar,
        link: {
          ...defaultDictionary.formatting_toolbar.link,
          // Change shortcut hint from Mod+K to Mod+Shift+K
          // (Mod+K conflicts with command palette, Mod+L conflicts with browser address bar)
          secondary_tooltip: "Mod+Shift+K",
        },
      },
      file_panel: {
        ...defaultDictionary.file_panel,
        upload: {
          ...defaultDictionary.file_panel.upload,
          file_placeholder: {
            image: "Upload Image",
            video: "Upload Video",
            audio: "Upload Audio",
            file: "Upload File",
          },
        },
        embed: {
          ...defaultDictionary.file_panel.embed,
          embed_button: {
            image: "Embed Image",
            video: "Embed Video",
            audio: "Embed Audio",
            file: "Embed File",
          },
        },
      },
    }),
    []
  );

  // Create editor with optional collaboration support
  // When collaborating, Yjs manages state so we skip initialContent
  const collaborationConfig = collaboration && collaboration.user
    ? {
        fragment: collaboration.fragment,
        user: collaboration.user,
        provider: collaboration.provider as any,
      }
    : undefined;

  const editor = useCreateBlockNote({
    schema,
    // Only use initialContent when NOT collaborating (Yjs handles state otherwise)
    initialContent: collaboration ? undefined : parsedContent,
    uploadFile: projectId ? uploadFile : undefined,
    dictionary: customDictionary,
    // Enable header row/column toggles on tables
    tables: { headers: true },
    // Collaboration configuration for real-time editing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collaboration: collaborationConfig,
  });

  // Defensive: if the editor somehow initialized empty despite having content,
  // force-replace the document. This catches edge cases in BlockNote's
  // useCreateBlockNote where initialContent is silently ignored.
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
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monkey-patch updateBlock and insertBlocks to handle block creation within group
  // children (tab, frameContent, step, etc.). When the slash menu is used inside a
  // group child's content area, new blocks must be inserted as CHILDREN of the group
  // child so they render inside the container's visual panel — not as flat siblings
  // that would appear outside the container.
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bnEditor = editor as any;
    // Only patch once
    if (bnEditor.__groupAwareUpdateBlockPatched) return;
    bnEditor.__groupAwareUpdateBlockPatched = true;

    const originalUpdateBlock = bnEditor.updateBlock.bind(bnEditor);
    const originalInsertBlocks = bnEditor.insertBlocks.bind(bnEditor);

    // Patch updateBlock: intercept type conversions on group children.
    // When BlockNote's insertOrUpdateBlockForSlashMenu tries to change a group child
    // (e.g., tab → image), ProseMirror rejects it because the content models differ.
    // Instead, we clear the group child's content and add the new block as a child.
    bnEditor.updateBlock = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blockToUpdate: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: any,
    ) => {
      // Get the actual block object
      const block = typeof blockToUpdate === "string"
        ? bnEditor.getBlock(blockToUpdate)
        : blockToUpdate;

      // If the update changes the type AND the current block is a group child,
      // insert the new block as a child instead of converting the type
      if (
        block &&
        update.type &&
        update.type !== block.type &&
        isGroupChildType(block.type)
      ) {
        const existingChildren = block.children || [];
        try {
          // Clear "/" trigger text and add new block as a nested child
          const updatedBlock = originalUpdateBlock(block, {
            content: [],
            children: [...existingChildren, update],
          });

          // Get the freshly created child block and set cursor to it
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
          // Fallback: insert as a flat sibling if children approach fails
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

    // Patch insertBlocks: when inserting "after" a group child (e.g., from custom
    // slash menu items like Card, Callout, etc.), redirect to insert as children
    // of the group child so they appear inside the container's content area.
    // Build sets of group-related types to exclude from the insertBlocks
    // redirect. When adding new tabs, frameContent, steps, etc. as flat siblings
    // of an existing group child, these should NOT be redirected to children.
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

      // Only redirect to children when inserting "content" blocks (headings,
      // images, paragraphs, etc.) after a group child. Do NOT intercept
      // insertions of group-related blocks (adding new tabs, steps, etc.)
      // as those must remain flat siblings for the group structure to work.
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

          // Set cursor to the first inserted child that has content
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

  // Custom slash menu items for Card and CardGroup
  const getCustomSlashMenuItems = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (editorInstance: CustomBlockNoteEditor) => [
      ...getDefaultReactSlashMenuItems(editorInstance as any),
      {
        title: t("slashMenu.card"),
        subtext: t("slashMenu.cardSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "card" as const, props: { title: t("slashMenu.cardDefaultTitle") } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["card", "box"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiInfoCardLine size={18} />,
      },
      {
        title: t("slashMenu.cardGroup"),
        subtext: t("slashMenu.cardGroupSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "cardGroup" as const, props: { cols: "2" as const } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["cardgroup", "cards", "grid"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiLayoutGridLine size={18} />,
      },
      {
        title: t("slashMenu.callout"),
        subtext: t("slashMenu.calloutSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "callout" as const, props: { type: "info" as const } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["callout", "note", "info", "warning", "tip", "alert"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiAlarmWarningLine size={18} />,
      },
      {
        title: t("slashMenu.tabs"),
        subtext: t("slashMenu.tabsSubtext"),
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "tabs" as const },
              { type: "tab" as const, props: { title: t("slashMenu.tabDefault", { number: 1 }) } },
              { type: "tab" as const, props: { title: t("slashMenu.tabDefault", { number: 2 }) } },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["tabs", "tabbed", "sections"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiWindow2Line size={18} />,
      },
      {
        title: t("slashMenu.steps"),
        subtext: t("slashMenu.stepsSubtext"),
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "steps" as const },
              { type: "step" as const, props: { title: t("slashMenu.stepDefault", { number: 1 }) } },
              { type: "step" as const, props: { title: t("slashMenu.stepDefault", { number: 2 }) } },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["steps", "procedure", "tutorial", "guide"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiListOrdered size={18} />,
      },
      {
        title: t("slashMenu.codeGroup"),
        subtext: t("slashMenu.codeGroupSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "codeGroup" as const }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["codegroup", "code", "snippet"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiBracesLine size={18} />,
      },
      {
        title: t("slashMenu.accordion"),
        subtext: t("slashMenu.accordionSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "accordion" as const, props: { title: t("slashMenu.accordionDefaultTitle") } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["accordion", "collapse", "expand", "faq", "toggle"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiExpandUpDownLine size={18} />,
      },
      {
        title: t("slashMenu.accordionGroup"),
        subtext: t("slashMenu.accordionGroupSubtext"),
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "accordionGroup" as const },
              { type: "accordion" as const, props: { title: t("slashMenu.accordionDefault", { number: 1 }) } },
              { type: "accordion" as const, props: { title: t("slashMenu.accordionDefault", { number: 2 }) } },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["accordiongroup", "faqgroup", "collapsible"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiStackLine size={18} />,
      },
      {
        title: t("slashMenu.responseField"),
        subtext: t("slashMenu.responseFieldSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "responseField" as const, props: { name: "", type: "", required: "false" } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["response", "field", "param", "parameter", "api"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiFileList3Line size={18} />,
      },
      {
        title: t("slashMenu.expandable"),
        subtext: t("slashMenu.expandableSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "expandable" as const, props: { title: "Details", type: "" } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["expandable", "collapsible", "details", "toggle"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiArrowDownSLine size={18} />,
      },
      {
        title: t("slashMenu.columns"),
        subtext: t("slashMenu.columnsSubtext"),
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
        group: t("slashMenu.componentsGroup"),
        icon: <RiLayoutColumnLine size={18} />,
      },
      {
        title: t("slashMenu.frame"),
        subtext: t("slashMenu.frameSubtext"),
        onItemClick: () => {
          const cursorBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.insertBlocks(
            [
              { type: "frame" as const },
              { type: "frameContent" as const },
            ],
            cursorBlock,
            "after"
          );
        },
        aliases: ["frame", "border", "container", "wrap"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiCropLine size={18} />,
      },
      {
        title: t("slashMenu.latex"),
        subtext: t("slashMenu.latexSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "latex" as const, props: { expression: "" } }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["latex", "math", "equation", "katex"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiFunctionLine size={18} />,
      },
      {
        title: t("slashMenu.video"),
        subtext: t("slashMenu.videoSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "video" as const }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["video", "mp4"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiVideoLine size={18} />,
      },
      {
        title: t("slashMenu.embed"),
        subtext: t("slashMenu.embedSubtext"),
        onItemClick: () => {
          editorInstance.insertBlocks(
            [{ type: "iframe" as const }],
            editorInstance.getTextCursorPosition().block,
            "after"
          );
        },
        aliases: ["embed", "iframe", "youtube", "vimeo"],
        group: t("slashMenu.componentsGroup"),
        icon: <RiCodeBoxLine size={18} />,
      },
      {
        title: t("slashMenu.badge"),
        subtext: t("slashMenu.badgeSubtext"),
        onItemClick: () => {
          // Insert text with the badge style applied
          (editorInstance as any).insertInlineContent([
            {
              type: "text",
              text: t("slashMenu.badgeDefaultText"),
              styles: { badge: "#6b7280" },
            },
          ]);
        },
        aliases: ["badge", "tag", "label", "chip", "pill"],
        group: t("slashMenu.inlineGroup"),
        icon: <Tag size={18} />,
      },
      {
        title: t("slashMenu.icon"),
        subtext: t("slashMenu.iconSubtext"),
        onItemClick: () => {
          // Insert a star icon inline content at the cursor
          (editorInstance as any).insertInlineContent([
            {
              type: "icon",
              props: { icon: "lucide:star", size: "16" },
            },
            " ",
          ]);
        },
        aliases: ["icon", "emoji", "symbol"],
        group: t("slashMenu.inlineGroup"),
        icon: <Smile size={18} />,
      },
    ];
  }, [t]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Fix Yjs UndoManager to ensure undo/redo works in collaboration mode.
  // The issue is that the UndoManager's afterTransactionHandler wasn't being
  // called correctly due to event registration timing. Re-registering it fixes the problem.
  useEffect(() => {
    if (!editor || !collaboration) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bnEditor = editor as any;
    const tiptapEditor = bnEditor._tiptapEditor;
    if (!tiptapEditor) return;

    // Find the y-undo plugin's UndoManager
    const state = tiptapEditor.state;
    for (const plugin of state.plugins) {
      const pluginState = plugin.getState?.(state);
      if (pluginState && typeof pluginState === 'object' && 'undoManager' in pluginState) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const undoManager = (pluginState as any).undoManager;
        if (!undoManager) break;

        const yDoc = undoManager.doc;
        if (!yDoc) break;

        // The key fix: re-register the afterTransactionHandler
        // For some reason the original registration doesn't work correctly
        // when collaboration is enabled. Re-registering fixes it.
        const handler = undoManager.afterTransactionHandler;
        if (handler) {
          yDoc.off('afterTransaction', handler);
          yDoc.on('afterTransaction', handler);
        }

        // Ensure the UndoManager itself is in trackedOrigins (for undo/redo to work)
        // The UndoManager should add itself in constructor, but it seems to get lost
        if (!undoManager.trackedOrigins.has(undoManager)) {
          undoManager.trackedOrigins.add(undoManager);
        }

        // Also ensure the actual ySyncPluginKey from the plugin is in trackedOrigins
        for (const p of state.plugins) {
          if (p.key?.includes('y-sync')) {
            const syncKey = p.spec?.key;
            if (syncKey && !undoManager.trackedOrigins.has(syncKey)) {
              undoManager.trackedOrigins.add(syncKey);
            }
            break;
          }
        }

        break;
      }
    }
  }, [editor, collaboration]);

  // Handle Cmd+Shift+K for Create Link (and intercept Cmd+K which conflicts with command palette)
  // Note: Cmd+L conflicts with browser "focus address bar" shortcut
  useEffect(() => {
    if (!editor?.domElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Intercept Cmd+K (without shift) - let it bubble up to the command palette instead
      // BlockNote's internal handler uses capturing, so we need capturing too
      if (isMod && !e.shiftKey && e.key === "k") {
        e.stopPropagation();
        // Don't prevent default - let the command palette handle it
        return;
      }

      // Handle Cmd+Shift+K to open the Create Link popup
      // Check for both uppercase K (with shift) and lowercase k (some browsers report lowercase)
      if (isMod && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        e.stopPropagation();
        // Find and click the Create Link button
        const linkButton = document.querySelector('[data-test="createLink"]') as HTMLElement;
        if (linkButton) {
          linkButton.click();
        }
      }
    };

    // Use capturing phase to intercept before BlockNote's handler
    editor.domElement.addEventListener("keydown", handleKeyDown, true);
    return () => {
      editor.domElement?.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor?.domElement]);

  // Handle Backspace/Delete for custom blocks (accordion, callout, step, etc.)
  // BlockNote's native backspace/delete can't merge or delete these blocks when their
  // inline content is empty (canMerge requires childCount > 0) or they have children
  // (getBottomNestedBlockInfo finds a non-empty child, preventing deletion).
  // This handler intercepts Backspace/Delete before BlockNote and handles these cases.
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

      // Only handle when selection is empty (cursor, not range)
      if (!selection.empty) return;

      let cursorPos;
      try {
        cursorPos = editor.getTextCursorPosition();
      } catch {
        return;
      }

      const { block, prevBlock, nextBlock } = cursorPos;
      const { $from } = selection;

      // Helper: check if a block type is a deletable custom block
      const isDeletableCustomBlock = (blockType: string): boolean => {
        return isGroupChildType(blockType) || isContainerType(blockType) ||
          blockType === "callout" || blockType === "expandable";
      };

      // Helper: remove a block, moving its children out first, and also
      // remove its group container if this was the last child
      const removeBlockWithChildren = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blockToRemove: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adjacentBlock: any,
        insertDirection: "before" | "after",
      ) => {
        // Move children of the block being deleted to be siblings
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
            // Insert in reverse to maintain order when using "after"
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

        // Check if this is the last group child — if so, remove the container too
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
          e.preventDefault();
          e.stopPropagation();
          removeBlockWithChildren(prevBlock, block, "before");
          return;
        }

        // Also handle: cursor at start of a custom block with empty inline content
        if (atStart && isDeletableCustomBlock(block.type)) {
          const blockContent = block.content;
          const isEmpty = !blockContent || (Array.isArray(blockContent) &&
            (blockContent.length === 0 ||
              (blockContent.length === 1 && blockContent[0]?.type === "text" &&
                (!blockContent[0]?.text || blockContent[0]?.text === ""))));

          if (isEmpty) {
            e.preventDefault();
            e.stopPropagation();

            // Move children out and remove this block
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

            // Also remove container if last child
            const blockIdsToRemove: string[] = [block.id];
            if (isGroupChildType(block.type)) {
              const containerInfo = getGroupContainer(editor, block);
              if (containerInfo && containerInfo.siblings.length <= 1) {
                blockIdsToRemove.push(containerInfo.container.id);
              }
            }

            editor.removeBlocks(blockIdsToRemove);

            // Move cursor to next or previous block
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
          e.preventDefault();
          e.stopPropagation();
          removeBlockWithChildren(nextBlock, block, "after");
          return;
        }
      }
    };

    // Use capturing phase to intercept before BlockNote's handler
    editor.domElement.addEventListener("keydown", handleCustomBlockDeletion, true);
    return () => {
      editor.domElement?.removeEventListener("keydown", handleCustomBlockDeletion, true);
    };
  }, [editor?.domElement]);

  // Workaround: BlockNote's table block uses a DOM-based NodeView that only sets
  // data-* attributes (like data-text-color) in the constructor. Unlike React-based
  // blocks, it has no update() method, so prop changes aren't reflected in the DOM
  // until a full re-mount (page refresh). This effect listens for transactions and
  // syncs the textColor prop to the DOM for table blocks.
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tiptap = (editor as any)._tiptapEditor;
    if (!tiptap) return;

    const syncTableAttributes = () => {
      const editorEl = editor.domElement;
      if (!editorEl) return;

      for (const block of editor.document) {
        if (block.type !== "table") continue;
        const blockEl = editorEl.querySelector(
          `.bn-block-outer[data-id="${block.id}"] [data-content-type="table"]`
        );
        if (!blockEl) continue;

        const props = block.props as Record<string, unknown> | undefined;
        const textColor = (props?.textColor as string) || "default";
        const current = blockEl.getAttribute("data-text-color");
        if (textColor !== "default" && current !== textColor) {
          blockEl.setAttribute("data-text-color", textColor);
        } else if (textColor === "default" && current) {
          blockEl.removeAttribute("data-text-color");
        }
      }
    };

    // Run after every ProseMirror transaction
    tiptap.on("transaction", syncTableAttributes);
    return () => {
      tiptap.off("transaction", syncTableAttributes);
    };
  }, [editor]);

  const handleChange = useCallback(() => {
    if (!onChange) return;
    const content = JSON.stringify(editor.document);
    onChange(content);
  }, [editor, onChange]);

  // Create a unique class name for this editor instance
  const wrapperClass = `editor-theme-${editorId.replace(/:/g, "")}`;

  // Generate theme-specific CSS with dark mode support
  const themeCSS = useMemo(
    () => generateEditorThemeCSS(wrapperClass, themePreset, customPrimaryColor, customBackgroundColorLight, customBackgroundColorDark, customBackgroundSubtleColorLight, customBackgroundSubtleColorDark),
    [wrapperClass, themePreset, customPrimaryColor, customBackgroundColorLight, customBackgroundColorDark, customBackgroundSubtleColorLight, customBackgroundSubtleColorDark]
  );

  // Get the font URL for the theme
  const fontUrl = useMemo(() => getEditorFontUrl(themePreset), [themePreset]);

  // Store highlighted ranges for click/hover detection
  const highlightedRangesRef = useRef<Map<string, { range: Range; threadId: string }>>(new Map());

  // Tooltip state for comment hover preview
  const [tooltipData, setTooltipData] = useState<{
    threadId: string;
    quotedText?: string;
    status: "open" | "resolved";
    authorName?: string;
    authorAvatar?: string | null;
    commentContent?: string;
    commentCount?: number;
    createdAt?: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Apply comment highlights using CSS Custom Highlight API (modern approach)
  // Falls back to interval-based DOM manipulation for older browsers
  useEffect(() => {
    if (!commentThreads || commentThreads.length === 0) {
      highlightedRangesRef.current.clear();
      return;
    }

    const threadsWithQuotedText = commentThreads.filter(t => t.quotedText);
    if (threadsWithQuotedText.length === 0) {
      highlightedRangesRef.current.clear();
      return;
    }

    // Check if CSS Custom Highlight API is supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CSS_HIGHLIGHT_SUPPORTED = typeof (CSS as any).highlights !== "undefined" &&
      typeof (window as any).Highlight !== "undefined";

    if (CSS_HIGHLIGHT_SUPPORTED) {
      // Inject styles for CSS Custom Highlight API (can't be in static CSS due to PostCSS)
      const styleId = "comment-highlight-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          ::highlight(comment-open) {
            background-color: rgba(251, 191, 36, 0.3);
            text-decoration-line: underline;
            text-decoration-color: rgb(251, 191, 36);
            text-decoration-thickness: 2px;
          }
          ::highlight(comment-resolved) {
            background-color: rgba(34, 197, 94, 0.2);
            text-decoration-line: underline;
            text-decoration-color: rgb(34, 197, 94);
            text-decoration-thickness: 2px;
          }
        `;
        document.head.appendChild(style);
      }

      // Use CSS Custom Highlight API (Chrome 105+, Safari 17.2+, Firefox 130+)
      const applyHighlights = () => {
        const editorContainer = document.querySelector(`.${wrapperClass} .bn-editor`);
        if (!editorContainer) return;

        const openRanges: Range[] = [];
        const resolvedRanges: Range[] = [];
        const newRangeMap = new Map<string, { range: Range; threadId: string }>();

        threadsWithQuotedText.forEach(thread => {
          if (!thread.quotedText) return;

          // Find the specific block by blockId using BlockNote's data-id attribute
          const blockElement = editorContainer.querySelector(`[data-id="${thread.blockId}"]`);
          const searchRoot = blockElement || editorContainer;

          // Collect all text nodes and their positions within the block
          const textNodes: { node: Text; startOffset: number }[] = [];
          let currentOffset = 0;

          const treeWalker = document.createTreeWalker(
            searchRoot,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                if (!node.parentElement?.closest(".bn-inline-content, .bn-block-content")) {
                  return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );

          let node: Text | null;
          while ((node = treeWalker.nextNode() as Text | null)) {
            textNodes.push({ node, startOffset: currentOffset });
            currentOffset += node.textContent?.length || 0;
          }

          // Get full text content of the block
          const fullText = textNodes.map(t => t.node.textContent || "").join("");

          // Find all occurrences of the quoted text
          const quotedText = thread.quotedText;
          const occurrences: number[] = [];
          let searchStart = 0;
          while (true) {
            const idx = fullText.indexOf(quotedText, searchStart);
            if (idx === -1) break;
            occurrences.push(idx);
            searchStart = idx + 1;
          }

          if (occurrences.length === 0) return;

          // Determine which occurrence to highlight
          let targetIndex: number;

          if (occurrences.length === 1) {
            // Only one occurrence - use it
            targetIndex = occurrences[0]!;
          } else if (thread.inlineStart !== undefined) {
            // Multiple occurrences - use inlineStart (block-relative offset) to find the right one
            // Find the occurrence that matches or is closest to the stored offset
            const closestOccurrence = occurrences.reduce((closest, offset) => {
              const currentDiff = Math.abs(offset - thread.inlineStart!);
              const closestDiff = Math.abs(closest - thread.inlineStart!);
              return currentDiff < closestDiff ? offset : closest;
            }, occurrences[0]!);
            targetIndex = closestOccurrence;
          } else {
            // No inlineStart stored - default to first occurrence
            targetIndex = occurrences[0]!;
          }
          if (targetIndex === undefined) return;

          // Find which text node contains the target position
          for (let i = 0; i < textNodes.length; i++) {
            const textNodeData = textNodes[i];
            if (!textNodeData) continue;

            const { node: textNode, startOffset } = textNodeData;
            const nodeText = textNode.textContent || "";
            const nodeEnd = startOffset + nodeText.length;

            // Check if this node contains the start of our target
            if (targetIndex >= startOffset && targetIndex < nodeEnd) {
              const localStart = targetIndex - startOffset;
              const localEnd = localStart + quotedText.length;

              // Check if the entire quoted text fits in this node
              if (localEnd <= nodeText.length) {
                try {
                  const range = document.createRange();
                  range.setStart(textNode, localStart);
                  range.setEnd(textNode, localEnd);

                  // Store for click detection
                  newRangeMap.set(thread._id, { range, threadId: thread._id });

                  if (thread.status === "resolved") {
                    resolvedRanges.push(range);
                  } else {
                    openRanges.push(range);
                  }
                } catch {
                  // Range creation can fail
                }
              }
              break;
            }
          }
        });

        // Update the ref with new ranges
        highlightedRangesRef.current = newRangeMap;

        // Clear and re-set highlights
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CSS as any).highlights.delete("comment-open");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CSS as any).highlights.delete("comment-resolved");

        if (openRanges.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (CSS as any).highlights.set("comment-open", new (window as any).Highlight(...openRanges));
        }
        if (resolvedRanges.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (CSS as any).highlights.set("comment-resolved", new (window as any).Highlight(...resolvedRanges));
        }
      };

      // Apply immediately and on editor changes
      const timeoutId = setTimeout(applyHighlights, 200);
      const intervalId = setInterval(applyHighlights, 500); // Re-apply periodically

      return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CSS as any).highlights.delete("comment-open");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CSS as any).highlights.delete("comment-resolved");
        highlightedRangesRef.current.clear();
      };
    } else {
      // Fallback: Use interval-based DOM manipulation
      // This isn't ideal but ensures highlights stay visible
      const applyHighlights = () => {
        const editorContainer = document.querySelector(`.${wrapperClass} .bn-editor`);
        if (!editorContainer) return;

        // Track which threads already have highlights
        const existingHighlights = new Set(
          Array.from(editorContainer.querySelectorAll("mark.comment-highlight"))
            .map(m => m.getAttribute("data-thread-id"))
        );

        threadsWithQuotedText.forEach(thread => {
          if (existingHighlights.has(thread._id) || !thread.quotedText) {
            return;
          }

          // Find the specific block by blockId using BlockNote's data-id attribute
          const blockElement = editorContainer.querySelector(`[data-id="${thread.blockId}"]`);
          const searchRoot = blockElement || editorContainer;

          // Collect all text nodes and their positions within the block
          const textNodes: { node: Text; startOffset: number }[] = [];
          let currentOffset = 0;

          const treeWalker = document.createTreeWalker(
            searchRoot,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                if (node.parentElement?.closest("mark.comment-highlight")) {
                  return NodeFilter.FILTER_REJECT;
                }
                if (!node.parentElement?.closest(".bn-inline-content, .bn-block-content")) {
                  return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );

          let node: Text | null;
          while ((node = treeWalker.nextNode() as Text | null)) {
            textNodes.push({ node, startOffset: currentOffset });
            currentOffset += node.textContent?.length || 0;
          }

          // Get full text content of the block
          const fullText = textNodes.map(t => t.node.textContent || "").join("");

          // Find all occurrences of the quoted text
          const quotedText = thread.quotedText;
          const occurrences: number[] = [];
          let searchStart = 0;
          while (true) {
            const idx = fullText.indexOf(quotedText, searchStart);
            if (idx === -1) break;
            occurrences.push(idx);
            searchStart = idx + 1;
          }

          if (occurrences.length === 0) return;

          // Determine which occurrence to highlight
          let targetIndex: number;

          if (occurrences.length === 1) {
            targetIndex = occurrences[0]!;
          } else if (thread.inlineStart !== undefined) {
            // Multiple occurrences - use inlineStart to find the right one
            const closestOccurrence = occurrences.reduce((closest, offset) => {
              const currentDiff = Math.abs(offset - thread.inlineStart!);
              const closestDiff = Math.abs(closest - thread.inlineStart!);
              return currentDiff < closestDiff ? offset : closest;
            }, occurrences[0]!);
            targetIndex = closestOccurrence;
          } else {
            targetIndex = occurrences[0]!;
          }

          // Find which text node contains the target position
          for (let i = 0; i < textNodes.length; i++) {
            const textNodeData = textNodes[i];
            if (!textNodeData) continue;

            const { node: textNode, startOffset } = textNodeData;
            const nodeText = textNode.textContent || "";
            const nodeEnd = startOffset + nodeText.length;

            if (targetIndex >= startOffset && targetIndex < nodeEnd) {
              const localStart = targetIndex - startOffset;
              const localEnd = localStart + quotedText.length;

              if (localEnd <= nodeText.length && textNode.parentNode) {
                try {
                  const range = document.createRange();
                  range.setStart(textNode, localStart);
                  range.setEnd(textNode, localEnd);

                  const mark = document.createElement("mark");
                  mark.className = `comment-highlight ${thread.status === "resolved" ? "comment-highlight-resolved" : "comment-highlight-open"}`;
                  mark.setAttribute("data-thread-id", thread._id);
                  mark.setAttribute("data-quoted-text", quotedText);
                  mark.title = "Click to view comment";

                  range.surroundContents(mark);
                } catch {
                  // Ignore errors
                }
              }
              break;
            }
          }
        });
      };

      // Apply immediately and re-apply on interval to combat editor re-renders
      const timeoutId = setTimeout(applyHighlights, 200);
      const intervalId = setInterval(applyHighlights, 300);

      return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
      };
    }
  }, [commentThreads, wrapperClass]);

  // Handle clicks on comment highlights (both <mark> elements and CSS Custom Highlight API)
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      // First, check for <mark> elements (fallback approach)
      const target = e.target as HTMLElement;
      if (target.classList.contains("comment-highlight")) {
        const threadId = target.getAttribute("data-thread-id");
        if (threadId && onThreadClick) {
          e.preventDefault();
          e.stopPropagation();
          onThreadClick(threadId);
          return;
        }
      }

      // Check for CSS Custom Highlight API ranges
      if (highlightedRangesRef.current.size > 0 && onThreadClick) {
        // Get the clicked position
        const selection = document.caretPositionFromPoint?.(e.clientX, e.clientY) ||
          // Fallback for browsers that don't support caretPositionFromPoint
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).caretRangeFromPoint?.(e.clientX, e.clientY);

        if (selection) {
          const clickedNode = selection.offsetNode || selection.startContainer;
          const clickedOffset = selection.offset ?? selection.startOffset;

          // Check if click is within any highlighted range
          for (const [, { range, threadId }] of highlightedRangesRef.current) {
            try {
              // Check if the click position is within this range
              if (range.startContainer === clickedNode &&
                  clickedOffset >= range.startOffset &&
                  clickedOffset <= range.endOffset) {
                onThreadClick(threadId);
                return;
              }

              // Also check if click is within range using range comparison
              const clickRange = document.createRange();
              clickRange.setStart(clickedNode, clickedOffset);
              clickRange.setEnd(clickedNode, clickedOffset);

              if (range.compareBoundaryPoints(Range.START_TO_START, clickRange) <= 0 &&
                  range.compareBoundaryPoints(Range.END_TO_END, clickRange) >= 0) {
                onThreadClick(threadId);
                return;
              }
            } catch {
              // Range comparison can fail if nodes have been removed
            }
          }
        }
      }
    };

    document.addEventListener("click", handleHighlightClick);
    return () => document.removeEventListener("click", handleHighlightClick);
  }, [onThreadClick]);

  // Handle hover on comment highlights to show tooltip
  useEffect(() => {
    const editorContainer = document.querySelector(`.${wrapperClass} .bn-editor`);
    if (!editorContainer || !commentThreads || commentThreads.length === 0) {
      return;
    }

    const threadsWithQuotedText = commentThreads.filter(t => t.quotedText);
    if (threadsWithQuotedText.length === 0) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Check for <mark> elements first (fallback approach)
      const target = e.target as HTMLElement;
      if (target.classList.contains("comment-highlight")) {
        const threadId = target.getAttribute("data-thread-id");
        if (threadId) {
          const thread = commentThreads.find(t => t._id === threadId);
          if (thread) {
            hoverTimeoutRef.current = setTimeout(() => {
              setTooltipData({
                threadId: thread._id,
                quotedText: thread.quotedText,
                status: thread.status,
                authorName: thread.authorName,
                authorAvatar: thread.authorAvatar,
                commentContent: thread.commentContent,
                commentCount: thread.commentCount,
                createdAt: thread.createdAt,
              });
              setTooltipPosition({ x: e.clientX + 10, y: e.clientY + 10 });
            }, 300);
            return;
          }
        }
      }

      // For CSS Custom Highlight API: check if we're hovering over highlighted text
      // Use the stored highlighted ranges for accurate detection
      if (highlightedRangesRef.current.size > 0) {
        const caretPos = document.caretPositionFromPoint?.(e.clientX, e.clientY) ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).caretRangeFromPoint?.(e.clientX, e.clientY);

        if (caretPos) {
          const hoveredNode = caretPos.offsetNode || caretPos.startContainer;
          const hoveredOffset = caretPos.offset ?? caretPos.startOffset;

          // Check if cursor is within any highlighted range
          for (const [, { range, threadId }] of highlightedRangesRef.current) {
            try {
              // Check if the hover position is within this range
              if (range.startContainer === hoveredNode &&
                  hoveredOffset >= range.startOffset &&
                  hoveredOffset <= range.endOffset) {
                const thread = commentThreads.find(t => t._id === threadId);
                if (thread) {
                  hoverTimeoutRef.current = setTimeout(() => {
                    setTooltipData({
                      threadId: thread._id,
                      quotedText: thread.quotedText,
                      status: thread.status,
                      authorName: thread.authorName,
                      authorAvatar: thread.authorAvatar,
                      commentContent: thread.commentContent,
                      commentCount: thread.commentCount,
                      createdAt: thread.createdAt,
                    });
                    setTooltipPosition({ x: e.clientX + 10, y: e.clientY + 10 });
                  }, 300);
                  return;
                }
              }
            } catch {
              // Range comparison can fail if nodes have been removed
            }
          }
        }
      }

      // If we're not over a highlight, hide the tooltip (with a small delay to prevent flicker)
      hoverTimeoutRef.current = setTimeout(() => {
        setTooltipData(null);
        setTooltipPosition(null);
      }, 100);
    };

    const handleMouseLeave = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setTooltipData(null);
      setTooltipPosition(null);
    };

    editorContainer.addEventListener("mousemove", handleMouseMove as EventListener);
    editorContainer.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      editorContainer.removeEventListener("mousemove", handleMouseMove as EventListener);
      editorContainer.removeEventListener("mouseleave", handleMouseLeave);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [wrapperClass, commentThreads]);

  // Callback to close tooltip
  const handleCloseTooltip = useCallback(() => {
    setTooltipData(null);
    setTooltipPosition(null);
  }, []);

  // Callback when tooltip is clicked
  const handleTooltipClick = useCallback((threadId: string) => {
    setTooltipData(null);
    setTooltipPosition(null);
    if (onThreadClick) {
      onThreadClick(threadId);
    }
  }, [onThreadClick]);

  // Handle adding a comment on the current block/selection
  const handleAddComment = useCallback(() => {
    if (!onAddComment) return;

    // Get the selected text from the browser selection
    const windowSelection = window.getSelection();
    const quotedText = windowSelection?.toString().trim() || undefined;

    // Get the text cursor position for block info
    const cursorPosition = editor.getTextCursorPosition();
    const block = cursorPosition.block;

    if (!block) return;

    // Calculate the block-relative offset for the selection
    // This helps disambiguate when the same text appears multiple times
    let inlineStart: number | undefined;
    let inlineEnd: number | undefined;

    if (quotedText && windowSelection && windowSelection.rangeCount > 0) {
      const range = windowSelection.getRangeAt(0);

      // Find the block element containing this selection
      const blockElement = document.querySelector(`[data-id="${block.id}"]`);

      if (blockElement) {
        // Get all text content before the selection start within the block
        const treeWalker = document.createTreeWalker(
          blockElement,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              if (!node.parentElement?.closest(".bn-inline-content, .bn-block-content")) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        let offset = 0;
        let node: Text | null;

        while ((node = treeWalker.nextNode() as Text | null)) {
          if (node === range.startContainer) {
            // Found the start container - add the offset within this node
            inlineStart = offset + range.startOffset;
            inlineEnd = inlineStart + quotedText.length;
            break;
          }
          offset += node.textContent?.length || 0;
        }
      }
    }

    onAddComment({
      blockId: block.id,
      quotedText,
      inlineStart,
      inlineEnd,
    });
  }, [editor, onAddComment]);


  return (
    <>
      {/* Load theme-specific Google Fonts */}
      <link rel="stylesheet" href={fontUrl} />

      {/* Apply theme variables with light/dark mode support */}
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />

      <div className={`editor-theme-wrapper ${wrapperClass} min-h-full`}>
        <BlockNoteView
          editor={editor}
          editable={editable}
          onChange={handleChange}
          className="min-h-[500px]"
          slashMenu={false}
          formattingToolbar={false}
          filePanel={false}
          sideMenu={false}
        >
          {/* Custom file panel: closes immediately on image upload, shows in-block loading */}
          <FilePanelController filePanel={CustomFilePanel} />
          {/* Custom side menu: freezes on hover to prevent disappearing when
              moving cursor from sub-content blocks to the side menu buttons */}
          <SideMenuController sideMenu={StickyHoverSideMenu} />
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
          {/* Custom formatting toolbar with Add Comment button */}
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
                <BadgeToolbarButton key="badgeButton" />
                <IconToolbarButton key="iconButton" />
                {/* Add Comment button */}
                {onAddComment && pageId && currentUserId && (
                  <MantineTooltip label={t("addComment")} withinPortal={false}>
                    <MantineActionIcon
                      size={30}
                      variant="transparent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddComment();
                      }}
                    >
                      <MessageSquarePlus size={16} />
                    </MantineActionIcon>
                  </MantineTooltip>
                )}
              </FormattingToolbar>
            )}
          />
        </BlockNoteView>
      </div>

      {/* Comment hover tooltip */}
      <CommentHoverTooltip
        data={tooltipData}
        position={tooltipPosition}
        onClose={handleCloseTooltip}
        onClick={handleTooltipClick}
      />
    </>
  );
}
