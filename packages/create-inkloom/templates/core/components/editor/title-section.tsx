"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { IconPicker, IconDisplay } from "./icon-picker";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImageOff,
  SmilePlus,
  Loader2,
  Check,
} from "lucide-react";
import type { ThemePreset } from "@/lib/theme-presets";
import { THEME_PRESETS } from "@/lib/theme-presets";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Save status type and indicator
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved";

function TitleSaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          Saved
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Slug helper — derive a URL slug from a title string
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "untitled";
}

// ---------------------------------------------------------------------------
// TitleSection component
// ---------------------------------------------------------------------------

interface TitleSectionProps {
  pageId: Id<"pages">;
  title: string;
  icon?: string;
  subtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
  themePreset?: ThemePreset;
  customFonts?: { heading?: string; body?: string; code?: string };
}

export function TitleSection({
  pageId,
  title,
  icon,
  subtitle,
  titleSectionHidden,
  titleIconHidden,
  themePreset = "default",
  customFonts,
}: TitleSectionProps) {
  const updatePage = useMutation(api.pages.updateMeta);

  // Local state for editable title and subtitle
  const [localTitle, setLocalTitle] = useState(title);
  const [localSubtitle, setLocalSubtitle] = useState(subtitle ?? "");

  // Save status tracking
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce refs
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve the display font from custom fonts or theme preset
  const themeConfig = useMemo(
    () => THEME_PRESETS[themePreset] ?? THEME_PRESETS.default,
    [themePreset]
  );
  const displayFontFamily = useMemo(() => {
    if (customFonts?.heading) {
      return `'${customFonts.heading}', ui-sans-serif, system-ui, sans-serif`;
    }
    return themeConfig.typography.fontDisplay;
  }, [customFonts?.heading, themeConfig]);
  const fontUrl = useMemo(() => {
    if (customFonts?.heading) {
      const encoded = customFonts.heading.replace(/ /g, "+");
      return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
    }
    return themeConfig.typography.googleFontsUrl;
  }, [customFonts?.heading, themeConfig]);

  // Sync local title/subtitle when page changes (e.g. switching pages)
  useEffect(() => {
    setLocalTitle(title);
  }, [title, pageId]);

  useEffect(() => {
    setLocalSubtitle(subtitle ?? "");
  }, [subtitle, pageId]);

  // Helper to show saving indicator and transition to saved
  const showSaving = useCallback(() => {
    setSaveStatus("saving");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const showSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setSaveStatus("idle");
    }, 1500);
  }, []);

  // Debounced title change — updates title + slug
  const handleTitleChange = useCallback(
    (value: string) => {
      setLocalTitle(value);
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      showSaving();
      titleDebounceRef.current = setTimeout(async () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        try {
          await updatePage({
            pageId,
            title: trimmed,
            slug: slugify(trimmed),
          });
          showSaved();
        } catch {
          setSaveStatus("idle");
        }
      }, 300);
    },
    [pageId, updatePage, showSaving, showSaved]
  );

  // Debounced subtitle change
  const handleSubtitleChange = useCallback(
    (value: string) => {
      setLocalSubtitle(value);
      if (subtitleDebounceRef.current)
        clearTimeout(subtitleDebounceRef.current);
      showSaving();
      subtitleDebounceRef.current = setTimeout(async () => {
        try {
          await updatePage({
            pageId,
            subtitle: value || undefined,
          });
          showSaved();
        } catch {
          setSaveStatus("idle");
        }
      }, 300);
    },
    [pageId, updatePage, showSaving, showSaved]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      if (subtitleDebounceRef.current)
        clearTimeout(subtitleDebounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleIconChange = useCallback(
    (newIcon: string | null) => {
      showSaving();
      updatePage({ pageId, icon: newIcon ?? undefined }).then(
        () => showSaved(),
        () => setSaveStatus("idle")
      );
    },
    [pageId, updatePage, showSaving, showSaved]
  );

  const handleToggleHidden = useCallback(() => {
    updatePage({ pageId, titleSectionHidden: !titleSectionHidden });
  }, [pageId, titleSectionHidden, updatePage]);

  const handleToggleIconHidden = useCallback(() => {
    updatePage({ pageId, titleIconHidden: !titleIconHidden });
  }, [pageId, titleIconHidden, updatePage]);

  const showIcon = icon && !titleIconHidden;

  if (titleSectionHidden) {
    return (
      <div className="mx-auto w-full max-w-4xl px-[3rem] pt-8 pb-2">
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/50 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            Title section hidden from preview &amp; published site
          </span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleHidden}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Show/Hide title section</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 pb-0">
      {/* Load the display font for the title */}
      <link rel="stylesheet" href={fontUrl} />
      <div className="mx-auto w-full max-w-4xl px-[3rem]">
        {/* Controls row */}
        <div className="mb-3 flex items-center justify-end gap-1">
          <TitleSaveIndicator status={saveStatus} />
          <div className="flex-1" />
          {icon && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleIconHidden}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {titleIconHidden ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : (
                      <ImageOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Show/Hide icon in title</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleHidden}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Show/Hide title section</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Title row with inline icon */}
        <div className="flex items-start gap-3">
          {showIcon && (
            <div className="mt-0.5 shrink-0">
              <IconPicker
                value={icon}
                onChange={handleIconChange}
                trigger={
                  <button className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent">
                    <IconDisplay
                      icon={icon}
                      className="h-7 w-7 text-[1.5rem]"
                    />
                  </button>
                }
              />
            </div>
          )}
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full border-none bg-transparent text-3xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            style={{
              fontFamily: displayFontFamily,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
            placeholder="Untitled"
          />
        </div>

        {/* Add icon button (only shown when no icon set at all) */}
        {!icon && (
          <div className="mt-2">
            <IconPicker
              value={undefined}
              onChange={handleIconChange}
              trigger={
                <button className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <SmilePlus className="h-3.5 w-3.5" />
                  Add icon
                </button>
              }
            />
          </div>
        )}

        {/* Subtitle — always left-aligned with the title text, not the icon */}
        <input
          type="text"
          value={localSubtitle}
          onChange={(e) => handleSubtitleChange(e.target.value)}
          placeholder="Add a subtitle..."
          className="mt-2 w-full border-none bg-transparent text-base text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
      </div>

      {/* Divider — full width */}
      <hr className="mt-4 border-border" />
    </div>
  );
}
