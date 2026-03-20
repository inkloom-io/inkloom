"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useBlockNoteEditor, useSelectedBlocks } from "@blocknote/react";
import { ActionIcon as MantineActionIcon, Tooltip as MantineTooltip } from "@mantine/core";
import { Tag } from "lucide-react";
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

export function BadgeToolbarButton() {
  const t = useTranslations("editor.blockEditor.inlineToolbar");
  const editor = useBlockNoteEditor();
  const selectedBlocks = useSelectedBlocks(editor);
  const [open, setOpen] = useState(false);

  const hasSelection = selectedBlocks.length > 0;

  // Check if the badge style is currently active on the selection
  // Cast to any because the generic useBlockNoteEditor() doesn't know about our custom badge style
  const activeBadgeColor = useMemo(() => {
    try {
      const activeStyles = (editor as any).getActiveStyles();
      if (activeStyles.badge) {
        return typeof activeStyles.badge === "string" ? activeStyles.badge : null;
      }
    } catch {
      // ignore
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, selectedBlocks]);

  const isInsideBadge = activeBadgeColor !== null;

  // Show button when there's a selection OR when cursor is inside a badge
  if (!hasSelection && !isInsideBadge) return null;

  const handleColorSelect = (color: string) => {
    (editor as any).addStyles({ badge: color });
    setOpen(false);
  };

  const handleRemoveBadge = () => {
    (editor as any).removeStyles({ badge: true });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MantineTooltip
        label={isInsideBadge ? t("badgeColor") : t("badge")}
        withinPortal={false}
        disabled={open}
      >
        <PopoverTrigger asChild>
          <MantineActionIcon
            size={30}
            variant="transparent"
            data-selected={isInsideBadge || undefined}
            onClick={() => {}}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Tag size={16} />
          </MantineActionIcon>
        </PopoverTrigger>
      </MantineTooltip>
      <PopoverContent
        className="w-48 p-2"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
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
                activeBadgeColor === color.text && "ring-2 ring-ring ring-offset-1"
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
        {isInsideBadge && (
          <button
            type="button"
            onClick={handleRemoveBadge}
            className="mt-2 w-full rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            {t("removeBadge")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
