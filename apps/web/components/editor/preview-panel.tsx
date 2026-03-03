"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { blockNoteToMDX, parseBlockNoteContent } from "@/lib/blocknote-to-mdx";
import {
  THEME_PRESETS,
  type ThemePreset,
  type ThemeColors,
} from "@/lib/theme-presets";
import { MDXPreviewRenderer } from "@/lib/parse-mdx-preview";
import { ChevronRight, Home, Search, Sun, Moon } from "lucide-react";
import { IconDisplay } from "./icon-picker";
import "./preview-styles.css";

interface BreadcrumbFolder {
  _id: string;
  name: string;
  parentId?: string;
}

interface NavTab {
  name: string;
  slug: string;
  icon?: string;
  folderId?: string;
  items?: Array<{ type: string; folderId?: string; pageId?: string }>;
}

interface PreviewPanelProps {
  content: string;
  pageTitle: string;
  pageId?: string;
  folderId?: string;
  folders?: BreadcrumbFolder[];
  navTabs?: NavTab[];
  themePreset?: ThemePreset;
  customPrimaryColor?: string;
  customBackgroundColorLight?: string;
  customBackgroundColorDark?: string;
  customBackgroundSubtleColorLight?: string;
  customBackgroundSubtleColorDark?: string;
  pageIcon?: string;
  pageSubtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
}

/** Build the breadcrumb trail: [tab?, ...folders] (page title rendered separately) */
function buildBreadcrumbTrail(
  folderId: string | undefined,
  pageId: string | undefined,
  folders: BreadcrumbFolder[],
  navTabs: NavTab[]
): string[] {
  // Walk up the folder chain
  const folderChain: BreadcrumbFolder[] = [];
  const folderMap = new Map(folders.map((f: any) => [f._id, f]));
  let currentId = folderId;
  while (currentId) {
    const folder = folderMap.get(currentId);
    if (!folder) break;
    folderChain.unshift(folder);
    currentId = folder.parentId;
  }

  // Find matching nav tab
  const folderIds = new Set(folderChain.map((f: any) => f._id));
  let tabName: string | undefined;
  for (const tab of navTabs) {
    // Check legacy single-folder reference
    if (tab.folderId && folderIds.has(tab.folderId)) {
      tabName = tab.name;
      break;
    }
    // Check items array
    if (tab.items) {
      const match = tab.items.some(
        (item) =>
          (item.type === "folder" &&
            item.folderId &&
            folderIds.has(item.folderId)) ||
          (item.type === "page" && item.pageId && item.pageId === pageId)
      );
      if (match) {
        tabName = tab.name;
        break;
      }
    }
  }

  const trail: string[] = [];
  if (tabName) trail.push(tabName);
  for (const folder of folderChain) {
    trail.push(folder.name);
  }
  return trail;
}

function getThemeConfig(themePreset: ThemePreset = "default") {
  return THEME_PRESETS[themePreset] || THEME_PRESETS.default;
}

function getThemeCSSVars(
  themePreset: ThemePreset = "default",
  customPrimaryColor?: string,
  isDark: boolean = false,
  customBackgroundColor?: string,
  customBackgroundSubtleColor?: string
): Record<string, string> {
  const theme = getThemeConfig(themePreset);
  const colors: ThemeColors = isDark ? theme.colors.dark : theme.colors.light;
  const effects = theme.effects;
  const typography = theme.typography;

  const primaryColor = customPrimaryColor || colors.primary;
  const backgroundColor = customBackgroundColor || colors.background;
  const backgroundSubtleColor =
    customBackgroundSubtleColor || colors.backgroundSubtle;

  return {
    // Core colors
    "--color-background": backgroundColor,
    "--color-foreground": colors.foreground,
    "--color-background-subtle": backgroundSubtleColor,
    // Surfaces
    "--color-muted": colors.muted,
    "--color-muted-foreground": colors.mutedForeground,
    // Borders
    "--color-border": colors.border,
    "--color-border-subtle": colors.borderSubtle,
    // Primary
    "--color-primary": primaryColor,
    "--color-primary-foreground": colors.primaryForeground,
    // Accents
    "--color-accent": colors.accent,
    "--color-accent-foreground": colors.accentForeground,
    // Code blocks
    "--color-code-background": colors.codeBackground,
    "--color-code-foreground": colors.codeForeground,
    "--color-code-highlight": colors.codeHighlight,
    // Typography
    "--font-sans": typography.fontSans,
    "--font-mono": typography.fontMono,
    "--font-display": typography.fontDisplay,
    // Header
    "--color-header-background": colors.headerBackground,
    "--color-header-border": colors.headerBorder,
    "--header-blur": effects.headerBlur,
    // Effects
    "--shadow-sm": effects.shadowSm,
    "--shadow-md": effects.shadowMd,
    "--radius-sm": effects.radiusSm,
    "--radius-md": effects.radiusMd,
    "--radius-lg": effects.radiusLg,
  };
}

export function PreviewPanel({
  content,
  pageTitle,
  pageId,
  folderId,
  folders = [],
  navTabs = [],
  themePreset = "default",
  customPrimaryColor,
  customBackgroundColorLight,
  customBackgroundColorDark,
  customBackgroundSubtleColorLight,
  customBackgroundSubtleColorDark,
  pageIcon,
  pageSubtitle,
  titleSectionHidden,
  titleIconHidden,
}: PreviewPanelProps) {
  const t = useTranslations("editor.previewPanel");
  const { resolvedTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(
    () => (resolvedTheme === "dark" ? "dark" : "light")
  );

  const blocks = parseBlockNoteContent(content);
  const markdown = blockNoteToMDX(blocks);
  const breadcrumbTrail = buildBreadcrumbTrail(
    folderId,
    pageId,
    folders,
    navTabs
  );

  // Get theme config and CSS variables
  const theme = getThemeConfig(themePreset);
  const lightVars = getThemeCSSVars(
    themePreset,
    customPrimaryColor,
    false,
    customBackgroundColorLight,
    customBackgroundSubtleColorLight
  );
  const darkVars = getThemeCSSVars(
    themePreset,
    customPrimaryColor,
    true,
    customBackgroundColorDark,
    customBackgroundSubtleColorDark
  );
  const fontsUrl = theme.typography.googleFontsUrl;

  // Build inline style with CSS variables based on the local preview theme toggle
  const isDark = previewTheme === "dark";
  const activeVars = isDark ? darkVars : lightVars;

  const isVerdant = themePreset === "forest";
  const isMidnight = themePreset === "midnight";
  const isVapor = themePreset === "vapor";
  const isAubergine = themePreset === "aubergine";

  function getBackgroundStyles(
    vars: Record<string, string>,
    isDarkMode: boolean
  ): React.CSSProperties {
    if (isVerdant) {
      return {
        backgroundColor: vars["--color-background"],
        backgroundImage: `radial-gradient(circle, ${vars["--color-border"]} 0.5px, transparent 0.5px)`,
        backgroundSize: "24px 24px",
      } as React.CSSProperties;
    }
    if (isMidnight && isDarkMode) {
      return {
        backgroundColor: vars["--color-background"],
        backgroundImage: `radial-gradient(at 0% 0%, hsl(210 90% 60% / 0.04) 0%, transparent 50%), radial-gradient(at 100% 100%, hsl(210 90% 60% / 0.03) 0%, transparent 50%)`,
      } as React.CSSProperties;
    }
    if (isVapor) {
      return {
        backgroundColor: vars["--color-background"],
        backgroundImage: isDarkMode
          ? `radial-gradient(at 20% 30%, hsl(174 75% 52% / 0.06) 0%, transparent 50%), radial-gradient(at 80% 70%, hsl(190 60% 50% / 0.04) 0%, transparent 50%)`
          : `radial-gradient(at 20% 30%, hsl(174 72% 40% / 0.06) 0%, transparent 50%), radial-gradient(at 80% 70%, hsl(190 60% 50% / 0.05) 0%, transparent 50%)`,
      } as React.CSSProperties;
    }
    if (isAubergine && isDarkMode) {
      return {
        backgroundColor: vars["--color-background"],
        backgroundImage: `radial-gradient(at 50% 0%, hsl(275 30% 14%) 0%, transparent 60%), radial-gradient(at 100% 50%, hsl(42 50% 50% / 0.03) 0%, transparent 40%)`,
      } as React.CSSProperties;
    }
    return {
      background: `linear-gradient(180deg, ${vars["--color-background"]} 0%, ${vars["--color-background-subtle"]} 100%)`,
    } as React.CSSProperties;
  }

  const containerStyle: React.CSSProperties = {
    ...Object.fromEntries(Object.entries(activeVars).map(([k, v]) => [k, v])),
    ...getBackgroundStyles(activeVars, isDark),
    color: activeVars["--color-foreground"],
    fontFamily: activeVars["--font-sans"],
  } as React.CSSProperties;

  return (
    <div
      className="preview-container flex h-full flex-col"
      style={containerStyle}
    >
      {/* Inject fonts */}
      <style>{`@import url('${fontsUrl}');`}</style>
      <div className="preview-header sticky top-0 z-10 border-b border-[var(--color-header-border)]">
        <div className="flex h-12 items-center justify-between px-5">
          <span
            className="text-sm font-semibold"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-foreground)",
            }}
          >
            {t("docs")}
          </span>
          <div className="flex items-center gap-2">
            <div
              className="preview-search-trigger flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 text-xs"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("searchPlaceholder")}</span>
              <kbd
                className="ml-1 hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-muted)] px-1.5 py-0.5 text-[0.6875rem] sm:inline"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                ⌘K
              </kbd>
            </div>
            {/* Preview theme toggle */}
            <button
              onClick={() =>
                setPreviewTheme(previewTheme === "dark" ? "light" : "dark")
              }
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors"
              style={{
                color: "var(--color-muted-foreground)",
                backgroundColor: "var(--color-background)",
              }}
              aria-label={t("toggleTheme")}
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        <nav
          className="mb-4 flex items-center gap-1 text-sm"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          <Home className="h-3.5 w-3.5 shrink-0" />
          {breadcrumbTrail.map((segment: any, i: number) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{segment}</span>
            </span>
          ))}
          <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0" />
          <span
            className="truncate font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            {pageTitle}
          </span>
        </nav>
        {!titleSectionHidden && (
          <>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                {pageIcon && !titleIconHidden && (
                  <div className="mt-0.5 shrink-0">
                    <IconDisplay
                      icon={pageIcon}
                      className="h-7 w-7 text-[1.5rem]"
                    />
                  </div>
                )}
                <h1
                  className="text-3xl font-bold tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    color: "var(--color-foreground)",
                  }}
                >
                  {pageTitle}
                </h1>
              </div>
              <div className="min-w-0">
                {pageSubtitle && (
                  <p
                    className="mt-2 text-base"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {pageSubtitle}
                  </p>
                )}
              </div>
            </div>
            {/* Divider — full width, break out of px-6 padding. mt-4 matches editor. */}
            <hr
              className="-mx-6 mt-4 mb-6"
              style={{ borderColor: "var(--color-border)" }}
            />
          </>
        )}
        <article className="prose mx-auto">
          <MDXPreviewRenderer content={markdown} />
        </article>
      </div>
    </div>
  );
}
