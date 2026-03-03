"use client";

import { Check } from "lucide-react";
import { cn } from "@inkloom/ui/lib/utils";
import {
  THEME_PRESETS,
  hslToHex,
  type ThemePreset,
  type ThemeColors,
} from "@/lib/theme-presets";

interface ThemeSelectorProps {
  value: ThemePreset;
  onChange: (value: ThemePreset) => void;
  previewMode?: "light" | "dark";
}

/**
 * Converts an HSL color (possibly with alpha) to a hex color.
 * Strips alpha for the preview since we just need solid colors.
 */
function toHex(hsl: string): string {
  // Strip alpha: "hsl(240 6% 4% / 0.85)" → "hsl(240 6% 4%)"
  const clean = hsl.replace(/\s*\/\s*[\d.]+\)/, ")");
  return hslToHex(clean);
}

/**
 * Data-driven theme preview that renders using the actual
 * colors from the theme preset for the selected preview mode.
 */
function ThemePreview({ themeKey, previewMode = "dark" }: { themeKey: Exclude<ThemePreset, "custom">; previewMode?: "light" | "dark" }) {
  const theme = THEME_PRESETS[themeKey];
  const c: ThemeColors = theme.colors[previewMode];

  const bg = toHex(c.background);
  const fg = toHex(c.foreground);
  const border = toHex(c.border);
  const borderSubtle = toHex(c.borderSubtle);
  const primary = toHex(c.primary);
  const primaryFg = toHex(c.primaryForeground);
  const muted = toHex(c.mutedForeground);
  const sidebar = toHex(c.sidebarBackground);
  const sidebarBorder = toHex(c.sidebarBorder);
  const sidebarActive = toHex(c.sidebarActiveBackground);
  const code = toHex(c.codeBackground);
  const codeFg = toHex(c.codeForeground);
  const header = toHex(c.headerBackground);
  const headerBorder = toHex(c.headerBorder);

  return (
    <div
      className="h-20 w-full rounded-md overflow-hidden"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      {/* Header bar */}
      <div
        className="h-3.5 border-b flex items-center justify-between px-1.5"
        style={{ background: header, borderColor: headerBorder }}
      >
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: primary }} />
          <div className="w-5 h-1 rounded-sm" style={{ background: fg, opacity: 0.7 }} />
        </div>
        <div className="w-6 h-1.5 rounded-sm" style={{ background: borderSubtle }} />
      </div>
      {/* Body: sidebar + content */}
      <div className="flex h-[calc(100%-0.875rem)]">
        {/* Sidebar */}
        <div
          className="w-7 shrink-0 border-r px-1 pt-1.5 space-y-[3px]"
          style={{ background: sidebar, borderColor: sidebarBorder }}
        >
          <div className="w-full h-[3px] rounded-sm" style={{ background: muted, opacity: 0.5 }} />
          <div
            className="w-full h-[3px] rounded-sm"
            style={{ background: sidebarActive, borderLeft: `2px solid ${primary}` }}
          />
          <div className="w-3/4 h-[3px] rounded-sm" style={{ background: muted, opacity: 0.5 }} />
          <div className="w-full h-[3px] rounded-sm" style={{ background: muted, opacity: 0.3 }} />
        </div>
        {/* Content area */}
        <div className="flex-1 p-1.5 space-y-[3px] overflow-hidden" style={{ background: bg }}>
          <div className="w-10 h-1.5 rounded-sm" style={{ background: fg }} />
          <div className="w-full h-[2px] rounded-sm" style={{ background: muted, opacity: 0.4 }} />
          <div className="w-3/4 h-[2px] rounded-sm" style={{ background: muted, opacity: 0.4 }} />
          {/* Code block */}
          <div
            className="w-full h-[9px] rounded-sm flex items-center px-1 mt-0.5"
            style={{ background: code, border: `1px solid ${borderSubtle}` }}
          >
            <div className="w-1/2 h-[2px] rounded-sm" style={{ background: codeFg, opacity: 0.6 }} />
          </div>
          {/* Primary button */}
          <div
            className="w-6 h-[6px] rounded-sm mt-0.5"
            style={{ background: primary, color: primaryFg }}
          />
        </div>
      </div>
    </div>
  );
}

export function ThemeSelector({ value, onChange, previewMode = "dark" }: ThemeSelectorProps) {
  const presets = Object.entries(THEME_PRESETS).filter(
    ([key]) => key !== "custom"
  ) as [ThemePreset, (typeof THEME_PRESETS)[ThemePreset]][];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {presets.map(([key, preset]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:shadow-md",
            value === key
              ? "border-primary bg-accent shadow-sm"
              : "border-muted bg-transparent hover:border-muted-foreground/30"
          )}
        >
          {value === key && (
            <div className="absolute right-2 top-2 rounded-full bg-primary p-0.5">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}

          {/* Theme preview */}
          <div className="mb-3 w-full">
            <ThemePreview themeKey={key as Exclude<ThemePreset, "custom">} previewMode={previewMode} />
          </div>

          {/* Theme info */}
          <div className="flex items-center gap-2 mb-1">
            <div
              className="h-3 w-3 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: preset.primaryColorHex }}
            />
            <span className="font-semibold text-sm">{preset.name}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {preset.description}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
            {preset.tagline}
          </p>
        </button>
      ))}
    </div>
  );
}
