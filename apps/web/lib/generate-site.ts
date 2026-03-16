import { blockNoteToMDX, parseBlockNoteContent } from "./blocknote-to-mdx";
import { THEME_PRESETS, type ThemeColors } from "./theme-presets";
import { extractSearchableText, parseBlockNoteContent as parseBlocks } from "./search/extract-text";
import type { SearchDocument } from "./search/types";
import { parseOpenApiSpec } from "./openapi/parse-spec";
import {
  generateApiReferenceMdx,
  generatePlaygroundData,
} from "./openapi/generate-api-mdx";

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
  navigation: NavItem[],
  tabs: { id: string; name: string; slug: string; icon?: string; navigation: NavItem[] }[]
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
    tabs,
  };
}

interface Page {
  id?: string; // Convex page ID for tab matching
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
  id?: string; // Convex folder ID for tab matching
  name: string;
  slug: string;
  path: string;
  position: number;
  icon?: string;
}

type ThemePreset = "default" | "ocean" | "forest" | "ember" | "midnight" | "dune" | "fossil" | "vapor" | "aubergine" | "custom";

interface NavTabItem {
  type: "folder" | "page";
  folderId?: string;
  pageId?: string;
}

interface NavTab {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  // Legacy format: single folderId directly on tab
  folderId?: string;
  // New format: array of items
  items?: NavTabItem[];
}

// Normalize tab to always have items array
function normalizeNavTab(tab: NavTab): NavTab & { items: NavTabItem[] } {
  if (tab.items && tab.items.length > 0) {
    return tab as NavTab & { items: NavTabItem[] };
  }
  // Migrate from old folderId format
  if (tab.folderId) {
    return {
      ...tab,
      items: [{ type: "folder", folderId: tab.folderId }],
    };
  }
  // Empty tab
  return { ...tab, items: [] };
}

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
  navTabs?: NavTab[];
  openapi?: {
    specContent: string;
    basePath: string;
  };
}

interface GeneratedFile {
  file: string;
  data: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}


function generateNavigation(pages: Page[], folders: Folder[]): NavItem[] {
  const navigation: NavItem[] = [];

  // Note: We don't add an index page to navigation since the root redirects to the first doc

  // Build tree from root items
  const rootPages = pages
    .filter((p) => p.path !== "/" && p.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);
  const rootFolders = folders
    .filter((f) => f.path.split("/").length === 2)
    .sort((a, b) => a.position - b.position);

  // Add root pages first (pages above folders at root level)
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
 * Generate search index with path mapping for tabs
 * When tabs exist, only include pages that are assigned to a tab, using remapped paths
 */
function generateSearchIndexWithMapping(
  pages: Page[],
  pathMapping: Map<string, string>,
  hasTabs: boolean
): { documents: SearchDocument[] } {
  const documents: SearchDocument[] = [];

  for (const page of pages) {
    const remappedPath = pathMapping.get(page.path);

    // If tabs exist and this page isn't assigned to a tab, skip it
    if (hasTabs && !remappedPath) {
      continue;
    }

    const blocks = parseBlocks(page.content);
    const extracted = extractSearchableText(blocks, page.title);

    // Use remapped path if available
    const finalPath = remappedPath ? `${remappedPath}` : `${page.path}`;

    documents.push({
      id: finalPath,
      title: extracted.title,
      headings: extracted.headings,
      content: extracted.content,
      codeBlocks: extracted.codeBlocks,
      path: finalPath,
      excerpt: extracted.excerpt,
    });
  }

  return { documents };
}

/**
 * Rewrite a path by replacing the original folder prefix with a new prefix (tab slug)
 * e.g., rewritePath("/api-reference/endpoint", "/api-reference", "/guides") => "/guides/endpoint"
 */
function rewritePath(originalPath: string, originalPrefix: string, newPrefix: string): string {
  if (originalPath === originalPrefix) {
    return newPrefix;
  }
  if (originalPath.startsWith(originalPrefix + "/")) {
    return newPrefix + originalPath.slice(originalPrefix.length);
  }
  return originalPath;
}

function generateNavigationForFolder(
  rootFolder: Folder,
  pages: Page[],
  folders: Folder[],
  pathPrefix?: string // Optional: tab slug to use as path prefix (e.g., "/guides")
): NavItem[] {
  // Get direct children of the root folder
  const childFolders = folders
    .filter(
      (f) =>
        f.path.startsWith(rootFolder.path + "/") &&
        f.path.split("/").length === rootFolder.path.split("/").length + 1
    )
    .sort((a, b) => a.position - b.position);

  const childPages = pages
    .filter(
      (p) =>
        p.path.startsWith(rootFolder.path + "/") &&
        p.path.split("/").length === rootFolder.path.split("/").length + 1
    )
    .sort((a, b) => a.position - b.position);

  const navigation: NavItem[] = [];

  // Add child folders
  for (const childFolder of childFolders) {
    const grandChildren = buildFolderChildrenWithRewrite(childFolder, pages, folders, rootFolder.path, pathPrefix);
    const href = pathPrefix
      ? `${rewritePath(childFolder.path, rootFolder.path, pathPrefix)}`
      : `${childFolder.path}`;
    const navItem: NavItem = {
      title: childFolder.name,
      href,
      children: grandChildren,
    };
    if (childFolder.icon) {
      navItem.icon = childFolder.icon;
    }
    navigation.push(navItem);
  }

  // Add child pages
  for (const page of childPages) {
    const href = pathPrefix
      ? `${rewritePath(page.path, rootFolder.path, pathPrefix)}`
      : `${page.path}`;
    const navItem: NavItem = {
      title: page.title,
      href,
    };
    if (page.icon) {
      navItem.icon = page.icon;
    }
    navigation.push(navItem);
  }

  return navigation;
}

/**
 * Build folder children with optional path rewriting for tabs
 */
function buildFolderChildrenWithRewrite(
  folder: Folder,
  pages: Page[],
  folders: Folder[],
  originalRootPath: string,
  pathPrefix?: string
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
    const grandChildren = buildFolderChildrenWithRewrite(childFolder, pages, folders, originalRootPath, pathPrefix);
    const href = pathPrefix
      ? `${rewritePath(childFolder.path, originalRootPath, pathPrefix)}`
      : `${childFolder.path}`;
    const navItem: NavItem = {
      title: childFolder.name,
      href,
      children: grandChildren,
    };
    if (childFolder.icon) {
      navItem.icon = childFolder.icon;
    }
    children.push(navItem);
  }

  // Add child pages
  for (const page of childPages) {
    const href = pathPrefix
      ? `${rewritePath(page.path, originalRootPath, pathPrefix)}`
      : `${page.path}`;
    const navItem: NavItem = {
      title: page.title,
      href,
    };
    if (page.icon) {
      navItem.icon = page.icon;
    }
    children.push(navItem);
  }

  return children;
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
 * Generate comprehensive theme CSS based on the selected preset
 * Each theme gets its own distinct visual identity with unique typography,
 * colors, effects, and atmospheric styling.
 */
function generateColorBlock(colors: ThemeColors, primaryOverride: string | null, backgroundOverride: string | null, backgroundSubtleOverride: string | null): string {
  const primary = primaryOverride || colors.primary;
  const background = backgroundOverride || colors.background;

  // When primary is overridden, derive accent and sidebar-active from the new primary
  // using color-mix() so they harmonize with the custom color.
  // accent: very light tint of primary (8% primary mixed into background)
  // sidebar-active: slightly stronger tint (10% primary mixed into background)
  // accent-foreground stays as the main foreground for readability on tinted surfaces
  const accent = primaryOverride
    ? `color-mix(in srgb, ${primaryOverride} 8%, ${background})`
    : colors.accent;
  const accentForeground = primaryOverride
    ? colors.foreground
    : colors.accentForeground;
  const sidebarActive = primaryOverride
    ? `color-mix(in srgb, ${primaryOverride} 10%, ${background})`
    : colors.sidebarActiveBackground;

  return `
  --color-background: ${background};
  --color-foreground: ${colors.foreground};
  --color-background-subtle: ${backgroundSubtleOverride || colors.backgroundSubtle};
  --color-muted: ${colors.muted};
  --color-muted-foreground: ${colors.mutedForeground};
  --color-border: ${colors.border};
  --color-border-subtle: ${colors.borderSubtle};
  --color-primary: ${primary};
  --color-primary-foreground: ${colors.primaryForeground};
  --color-accent: ${accent};
  --color-accent-foreground: ${accentForeground};
  --color-secondary: ${colors.muted};
  --color-secondary-foreground: ${colors.foreground};
  --color-code-background: ${colors.codeBackground};
  --color-code-foreground: ${colors.codeForeground};
  --color-code-highlight: ${colors.codeHighlight};
  --color-sidebar-background: ${colors.sidebarBackground};
  --color-sidebar-border: ${colors.sidebarBorder};
  --color-sidebar-active: ${sidebarActive};
  --color-header-background: ${colors.headerBackground};
  --color-header-border: ${colors.headerBorder};`;
}

function generateThemeCss(config: ProjectConfig): { css: string; googleFontsUrl: string } {
  const themeKey = config.theme || "default";
  const theme = THEME_PRESETS[themeKey];

  const colors = theme.colors;
  const typography = theme.typography;
  const effects = theme.effects;

  // Allow custom primary color override on any theme
  const primaryColorOverride = config.primaryColor && config.primaryColor !== theme.primaryColor
    ? config.primaryColor
    : null;

  // Allow custom background color overrides per mode
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

  const lightBlock = generateColorBlock(colors.light, primaryColorOverride, bgLightOverride, bgSubtleLightOverride);
  const darkBlock = generateColorBlock(colors.dark, primaryColorOverride, bgDarkOverride, bgSubtleDarkOverride);

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

${generateThemeSpecificCss(themeKey)}
`;

  return { css, googleFontsUrl: typography.googleFontsUrl };
}

/**
 * Generate theme-specific CSS enhancements for each preset
 */
function generateThemeSpecificCss(themeKey: ThemePreset): string {
  switch (themeKey) {
    case "default":
      return generateSlateCss();
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
      return generateSlateCss();
  }
}

/**
 * Slate theme: Premium technical documentation
 * Inspired by Stripe, Linear, Vercel — minimal but meticulously refined
 * Subtle mesh gradients, micro-shadows, crisp typography, elegant depth
 */
function generateSlateCss(): string {
  return `
/* Slate: Premium refinement */
html {
  --theme-name: "slate";
}

/* Sophisticated mesh gradient background with subtle depth */
body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(at 0% 0%, var(--color-background-subtle) 0%, transparent 50%),
    radial-gradient(at 100% 50%, color-mix(in srgb, var(--color-border-subtle) 40%, transparent) 0%, transparent 50%),
    radial-gradient(at 30% 100%, var(--color-background-subtle) 0%, transparent 40%);
  background-attachment: fixed;
}

/* Subtle dot-grid texture overlay */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, var(--color-border-subtle) 0.5px, transparent 0.5px);
  background-size: 32px 32px;
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}

/* Header — crisp frosted glass with refined border */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow:
    0 1px 0 0 color-mix(in srgb, var(--color-border) 50%, transparent),
    0 4px 12px -4px rgb(0 0 0 / 0.03);
}

/* Sidebar active — clean left accent with subtle highlight */
.sidebar-link-active {
  position: relative;
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 2px;
  background: var(--color-primary);
  border-radius: 0 1px 1px 0;
}

/* Code blocks — refined with top accent edge and layered shadow */
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

/* Inline code — crisp pill with subtle depth */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.125em 0.375em;
  font-size: 0.875em;
  box-shadow: 0 1px 1px 0 rgb(0 0 0 / 0.04);
}

/* Callouts — refined card style with left accent */
.callout {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  border-left: 3px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-background-subtle) 60%, var(--color-background));
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 0.04),
    0 1px 2px -1px rgb(0 0 0 / 0.03);
}

/* Links — refined underline interaction */
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

/* Headings — precise spacing with subtle gradient on h1 */
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

/* Tables — clean card style with refined header */
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

/* Blockquote — refined with subtle background */
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

/* Horizontal rules — elegant fade */
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

/* Sidebar section — subtle refinement */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Button refinement */
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
 * Glowing accents, gradient effects, bold interactions
 */
function generateAuroraCss(): string {
  return `
/* Aurora: Dynamic energy */
html {
  --theme-name: "aurora";
}

/* Subtle gradient mesh background */
body {
  background-image:
    radial-gradient(at 0% 0%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 50%),
    radial-gradient(at 100% 0%, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 50%),
    radial-gradient(at 50% 100%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

/* Glowing header border */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* Sidebar active state with glow */
.sidebar-link-active {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent), 0 2px 16px -2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

/* Code blocks with gradient border */
.prose pre {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 30%, transparent), color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-primary) 30%, transparent)) border-box;
}

/* Links with subtle glow on hover */
.prose a:hover {
  text-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

/* Callouts with gradient accents */
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

/* Headings with subtle gradient */
.prose h1 {
  background: linear-gradient(135deg, var(--color-foreground) 0%, var(--color-muted-foreground) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Button glow effect */
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
 * Scholarly, lush, grounded — like a beautifully typeset botanical field guide
 * Deep forest greens on warm ivory, refined serif typography, nature-inspired accents
 */
function generateVerdantCss(): string {
  return `
/* Verdant: Botanical Ink */
html {
  --theme-name: "verdant";
}

/* Warm ivory background with subtle dot-grid texture */
body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(circle, var(--color-border) 0.5px, transparent 0.5px);
  background-size: 24px 24px;
  background-attachment: fixed;
}

/* Header with a fine ruled line */
.site-header {
  background: var(--color-header-background);
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 var(--color-border-subtle);
}

/* Sidebar with clean ivory finish */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Sidebar active with botanical accent bar */
.sidebar-link-active {
  position: relative;
  background: var(--color-sidebar-active);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.375rem;
  bottom: 0.375rem;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 3px 3px 0;
}

/* Code blocks — inset parchment feel */
.prose pre {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  box-shadow: inset 0 1px 3px 0 rgb(0 0 0 / 0.12);
}

/* Blockquotes — scholarly left rule */
.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  font-style: italic;
  border-radius: 0;
  padding-left: 1.25rem;
}

/* Headings — tight tracking, strong ink weight */
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

/* Links — understated underline that reveals on hover */
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

/* Tables — clean ruled style, no outer box */
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

/* Callouts — subtle leaf-green accent bar */
.callout {
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

/* Inline code — green-tinted ink on parchment */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — botanical divider */
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
 * Warm amber/copper on ivory, serif display headings, rich editorial atmosphere
 * Inspired by mid-century print, Criterion Collection, Monocle magazine
 */
function generateEmberCss(): string {
  return `
/* Ember: Cinematic Editorial */
html {
  --theme-name: "ember";
}

/* Warm gradient with subtle vignette */
body {
  background-image:
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

/* Header with warm bottom glow */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 13%, transparent);
}

/* Sidebar with warm finish */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Sidebar active — warm accent bar with copper glow */
.sidebar-link-active {
  position: relative;
  background: var(--color-sidebar-active);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}

/* Code blocks — warm charcoal with copper accent top edge */
.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
}

/* Blockquotes — editorial pull-quote style */
.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  font-style: italic;
  padding-left: 1.25rem;
  border-radius: 0;
}

/* Headings — display serif with tight tracking */
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

/* Links — warm copper underline */
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

/* Tables — editorial ruled style */
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

/* Callouts — warm accent bar */
.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

/* Inline code — warm tint */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — ember fade */
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
 * Deep navy with electric blue accents, ultrasharp borders, luminous glow effects
 * Inspired by observatory UIs, star charts, NASA mission control
 */
function generateMidnightCss(): string {
  return `
/* Midnight: Celestial Observatory */
html {
  --theme-name: "midnight";
}

/* Deep space background with subtle radial glow */
body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(at 0% 0%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%),
    radial-gradient(at 100% 100%, color-mix(in srgb, var(--color-primary) 3%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

/* Header — sharp edge with cyan underline glow */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 19%, transparent), 0 2px 8px -2px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

/* Sidebar active — cyan indicator with subtle glow */
.sidebar-link-active {
  position: relative;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 15%, transparent), 0 0 12px -3px color-mix(in srgb, var(--color-primary) 13%, transparent);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-primary);
  box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-primary) 31%, transparent);
}

/* Code blocks — sharp edges, cyan border glow */
.prose pre {
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 19%, transparent), transparent 40%, transparent 60%, color-mix(in srgb, var(--color-primary) 13%, transparent)) border-box;
  box-shadow: 0 0 12px -4px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

/* Blockquotes — luminous left edge */
.prose blockquote {
  border-left: 2px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0;
  box-shadow: -2px 0 12px -4px color-mix(in srgb, var(--color-primary) 13%, transparent);
}

/* Headings — crisp, high contrast */
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

/* Links — cyan glow on hover */
.prose a {
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  transition: border-color 0.2s ease, text-shadow 0.2s ease;
}

.prose a:hover {
  border-bottom-color: var(--color-primary);
  text-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 19%, transparent);
}

/* Tables — sharp observatory grid */
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

/* Callouts — observatory panel look */
.callout {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  border-left: 2px solid var(--color-primary);
  background: var(--color-background-subtle);
  box-shadow: 0 0 8px -4px color-mix(in srgb, var(--color-primary) 6%, transparent);
}

/* Inline code — crisp contrast */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — cyan pulse */
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
 * Soft mauve/rose on cool cream, plum-tinted dark mode, refined geometry
 * Inspired by design tool interfaces, Acne Studios, gallery spaces
 */
function generateDuneCss(): string {
  return `
/* Dune: Rose Quartz */
html {
  --theme-name: "dune";
}

/* Soft gradient background */
body {
  background-image:
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

/* Header — soft with rose-tinted bottom edge */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 8%, transparent);
}

/* Sidebar — clean and airy */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Sidebar active — rose accent with soft pill shape */
.sidebar-link-active {
  position: relative;
  background: var(--color-sidebar-active);
  border-radius: var(--radius-md);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 3px 3px 0;
}

/* Code blocks — soft rounded with subtle rose border */
.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
}

/* Blockquotes — rose accent, soft background */
.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

/* Headings — geometric sans, clean and modern */
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

/* Links — rose underline with smooth transition */
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

/* Tables — soft rounded container */
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

/* Callouts — rose accent, rounded */
.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
}

/* Inline code — soft rose tint */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — rose fade */
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
 * Achromatic gray with muted verdigris/patina accent, brutalist geometry
 * Inspired by poured concrete, brutalist architecture, museum specimen labels
 */
function generateFossilCss(): string {
  return `
/* Fossil: Raw Concrete */
html {
  --theme-name: "fossil";
}

/* Raw concrete — flat gradient, no texture */
body {
  background-image:
    linear-gradient(180deg, var(--color-background) 0%, var(--color-background-subtle) 100%);
  background-attachment: fixed;
}

/* Header — solid slab, heavy bottom rule, no glow */
.site-header {
  border-bottom: 2px solid var(--color-border);
  box-shadow: none;
}

/* Sidebar — raw concrete surface */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Sidebar active — patina block indicator, full-height */
.sidebar-link-active {
  position: relative;
  background: var(--color-sidebar-active);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--color-primary);
}

/* Code blocks — chiseled slab, zero radius, offset shadow */
.prose pre {
  border-radius: 0;
  border: 2px solid var(--color-border);
  box-shadow: 4px 4px 0 0 var(--color-border-subtle);
}

/* Blockquotes — heavy patina left rule, specimen label */
.prose blockquote {
  border-left: 4px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.25rem;
  border-radius: 0;
  font-style: normal;
  position: relative;
}

/* Headings — bold, utilitarian, uppercase h3 */
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

/* Links — patina underline, heavy on hover */
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

/* Tables — brutalist grid, heavy borders */
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

/* Callouts — brutalist card with offset shadow */
.callout {
  border-radius: 0;
  border: 2px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  background: var(--color-background-subtle);
  box-shadow: 3px 3px 0 0 var(--color-border-subtle);
}

/* Inline code — specimen tag, zero radius */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: 0;
}

/* Horizontal rules — patina line */
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
 * Cool teal/cyan on frosted surfaces, luminous edges, glass morphism
 * Inspired by Apple Vision Pro, translucent UI, futuristic dashboards
 */
function generateVaporCss(): string {
  return `
/* Vapor: Frosted Glass Interface */
html {
  --theme-name: "vapor";
}

/* Frosted glass background with luminous orbs */
body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(at 20% 30%, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 50%),
    radial-gradient(at 80% 70%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 50%);
  background-attachment: fixed;
}

/* Header — frosted glass with luminous border */
.site-header {
  background: var(--color-header-background);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 8%, transparent), 0 4px 16px -4px rgb(0 0 0 / 0.12);
}

/* Sidebar — frosted glass surface */
.site-sidebar {
  background: var(--color-sidebar-background);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* Sidebar active — glass pill with teal glow */
.sidebar-link-active {
  position: relative;
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 13%, transparent), 0 0 16px -4px color-mix(in srgb, var(--color-primary) 9%, transparent);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.375rem;
  bottom: 0.375rem;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 10px 0 color-mix(in srgb, var(--color-primary) 25%, transparent);
}

/* Code blocks — frosted glass with luminous edge */
.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--color-code-background), var(--color-code-background)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 19%, transparent), transparent 40%, transparent 60%, color-mix(in srgb, var(--color-primary) 9%, transparent)) border-box;
  box-shadow: 0 4px 20px -6px rgb(0 0 0 / 0.2), 0 0 0 1px color-mix(in srgb, var(--color-primary) 3%, transparent);
}

/* Blockquotes — glass panel with teal accent */
.prose blockquote {
  border-left: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 3%, transparent);
  padding-left: 1.25rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  box-shadow: -2px 0 12px -4px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

/* Headings — light weight, airy feel */
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

/* Links — teal glow trail on hover */
.prose a {
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 21%, transparent);
  transition: border-color 0.2s ease, text-shadow 0.2s ease, color 0.2s ease;
}

.prose a:hover {
  border-bottom-color: var(--color-primary);
  text-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

/* Tables — frosted glass card */
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

/* Callouts — glass card with teal accent and glow */
.callout {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  border-left: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 2%, transparent);
  box-shadow: 0 2px 16px -6px color-mix(in srgb, var(--color-primary) 7%, transparent);
}

/* Inline code — frosted chip */
.prose :not(pre) > code {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 13%, transparent);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — luminous teal line */
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
 * Deep purple/plum with champagne gold accents, luxurious dark-first aesthetic
 * Inspired by luxury brand sites, wine labels, velvet textures, art galleries
 */
function generateAubergineCss(): string {
  return `
/* Aubergine: Velvet & Gold */
html {
  --theme-name: "aubergine";
}

/* Deep velvety background with subtle radial warmth */
body {
  background-color: var(--color-background);
  background-image:
    radial-gradient(at 50% 0%, color-mix(in srgb, var(--color-primary) 15%, var(--color-background)) 0%, transparent 60%),
    radial-gradient(at 100% 50%, color-mix(in srgb, var(--color-primary) 3%, transparent) 0%, transparent 40%);
  background-attachment: fixed;
}

/* Header — velvet with gold trim */
.site-header {
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-primary) 9%, transparent);
}

/* Sidebar — deep velvet */
.site-sidebar {
  background: var(--color-sidebar-background);
}

/* Sidebar active — gold accent with warm glow */
.sidebar-link-active {
  position: relative;
  background: var(--color-sidebar-active);
}

.sidebar-link-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 3px;
  background: linear-gradient(180deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 50%, transparent));
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-primary) 15%, transparent);
}

/* Code blocks — deep plum with gold accent line */
.prose pre {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* Blockquotes — luxurious pull-quote with gold rule */
.prose blockquote {
  border-left: 3px solid var(--color-primary);
  background: var(--color-background-subtle);
  padding-left: 1.5rem;
  border-radius: 0;
  font-style: italic;
}

/* Headings — elegant serif display with gold h1 accent */
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

/* Links — gold underline that glows on hover */
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

/* Tables — elegant with gold header accent */
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

/* Callouts — velvet card with gold edge */
.callout {
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  border-top: none;
  border-right: none;
  border-bottom: none;
  background: var(--color-background-subtle);
  box-shadow: 0 2px 12px -4px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

/* Inline code — plum tinted */
.prose :not(pre) > code {
  background: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

/* Horizontal rules — gold fade with warm glow */
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
  // If OpenAPI is configured, filter out any manually-created folder/pages
  // that clash with the OpenAPI basePath to avoid duplicate routes
  if (config.openapi) {
    const basePath = config.openapi.basePath || "/api-reference";
    folders = folders.filter((f) => f.path !== basePath);
    pages = pages.filter((p) => !p.path.startsWith(basePath + "/"));
  }

  const files: GeneratedFile[] = [];
  const warnings: string[] = [];

  // docs.config.ts is no longer generated for the SPA template
  // Config is embedded in HTML via buildSiteData() at publish time

  // Generate theme CSS — uses :root custom properties (not @theme) so it
  // works as inline <style> in the HTML and overrides the pre-built CSS bundle.
  const themeResult = generateThemeCss(config);
  files.push({
    file: "theme.css",
    data: themeResult.css,
  });
  files.push({
    file: "theme-fonts-url",
    data: themeResult.googleFontsUrl,
  });

  // Generate tabs configuration
  const hasTabs = config.navTabs && config.navTabs.length > 0;

  // Track all navigations for the combined file (used by server components)
  const allNavigations: { main: NavItem[]; tabs: Record<string, NavItem[]> } = {
    main: [],
    tabs: {},
  };

  // Always generate tabs.json (empty array if no tabs) to override any previous deployment
  const tabsConfig = hasTabs
    ? config.navTabs!.map((tab) => ({
        id: tab.id,
        name: tab.name,
        slug: tab.slug,
        icon: tab.icon,
      }))
    : [];
  files.push({
    file: "lib/tabs.json",
    data: JSON.stringify(tabsConfig, null, 2),
  });

  // Track path mappings for MDX file generation and search index
  // Maps original page path -> new path (for tabs with path rewriting)
  const pagePathMapping: Map<string, string> = new Map();

  if (hasTabs) {
    // Collect all assigned folder paths and page paths for filtering unassigned content
    const assignedFolderPaths: string[] = [];
    const assignedPagePaths: string[] = [];

    // Generate navigation for each tab
    for (const rawTab of config.navTabs!) {
      // Normalize tab to ensure items array exists (handles legacy folderId format)
      const tab = normalizeNavTab(rawTab);
      const tabNavigation: NavItem[] = [];
      const tabSlugPrefix = `/${tab.slug}`;

      for (const item of tab.items) {
        if (item.type === "folder" && item.folderId) {
          // Find folder by ID
          const tabFolder = folders.find((f) => f.id === item.folderId);
          if (tabFolder) {
            // Track this folder path as assigned
            assignedFolderPaths.push(tabFolder.path);

            // Get pages and subfolders for this folder
            const folderPages = pages.filter(
              (p) => p.path.startsWith(tabFolder.path + "/") || p.path === tabFolder.path
            );
            const folderSubfolders = folders.filter(
              (f) => f.path.startsWith(tabFolder.path + "/") || f.path === tabFolder.path
            );

            // Include the folder slug in the path prefix so nested paths
            // stay under the folder in the URL hierarchy. This ensures the
            // sidebar can match active/expanded state via pathname.startsWith.
            const folderPathPrefix = `${tabSlugPrefix}/${tabFolder.slug}`;

            // Build path mappings for pages in this folder
            for (const page of folderPages) {
              const newPath = rewritePath(page.path, tabFolder.path, folderPathPrefix);
              pagePathMapping.set(page.path, newPath);
            }

            // Generate navigation for this folder's children with path rewriting
            const folderChildren = generateNavigationForFolder(
              tabFolder,
              folderPages,
              folderSubfolders,
              folderPathPrefix
            );

            // Wrap children in a folder NavItem so the folder appears in the sidebar
            const folderNavItem: NavItem = {
              title: tabFolder.name,
              href: `${folderPathPrefix}`,
              children: folderChildren,
            };
            if (tabFolder.icon) {
              folderNavItem.icon = tabFolder.icon;
            }
            tabNavigation.push(folderNavItem);
          }
        } else if (item.type === "page" && item.pageId) {
          // Find page by ID
          const page = pages.find((p) => p.id === item.pageId);
          if (page) {
            // Track this page path as assigned
            assignedPagePaths.push(page.path);

            // Rewrite path to use tab slug
            const newPath = tabSlugPrefix + "/" + page.slug;
            pagePathMapping.set(page.path, newPath);

            // Add page directly to tab navigation
            const navItem: NavItem = {
              title: page.title,
              href: `${newPath}`,
            };
            if (page.icon) {
              navItem.icon = page.icon;
            }
            tabNavigation.push(navItem);
          }
        }
      }

      files.push({
        file: `lib/navigation-${tab.slug}.json`,
        data: JSON.stringify(tabNavigation, null, 2),
      });
      // Store for combined file
      allNavigations.tabs[tab.slug] = tabNavigation;
    }

    // When tabs exist, hide unassigned content - generate empty default navigation
    // This implements Issue 3: unassigned content is not shown
    files.push({
      file: "lib/navigation.json",
      data: JSON.stringify([], null, 2),
    });
    allNavigations.main = [];
  } else {
    // Generate navigation.json for client-side sidebar (no tabs)
    const navigation = generateNavigation(pages, folders);
    files.push({
      file: "lib/navigation.json",
      data: JSON.stringify(navigation, null, 2),
    });
    allNavigations.main = navigation;
  }

  // Generate combined navigation file for server components (static import)
  files.push({
    file: "lib/all-navigation.json",
    data: JSON.stringify(allNavigations, null, 2),
  });

  // _meta.json files are not needed in the SPA template

  // Folder _meta.json files are not needed in the SPA template

  // Generate page MDX files (with path rewriting for tabs)
  // When tabs exist, only generate files for pages that are assigned to a tab
  for (const page of pages) {
    // Check if this page has a remapped path (is part of a tab)
    const remappedPath = pagePathMapping.get(page.path);

    // If tabs exist and this page isn't assigned to a tab, skip it
    if (hasTabs && !remappedPath) {
      continue;
    }

    const blocks = parseBlockNoteContent(page.content);
    const mdxContent = blockNoteToMDX(blocks);

    const frontmatterLines = [`title: "${page.title}"`];
    if (page.icon) frontmatterLines.push(`icon: "${page.icon}"`);
    if (page.subtitle) frontmatterLines.push(`subtitle: "${page.subtitle}"`);
    if (page.titleSectionHidden) frontmatterLines.push(`titleSectionHidden: true`);
    if (page.titleIconHidden) frontmatterLines.push(`titleIconHidden: true`);
    const frontmatter = `---\n${frontmatterLines.join("\n")}\n---\n\n`;

    // Use remapped path if available, otherwise use original path
    const outputPath = remappedPath ?? page.path;
    files.push({
      file: `docs${outputPath === "/" ? "/index" : outputPath}.mdx`,
      data: frontmatter + mdxContent,
    });
  }

  // Tab directory _meta.json files are not needed in the SPA template

  // Generate OpenAPI reference pages if spec is provided
  let apiSearchDocuments: SearchDocument[] = [];
  if (config.openapi) {
    try {
      const parsed = await parseOpenApiSpec(config.openapi.specContent);
      const basePath = config.openapi.basePath || "/api-reference";
      const apiResult = generateApiReferenceMdx(parsed, basePath);

      // Add generated MDX files
      for (const apiFile of apiResult.files) {
        files.push(apiFile);
      }

      // Add API reference navigation
      const apiNavGroup: NavItem = {
        title: "API Reference",
        href: `${basePath}`,
        children: apiResult.navigation,
      };

      if (hasTabs) {
        // Create a dedicated tab for API Reference, but only if
        // the user hasn't already defined a manual tab with the same slug
        const apiTabSlug = basePath.replace(/^\//, "");
        const existingTab = tabsConfig.find((t) => t.slug === apiTabSlug);
        if (!existingTab) {
          tabsConfig.push({
            id: `api-ref-${Date.now()}`,
            name: "API Reference",
            slug: apiTabSlug,
            icon: undefined,
          });
          // Overwrite tabs.json with updated tabs
          const tabsFileIdx = files.findIndex((f) => f.file === "lib/tabs.json");
          if (tabsFileIdx >= 0) {
            files[tabsFileIdx] = {
              file: "lib/tabs.json",
              data: JSON.stringify(tabsConfig, null, 2),
            };
          }
          // Generate navigation file for this tab
          files.push({
            file: `lib/navigation-${apiTabSlug}.json`,
            data: JSON.stringify(apiResult.navigation, null, 2),
          });
        }
        allNavigations.tabs[apiTabSlug] = apiResult.navigation;
        // Update combined navigation
        const combinedIdx = files.findIndex((f) => f.file === "lib/all-navigation.json");
        if (combinedIdx >= 0) {
          files[combinedIdx] = {
            file: "lib/all-navigation.json",
            data: JSON.stringify(allNavigations, null, 2),
          };
        }
      } else {
        // Append to main navigation
        const navIdx = files.findIndex((f) => f.file === "lib/navigation.json");
        if (navIdx >= 0) {
          const existingNav: NavItem[] = JSON.parse(files[navIdx]!.data);
          existingNav.push(apiNavGroup);
          files[navIdx] = {
            file: "lib/navigation.json",
            data: JSON.stringify(existingNav, null, 2),
          };
          allNavigations.main = existingNav;
        }
        // Update combined navigation
        const combinedIdx = files.findIndex((f) => f.file === "lib/all-navigation.json");
        if (combinedIdx >= 0) {
          files[combinedIdx] = {
            file: "lib/all-navigation.json",
            data: JSON.stringify(allNavigations, null, 2),
          };
        }
      }

      // Generate playground data for interactive API testing
      const playgroundJson = generatePlaygroundData(parsed);
      files.push({
        file: "public/api-playground.json",
        data: playgroundJson,
      });

      apiSearchDocuments = apiResult.searchDocuments;
    } catch (err) {
      console.error("Failed to generate OpenAPI reference:", err);
      warnings.push(
        `API Reference generation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Generate search index (in public/ for static serving)
  // Use remapped paths for search index when tabs are enabled
  const searchIndex = generateSearchIndexWithMapping(pages, pagePathMapping, hasTabs ?? false);

  // Merge API reference search documents
  if (apiSearchDocuments.length > 0) {
    searchIndex.documents.push(...apiSearchDocuments);
  }

  files.push({
    file: "public/search-index.json",
    data: JSON.stringify(searchIndex, null, 2),
  });

  return { files, ...(warnings.length > 0 ? { warnings } : {}) };
}
