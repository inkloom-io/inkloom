"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
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
} from "lucide-react";
import type { ThemePreset } from "@/lib/theme-presets";
import { getThemeConfig } from "@/lib/generate-editor-theme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";

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
  const t = useTranslations("editor.titleSection");
  const updatePage = useMutation(api.pages.update);
  const [localSubtitle, setLocalSubtitle] = useState(subtitle ?? "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve the display font from custom fonts or theme preset
  const themeConfig = useMemo(() => getThemeConfig(themePreset), [themePreset]);
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

  // Sync local subtitle when page changes
  useEffect(() => {
    setLocalSubtitle(subtitle ?? "");
  }, [subtitle, pageId]);

  const handleSubtitleChange = useCallback(
    (value: string) => {
      setLocalSubtitle(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updatePage({
          pageId,
          subtitle: value || null,
        });
      }, 300);
    },
    [pageId, updatePage]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleIconChange = useCallback(
    (newIcon: string | null) => {
      updatePage({ pageId, icon: newIcon });
    },
    [pageId, updatePage]
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
      <div className="mx-auto w-full max-w-[80ch] px-[3rem] pt-8 pb-2">
        <div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--surface-bg)]/50 px-4 py-2.5">
          <span className="text-xs text-[var(--text-dim)]">
            {t("titleSectionHidden")}
          </span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleHidden}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-bg)] hover:text-[var(--text-bright)]"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t("showTitleSection")}</p>
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
      <div className="mx-auto w-full max-w-[80ch] px-[3rem]">
        {/* Controls row */}
        <div className="mb-3 flex items-center justify-end gap-1">
          {icon && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleIconHidden}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-bg)] hover:text-[var(--text-bright)]"
                  >
                    {titleIconHidden ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : (
                      <ImageOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {titleIconHidden
                      ? t("showIconInTitle")
                      : t("hideIconFromTitle")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleHidden}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-bg)] hover:text-[var(--text-bright)]"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t("hideTitleSection")}</p>
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
                  <button className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-bg)]">
                    <IconDisplay
                      icon={icon}
                      className="h-7 w-7 text-[1.5rem]"
                    />
                  </button>
                }
              />
            </div>
          )}
          <h1
            className="text-3xl font-bold tracking-tight text-[var(--text-bright)]"
            style={{
              fontFamily: displayFontFamily,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
        </div>

        {/* Add icon button (only shown when no icon set at all) */}
        {!icon && (
          <div className="mt-2">
            <IconPicker
              value={undefined}
              onChange={handleIconChange}
              trigger={
                <button className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-bg)] hover:text-[var(--text-bright)]">
                  <SmilePlus className="h-3.5 w-3.5" />
                  {t("addIcon")}
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
          placeholder={t("subtitlePlaceholder")}
          className="mt-2 w-full border-none bg-transparent text-base text-[var(--text-dim)] placeholder:text-[var(--text-dim)]/40 focus:outline-none"
        />
      </div>

      {/* Divider — full width */}
      <hr className="mt-4 border-[var(--glass-border)]" />
    </div>
  );
}
