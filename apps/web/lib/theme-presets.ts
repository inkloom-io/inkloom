export type ThemePreset = "default" | "ocean" | "forest" | "ember" | "midnight" | "dune" | "fossil" | "vapor" | "aubergine" | "custom";

export interface ThemeColors {
  // Core colors
  primary: string;
  primaryForeground: string;
  // Backgrounds
  background: string;
  foreground: string;
  backgroundSubtle: string;
  // Surfaces
  muted: string;
  mutedForeground: string;
  // Borders
  border: string;
  borderSubtle: string;
  // Accents
  accent: string;
  accentForeground: string;
  // Code blocks
  codeBackground: string;
  codeForeground: string;
  codeHighlight: string;
  // Sidebar
  sidebarBackground: string;
  sidebarBorder: string;
  sidebarActiveBackground: string;
  // Header
  headerBackground: string;
  headerBorder: string;
}

export interface ThemeTypography {
  fontSans: string;
  fontMono: string;
  fontDisplay: string;
  googleFontsUrl: string;
}

export interface ThemeEffects {
  // Shadow styles
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  // Border radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  // Unique effects
  headerBlur: string;
  codeBlockStyle: "sharp" | "rounded" | "soft";
  accentGlow: boolean;
}

export interface ThemePresetConfig {
  name: string;
  description: string;
  tagline: string;
  // Legacy - for backwards compatibility
  primaryColor: string;
  primaryColorHex: string;
  // Full theme definition
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  typography: ThemeTypography;
  effects: ThemeEffects;
}

// ============================================================================
// SLATE THEME (Default) - Professional Technical Documentation
// Inspired by: Stripe, Linear, Tailwind docs
// ============================================================================
const slateTheme: ThemePresetConfig = {
  name: "Slate",
  description: "Professional technical documentation",
  tagline: "Clean, precise, authoritative",
  primaryColor: "hsl(222 47% 11%)",
  primaryColorHex: "#111827",
  colors: {
    light: {
      primary: "hsl(222 47% 11%)",
      primaryForeground: "hsl(210 40% 98%)",
      background: "hsl(220 16% 99%)",
      foreground: "hsl(222 47% 11%)",
      backgroundSubtle: "hsl(220 14% 93%)",
      muted: "hsl(220 12% 90%)",
      mutedForeground: "hsl(220 9% 43%)",
      border: "hsl(220 12% 85%)",
      borderSubtle: "hsl(220 12% 91%)",
      accent: "hsl(220 14% 93%)",
      accentForeground: "hsl(222 47% 11%)",
      codeBackground: "hsl(228 16% 14%)",
      codeForeground: "hsl(220 14% 90%)",
      codeHighlight: "hsl(228 14% 22%)",
      sidebarBackground: "hsl(220 18% 95%)",
      sidebarBorder: "hsl(220 12% 87%)",
      sidebarActiveBackground: "hsl(220 14% 91%)",
      headerBackground: "hsl(220 16% 99% / 0.85)",
      headerBorder: "hsl(220 12% 86%)",
    },
    dark: {
      primary: "hsl(210 40% 98%)",
      primaryForeground: "hsl(222 47% 11%)",
      background: "hsl(240 6% 4%)",
      foreground: "hsl(210 20% 94%)",
      backgroundSubtle: "hsl(240 5% 7%)",
      muted: "hsl(240 4% 11%)",
      mutedForeground: "hsl(220 9% 55%)",
      border: "hsl(240 4% 14%)",
      borderSubtle: "hsl(240 4% 10%)",
      accent: "hsl(240 4% 12%)",
      accentForeground: "hsl(210 20% 94%)",
      codeBackground: "hsl(240 6% 3%)",
      codeForeground: "hsl(220 14% 88%)",
      codeHighlight: "hsl(240 4% 10%)",
      sidebarBackground: "hsl(240 6% 4%)",
      sidebarBorder: "hsl(240 4% 12%)",
      sidebarActiveBackground: "hsl(240 4% 12%)",
      headerBackground: "hsl(240 6% 4% / 0.85)",
      headerBorder: "hsl(240 4% 12%)",
    },
  },
  typography: {
    fontSans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
  },
  effects: {
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.03)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
    radiusSm: "0.375rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    headerBlur: "16px",
    codeBlockStyle: "rounded",
    accentGlow: false,
  },
};

// ============================================================================
// AURORA THEME (Ocean) - Modern Vibrant Developer Experience
// Inspired by: Vercel, Raycast, Linear
// ============================================================================
const auroraTheme: ThemePresetConfig = {
  name: "Aurora",
  description: "Modern vibrant developer experience",
  tagline: "Dynamic, energetic, cutting-edge",
  primaryColor: "hsl(238 84% 67%)",
  primaryColorHex: "#6366f1",
  colors: {
    light: {
      primary: "hsl(238 84% 67%)",
      primaryForeground: "hsl(0 0% 100%)",
      background: "hsl(240 24% 97%)",
      foreground: "hsl(240 24% 10%)",
      backgroundSubtle: "hsl(240 20% 93%)",
      muted: "hsl(240 16% 90%)",
      mutedForeground: "hsl(240 10% 46%)",
      border: "hsl(240 14% 86%)",
      borderSubtle: "hsl(240 14% 91%)",
      accent: "hsl(238 84% 67% / 0.1)",
      accentForeground: "hsl(238 84% 50%)",
      codeBackground: "hsl(240 21% 12%)",
      codeForeground: "hsl(240 10% 92%)",
      codeHighlight: "hsl(240 21% 18%)",
      sidebarBackground: "hsl(240 22% 95%)",
      sidebarBorder: "hsl(240 14% 88%)",
      sidebarActiveBackground: "hsl(238 84% 67% / 0.1)",
      headerBackground: "hsl(240 24% 97% / 0.7)",
      headerBorder: "hsl(240 14% 86%)",
    },
    dark: {
      primary: "hsl(238 84% 70%)",
      primaryForeground: "hsl(0 0% 100%)",
      background: "hsl(240 21% 6%)",
      foreground: "hsl(240 10% 96%)",
      backgroundSubtle: "hsl(240 21% 9%)",
      muted: "hsl(240 21% 12%)",
      mutedForeground: "hsl(240 10% 60%)",
      border: "hsl(240 21% 14%)",
      borderSubtle: "hsl(240 21% 10%)",
      accent: "hsl(238 84% 67% / 0.15)",
      accentForeground: "hsl(238 84% 80%)",
      codeBackground: "hsl(240 23% 4%)",
      codeForeground: "hsl(240 10% 90%)",
      codeHighlight: "hsl(240 23% 10%)",
      sidebarBackground: "hsl(240 21% 6%)",
      sidebarBorder: "hsl(240 21% 12%)",
      sidebarActiveBackground: "hsl(238 84% 67% / 0.15)",
      headerBackground: "hsl(240 21% 6% / 0.7)",
      headerBorder: "hsl(240 21% 12%)",
    },
  },
  typography: {
    fontSans: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
    fontDisplay: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap",
  },
  effects: {
    shadowSm: "0 1px 3px 0 rgb(99 102 241 / 0.1), 0 1px 2px -1px rgb(99 102 241 / 0.1)",
    shadowMd: "0 4px 6px -1px rgb(99 102 241 / 0.15), 0 2px 4px -2px rgb(99 102 241 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(99 102 241 / 0.2), 0 4px 6px -4px rgb(99 102 241 / 0.1)",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1rem",
    headerBlur: "16px",
    codeBlockStyle: "rounded",
    accentGlow: true,
  },
};

// ============================================================================
// VERDANT THEME (Forest) - Botanical Ink
// Inspired by: Beautifully typeset field guides, archival reference books
// Deep forest greens on warm ivory, scholarly and lush
// ============================================================================
const verdantTheme: ThemePresetConfig = {
  name: "Verdant",
  description: "Botanical ink documentation",
  tagline: "Scholarly, lush, grounded",
  primaryColor: "hsl(160 45% 30%)",
  primaryColorHex: "#2a7a5e",
  colors: {
    light: {
      primary: "hsl(160 45% 28%)",
      primaryForeground: "hsl(48 60% 97%)",
      background: "hsl(48 45% 96%)",
      foreground: "hsl(160 20% 12%)",
      backgroundSubtle: "hsl(48 35% 92%)",
      muted: "hsl(48 28% 88%)",
      mutedForeground: "hsl(160 8% 42%)",
      border: "hsl(48 22% 82%)",
      borderSubtle: "hsl(48 22% 88%)",
      accent: "hsl(160 35% 90%)",
      accentForeground: "hsl(160 45% 24%)",
      codeBackground: "hsl(150 10% 13%)",
      codeForeground: "hsl(48 18% 88%)",
      codeHighlight: "hsl(150 8% 19%)",
      sidebarBackground: "hsl(48 40% 94%)",
      sidebarBorder: "hsl(48 22% 84%)",
      sidebarActiveBackground: "hsl(160 32% 88%)",
      headerBackground: "hsl(48 45% 96% / 0.9)",
      headerBorder: "hsl(48 22% 82%)",
    },
    dark: {
      primary: "hsl(160 50% 52%)",
      primaryForeground: "hsl(160 30% 8%)",
      background: "hsl(160 12% 8%)",
      foreground: "hsl(48 20% 90%)",
      backgroundSubtle: "hsl(160 10% 11%)",
      muted: "hsl(160 8% 15%)",
      mutedForeground: "hsl(48 10% 56%)",
      border: "hsl(160 8% 19%)",
      borderSubtle: "hsl(160 8% 13%)",
      accent: "hsl(160 30% 16%)",
      accentForeground: "hsl(160 50% 68%)",
      codeBackground: "hsl(155 10% 5%)",
      codeForeground: "hsl(48 12% 82%)",
      codeHighlight: "hsl(155 8% 10%)",
      sidebarBackground: "hsl(160 12% 8%)",
      sidebarBorder: "hsl(160 8% 16%)",
      sidebarActiveBackground: "hsl(160 25% 14%)",
      headerBackground: "hsl(160 12% 8% / 0.9)",
      headerBorder: "hsl(160 8% 16%)",
    },
  },
  typography: {
    fontSans: '"Literata", "Georgia", ui-serif, serif',
    fontMono: '"Source Code Pro", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Literata", "Georgia", ui-serif, serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600;7..72,700&family=Source+Code+Pro:wght@400;500;600&display=swap",
  },
  effects: {
    shadowSm: "0 1px 3px 0 rgb(20 50 36 / 0.06)",
    shadowMd: "0 3px 10px -3px rgb(20 50 36 / 0.1), 0 1px 4px -1px rgb(20 50 36 / 0.05)",
    shadowLg: "0 8px 20px -5px rgb(20 50 36 / 0.12), 0 3px 8px -3px rgb(20 50 36 / 0.07)",
    radiusSm: "0.1875rem",
    radiusMd: "0.3125rem",
    radiusLg: "0.4375rem",
    headerBlur: "12px",
    codeBlockStyle: "soft",
    accentGlow: false,
  },
};

// ============================================================================
// EMBER THEME - Cinematic Editorial
// Inspired by: Mid-century print design, Criterion Collection, Monocle magazine
// Rich amber/copper on warm ivory, sophisticated serif display, warm charcoal dark mode
// ============================================================================
const emberTheme: ThemePresetConfig = {
  name: "Ember",
  description: "Cinematic editorial warmth",
  tagline: "Warm, editorial, refined",
  primaryColor: "hsl(24 80% 42%)",
  primaryColorHex: "#c25a13",
  colors: {
    light: {
      primary: "hsl(24 80% 42%)",
      primaryForeground: "hsl(40 50% 98%)",
      background: "hsl(38 35% 96%)",
      foreground: "hsl(20 20% 12%)",
      backgroundSubtle: "hsl(36 28% 92%)",
      muted: "hsl(34 22% 88%)",
      mutedForeground: "hsl(20 10% 44%)",
      border: "hsl(32 18% 80%)",
      borderSubtle: "hsl(34 18% 87%)",
      accent: "hsl(24 50% 92%)",
      accentForeground: "hsl(24 80% 34%)",
      codeBackground: "hsl(20 12% 12%)",
      codeForeground: "hsl(38 18% 88%)",
      codeHighlight: "hsl(20 10% 18%)",
      sidebarBackground: "hsl(36 32% 94%)",
      sidebarBorder: "hsl(32 18% 82%)",
      sidebarActiveBackground: "hsl(24 42% 90%)",
      headerBackground: "hsl(38 35% 96% / 0.9)",
      headerBorder: "hsl(32 18% 80%)",
    },
    dark: {
      primary: "hsl(24 85% 58%)",
      primaryForeground: "hsl(20 20% 6%)",
      background: "hsl(20 10% 7%)",
      foreground: "hsl(38 18% 90%)",
      backgroundSubtle: "hsl(20 8% 10%)",
      muted: "hsl(20 6% 14%)",
      mutedForeground: "hsl(30 10% 54%)",
      border: "hsl(20 6% 18%)",
      borderSubtle: "hsl(20 6% 12%)",
      accent: "hsl(24 30% 15%)",
      accentForeground: "hsl(24 80% 68%)",
      codeBackground: "hsl(20 10% 4%)",
      codeForeground: "hsl(38 12% 82%)",
      codeHighlight: "hsl(20 8% 10%)",
      sidebarBackground: "hsl(20 10% 7%)",
      sidebarBorder: "hsl(20 6% 15%)",
      sidebarActiveBackground: "hsl(24 20% 13%)",
      headerBackground: "hsl(20 10% 7% / 0.9)",
      headerBorder: "hsl(20 6% 15%)",
    },
  },
  typography: {
    fontSans: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Fira Code", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Fraunces", "Georgia", ui-serif, serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&display=swap",
  },
  effects: {
    shadowSm: "0 1px 3px 0 rgb(120 60 20 / 0.06)",
    shadowMd: "0 4px 8px -2px rgb(120 60 20 / 0.1), 0 1px 3px -1px rgb(120 60 20 / 0.06)",
    shadowLg: "0 10px 20px -4px rgb(120 60 20 / 0.12), 0 4px 8px -3px rgb(120 60 20 / 0.07)",
    radiusSm: "0.25rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    headerBlur: "14px",
    codeBlockStyle: "rounded",
    accentGlow: false,
  },
};

// ============================================================================
// MIDNIGHT THEME - Celestial Observatory
// Inspired by: Observatory UIs, star charts, NASA mission control, Figma dark mode
// Deep navy with electric blue accents, crisp type, ultrasharp borders
// ============================================================================
const midnightTheme: ThemePresetConfig = {
  name: "Midnight",
  description: "Celestial observatory interface",
  tagline: "Deep, precise, luminous",
  primaryColor: "hsl(210 90% 56%)",
  primaryColorHex: "#2b7de9",
  colors: {
    light: {
      primary: "hsl(210 80% 42%)",
      primaryForeground: "hsl(0 0% 100%)",
      background: "hsl(215 30% 97%)",
      foreground: "hsl(218 30% 12%)",
      backgroundSubtle: "hsl(215 22% 93%)",
      muted: "hsl(215 18% 90%)",
      mutedForeground: "hsl(218 12% 46%)",
      border: "hsl(215 16% 84%)",
      borderSubtle: "hsl(215 16% 90%)",
      accent: "hsl(210 50% 92%)",
      accentForeground: "hsl(210 80% 34%)",
      codeBackground: "hsl(222 30% 10%)",
      codeForeground: "hsl(215 15% 90%)",
      codeHighlight: "hsl(222 26% 16%)",
      sidebarBackground: "hsl(215 26% 95%)",
      sidebarBorder: "hsl(215 16% 86%)",
      sidebarActiveBackground: "hsl(210 42% 90%)",
      headerBackground: "hsl(215 30% 97% / 0.85)",
      headerBorder: "hsl(215 16% 84%)",
    },
    dark: {
      primary: "hsl(210 90% 62%)",
      primaryForeground: "hsl(222 30% 6%)",
      background: "hsl(224 32% 6%)",
      foreground: "hsl(215 20% 93%)",
      backgroundSubtle: "hsl(224 28% 9%)",
      muted: "hsl(224 24% 12%)",
      mutedForeground: "hsl(218 15% 55%)",
      border: "hsl(224 20% 16%)",
      borderSubtle: "hsl(224 20% 11%)",
      accent: "hsl(210 40% 14%)",
      accentForeground: "hsl(210 85% 74%)",
      codeBackground: "hsl(226 32% 4%)",
      codeForeground: "hsl(215 15% 86%)",
      codeHighlight: "hsl(226 26% 9%)",
      sidebarBackground: "hsl(224 32% 6%)",
      sidebarBorder: "hsl(224 20% 13%)",
      sidebarActiveBackground: "hsl(210 30% 12%)",
      headerBackground: "hsl(224 32% 6% / 0.85)",
      headerBorder: "hsl(224 20% 13%)",
    },
  },
  typography: {
    fontSans: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
  effects: {
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.15), 0 0 1px 0 rgb(30 100 200 / 0.08)",
    shadowMd: "0 4px 8px -1px rgb(0 0 0 / 0.2), 0 0 2px 0 rgb(30 100 200 / 0.1)",
    shadowLg: "0 10px 20px -3px rgb(0 0 0 / 0.25), 0 0 4px 0 rgb(30 100 200 / 0.08)",
    radiusSm: "0.25rem",
    radiusMd: "0.375rem",
    radiusLg: "0.5rem",
    headerBlur: "20px",
    codeBlockStyle: "sharp",
    accentGlow: true,
  },
};

// ============================================================================
// DUNE THEME - Rose Quartz
// Inspired by: Design tool interfaces, Acne Studios, Céline, gallery spaces
// Soft mauve/rose primary on cool cream, plum-tinted dark mode, refined geometry
// ============================================================================
const duneTheme: ThemePresetConfig = {
  name: "Dune",
  description: "Rose quartz editorial clarity",
  tagline: "Soft, refined, modern",
  primaryColor: "hsl(340 55% 48%)",
  primaryColorHex: "#be3c6d",
  colors: {
    light: {
      primary: "hsl(340 50% 45%)",
      primaryForeground: "hsl(340 20% 98%)",
      background: "hsl(330 20% 97%)",
      foreground: "hsl(335 15% 13%)",
      backgroundSubtle: "hsl(330 16% 93%)",
      muted: "hsl(330 12% 89%)",
      mutedForeground: "hsl(335 6% 44%)",
      border: "hsl(330 10% 82%)",
      borderSubtle: "hsl(330 12% 89%)",
      accent: "hsl(340 38% 92%)",
      accentForeground: "hsl(340 50% 38%)",
      codeBackground: "hsl(330 12% 11%)",
      codeForeground: "hsl(330 8% 88%)",
      codeHighlight: "hsl(330 10% 17%)",
      sidebarBackground: "hsl(330 18% 95%)",
      sidebarBorder: "hsl(330 12% 84%)",
      sidebarActiveBackground: "hsl(340 28% 91%)",
      headerBackground: "hsl(330 20% 97% / 0.9)",
      headerBorder: "hsl(330 10% 82%)",
    },
    dark: {
      primary: "hsl(340 60% 62%)",
      primaryForeground: "hsl(335 15% 6%)",
      background: "hsl(330 14% 7%)",
      foreground: "hsl(330 10% 90%)",
      backgroundSubtle: "hsl(330 12% 10%)",
      muted: "hsl(330 10% 14%)",
      mutedForeground: "hsl(330 6% 52%)",
      border: "hsl(330 8% 18%)",
      borderSubtle: "hsl(330 8% 12%)",
      accent: "hsl(340 22% 15%)",
      accentForeground: "hsl(340 55% 72%)",
      codeBackground: "hsl(330 12% 4%)",
      codeForeground: "hsl(330 6% 80%)",
      codeHighlight: "hsl(330 10% 9%)",
      sidebarBackground: "hsl(330 14% 7%)",
      sidebarBorder: "hsl(330 8% 15%)",
      sidebarActiveBackground: "hsl(340 18% 13%)",
      headerBackground: "hsl(330 14% 7% / 0.9)",
      headerBorder: "hsl(330 8% 15%)",
    },
  },
  typography: {
    fontSans: '"Sora", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Overpass Mono", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Sora", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Overpass+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap",
  },
  effects: {
    shadowSm: "0 1px 2px 0 rgb(100 40 70 / 0.05)",
    shadowMd: "0 3px 8px -2px rgb(100 40 70 / 0.08), 0 1px 3px -1px rgb(100 40 70 / 0.04)",
    shadowLg: "0 8px 18px -4px rgb(100 40 70 / 0.1), 0 3px 6px -3px rgb(100 40 70 / 0.05)",
    radiusSm: "0.3125rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    headerBlur: "14px",
    codeBlockStyle: "rounded",
    accentGlow: false,
  },
};

// ============================================================================
// FOSSIL THEME - Raw Concrete
// Inspired by: Brutalist architecture, museum specimen labels, poured concrete
// Achromatic gray base (zero warmth) with muted verdigris/patina accent
// The only theme with truly neutral grays — cold, mineral, uncompromising
// ============================================================================
const fossilTheme: ThemePresetConfig = {
  name: "Fossil",
  description: "Raw concrete brutalism",
  tagline: "Cold, mineral, uncompromising",
  primaryColor: "hsl(175 22% 38%)",
  primaryColorHex: "#4b7d78",
  colors: {
    light: {
      primary: "hsl(175 22% 34%)",
      primaryForeground: "hsl(0 0% 98%)",
      background: "hsl(0 0% 95%)",
      foreground: "hsl(0 0% 11%)",
      backgroundSubtle: "hsl(0 0% 91%)",
      muted: "hsl(0 0% 87%)",
      mutedForeground: "hsl(0 0% 44%)",
      border: "hsl(0 0% 77%)",
      borderSubtle: "hsl(0 0% 85%)",
      accent: "hsl(175 12% 91%)",
      accentForeground: "hsl(175 22% 28%)",
      codeBackground: "hsl(0 0% 11%)",
      codeForeground: "hsl(0 0% 86%)",
      codeHighlight: "hsl(0 0% 17%)",
      sidebarBackground: "hsl(0 0% 93%)",
      sidebarBorder: "hsl(0 0% 79%)",
      sidebarActiveBackground: "hsl(175 12% 89%)",
      headerBackground: "hsl(0 0% 95% / 0.92)",
      headerBorder: "hsl(0 0% 77%)",
    },
    dark: {
      primary: "hsl(175 28% 58%)",
      primaryForeground: "hsl(0 0% 6%)",
      background: "hsl(0 0% 7%)",
      foreground: "hsl(0 0% 87%)",
      backgroundSubtle: "hsl(0 0% 10%)",
      muted: "hsl(0 0% 14%)",
      mutedForeground: "hsl(0 0% 52%)",
      border: "hsl(0 0% 18%)",
      borderSubtle: "hsl(0 0% 12%)",
      accent: "hsl(175 14% 14%)",
      accentForeground: "hsl(175 28% 66%)",
      codeBackground: "hsl(0 0% 4%)",
      codeForeground: "hsl(0 0% 78%)",
      codeHighlight: "hsl(0 0% 9%)",
      sidebarBackground: "hsl(0 0% 7%)",
      sidebarBorder: "hsl(0 0% 15%)",
      sidebarActiveBackground: "hsl(175 12% 12%)",
      headerBackground: "hsl(0 0% 7% / 0.92)",
      headerBorder: "hsl(0 0% 15%)",
    },
  },
  typography: {
    fontSans: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Inconsolata", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Inconsolata:wght@400;500;600;700&display=swap",
  },
  effects: {
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.08)",
    shadowMd: "0 3px 8px -2px rgb(0 0 0 / 0.14), 0 1px 3px -1px rgb(0 0 0 / 0.08)",
    shadowLg: "0 8px 18px -4px rgb(0 0 0 / 0.18), 0 3px 6px -3px rgb(0 0 0 / 0.1)",
    radiusSm: "0.125rem",
    radiusMd: "0.25rem",
    radiusLg: "0.375rem",
    headerBlur: "10px",
    codeBlockStyle: "sharp",
    accentGlow: false,
  },
};

// ============================================================================
// VAPOR THEME - Frosted Glass Interface
// Inspired by: Apple Vision Pro, glass-morphism dashboards, translucent UI
// Cool teal/cyan on frosted surfaces, luminous edges, ethereal depth
// ============================================================================
const vaporTheme: ThemePresetConfig = {
  name: "Vapor",
  description: "Frosted glass interface",
  tagline: "Ethereal, luminous, fluid",
  primaryColor: "hsl(174 72% 40%)",
  primaryColorHex: "#1ba8a0",
  colors: {
    light: {
      primary: "hsl(174 65% 36%)",
      primaryForeground: "hsl(0 0% 100%)",
      background: "hsl(190 25% 97%)",
      foreground: "hsl(195 25% 12%)",
      backgroundSubtle: "hsl(190 20% 93%)",
      muted: "hsl(190 14% 89%)",
      mutedForeground: "hsl(195 10% 44%)",
      border: "hsl(190 14% 83%)",
      borderSubtle: "hsl(190 12% 89%)",
      accent: "hsl(174 38% 91%)",
      accentForeground: "hsl(174 65% 28%)",
      codeBackground: "hsl(195 18% 11%)",
      codeForeground: "hsl(190 12% 90%)",
      codeHighlight: "hsl(195 14% 17%)",
      sidebarBackground: "hsl(190 22% 95% / 0.8)",
      sidebarBorder: "hsl(190 14% 85%)",
      sidebarActiveBackground: "hsl(174 32% 89%)",
      headerBackground: "hsl(190 25% 97% / 0.7)",
      headerBorder: "hsl(190 14% 83% / 0.6)",
    },
    dark: {
      primary: "hsl(174 75% 52%)",
      primaryForeground: "hsl(195 25% 6%)",
      background: "hsl(200 18% 6%)",
      foreground: "hsl(190 15% 92%)",
      backgroundSubtle: "hsl(200 14% 9%)",
      muted: "hsl(200 12% 13%)",
      mutedForeground: "hsl(195 10% 54%)",
      border: "hsl(200 10% 17%)",
      borderSubtle: "hsl(200 10% 11%)",
      accent: "hsl(174 25% 14%)",
      accentForeground: "hsl(174 70% 66%)",
      codeBackground: "hsl(200 16% 4%)",
      codeForeground: "hsl(190 10% 84%)",
      codeHighlight: "hsl(200 12% 9%)",
      sidebarBackground: "hsl(200 18% 6% / 0.8)",
      sidebarBorder: "hsl(200 10% 14%)",
      sidebarActiveBackground: "hsl(174 18% 12%)",
      headerBackground: "hsl(200 18% 6% / 0.6)",
      headerBorder: "hsl(200 10% 14% / 0.5)",
    },
  },
  typography: {
    fontSans: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Space Mono", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap",
  },
  effects: {
    shadowSm: "0 1px 3px 0 rgb(0 80 80 / 0.06), 0 0 1px 0 rgb(0 180 160 / 0.08)",
    shadowMd: "0 4px 10px -2px rgb(0 80 80 / 0.1), 0 0 2px 0 rgb(0 180 160 / 0.1)",
    shadowLg: "0 12px 24px -4px rgb(0 80 80 / 0.14), 0 0 4px 0 rgb(0 180 160 / 0.08)",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1.25rem",
    headerBlur: "24px",
    codeBlockStyle: "rounded",
    accentGlow: true,
  },
};

// ============================================================================
// AUBERGINE THEME - Velvet & Gold
// Inspired by: Luxury brand sites, wine labels, velvet textures, art galleries
// Deep purple/plum with champagne gold accents, opulent dark-first aesthetic
// ============================================================================
const aubergineTheme: ThemePresetConfig = {
  name: "Aubergine",
  description: "Velvet luxury documentation",
  tagline: "Opulent, rich, distinguished",
  primaryColor: "hsl(42 70% 50%)",
  primaryColorHex: "#d9a825",
  colors: {
    light: {
      primary: "hsl(42 60% 42%)",
      primaryForeground: "hsl(0 0% 100%)",
      background: "hsl(278 16% 97%)",
      foreground: "hsl(275 18% 14%)",
      backgroundSubtle: "hsl(276 12% 92%)",
      muted: "hsl(276 8% 88%)",
      mutedForeground: "hsl(275 6% 44%)",
      border: "hsl(276 8% 81%)",
      borderSubtle: "hsl(278 8% 88%)",
      accent: "hsl(42 38% 92%)",
      accentForeground: "hsl(42 60% 34%)",
      codeBackground: "hsl(275 16% 12%)",
      codeForeground: "hsl(278 8% 88%)",
      codeHighlight: "hsl(275 14% 18%)",
      sidebarBackground: "hsl(278 14% 95%)",
      sidebarBorder: "hsl(276 8% 83%)",
      sidebarActiveBackground: "hsl(42 28% 91%)",
      headerBackground: "hsl(278 16% 97% / 0.9)",
      headerBorder: "hsl(276 8% 81%)",
    },
    dark: {
      primary: "hsl(42 75% 58%)",
      primaryForeground: "hsl(275 20% 6%)",
      background: "hsl(275 22% 6%)",
      foreground: "hsl(278 10% 90%)",
      backgroundSubtle: "hsl(275 18% 9%)",
      muted: "hsl(275 14% 13%)",
      mutedForeground: "hsl(278 8% 52%)",
      border: "hsl(275 12% 17%)",
      borderSubtle: "hsl(275 12% 11%)",
      accent: "hsl(42 25% 13%)",
      accentForeground: "hsl(42 70% 68%)",
      codeBackground: "hsl(275 20% 4%)",
      codeForeground: "hsl(278 6% 80%)",
      codeHighlight: "hsl(275 16% 9%)",
      sidebarBackground: "hsl(275 22% 6%)",
      sidebarBorder: "hsl(275 12% 14%)",
      sidebarActiveBackground: "hsl(42 18% 11%)",
      headerBackground: "hsl(275 22% 6% / 0.88)",
      headerBorder: "hsl(275 12% 14%)",
    },
  },
  typography: {
    fontSans: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"Victor Mono", ui-monospace, SFMono-Regular, monospace',
    fontDisplay: '"Playfair Display", "Georgia", ui-serif, serif',
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&family=Victor+Mono:wght@400;500;600&display=swap",
  },
  effects: {
    shadowSm: "0 1px 3px 0 rgb(40 20 60 / 0.08)",
    shadowMd: "0 4px 10px -2px rgb(40 20 60 / 0.12), 0 1px 4px -1px rgb(40 20 60 / 0.06)",
    shadowLg: "0 10px 22px -4px rgb(40 20 60 / 0.16), 0 4px 8px -3px rgb(40 20 60 / 0.08)",
    radiusSm: "0.25rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    headerBlur: "16px",
    codeBlockStyle: "rounded",
    accentGlow: true,
  },
};

// Custom theme (uses default/slate as base)
const customTheme: ThemePresetConfig = {
  ...slateTheme,
  name: "Custom",
  description: "Use your own brand color",
  tagline: "Your brand, your style",
};

export const THEME_PRESETS: Record<ThemePreset, ThemePresetConfig> = {
  default: slateTheme,
  ocean: auroraTheme,
  forest: verdantTheme,
  ember: emberTheme,
  midnight: midnightTheme,
  dune: duneTheme,
  fossil: fossilTheme,
  vapor: vaporTheme,
  aubergine: aubergineTheme,
  custom: customTheme,
};

// ============================================================================
// Color Utility Functions
// ============================================================================

export function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!match) return "#111827";

  const h = parseInt(match[1]!, 10) / 360;
  const s = parseInt(match[2]!, 10) / 100;
  const l = parseInt(match[3]!, 10) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "hsl(222 47% 11%)";

  const r = parseInt(result[1]!, 16) / 255;
  const g = parseInt(result[2]!, 16) / 255;
  const b = parseInt(result[3]!, 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

export function isValidHex(hex: string): boolean {
  return /^#?([a-f\d]{6}|[a-f\d]{3})$/i.test(hex);
}

export function isValidHsl(hsl: string): boolean {
  return /^hsl\(\d+\s+\d+%\s+\d+%\)$/.test(hsl);
}

export function normalizeColor(color: string): string {
  if (isValidHex(color)) {
    const hex = color.startsWith("#") ? color : `#${color}`;
    return hexToHsl(hex);
  }
  if (isValidHsl(color)) {
    return color;
  }
  return THEME_PRESETS.default.primaryColor;
}
