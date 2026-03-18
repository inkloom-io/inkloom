"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBlockNoteEditor, useSelectedBlocks } from "@blocknote/react";
import { Tag } from "lucide-react";
import { Button } from "@inkloom/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@inkloom/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";
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

export function BadgeToolbarButton() {
  const t = useTranslations("editor.blockEditor.inlineToolbar");
  const editor = useBlockNoteEditor();
  const selectedBlocks = useSelectedBlocks(editor);
  const [open, setOpen] = useState(false);

  // Only show when there's a text selection
  const hasSelection = selectedBlocks.length > 0;
  if (!hasSelection) return null;

  const handleInsertBadge = (color: string) => {
    // Get selected text from the editor
    const selection = editor.getSelection();
    if (!selection) {
      // No selection - insert an empty badge at cursor
      (editor as any).insertInlineContent([
        {
          type: "badge",
          props: { color },
          content: "badge",
        },
      ]);
    } else {
      // There's a selection - get selected text, remove it, and insert badge with that text
      const selectedText = getSelectedText(editor);
      if (selectedText) {
        (editor as any).insertInlineContent([
          {
            type: "badge",
            props: { color },
            content: selectedText,
          },
        ]);
      }
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Tag className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("badge")}</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("badgeColor")}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {BADGE_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => handleInsertBadge(color.text)}
              className={cn(
                "flex h-8 items-center justify-center rounded text-xs font-medium",
                "hover:ring-2 hover:ring-ring hover:ring-offset-1"
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
