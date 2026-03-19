import {
  type ThemePreset,
  type ThemePresetConfig,
  THEME_PRESETS,
} from "./theme-presets";
import { computeContrastForeground } from "./color-utils";

/**
 * @deprecated Use generateEditorThemeCSS instead for full dark mode support
 */
export function generateEditorThemeStyles(
  themePreset: ThemePreset = "default",
  customPrimaryColor?: string,
  customBackgroundColorLight?: string,
): string {
  const theme = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
  const colors = theme.colors.light;
  const typography = theme.typography;
  const effects = theme.effects;

  const primaryColor = customPrimaryColor || colors.primary;

  return `
    --editor-background: ${customBackgroundColorLight || colors.background};
    --editor-foreground: ${colors.foreground};
    --editor-background-subtle: ${colors.backgroundSubtle};
    --editor-muted: ${colors.muted};
    --editor-muted-foreground: ${colors.mutedForeground};
    --editor-border: ${colors.border};
    --editor-border-subtle: ${colors.borderSubtle};
    --editor-primary: ${primaryColor};
    --editor-primary-foreground: ${customPrimaryColor ? computeContrastForeground(customPrimaryColor) : colors.primaryForeground};
    --editor-accent: ${colors.accent};
    --editor-accent-foreground: ${colors.accentForeground};
    --editor-code-background: ${colors.codeBackground};
    --editor-code-foreground: ${colors.codeForeground};
    --editor-code-highlight: ${colors.codeHighlight};
    --editor-font-sans: ${typography.fontSans};
    --editor-font-mono: ${typography.fontMono};
    --editor-font-display: ${typography.fontDisplay};
    --editor-shadow-sm: ${effects.shadowSm};
    --editor-shadow-md: ${effects.shadowMd};
    --editor-shadow-lg: ${effects.shadowLg};
    --editor-radius-sm: ${effects.radiusSm};
    --editor-radius-md: ${effects.radiusMd};
    --editor-radius-lg: ${effects.radiusLg};
  `.trim();
}

/**
 * Generate theme-specific background CSS for light/dark modes
 */
function getThemeBackground(
  themePreset: ThemePreset,
  lightColors: { background: string; backgroundSubtle: string; border: string },
  darkColors: { background: string; backgroundSubtle: string; border: string }
): { light: string; dark: string } {
  if (themePreset === "forest") {
    // Verdant: dot-grid pattern matching the published site
    return {
      light: `background-color: ${lightColors.background};
      background-image: radial-gradient(circle, ${lightColors.border} 0.5px, transparent 0.5px);
      background-size: 24px 24px;`,
      dark: `background-color: ${darkColors.background};
      background-image: radial-gradient(circle, ${darkColors.border} 0.5px, transparent 0.5px);
      background-size: 24px 24px;`,
    };
  }
  if (themePreset === "midnight") {
    // Midnight: subtle radial glow from corners
    return {
      light: `background: linear-gradient(180deg, ${lightColors.background} 0%, ${lightColors.backgroundSubtle} 100%);`,
      dark: `background-color: ${darkColors.background};
      background-image:
        radial-gradient(at 0% 0%, hsl(210 90% 60% / 0.04) 0%, transparent 50%),
        radial-gradient(at 100% 100%, hsl(210 90% 60% / 0.03) 0%, transparent 50%);`,
    };
  }
  // Fossil / Default-gradient fallthrough: simple gradient
  // (fossil removed its grid texture — uses the default gradient below)
  if (themePreset === "vapor") {
    // Vapor: frosted glass with luminous orbs
    return {
      light: `background-color: ${lightColors.background};
      background-image:
        radial-gradient(at 20% 30%, hsl(174 72% 40% / 0.06) 0%, transparent 50%),
        radial-gradient(at 80% 70%, hsl(190 60% 50% / 0.05) 0%, transparent 50%);`,
      dark: `background-color: ${darkColors.background};
      background-image:
        radial-gradient(at 20% 30%, hsl(174 75% 52% / 0.06) 0%, transparent 50%),
        radial-gradient(at 80% 70%, hsl(190 60% 50% / 0.04) 0%, transparent 50%);`,
    };
  }
  if (themePreset === "aubergine") {
    // Aubergine: deep radial vignette with gold dust
    return {
      light: `background: linear-gradient(180deg, ${lightColors.background} 0%, ${lightColors.backgroundSubtle} 100%);`,
      dark: `background-color: ${darkColors.background};
      background-image:
        radial-gradient(at 50% 0%, hsl(275 30% 14%) 0%, transparent 60%),
        radial-gradient(at 100% 50%, hsl(42 50% 50% / 0.03) 0%, transparent 40%);`,
    };
  }
  // Default/Aurora/Ember/Dune/Custom: simple gradient
  return {
    light: `background: linear-gradient(180deg, ${lightColors.background} 0%, ${lightColors.backgroundSubtle} 100%);`,
    dark: `background: linear-gradient(180deg, ${darkColors.background} 0%, ${darkColors.backgroundSubtle} 100%);`,
  };
}

/**
 * Generates the full CSS block including dark mode media query
 */
export function generateEditorThemeCSS(
  wrapperClass: string,
  themePreset: ThemePreset = "default",
  customPrimaryColor?: string,
  customBackgroundColorLight?: string,
  customBackgroundColorDark?: string,
  customBackgroundSubtleColorLight?: string,
  customBackgroundSubtleColorDark?: string,
): string {
  const theme = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
  const lightColors = theme.colors.light;
  const darkColors = theme.colors.dark;
  const typography = theme.typography;
  const effects = theme.effects;

  const lightPrimaryColor = customPrimaryColor || lightColors.primary;
  const lightBackground = customBackgroundColorLight || lightColors.background;
  const lightBackgroundSubtle = customBackgroundSubtleColorLight || lightColors.backgroundSubtle;

  const darkPrimaryColor = customPrimaryColor || darkColors.primary;
  const darkBackground = customBackgroundColorDark || darkColors.background;
  const darkBackgroundSubtle = customBackgroundSubtleColorDark || darkColors.backgroundSubtle;

  const bg = getThemeBackground(themePreset,
    { ...lightColors, background: lightBackground, backgroundSubtle: lightBackgroundSubtle },
    { ...darkColors, background: darkBackground, backgroundSubtle: darkBackgroundSubtle },
  );

  return `
    .${wrapperClass} {
      --editor-background: ${lightBackground};
      --editor-foreground: ${lightColors.foreground};
      --editor-background-subtle: ${lightBackgroundSubtle};
      --editor-muted: ${lightColors.muted};
      --editor-muted-foreground: ${lightColors.mutedForeground};
      --editor-border: ${lightColors.border};
      --editor-border-subtle: ${lightColors.borderSubtle};
      --editor-primary: ${lightPrimaryColor};
      --editor-primary-foreground: ${customPrimaryColor ? computeContrastForeground(lightPrimaryColor) : lightColors.primaryForeground};
      --editor-accent: ${lightColors.accent};
      --editor-accent-foreground: ${lightColors.accentForeground};
      --editor-code-background: ${lightColors.codeBackground};
      --editor-code-foreground: ${lightColors.codeForeground};
      --editor-code-highlight: ${lightColors.codeHighlight};
      --editor-font-sans: ${typography.fontSans};
      --editor-font-mono: ${typography.fontMono};
      --editor-font-display: ${typography.fontDisplay};
      --editor-shadow-sm: ${effects.shadowSm};
      --editor-shadow-md: ${effects.shadowMd};
      --editor-shadow-lg: ${effects.shadowLg};
      --editor-radius-sm: ${effects.radiusSm};
      --editor-radius-md: ${effects.radiusMd};
      --editor-radius-lg: ${effects.radiusLg};
      ${bg.light}
    }

    .dark .${wrapperClass} {
      --editor-background: ${darkBackground};
      --editor-foreground: ${darkColors.foreground};
      --editor-background-subtle: ${darkBackgroundSubtle};
      --editor-muted: ${darkColors.muted};
      --editor-muted-foreground: ${darkColors.mutedForeground};
      --editor-border: ${darkColors.border};
      --editor-border-subtle: ${darkColors.borderSubtle};
      --editor-primary: ${darkPrimaryColor};
      --editor-primary-foreground: ${customPrimaryColor ? computeContrastForeground(darkPrimaryColor) : darkColors.primaryForeground};
      --editor-accent: ${darkColors.accent};
      --editor-accent-foreground: ${darkColors.accentForeground};
      --editor-code-background: ${darkColors.codeBackground};
      --editor-code-foreground: ${darkColors.codeForeground};
      --editor-code-highlight: ${darkColors.codeHighlight};
      ${bg.dark}
    }
  `.trim();
}

/**
 * Returns the Google Fonts URL for the selected theme
 */
export function getEditorFontUrl(themePreset: ThemePreset = "default"): string {
  const theme = THEME_PRESETS[themePreset] || THEME_PRESETS.default;
  return theme.typography.googleFontsUrl;
}

/**
 * Get theme configuration for a preset
 */
export function getThemeConfig(
  themePreset: ThemePreset = "default"
): ThemePresetConfig {
  return THEME_PRESETS[themePreset] || THEME_PRESETS.default;
}
