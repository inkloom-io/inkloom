"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { blockNoteToMDX, parseBlockNoteContent } from "@inkloom/mdx-parser";
import { MDXPreviewRenderer } from "@/lib/parse-mdx-preview";
import { DocsRendererProvider } from "@/components/docs-renderer";
import "@/components/docs-renderer/styles/index.css";
import { highlightCode } from "@/lib/syntax-highlighter";
import { ChevronRight, Home, Sun, Moon } from "lucide-react";
import { IconDisplay } from "./icon-picker";
import { THEME_PRESETS, type ThemePreset } from "@/lib/theme-presets";
import { generateThemeSpecificCss } from "@/lib/generate-site";
import "./preview-styles.css";

interface PreviewPanelProps {
  /** BlockNote JSON string content */
  content: string | null;
  /** Page title to display */
  pageTitle: string;
  /** Theme preset to apply */
  themePreset?: ThemePreset;
  /** Custom primary color override */
  customPrimaryColor?: string;
  /** Page icon (emoji or lucide:name) */
  icon?: string;
  /** Page subtitle */
  subtitle?: string;
  /** Whether the title section is hidden */
  titleSectionHidden?: boolean;
  /** Whether the icon is hidden */
  titleIconHidden?: boolean;
}

/** Simple link wrapper for preview — links don't navigate in preview mode */
function PreviewLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}) {
  return (
    <a href={href} className={className} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  );
}

/** Adapter: wraps the highlightCode to match DocsRendererProvider's expected signature */
async function highlightCodeForRenderer(
  code: string,
  language: string
): Promise<string> {
  return highlightCode(code, language);
}

/**
 * Build background style for a specific theme preset
 */
function getBackgroundStyles(
  themePreset: ThemePreset,
  isDark: boolean,
  colors: { background: string; backgroundSubtle: string; border: string }
): string {
  if (themePreset === "forest") {
    return `background-color: ${colors.background};
      background-image: radial-gradient(circle, ${colors.border} 0.5px, transparent 0.5px);
      background-size: 24px 24px;`;
  }
  if (themePreset === "midnight" && isDark) {
    return `background-color: ${colors.background};
      background-image:
        radial-gradient(at 0% 0%, hsl(210 90% 60% / 0.04) 0%, transparent 50%),
        radial-gradient(at 100% 100%, hsl(210 90% 60% / 0.03) 0%, transparent 50%);`;
  }
  if (themePreset === "vapor") {
    return `background-color: ${colors.background};
      background-image:
        radial-gradient(at 20% 30%, hsl(174 ${isDark ? "75" : "72"}% ${isDark ? "52" : "40"}% / 0.06) 0%, transparent 50%),
        radial-gradient(at 80% 70%, hsl(190 60% 50% / ${isDark ? "0.04" : "0.05"}) 0%, transparent 50%);`;
  }
  if (themePreset === "aubergine" && isDark) {
    return `background-color: ${colors.background};
      background-image:
        radial-gradient(at 50% 0%, hsl(275 30% 14%) 0%, transparent 60%),
        radial-gradient(at 100% 50%, hsl(42 50% 50% / 0.03) 0%, transparent 40%);`;
  }
  return `background: linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSubtle} 100%);`;
}

export function PreviewPanel({
  content,
  pageTitle,
  themePreset = "default",
  customPrimaryColor,
  icon,
  subtitle,
  titleSectionHidden,
  titleIconHidden,
}: PreviewPanelProps) {
  const { resolvedTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(
    () => (resolvedTheme === "dark" ? "dark" : "light")
  );

  const markdown = useMemo(() => {
    if (!content) return "";
    try {
      const blocks = parseBlockNoteContent(content);
      return blockNoteToMDX(blocks);
    } catch {
      return "";
    }
  }, [content]);

  const isDark = previewTheme === "dark";

  // Resolve theme config from preset
  const theme = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  const typography = theme.typography;
  const effects = theme.effects;

  const primaryColor = customPrimaryColor || colors.primary;

  // Build CSS variables from the theme config
  const containerStyle: React.CSSProperties = {
    "--color-background": colors.background,
    "--color-foreground": colors.foreground,
    "--color-background-subtle": colors.backgroundSubtle,
    "--color-muted": colors.muted,
    "--color-muted-foreground": colors.mutedForeground,
    "--color-border": colors.border,
    "--color-border-subtle": colors.borderSubtle,
    "--color-primary": primaryColor,
    "--color-primary-foreground": colors.primaryForeground,
    "--color-accent": colors.accent,
    "--color-accent-foreground": colors.accentForeground,
    "--color-code-background": colors.codeBackground,
    "--color-code-foreground": colors.codeForeground,
    "--color-code-highlight": colors.codeHighlight,
    "--color-header-background": colors.headerBackground,
    "--color-header-border": colors.headerBorder,
    "--header-blur": effects.headerBlur,
    "--font-sans": typography.fontSans,
    "--font-mono": typography.fontMono,
    "--font-display": typography.fontDisplay,
    "--shadow-sm": effects.shadowSm,
    "--shadow-md": effects.shadowMd,
    "--radius-sm": effects.radiusSm,
    "--radius-md": effects.radiusMd,
    "--radius-lg": effects.radiusLg,
    color: colors.foreground,
    fontFamily: typography.fontSans,
  } as React.CSSProperties;

  // Generate theme-specific CSS (background patterns, prose styles, etc.)
  const themeSpecificCss = useMemo(
    () => generateThemeSpecificCss(themePreset),
    [themePreset]
  );

  // Generate background CSS from theme
  const backgroundCss = useMemo(
    () =>
      getBackgroundStyles(themePreset, isDark, {
        background: colors.background,
        backgroundSubtle: colors.backgroundSubtle,
        border: colors.border,
      }),
    [themePreset, isDark, colors.background, colors.backgroundSubtle, colors.border]
  );

  // Google Fonts link for the theme
  const fontUrl = typography.googleFontsUrl;

  return (
    <DocsRendererProvider
      LinkComponent={PreviewLink}
      highlightCode={highlightCodeForRenderer}
      resolvedTheme={previewTheme}
    >
      {/* Load theme-specific fonts */}
      {fontUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontUrl} />
      )}
      {/* Inject theme-specific CSS (prose styles, background patterns, etc.) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .preview-container { ${backgroundCss} }
            ${themeSpecificCss}
          `,
        }}
      />
      <div
        className="preview-container flex h-full flex-col"
        data-preview-theme={previewTheme}
        style={containerStyle}
      >
        <div className="preview-header sticky top-0 z-10 border-b border-[var(--color-header-border)]">
          <div className="flex h-12 items-center justify-between px-5">
            <span
              className="text-sm font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-foreground)",
              }}
            >
              Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPreviewTheme(previewTheme === "dark" ? "light" : "dark")
                }
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors"
                style={{
                  color: "var(--color-muted-foreground)",
                  backgroundColor: "var(--color-background)",
                }}
                aria-label="Toggle preview theme"
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
                  {icon && !titleIconHidden && (
                    <div className="mt-0.5 shrink-0">
                      <IconDisplay
                        icon={icon}
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
                {subtitle && (
                  <p
                    className="mt-2 text-base"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
              <hr
                className="mt-4 mb-6"
                style={{ borderColor: "var(--color-border)" }}
              />
            </>
          )}
          <article className="prose mx-auto">
            {markdown ? (
              <MDXPreviewRenderer content={markdown} />
            ) : (
              <p style={{ color: "var(--color-muted-foreground)" }}>
                No content to preview
              </p>
            )}
          </article>
        </div>
      </div>
    </DocsRendererProvider>
  );
}
