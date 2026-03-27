import { blockNoteToMDX, parseBlockNoteContent } from "./blocknote-to-mdx";
import { THEME_PRESETS, type ThemeColors } from "./theme-presets";
import { computeContrastForeground } from "./color-utils";
import { extractSearchableText, parseBlockNoteContent as parseBlocks } from "./search/extract-text";
import type { SearchDocument } from "./search/types";
import {
  generatePageHtml,
  generateShellHtml,
  generateAnalyticsSnippets,
  generateSitemapXml,
  generateRobotsTxt,
  generateJsonLd,
  sanitizeCustomCss,
  buildCustomFontsUrl,
  buildCustomFontsCss,
} from "./generate-html";

/**
 * Build aggregated site data for embedding in HTML.
 * This is the data that gets serialized into __INKLOOM_DATA__.
 */
export function buildSiteData(
  config: {
    name: string;
    description?: string;
    logo?: string;
    lightLogo?: string;
    darkLogo?: string;
    customFonts?: { heading?: string; body?: string; code?: string };
    search?: { enabled: boolean };
    proxyUrl?: string;
    apiUrl?: string;
    socialLinks?: { platform: string; url: string }[];
    ctaButton?: { label: string; url: string };
    showBranding?: boolean;
    projectId?: string;
  },
  navigation: NavItem[]
): object {
  return {
    ...(config.projectId ? { projectId: config.projectId } : {}),
    config: {
      title: config.name,
      description: config.description || "",
      logo: config.logo,
      ...(config.lightLogo ? { lightLogo: config.lightLogo } : {}),
      ...(config.darkLogo ? { darkLogo: config.darkLogo } : {}),
      ...(config.customFonts ? { customFonts: config.customFonts } : {}),
      search: config.search || { enabled: true },
      proxyUrl: config.proxyUrl || null,
      ...(config.apiUrl ? { apiUrl: config.apiUrl } : {}),
      ...(config.socialLinks && config.socialLinks.length > 0
        ? { socialLinks: config.socialLinks }
        : {}),
      ...(config.ctaButton ? { ctaButton: config.ctaButton } : {}),
      ...(config.showBranding !== undefined ? { showBranding: config.showBranding } : {}),
    },
    navigation,
    tabs: [],
  };
}

interface Page {
  id?: string;
  title: string;
  slug: string;
  path: string;
  content: string;
  position: number;
  icon?: string;
  subtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
}

interface Folder {
  id?: string;
  name: string;
  slug: string;
  path: string;
  position: number;
  icon?: string;
}

type ThemePreset = "default" | "ocean" | "forest" | "ember" | "midnight" | "dune" | "fossil" | "vapor" | "aubergine" | "custom";

interface ProjectConfig {
  name: string;
  description?: string;
  logo?: string;
  theme?: ThemePreset;
  primaryColor?: string;
  backgroundColorLight?: string;
  backgroundColorDark?: string;
  backgroundSubtleColorLight?: string;
  backgroundSubtleColorDark?: string;
  accentColor?: string;
  sidebarBackgroundColor?: string;
  headerBackgroundColor?: string;
  linkColor?: string;
  codeAccentColor?: string;
  /** Custom CSS from branding settings */
  customCss?: string;
  /** Custom font families */
  customFonts?: { heading?: string; body?: string; code?: string };
  /** Default theme mode for first-time visitors */
  defaultThemeMode?: "light" | "dark" | "system";
  /** SEO settings */
  seo?: {
    ogTitle?: string;
    ogDescription?: string;
    twitterCard?: "summary" | "summary_large_image";
    robotsTxtCustom?: string;
  };
  /** Analytics settings */
  analytics?: {
    ga4MeasurementId?: string;
    posthogApiKey?: string;
    posthogHost?: string;
  };
  /** Base URL for the generated site (used in sitemap, canonical URLs) */
  baseUrl?: string;
  /** Viewer asset manifest (JS/CSS entry points from default template build) */
  viewerAssets?: { js: string[]; css: string[] };
}

interface GeneratedFile {
  file: string;
  data: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  method?: string;
  children?: NavItem[];
}


function generateNavigation(pages: Page[], folders: Folder[]): NavItem[] {
  const navigation: NavItem[] = [];

  // Build tree from root items
  const rootPages = pages
    .filter((p) => p.path !== "/" && p.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);
  const rootFolders = folders
    .filter((f) => f.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);

  // Add root pages first
  for (const page of rootPages) {
    const navItem: NavItem = {
      title: page.title,
      href: `${page.path}`,
    };
    if (page.icon) {
      navItem.icon = page.icon;
    }
    navigation.push(navItem);
  }

  // Add root folders with their children
  for (const folder of rootFolders) {
    const children = buildFolderChildren(folder, pages, folders);
    const navItem: NavItem = {
      title: folder.name,
      href: `${folder.path}`,
      children,
    };
    if (folder.icon) {
      navItem.icon = folder.icon;
    }
    navigation.push(navItem);
  }

  return navigation;
}

/**
 * Generate search index from pages.
 */
function generateSearchIndex(pages: Page[]): { documents: SearchDocument[] } {
  const documents: SearchDocument[] = [];

  for (const page of pages) {
    const blocks = parseBlocks(page.content);
    const extracted = extractSearchableText(blocks, page.title);

    documents.push({
      id: page.path,
      title: extracted.title,
      headings: extracted.headings,
      content: extracted.content,
      codeBlocks: extracted.codeBlocks,
      path: page.path,
      excerpt: extracted.excerpt,
    });
  }

  return { documents };
}

function buildFolderChildren(
  folder: Folder,
  pages: Page[],
  folders: Folder[]
): NavItem[] {
  const children: NavItem[] = [];

  // Get direct child folders
  const childFolders = folders
    .filter(
      (f) =>
        f.path.startsWith(folder.path + "/") &&
        f.path.split("/").length === folder.path.split("/").length + 1
    )
    .sort((a, b) => a.position - b.position);

  // Get direct child pages
  const childPages = pages
    .filter(
      (p) =>
        p.path.startsWith(folder.path + "/") &&
        p.path.split("/").length === folder.path.split("/").length + 1
    )
    .sort((a, b) => a.position - b.position);

  // Add child folders recursively
  for (const childFolder of childFolders) {
    const grandChildren = buildFolderChildren(childFolder, pages, folders);
    const navItem: NavItem = {
      title: childFolder.name,
      href: `${childFolder.path}`,
      children: grandChildren,
    };
    if (childFolder.icon) {
      navItem.icon = childFolder.icon;
    }
    children.push(navItem);
  }

  // Add child pages
  for (const page of childPages) {
    const navItem: NavItem = {
      title: page.title,
      href: `${page.path}`,
    };
    if (page.icon) {
      navItem.icon = page.icon;
    }
    children.push(navItem);
  }

  return children;
}

/**
 * Generate comprehensive theme CSS based on the selected preset.
 * Each theme gets its own distinct visual identity with unique typography,
 * colors, effects, and atmospheric styling.
 */
interface ColorBlockOverrides {
  primary?: string | null;
  background?: string | null;
  backgroundSubtle?: string | null;
  accent?: string | null;
  sidebarBackground?: string | null;
  headerBackground?: string | null;
  linkColor?: string | null;
  codeAccent?: string | null;
}

function generateColorBlock(colors: ThemeColors, primaryOverride: string | null, backgroundOverride: string | null, backgroundSubtleOverride: string | null, extraOverrides?: ColorBlockOverrides): string {
  const primary = primaryOverride || colors.primary;
  const background = backgroundOverride || colors.background;

  const derivedAccent = primaryOverride
    ? `color-mix(in srgb, ${primaryOverride} 8%, ${background})`
    : colors.accent;
  const derivedAccentForeground = primaryOverride
    ? colors.foreground
    : colors.accentForeground;
  const sidebarActive = primaryOverride
    ? `color-mix(in srgb, ${primaryOverride} 10%, ${background})`
    : colors.sidebarActiveBackground;

  const accent = extraOverrides?.accent || derivedAccent;
  const accentForeground = extraOverrides?.accent ? colors.foreground : derivedAccentForeground;

  return `
  --color-background: ${background};
  --color-foreground: ${colors.foreground};
  --color-background-subtle: ${backgroundSubtleOverride || colors.backgroundSubtle};
  --color-muted: ${colors.muted};
  --color-muted-foreground: ${colors.mutedForeground};
  --color-border: ${colors.border};
  --color-border-subtle: ${colors.borderSubtle};
  --color-primary: ${primary};
  --color-primary-foreground: ${primaryOverride ? computeContrastForeground(primaryOverride) : colors.primaryForeground};
  --color-accent: ${accent};
  --color-accent-foreground: ${accentForeground};
  --color-secondary: ${colors.muted};
  --color-secondary-foreground: ${colors.foreground};
  --color-code-background: ${colors.codeBackground};
  --color-code-foreground: ${colors.codeForeground};
  --color-code-highlight: ${colors.codeHighlight};
  --color-sidebar-background: ${extraOverrides?.sidebarBackground || colors.sidebarBackground};
  --color-sidebar-border: ${colors.sidebarBorder};
  --color-sidebar-active: ${sidebarActive};
  --color-header-background: ${extraOverrides?.headerBackground || colors.headerBackground};
  --color-header-border: ${colors.headerBorder};
  --color-link: ${extraOverrides?.linkColor || `var(--color-primary)`};
  --color-code-accent: ${extraOverrides?.codeAccent || `var(--color-primary)`};`;
}

function generateThemeCss(config: ProjectConfig): { css: string; googleFontsUrl: string } {
  const themeKey = config.theme || "default";
  const theme = THEME_PRESETS[themeKey];

  const colors = theme.colors;
  const typography = theme.typography;
  const effects = theme.effects;

  const primaryColorOverride = config.primaryColor && config.primaryColor !== theme.primaryColor
    ? config.primaryColor
    : null;

  const bgLightOverride = config.backgroundColorLight && config.backgroundColorLight !== colors.light.background
    ? config.backgroundColorLight
    : null;
  const bgDarkOverride = config.backgroundColorDark && config.backgroundColorDark !== colors.dark.background
    ? config.backgroundColorDark
    : null;
  const bgSubtleLightOverride = config.backgroundSubtleColorLight && config.backgroundSubtleColorLight !== colors.light.backgroundSubtle
    ? config.backgroundSubtleColorLight
    : null;
  const bgSubtleDarkOverride = config.backgroundSubtleColorDark && config.backgroundSubtleColorDark !== colors.dark.backgroundSubtle
    ? config.backgroundSubtleColorDark
    : null;

  const extraOverrides: ColorBlockOverrides = {
    accent: config.accentColor || null,
    sidebarBackground: config.sidebarBackgroundColor || null,
    headerBackground: config.headerBackgroundColor || null,
    linkColor: config.linkColor || null,
    codeAccent: config.codeAccentColor || null,
  };

  const lightBlock = generateColorBlock(colors.light, primaryColorOverride, bgLightOverride, bgSubtleLightOverride, extraOverrides);
  const darkBlock = generateColorBlock(colors.dark, primaryColorOverride, bgDarkOverride, bgSubtleDarkOverride, extraOverrides);

  const css = `/* InkLoom Theme: ${theme.name} */

/* Shared (mode-independent) */
:root {
  --font-sans: ${typography.fontSans};
  --font-mono: ${typography.fontMono};
  --font-display: ${typography.fontDisplay};
  --shadow-sm: ${effects.shadowSm};
  --shadow-md: ${effects.shadowMd};
  --shadow-lg: ${effects.shadowLg};
  --radius-sm: ${effects.radiusSm};
  --radius-md: ${effects.radiusMd};
  --radius-lg: ${effects.radiusLg};
  --header-blur: ${effects.headerBlur};
}

/* Light mode */
:root[data-theme="light"] {
  color-scheme: light;
${lightBlock}
}

/* Dark mode */
:root[data-theme="dark"] {
  color-scheme: dark;
${darkBlock}
}

/* System: default to light, dark via media query */
:root[data-theme="system"] {
  color-scheme: light;
${lightBlock}
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    color-scheme: dark;
  ${darkBlock}
  }
}

/* Legacy fallback (sites deployed before this feature) */
:root:not([data-theme]) {
  color-scheme: dark;
${darkBlock}
}

/* Link color override */
.prose a { color: var(--color-link, var(--color-primary)); }

/* Code block accent border */
pre[data-code-block] { border-top: 2px solid var(--color-code-accent, var(--color-primary)); }

${generateThemeSpecificCss(themeKey)}
`;

  return { css, googleFontsUrl: typography.googleFontsUrl };
}

/**
 * Generate theme-specific CSS enhancements for each preset
 */
export function generateThemeSpecificCss(themeKey: ThemePreset): string {
  switch (themeKey) {
    case "default":
      return generateInkCss();
    case "ocean":
      return generateAuroraCss();
    case "forest":
      return generateVerdantCss();
    case "ember":
      return generateEmberCss();
    case "midnight":
      return generateMidnightCss();
    case "dune":
      return generateDuneCss();
    case "fossil":
      return generateFossilCss();
    case "vapor":
      return generateVaporCss();
    case "aubergine":
      return generateAubergineCss();
    default:
      return generateInkCss();
  }
}

/**
 * Ink theme: Premium technical documentation
 * Inspired by Stripe, Linear, Vercel — minimal but meticulously refined
 */
function generateInkCss(): string {
  return `
/* Ink: Premium refinement */
html {
  --theme-name: "ink";
}

body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--color-primary) 10%, transparent) 0%, transparent 100%),
    radial-gradient(at 0% 0%, var(--color-background-subtle) 0%, transparent 50%),
    radial-gradient(at 100% 50%, color-mix(in srgb, var(--color-border-subtle) 40%, transparent) 0%, transparent 50%),
    radial-gradient(at 30% 100%, var(--color-background-subtle) 0%, transparent 40%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--color-border-subtle) 60%, transparent) 0.5px, transparent 0.5px);
  background-size: 32px 32px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow:
    0 1px 0 0 color-mix(in srgb, var(--color-border) 50%, transparent),
    0 4px 12px -4px rgb(0 0 0 / 0.03);
}

.sidebar-link-active {
  border-left-width: 3px;
}

.prose pre {
  position: relative;
  border: 1px solid var(--color-border-subtle);
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
  border-radius: var(--radius-md);
  box-shadow:
    0 2px 4px -1px rgb(0 0 0 / 0.06),
    0 1px 2px -1px rgb(0 0 0 / 0.04),
    inset 0 1px 0 0 color-mix(in srgb, var(--color-border-subtle) 30%, transparent);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.125em 0.375em;
  font-size: 0.875em;
  box-shadow: 0 1px 1px 0 rgb(0 0 0 / 0.04);
}

.callout {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  border-left: 3px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-background-subtle) 60%, var(--color-background));
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 0.04),
    0 1px 2px -1px rgb(0 0 0 / 0.03);
}

.prose a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease, color 0.2s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
  color: var(--color-primary);
}

.prose h1 {
  background: linear-gradient(145deg, var(--color-foreground) 30%, var(--color-muted-foreground) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.prose h2 {
  font-weight: 600;
  letter-spacing: -0.02em;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose h3 {
  font-weight: 600;
  letter-spacing: -0.01em;
  color: color-mix(in srgb, var(--color-foreground) 85%, var(--color-primary));
}

.prose table {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.03);
}

.prose th {
  background: var(--color-background-subtle);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  font-size: 0.8em;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: none;
}

.prose blockquote {
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-background-subtle) 80%, var(--color-background)) 0%,
    transparent 100%
  );
  padding-left: 1.25rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 20%,
    var(--color-border) 80%,
    transparent 100%
  );
  opacity: 0.7;
}

.btn-primary {
  box-shadow:
    0 1px 2px 0 rgb(0 0 0 / 0.08),
    0 1px 1px 0 rgb(0 0 0 / 0.04),
    inset 0 1px 0 0 rgb(255 255 255 / 0.1);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  box-shadow:
    0 2px 4px 0 rgb(0 0 0 / 0.12),
    0 1px 2px 0 rgb(0 0 0 / 0.06),
    inset 0 1px 0 0 rgb(255 255 255 / 0.1);
  transform: translateY(-0.5px);
}
`;
}

/**
 * Aurora theme: Modern, vibrant, energetic
 */
function generateAuroraCss(): string {
  return `
/* Aurora: Dynamic energy */
html {
  --theme-name: "aurora";
}

body {
  background-image:
    radial-gradient(ellipse 90% 50% at 50% -5%, color-mix(in srgb, var(--color-primary) 14%, transparent) 0%, transparent 100%),
    radial-gradient(at 0% 0%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 50%),
    radial-gradient(at 100% 0%, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 50%),
    radial-gradient(at 50% 100%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image:
    linear-gradient(30deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--color-primary) 6%, transparent) 87.5%, color-mix(in srgb, var(--color-primary) 6%, transparent)),
    linear-gradient(150deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--color-primary) 6%, transparent) 87.5%, color-mix(in srgb, var(--color-primary) 6%, transparent)),
    linear-gradient(30deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--color-primary) 6%, transparent) 87.5%, color-mix(in srgb, var(--color-primary) 6%, transparent)),
    linear-gradient(150deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 12%, transparent 12.5%, transparent 87%, color-mix(in srgb, var(--color-primary) 6%, transparent) 87.5%, color-mix(in srgb, var(--color-primary) 6%, transparent)),
    linear-gradient(60deg, color-mix(in srgb, var(--color-primary) 4%, transparent) 25%, transparent 25.5%, transparent 75%, color-mix(in srgb, var(--color-primary) 4%, transparent) 75%, color-mix(in srgb, var(--color-primary) 4%, transparent));
  background-size: 40px 70px;
  background-position: 0 0, 0 0, 20px 35px, 20px 35px, 0 0;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.sidebar-link-active {
  border-left-width: 3px;
  box-shadow: -3px 0 12px -2px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.prose pre {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 30%, transparent), color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-primary) 30%, transparent)) border-box;
}

.prose a:hover {
  text-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.callout {
  position: relative;
  overflow: hidden;
}

.callout::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, transparent));
  border-radius: 3px 0 0 3px;
}

.prose h1 {
  background: linear-gradient(135deg, var(--color-foreground) 0%, var(--color-muted-foreground) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  box-shadow: 0 0 0 0 transparent;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 20px 0 color-mix(in srgb, var(--color-primary) 30%, transparent);
}
`;
}

/**
 * Verdant theme: Botanical Ink
 */
function generateVerdantCss(): string {
  return `
/* Verdant: Botanical Ink */
html {
  --theme-name: "verdant";
}

body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(circle, var(--color-border) 0.5px, transparent 0.5px);
  background-size: 24px 24px;
  background-attachment: fixed;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 var(--color-border-subtle);
}

.sidebar-link-active {
  border-left-width: 3px;
  border-left-color: var(--color-primary);
}

.prose pre {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  box-shadow: inset 0 1px 3px 0 rgb(0 0 0 / 0.12);
}

.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  font-style: italic;
  border-radius: 0;
  padding-left: 1.25rem;
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.025em;
}

.prose h2 {
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 600;
}

.prose a {
  text-decoration: underline;
  text-decoration-color: var(--color-border);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
}

.prose table {
  border: none;
  border-collapse: collapse;
}

.prose th {
  background: transparent;
  border-bottom: 2px solid var(--color-border);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75em;
  letter-spacing: 0.05em;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: 1px solid var(--color-border);
}

.callout {
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 15%,
    var(--color-primary) 50%,
    var(--color-border) 85%,
    transparent 100%
  );
  opacity: 0.6;
}
`;
}

/**
 * Ember theme: Cinematic Editorial
 */
function generateEmberCss(): string {
  return `
/* Ember: Cinematic Editorial */
html {
  --theme-name: "ember";
}

body {
  background-image:
    radial-gradient(ellipse 70% 45% at 50% -5%, color-mix(in srgb, var(--color-primary) 10%, transparent) 0%, transparent 100%),
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 39px,
    color-mix(in srgb, var(--color-border-subtle) 50%, transparent) 39px,
    color-mix(in srgb, var(--color-border-subtle) 50%, transparent) 40px
  );
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.sidebar-link-active {
  border-left-width: 3px;
  border-left-color: var(--color-primary);
}

.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  font-style: italic;
  padding-left: 1.25rem;
  border-radius: 0;
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.prose h2 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 600;
}

.prose a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 31%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
}

.prose table {
  border: none;
  border-collapse: collapse;
}

.prose th {
  background: transparent;
  border-bottom: 2px solid var(--color-border);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.7em;
  letter-spacing: 0.08em;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: 1px solid var(--color-border);
}

.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 20%,
    color-mix(in srgb, var(--color-primary) 38%, transparent) 50%,
    var(--color-border) 80%,
    transparent 100%
  );
}
`;
}

/**
 * Midnight theme: Celestial Observatory
 */
function generateMidnightCss(): string {
  return `
/* Midnight: Celestial Observatory */
html {
  --theme-name: "midnight";
}

body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(ellipse 80% 45% at 50% -10%, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 100%),
    radial-gradient(at 0% 0%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%),
    radial-gradient(at 100% 100%, color-mix(in srgb, var(--color-primary) 3%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--color-primary) 5%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 5%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.12) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.12) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 19%, transparent), 0 2px 8px -2px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.sidebar-link-active {
  border-left-width: 2px;
  box-shadow: -2px 0 10px -1px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.prose pre {
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 19%, transparent), transparent 40%, transparent 60%, color-mix(in srgb, var(--color-primary) 13%, transparent)) border-box;
  box-shadow: 0 0 12px -4px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.prose blockquote {
  border-left: 2px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0;
  box-shadow: -2px 0 12px -4px color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.02em;
}

.prose h2 {
  font-weight: 600;
  letter-spacing: -0.01em;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 600;
}

.prose a {
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  transition: border-color 0.2s ease, text-shadow 0.2s ease;
}

.prose a:hover {
  border-bottom-color: var(--color-primary);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 19%, transparent);
}

.prose table {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.prose th {
  background: var(--color-background-subtle);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  font-size: 0.8em;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: none;
}

.callout {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  border-left: 2px solid var(--color-primary);
  background: var(--color-background-subtle);
  box-shadow: 0 0 8px -4px color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 10%,
    color-mix(in srgb, var(--color-primary) 38%, transparent) 50%,
    var(--color-border) 90%,
    transparent 100%
  );
  box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-primary) 8%, transparent);
}
`;
}

/**
 * Dune theme: Rose Quartz
 */
function generateDuneCss(): string {
  return `
/* Dune: Rose Quartz */
html {
  --theme-name: "dune";
}

body {
  background-image:
    radial-gradient(ellipse 75% 45% at 50% -5%, color-mix(in srgb, var(--color-primary) 9%, transparent) 0%, transparent 100%),
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image:
    linear-gradient(45deg, color-mix(in srgb, var(--color-border-subtle) 40%, transparent) 1px, transparent 1px),
    linear-gradient(-45deg, color-mix(in srgb, var(--color-border-subtle) 40%, transparent) 1px, transparent 1px);
  background-size: 36px 36px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.sidebar-link-active {
  border-left-width: 3px;
  border-left-color: var(--color-primary);
}

.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
}

.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.02em;
}

.prose h2 {
  font-weight: 600;
  letter-spacing: -0.01em;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 600;
}

.prose a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
}

.prose table {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.prose th {
  background: var(--color-background-subtle);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  font-size: 0.8em;
  letter-spacing: 0.02em;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: none;
}

.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 20%,
    color-mix(in srgb, var(--color-primary) 31%, transparent) 50%,
    var(--color-border) 80%,
    transparent 100%
  );
}
`;
}

/**
 * Fossil theme: Raw Concrete
 */
function generateFossilCss(): string {
  return `
/* Fossil: Raw Concrete */
html {
  --theme-name: "fossil";
}

body {
  background-image:
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

.site-header {
  border-bottom: 2px solid var(--color-border);
  box-shadow: none;
}

.sidebar-link-active {
  border-left-width: 4px;
  border-left-color: var(--color-primary);
}

.prose pre {
  border-radius: 0;
  border: 2px solid var(--color-border);
  box-shadow: 4px 4px 0 0 var(--color-border-subtle);
}

.prose blockquote {
  border-left: 4px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0;
  font-style: normal;
  position: relative;
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.02em;
}

.prose h2 {
  font-weight: 700;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 0.5rem;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.85em;
  letter-spacing: 0.06em;
}

.prose a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 31%, transparent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.15s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
}

.prose table {
  border: 2px solid var(--color-border);
  border-collapse: collapse;
}

.prose th {
  background: var(--color-background-subtle);
  border: 2px solid var(--color-border);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7em;
  letter-spacing: 0.1em;
}

.prose td {
  border: 1px solid var(--color-border);
}

.callout {
  border-radius: 0;
  border: 2px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  background: var(--color-background-subtle);
  box-shadow: 3px 3px 0 0 var(--color-border-subtle);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: 0;
}

.prose hr {
  border: none;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 25%, transparent) 10%,
    var(--color-primary) 50%,
    color-mix(in srgb, var(--color-primary) 25%, transparent) 90%,
    transparent 100%
  );
}
`;
}

/**
 * Vapor theme: Frosted Glass Interface
 */
function generateVaporCss(): string {
  return `
/* Vapor: Frosted Glass Interface */
html {
  --theme-name: "vapor";
}

body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(ellipse 85% 50% at 50% -10%, color-mix(in srgb, var(--color-primary) 11%, transparent) 0%, transparent 100%),
    radial-gradient(at 20% 30%, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 50%),
    radial-gradient(at 80% 70%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--color-primary) 5%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--color-primary) 5%, transparent) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 8%, transparent), 0 4px 16px -4px rgb(0 0 0 / 0.12);
}

.sidebar-link-active {
  border-left-width: 3px;
  box-shadow: -3px 0 14px -2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 19%, transparent), transparent 40%, transparent 60%, color-mix(in srgb, var(--color-primary) 9%, transparent)) border-box;
  box-shadow: 0 4px 20px -6px rgb(0 0 0 / 0.2), 0 0 0 1px color-mix(in srgb, var(--color-primary) 3%, transparent);
}

.prose blockquote {
  border-left: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
  padding-left: 1.25rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  box-shadow: -2px 0 12px -4px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.prose h1 {
  font-weight: 600;
  letter-spacing: -0.03em;
}

.prose h2 {
  font-weight: 500;
  letter-spacing: -0.02em;
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 500;
}

.prose a {
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 21%, transparent);
  transition: border-color 0.2s ease, text-shadow 0.2s ease, color 0.2s ease;
}

.prose a:hover {
  border-bottom-color: var(--color-primary);
  text-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.prose table {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 12px -4px rgb(0 0 0 / 0.1);
}

.prose th {
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
  border-bottom: 1px solid var(--color-border);
  font-weight: 500;
  font-size: 0.8em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: none;
}

.callout {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  border-left: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 2%, transparent);
  box-shadow: 0 2px 16px -6px color-mix(in srgb, var(--color-primary) 7%, transparent);
}

.prose :not(pre) > code {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 13%, transparent);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 13%, transparent) 15%,
    color-mix(in srgb, var(--color-primary) 38%, transparent) 50%,
    color-mix(in srgb, var(--color-primary) 13%, transparent) 85%,
    transparent 100%
  );
  box-shadow: 0 0 12px 0 color-mix(in srgb, var(--color-primary) 7%, transparent);
}
`;
}

/**
 * Aubergine theme: Velvet & Gold
 */
function generateAubergineCss(): string {
  return `
/* Aubergine: Velvet & Gold */
html {
  --theme-name: "aubergine";
}

body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -8%, color-mix(in srgb, var(--color-primary) 13%, transparent) 0%, transparent 100%),
    radial-gradient(at 50% 0%, color-mix(in srgb, var(--color-primary) 15%, var(--color-background)) 0%, transparent 60%),
    radial-gradient(at 100% 50%, color-mix(in srgb, var(--color-primary) 3%, transparent) 0%, transparent 40%);
  background-attachment: fixed;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 600px;
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 44px,
      color-mix(in srgb, var(--color-primary) 5%, transparent) 44px,
      color-mix(in srgb, var(--color-primary) 5%, transparent) 45px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 44px,
      color-mix(in srgb, var(--color-primary) 5%, transparent) 44px,
      color-mix(in srgb, var(--color-primary) 5%, transparent) 45px
    );
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 9%, transparent);
}

.sidebar-link-active {
  border-left-width: 3px;
  border-image: linear-gradient(180deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 50%, transparent)) 1;
  box-shadow: -3px 0 10px -2px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.5rem;
  border-radius: 0;
  font-style: italic;
}

.prose h1 {
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  background: linear-gradient(135deg, var(--color-foreground) 30%, var(--color-primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.prose h2 {
  font-weight: 600;
  letter-spacing: -0.01em;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.prose h3 {
  color: var(--color-primary);
  font-weight: 600;
}

.prose a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.2s ease, text-shadow 0.2s ease;
}

.prose a:hover {
  text-decoration-color: var(--color-primary);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.prose table {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.prose th {
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
  font-weight: 600;
  font-size: 0.75em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.prose td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.prose tr:last-child td {
  border-bottom: none;
}

.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
  box-shadow: 0 2px 12px -4px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.prose hr {
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border) 15%,
    var(--color-primary) 50%,
    var(--color-border) 85%,
    transparent 100%
  );
  box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-primary) 7%, transparent);
}
`;
}

export interface GenerateSiteResult {
  files: GeneratedFile[];
  warnings?: string[];
}

export async function generateSiteFiles(
  pages: Page[],
  folders: Folder[],
  config: ProjectConfig
): Promise<GenerateSiteResult> {
  const files: GeneratedFile[] = [];
  const warnings: string[] = [];

  // Generate theme CSS
  const themeResult = generateThemeCss(config);
  files.push({
    file: "theme.css",
    data: themeResult.css,
  });
  files.push({
    file: "theme-fonts-url",
    data: themeResult.googleFontsUrl,
  });

  // Generate empty tabs config (flat navigation only in core mode)
  files.push({
    file: "lib/tabs.json",
    data: JSON.stringify([], null, 2),
  });

  // Generate navigation.json for client-side sidebar
  const navigation = generateNavigation(pages, folders);
  files.push({
    file: "lib/navigation.json",
    data: JSON.stringify(navigation, null, 2),
  });

  // Generate combined navigation file for server components
  const allNavigations = {
    main: navigation,
    tabs: {} as Record<string, NavItem[]>,
  };
  files.push({
    file: "lib/all-navigation.json",
    data: JSON.stringify(allNavigations, null, 2),
  });

  // Generate page MDX files
  for (const page of pages) {
    const blocks = parseBlockNoteContent(page.content);
    const mdxContent = blockNoteToMDX(blocks);

    const frontmatterLines = [`title: "${page.title}"`];
    if (page.icon) frontmatterLines.push(`icon: "${page.icon}"`);
    if (page.subtitle) frontmatterLines.push(`subtitle: "${page.subtitle}"`);
    if (page.titleSectionHidden) frontmatterLines.push(`titleSectionHidden: true`);
    if (page.titleIconHidden) frontmatterLines.push(`titleIconHidden: true`);
    const frontmatter = `---\n${frontmatterLines.join("\n")}\n---\n\n`;

    files.push({
      file: `docs${page.path === "/" ? "/index" : page.path}.mdx`,
      data: frontmatter + mdxContent,
    });
  }

  // Generate search index (both for Next.js public dir and for built output root)
  const searchIndex = generateSearchIndex(pages);
  files.push({
    file: "public/search-index.json",
    data: JSON.stringify(searchIndex, null, 2),
  });
  files.push({
    file: "search-index.json",
    data: JSON.stringify(searchIndex, null, 2),
  });

  // ---------------------------------------------------------------------------
  // HTML generation: per-page HTML, shell HTML, sitemap, robots.txt
  // ---------------------------------------------------------------------------

  const baseUrl = config.baseUrl || "";

  // Build analytics snippets
  const analyticsSnippetsHtml = config.analytics
    ? generateAnalyticsSnippets({
        ga4MeasurementId: config.analytics.ga4MeasurementId,
        posthogApiKey: config.analytics.posthogApiKey,
        posthogHost: config.analytics.posthogHost,
      })
    : "";

  // Build custom fonts URL and CSS
  const customFontsUrl = config.customFonts
    ? buildCustomFontsUrl(config.customFonts)
    : undefined;
  const customFontsCss = config.customFonts
    ? buildCustomFontsCss(config.customFonts)
    : undefined;

  // Sanitize custom CSS
  const customCss = config.customCss
    ? sanitizeCustomCss(config.customCss)
    : undefined;

  // Build site data for embedding in HTML
  const siteData = buildSiteData(
    {
      name: config.name,
      description: config.description,
      logo: config.logo,
      customFonts: config.customFonts,
      search: { enabled: true },
    },
    navigation
  );

  const siteConfig = {
    title: config.name,
    description: config.description || "",
    logo: config.logo,
  };

  // Use viewer assets if available, otherwise empty manifest for static-only builds
  const assetManifest = config.viewerAssets ?? { js: [] as string[], css: [] as string[] };

  // Shared HTML options
  const sharedHtmlOpts = {
    siteConfig,
    assetManifest,
    siteData,
    themeCss: themeResult.css,
    themeFontsUrl: themeResult.googleFontsUrl || undefined,
    customCss,
    customFontsUrl,
    customFontsCss,
    analyticsSnippets: analyticsSnippetsHtml || undefined,
    defaultThemeMode: config.defaultThemeMode,
  };

  // Build folder lookup for breadcrumb trails
  const folderByPath = new Map(folders.map((f) => [f.path, f]));
  function getFolderTrail(pagePath: string): string[] {
    const parts = pagePath.split("/").filter(Boolean);
    // Remove the page slug (last part)
    parts.pop();
    const trail: string[] = [];
    let currentPath = "";
    for (const part of parts) {
      currentPath += `/${part}`;
      const folder = folderByPath.get(currentPath);
      if (folder) {
        trail.push(folder.name);
      }
    }
    // Return innermost to outermost
    return trail.reverse();
  }

  // Pre-compute MDX content for each page (reused for HTML, JSON, and search)
  const pagesWithMdx = pages.map((page) => {
    const blocks = parseBlockNoteContent(page.content);
    const mdxContent = blockNoteToMDX(blocks);
    return { ...page, mdxContent };
  });

  // Generate per-page HTML files
  for (const page of pagesWithMdx) {
    const pagePath = page.path === "/" ? "" : page.path;
    const canonicalUrl = `${baseUrl}${pagePath || "/"}`;

    const ogMeta = {
      ogTitle: config.seo?.ogTitle || page.title,
      ogDescription: config.seo?.ogDescription || config.description || "",
      ogUrl: canonicalUrl,
      ogSiteName: config.name,
      ogType: "article",
      twitterCard: config.seo?.twitterCard || "summary_large_image",
    };

    const jsonLd = generateJsonLd({
      title: page.title,
      description: config.description || "",
      url: canonicalUrl,
      siteName: config.name,
    });

    const pageHtml = generatePageHtml({
      ...sharedHtmlOpts,
      pageTitle: page.title,
      pageDescription: page.subtitle || config.description,
      pageContent: page.mdxContent,
      pagePath: canonicalUrl,
      pageIcon: page.icon,
      pageSubtitle: page.subtitle,
      titleSectionHidden: page.titleSectionHidden,
      titleIconHidden: page.titleIconHidden,
      folderTrail: getFolderTrail(page.path),
      ogMeta,
      jsonLd,
    });

    // Write as {path}/index.html (e.g., /getting-started → getting-started/index.html)
    const htmlPath = page.path === "/"
      ? "index.html"
      : `${page.path.replace(/^\//, "")}/index.html`;

    files.push({ file: htmlPath, data: pageHtml });
  }

  // Generate per-page JSON for SPA client-side navigation
  for (const page of pagesWithMdx) {
    const pageJson = JSON.stringify({
      title: page.title,
      ...(page.subtitle ? { description: page.subtitle } : {}),
      ...(page.icon ? { icon: page.icon } : {}),
      ...(page.subtitle ? { subtitle: page.subtitle } : {}),
      ...(page.titleSectionHidden ? { titleSectionHidden: page.titleSectionHidden } : {}),
      ...(page.titleIconHidden ? { titleIconHidden: page.titleIconHidden } : {}),
      content: page.mdxContent,
    });
    const jsonPath = page.path === "/"
      ? "_content/index.json"
      : `_content${page.path}.json`;
    files.push({ file: jsonPath, data: pageJson });
  }

  // Generate _content/site.json for SPA data provider
  files.push({
    file: "_content/site.json",
    data: JSON.stringify(siteData),
  });

  // Generate shell HTML (SPA entry point)
  const shellOgMeta = {
    ogTitle: config.seo?.ogTitle || `${config.name} Documentation`,
    ogDescription: config.seo?.ogDescription || config.description || "",
    ogUrl: baseUrl || "/",
    ogSiteName: config.name,
    ogType: "website",
    twitterCard: config.seo?.twitterCard || "summary_large_image",
  };

  // Only generate a separate 404.html shell if there's a root page already
  // generating index.html
  const hasRootPage = pages.some((p) => p.path === "/");
  if (!hasRootPage) {
    const shellHtml = generateShellHtml({
      ...sharedHtmlOpts,
      ogMeta: shellOgMeta,
    });
    files.push({ file: "index.html", data: shellHtml });
  }

  // Always generate 404.html as the SPA shell
  const notFoundHtml = generateShellHtml({
    ...sharedHtmlOpts,
    ogMeta: shellOgMeta,
  });
  files.push({ file: "404.html", data: notFoundHtml });

  // Generate sitemap.xml
  const sitemapPages = pages.map((p) => ({
    path: p.path === "/" ? "/" : p.path,
  }));
  files.push({
    file: "sitemap.xml",
    data: generateSitemapXml(baseUrl || "/", sitemapPages),
  });

  // Generate robots.txt
  files.push({
    file: "robots.txt",
    data: generateRobotsTxt(baseUrl || "/", config.seo?.robotsTxtCustom),
  });

  return { files, ...(warnings.length > 0 ? { warnings } : {}) };
}
