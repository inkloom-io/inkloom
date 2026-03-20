"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useBlockNoteEditor, useSelectedBlocks } from "@blocknote/react";
import { Tag } from "lucide-react";
import { Button } from "@inkloom/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@inkloom/ui/popover";

import { cn } from "@inkloom/ui/lib/utils";

const BADGE_COLORS = [
  { name: "gray", bg: "#6b728020", border: "#6b728040", text: "#6b7280" },
  { name: "red", bg: "#ef444420", border: "#ef444440", text: "#ef4444" },
  { name: "orange", bg: "#f9731620", border: "#f9731640", text: "#f97316" },
  { name: "yellow", bg: "#eab30820", border: "#eab30840", text: "#eab308" },
  { name: "green", bg: "#22c55e20", border: "#22c55e40", text: "#22c55e" },
  { name: "blue", bg: "#3b82f620", border: "#3b82f640", text: "#3b82f6" },
  { name: "purple", bg: "#a855f720", border: "#a855f740", text: "#a855f7" },
  { name: "pink", bg: "#ec489920", border: "#ec489940", text: "#ec4899" },
];

/**
 * Find the badge node at the current cursor position in the TipTap editor.
 * Returns the position and node if the cursor is inside a badge, or null otherwise.
 */
function findBadgeAtCursor(editor: any): { pos: number; node: any } | null {
  const tiptap = (editor as any)._tiptapEditor;
  if (!tiptap) return null;

  const { state } = tiptap;
  const { selection, doc } = state;
  const cursorPos = selection.$from.pos;

  let result: { pos: number; node: any } | null = null;

  doc.descendants((node: any, pos: number) => {
    if (result) return false;
    if (node.type.name === "badge") {
      // Check if cursor is within this badge node's range
      const endPos = pos + node.nodeSize;
      if (cursorPos >= pos && cursorPos <= endPos) {
        result = { pos, node };
        return false;
      }
    }
    return true;
  });

  return result;
}

export function BadgeToolbarButton() {
  const t = useTranslations("editor.blockEditor.inlineToolbar");
  const editor = useBlockNoteEditor();
  const selectedBlocks = useSelectedBlocks(editor);
  const [open, setOpen] = useState(false);

  const hasSelection = selectedBlocks.length > 0;

  // Check if the cursor is currently inside a badge node
  const badgeAtCursor = useMemo(() => {
    return findBadgeAtCursor(editor);
    // Re-evaluate when selected blocks change (selection moved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, selectedBlocks]);

  const isInsideBadge = badgeAtCursor !== null;

  // Show button when there's a selection OR when cursor is inside a badge
  if (!hasSelection && !isInsideBadge) return null;

  const handleUpdateBadgeColor = (color: string) => {
    const badge = findBadgeAtCursor(editor);
    if (!badge) return;

    const tiptap = (editor as any)._tiptapEditor;
    if (!tiptap) return;

    const { state } = tiptap;
    const nodeAtPos = state.doc.nodeAt(badge.pos);
    if (nodeAtPos) {
      const tr = state.tr.setNodeMarkup(badge.pos, undefined, {
        ...nodeAtPos.attrs,
        color,
      });
      tiptap.view.dispatch(tr);
    }
    setOpen(false);
  };

  const handleInsertBadge = (color: string) => {
    // Prevent nesting: never create a badge inside an existing badge.
    // This is a real-time check to guard against stale useMemo state.
    if (findBadgeAtCursor(editor)) {
      handleUpdateBadgeColor(color);
      return;
    }

    // Get selected text from the editor
    const selection = editor.getSelection();
    if (!selection) {
      // No selection - insert a badge with default text at cursor
      (editor as any).insertInlineContent([
        {
          type: "badge",
          props: { color },
          content: [{ type: "text", text: "badge", styles: {} }],
        },
        " ",
      ]);
    } else {
      // There's a selection - get selected text, remove it, and insert badge with that text
      const selectedText = getSelectedText(editor);
      if (selectedText) {
        (editor as any).insertInlineContent([
          {
            type: "badge",
            props: { color },
            content: [{ type: "text", text: selectedText, styles: {} }],
          },
          " ",
        ]);
      }
    }
    setOpen(false);
  };

  const handleColorSelect = (color: string) => {
    if (isInsideBadge) {
      handleUpdateBadgeColor(color);
    } else {
      handleInsertBadge(color);
    }
  };

  // Find the current badge color to highlight it in the picker
  const currentBadgeColor = isInsideBadge ? badgeAtCursor.node.attrs.color : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 bg-transparent text-[#404040] border-none hover:bg-[#f5f5f5] hover:text-[#171717] dark:text-[#e5e5e5] dark:hover:bg-[#262626] dark:hover:text-[#fafafa]",
            isInsideBadge && "bg-accent"
          )}
          title={isInsideBadge ? t("badgeColor") : t("badge")}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("badgeColor")}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {BADGE_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => handleColorSelect(color.text)}
              className={cn(
                "flex h-8 items-center justify-center rounded text-xs font-medium",
                "hover:ring-2 hover:ring-ring hover:ring-offset-1",
                currentBadgeColor === color.text && "ring-2 ring-ring ring-offset-1"
              )}
              style={{
                backgroundColor: color.bg,
                color: color.text,
                borderColor: color.border,
                borderWidth: "1px",
                borderStyle: "solid",
              }}
              title={color.name}
            >
              {color.name.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Extract the plain text of the current editor selection.
 */
function getSelectedText(editor: any): string {
  try {
    const selection = editor.getSelection();
    if (!selection) return "";
    // Walk through selected blocks and collect text content
    const blocks = selection.blocks;
    if (!blocks || blocks.length === 0) return "";
    const texts: string[] = [];
    for (const block of blocks) {
      if (block.content && Array.isArray(block.content)) {
        for (const inline of block.content) {
          if (inline.type === "text" && inline.text) {
            texts.push(inline.text);
          }
        }
      }
    }
    return texts.join(" ");
  } catch {
    return "";
  }
}
