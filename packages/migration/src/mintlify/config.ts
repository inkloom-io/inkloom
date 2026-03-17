/**
 * Mintlify config parser — handles both docs.json (new recursive format)
 * and mint.json (legacy format) to extract navigation, branding, and configuration.
 */
import type {
  ParsedNavTab,
  ParsedFolder,
  ParsedBranding,
  SocialLink,
  RedirectRule,
} from "../types.js";

// ── Input types for Mintlify configuration ──────────────────────────────────

/**
 * Recursive navigation item in docs.json format.
 * A navigation array entry can be a tab, a group, or a page reference string.
 */
interface DocsJsonTabItem {
  tab: string;
  groups?: DocsJsonNavItem[];
  pages?: DocsJsonNavItem[];
}

interface DocsJsonGroupItem {
  group: string;
  pages?: DocsJsonNavItem[];
  openapi?: string;
  asyncapi?: string;
}

type DocsJsonNavItem = string | DocsJsonTabItem | DocsJsonGroupItem;

/**
 * Legacy mint.json tab entry.
 */
interface MintJsonTab {
  name: string;
  url: string;
}

/**
 * Legacy mint.json navigation group.
 */
interface MintJsonNavGroup {
  group: string;
  pages: MintJsonNavItem[];
}

type MintJsonNavItem = string | MintJsonNavGroup;

/**
 * Logo configuration — can be a string or an object with light/dark variants.
 */
type LogoConfig = string | { light?: string; dark?: string; href?: string };

/**
 * Colors configuration.
 */
interface ColorsConfig {
  primary?: string;
  light?: string;
  dark?: string;
  background?: { light?: string; dark?: string };
}

/**
 * Topbar link in mint.json (legacy) or navbar link in docs.json.
 */
interface TopbarLink {
  name?: string;
  label?: string;
  url?: string;
  href?: string;
  type?: string;
}

/**
 * Redirect rule in Mintlify config.
 */
interface MintlifyRedirect {
  source: string;
  destination: string;
}

/**
 * Raw Mintlify configuration (union of both formats).
 */
export interface RawMintlifyConfig {
  $schema?: string;
  name?: string;
  description?: string;
  theme?: string;

  // Branding
  logo?: LogoConfig;
  favicon?: string | { light?: string; dark?: string };
  colors?: ColorsConfig;

  // Navigation — docs.json format (array or object-wrapped)
  navigation?:
    | DocsJsonNavItem[]
    | MintJsonNavGroup[]
    | { tabs?: DocsJsonNavItem[]; global?: { anchors?: Array<{ name: string; url: string; icon?: string }> } };

  // Navigation — mint.json format
  tabs?: MintJsonTab[];

  // Links
  topbarLinks?: TopbarLink[];
  navbar?: { links?: TopbarLink[] };

  // Redirects
  redirects?: MintlifyRedirect[];

  // API
  openapi?: string | string[];
  api?: { spec?: string };

  // Anchors (docs.json)
  anchors?: Array<{ name: string; url: string; icon?: string }>;

  // Catch-all for unknown fields
  [key: string]: unknown;
}

// ── Result type ──────────────────────────────────────────────────────────────

export interface MintlifyConfigResult {
  /** Parsed navigation tabs. Present for multi-tab configs. */
  navTabs: ParsedNavTab[];
  /** Parsed folders in the navigation hierarchy. */
  folders: ParsedFolder[];
  /** Page references (relative paths to MDX files). */
  pageRefs: string[];
  /** Branding configuration. */
  branding: ParsedBranding;
  /** Redirect rules. */
  redirects: RedirectRule[];
  /** Path(s) to OpenAPI spec file(s), if found. */
  openApiPaths: string[];
  /** Site metadata. */
  metadata: { name?: string; description?: string };
  /** Non-fatal warnings encountered during parsing. */
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Detect whether the raw config uses docs.json format (recursive navigation)
 * or mint.json format (separate tabs + flat navigation groups).
 */
export function isDocsJsonFormat(config: RawMintlifyConfig): boolean {
  // New docs.json format: navigation is an object with { tabs: [...], global: {...} }
  if (
    config.navigation &&
    !Array.isArray(config.navigation) &&
    typeof config.navigation === "object" &&
    "tabs" in config.navigation
  ) {
    return true;
  }

  if (!Array.isArray(config.navigation)) return false;

  // docs.json: navigation items can contain { tab: ... } entries
  for (const item of config.navigation) {
    if (typeof item === "object" && item !== null && "tab" in item) {
      return true;
    }
  }

  // If there are separate `tabs` array, it's mint.json
  if (Array.isArray(config.tabs) && config.tabs.length > 0) {
    return false;
  }

  // No tabs in either format — could be either. Default to docs.json
  // if there are no { group: ... } with tab-matching URL prefixes.
  return false;
}

// ── docs.json parser ─────────────────────────────────────────────────────────

interface FolderCollector {
  folders: ParsedFolder[];
  pageRefs: string[];
}

function isTabItem(item: DocsJsonNavItem): item is DocsJsonTabItem {
  return typeof item === "object" && item !== null && "tab" in item;
}

function isGroupItem(item: DocsJsonNavItem): item is DocsJsonGroupItem {
  return typeof item === "object" && item !== null && "group" in item;
}

/**
 * Recursively walk a docs.json group and collect folders + page refs.
 */
function walkDocsJsonGroup(
  group: DocsJsonGroupItem,
  parentPath: string | undefined,
  position: number,
  collector: FolderCollector
): void {
  const slug = slugify(group.group);
  const path = parentPath ? `${parentPath}/${slug}` : slug;

  collector.folders.push({
    name: group.group,
    slug,
    path,
    parentPath,
    position,
  });

  const pages = group.pages ?? [];
  let childGroupPos = 0;
  for (const item of pages) {
    if (typeof item === "string") {
      collector.pageRefs.push(item);
    } else if (isGroupItem(item)) {
      walkDocsJsonGroup(item, path, childGroupPos++, collector);
    }
    // Nested tabs within groups are unusual but technically possible — skip
  }
}

function parseDocsJsonNavigation(config: RawMintlifyConfig): {
  navTabs: ParsedNavTab[];
  folders: ParsedFolder[];
  pageRefs: string[];
} {
  // Handle object-wrapped navigation: { tabs: [...], global: {...} }
  let navItems: DocsJsonNavItem[];
  if (
    config.navigation &&
    !Array.isArray(config.navigation) &&
    typeof config.navigation === "object" &&
    "tabs" in config.navigation
  ) {
    navItems = (config.navigation.tabs ?? []) as DocsJsonNavItem[];
  } else {
    navItems = (config.navigation ?? []) as DocsJsonNavItem[];
  }
  const navTabs: ParsedNavTab[] = [];
  const allFolders: ParsedFolder[] = [];
  const allPageRefs: string[] = [];

  // Separate tab items from top-level group items
  const tabItems: DocsJsonTabItem[] = [];
  const topLevelGroups: DocsJsonGroupItem[] = [];

  for (const item of navItems) {
    if (isTabItem(item)) {
      tabItems.push(item);
    } else if (isGroupItem(item)) {
      topLevelGroups.push(item);
    }
    // Top-level string pages are uncommon but possible
    if (typeof item === "string") {
      allPageRefs.push(item);
    }
  }

  if (tabItems.length > 0) {
    // Multi-tab configuration
    for (const tabItem of tabItems) {
      const tabSlug = slugify(tabItem.tab);
      const collector: FolderCollector = { folders: [], pageRefs: [] };

      // docs.json tabs can have `groups` or `pages` arrays
      const children = tabItem.groups ?? tabItem.pages ?? [];
      let groupPos = 0;
      for (const child of children) {
        if (typeof child === "string") {
          collector.pageRefs.push(child);
        } else if (isGroupItem(child)) {
          walkDocsJsonGroup(child, undefined, groupPos++, collector);
        }
      }

      navTabs.push({
        name: tabItem.tab,
        slug: tabSlug,
        items: collector.folders
          .filter((f) => !f.parentPath)
          .map((f) => f.path),
      });

      allFolders.push(...collector.folders);
      allPageRefs.push(...collector.pageRefs);
    }
  }

  // Top-level groups not inside any tab
  if (topLevelGroups.length > 0) {
    const collector: FolderCollector = { folders: [], pageRefs: [] };
    let groupPos = 0;
    for (const group of topLevelGroups) {
      walkDocsJsonGroup(group, undefined, groupPos++, collector);
    }

    if (tabItems.length > 0) {
      // If there are tabs, create a default tab for ungrouped content
      navTabs.unshift({
        name: "Documentation",
        slug: "documentation",
        items: collector.folders
          .filter((f) => !f.parentPath)
          .map((f) => f.path),
      });
    }

    allFolders.push(...collector.folders);
    allPageRefs.push(...collector.pageRefs);
  }

  return { navTabs, folders: allFolders, pageRefs: allPageRefs };
}

// ── mint.json parser ─────────────────────────────────────────────────────────

/**
 * Recursively walk a mint.json navigation group.
 */
function walkMintJsonGroup(
  group: MintJsonNavGroup,
  parentPath: string | undefined,
  position: number,
  collector: FolderCollector
): void {
  const slug = slugify(group.group);
  const path = parentPath ? `${parentPath}/${slug}` : slug;

  collector.folders.push({
    name: group.group,
    slug,
    path,
    parentPath,
    position,
  });

  for (const item of group.pages ?? []) {
    if (typeof item === "string") {
      collector.pageRefs.push(item);
    } else if (typeof item === "object" && "group" in item) {
      walkMintJsonGroup(
        item as MintJsonNavGroup,
        path,
        collector.folders.length,
        collector
      );
    }
  }
}

/**
 * Determine which tab a mint.json navigation group belongs to,
 * based on whether its page paths start with the tab URL prefix.
 */
function findTabForGroup(
  group: MintJsonNavGroup,
  tabs: MintJsonTab[]
): MintJsonTab | undefined {
  // Collect all page paths in this group (recursively)
  const paths = collectMintPaths(group);
  if (paths.length === 0) return undefined;

  // Find the tab whose URL prefix matches the most pages
  for (const tab of tabs) {
    const prefix = tab.url.endsWith("/") ? tab.url : `${tab.url}/`;
    const matches = paths.some(
      (p) => p.startsWith(prefix) || p === tab.url
    );
    if (matches) return tab;
  }
  return undefined;
}

function collectMintPaths(group: MintJsonNavGroup): string[] {
  const paths: string[] = [];
  for (const item of group.pages ?? []) {
    if (typeof item === "string") {
      paths.push(item);
    } else if (typeof item === "object" && "group" in item) {
      paths.push(...collectMintPaths(item as MintJsonNavGroup));
    }
  }
  return paths;
}

function parseMintJsonNavigation(config: RawMintlifyConfig): {
  navTabs: ParsedNavTab[];
  folders: ParsedFolder[];
  pageRefs: string[];
} {
  const navGroups = (config.navigation ?? []) as MintJsonNavGroup[];
  const tabs = (config.tabs ?? []) as MintJsonTab[];
  const allFolders: ParsedFolder[] = [];
  const allPageRefs: string[] = [];
  const navTabs: ParsedNavTab[] = [];

  if (tabs.length > 0) {
    // Multi-tab: assign groups to tabs by URL prefix
    const tabMap = new Map<string, { tab: MintJsonTab; groups: MintJsonNavGroup[] }>();
    const ungrouped: MintJsonNavGroup[] = [];

    for (const tab of tabs) {
      tabMap.set(tab.url, { tab, groups: [] });
    }

    for (const group of navGroups) {
      const matchedTab = findTabForGroup(group, tabs);
      if (matchedTab) {
        tabMap.get(matchedTab.url)?.groups.push(group);
      } else {
        ungrouped.push(group);
      }
    }

    // Create a default tab for ungrouped content (first position)
    if (ungrouped.length > 0) {
      const collector: FolderCollector = { folders: [], pageRefs: [] };
      let pos = 0;
      for (const group of ungrouped) {
        walkMintJsonGroup(group, undefined, pos++, collector);
      }
      navTabs.push({
        name: "Documentation",
        slug: "documentation",
        items: collector.folders
          .filter((f) => !f.parentPath)
          .map((f) => f.path),
      });
      allFolders.push(...collector.folders);
      allPageRefs.push(...collector.pageRefs);
    }

    // Create tabs in order
    for (const tab of tabs) {
      const entry = tabMap.get(tab.url);
      if (!entry || entry.groups.length === 0) continue;

      const collector: FolderCollector = { folders: [], pageRefs: [] };
      let pos = 0;
      for (const group of entry.groups) {
        walkMintJsonGroup(group, undefined, pos++, collector);
      }

      navTabs.push({
        name: tab.name,
        slug: slugify(tab.url),
        items: collector.folders
          .filter((f) => !f.parentPath)
          .map((f) => f.path),
      });
      allFolders.push(...collector.folders);
      allPageRefs.push(...collector.pageRefs);
    }
  } else {
    // Single-tab: all groups at root level
    const collector: FolderCollector = { folders: [], pageRefs: [] };
    let pos = 0;
    for (const group of navGroups) {
      walkMintJsonGroup(group, undefined, pos++, collector);
    }
    allFolders.push(...collector.folders);
    allPageRefs.push(...collector.pageRefs);
  }

  return { navTabs, folders: allFolders, pageRefs: allPageRefs };
}

// ── Branding parser ──────────────────────────────────────────────────────────

function parseBranding(config: RawMintlifyConfig): ParsedBranding {
  const branding: ParsedBranding = {};

  // Colors
  if (config.colors?.primary) {
    branding.primaryColor = config.colors.primary;
  }

  // Logo
  if (config.logo) {
    if (typeof config.logo === "string") {
      branding.logoPath = config.logo;
    } else {
      if (config.logo.light) branding.logoPath = config.logo.light;
      if (config.logo.dark) branding.logoDarkPath = config.logo.dark;
      // If only dark is set, use it as primary
      if (!branding.logoPath && branding.logoDarkPath) {
        branding.logoPath = branding.logoDarkPath;
      }
    }
  }

  // Favicon
  if (config.favicon) {
    if (typeof config.favicon === "string") {
      branding.faviconPath = config.favicon;
    } else if (config.favicon.light) {
      branding.faviconPath = config.favicon.light;
    } else if (config.favicon.dark) {
      branding.faviconPath = config.favicon.dark;
    }
  }

  // Social links from topbarLinks (mint.json) or navbar.links (docs.json)
  const links: TopbarLink[] = config.topbarLinks ?? config.navbar?.links ?? [];
  const socialLinks: SocialLink[] = [];

  for (const link of links) {
    const url = link.url ?? link.href;
    const label = link.name ?? link.label ?? "";
    if (!url) continue;

    // Detect platform from URL
    const platform = detectPlatform(url, label);
    if (platform) {
      socialLinks.push({ platform, url });
    }
  }

  if (socialLinks.length > 0) {
    branding.socialLinks = socialLinks;
  }

  return branding;
}

/**
 * Detect social platform from a URL or label.
 */
function detectPlatform(url: string, label: string): string | undefined {
  const lowerUrl = url.toLowerCase();
  const lowerLabel = label.toLowerCase();

  const platforms: Array<{ name: string; patterns: string[] }> = [
    { name: "github", patterns: ["github.com"] },
    { name: "twitter", patterns: ["twitter.com", "x.com"] },
    { name: "discord", patterns: ["discord.gg", "discord.com"] },
    { name: "slack", patterns: ["slack.com"] },
    { name: "linkedin", patterns: ["linkedin.com"] },
    { name: "youtube", patterns: ["youtube.com", "youtu.be"] },
  ];

  for (const { name, patterns } of platforms) {
    if (patterns.some((p) => lowerUrl.includes(p))) {
      return name;
    }
    if (lowerLabel.includes(name)) {
      return name;
    }
  }

  return undefined;
}

// ── Redirects parser ─────────────────────────────────────────────────────────

function parseRedirects(config: RawMintlifyConfig): RedirectRule[] {
  if (!Array.isArray(config.redirects)) return [];

  return config.redirects.map((r) => ({
    from: r.source,
    to: r.destination,
    status: 301 as const,
  }));
}

// ── OpenAPI parser ───────────────────────────────────────────────────────────

function parseOpenApiPaths(config: RawMintlifyConfig): string[] {
  const paths: string[] = [];

  if (config.openapi) {
    if (typeof config.openapi === "string") {
      paths.push(config.openapi);
    } else if (Array.isArray(config.openapi)) {
      for (const p of config.openapi) {
        if (typeof p === "string") paths.push(p);
      }
    }
  }

  if (config.api && typeof config.api === "object") {
    const spec = (config.api as Record<string, unknown>).spec;
    if (typeof spec === "string") {
      paths.push(spec);
    }
  }

  return paths;
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a raw Mintlify configuration (docs.json or mint.json) and extract
 * navigation structure, branding, redirects, and metadata.
 *
 * Automatically detects the config format.
 *
 * @param config - Raw parsed JSON from docs.json or mint.json
 * @returns Parsed configuration result with navigation, branding, and metadata
 */
export function parseMintlifyConfig(
  config: RawMintlifyConfig
): MintlifyConfigResult {
  const warnings: string[] = [];
  const useDocsJson = isDocsJsonFormat(config);

  // Parse navigation based on detected format
  const nav = useDocsJson
    ? parseDocsJsonNavigation(config)
    : parseMintJsonNavigation(config);

  // Parse branding
  const branding = parseBranding(config);

  // Parse redirects
  const redirects = parseRedirects(config);

  // Parse OpenAPI paths
  const openApiPaths = parseOpenApiPaths(config);

  // Extract metadata
  const metadata: { name?: string; description?: string } = {};
  if (config.name) metadata.name = config.name;
  if (config.description) metadata.description = config.description;

  // Validation warnings
  if (!config.name) {
    warnings.push("Missing 'name' field in Mintlify config");
  }
  if (!config.colors?.primary) {
    warnings.push("Missing 'colors.primary' field in Mintlify config");
  }
  if (!config.navigation) {
    warnings.push("Empty or missing 'navigation' in Mintlify config");
  } else if (Array.isArray(config.navigation) && config.navigation.length === 0) {
    warnings.push("Empty or missing 'navigation' in Mintlify config");
  } else if (
    !Array.isArray(config.navigation) &&
    typeof config.navigation === "object" &&
    "tabs" in config.navigation &&
    (!config.navigation.tabs || config.navigation.tabs.length === 0)
  ) {
    warnings.push("Empty or missing 'navigation' in Mintlify config");
  }

  return {
    navTabs: nav.navTabs,
    folders: nav.folders,
    pageRefs: nav.pageRefs,
    branding,
    redirects,
    openApiPaths,
    metadata,
    warnings,
  };
}
