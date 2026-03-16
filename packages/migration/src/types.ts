/**
 * Supported migration sources.
 */
export enum MigrationSource {
  Mintlify = "mintlify",
  Gitbook = "gitbook",
}

/**
 * Configuration for a migration run.
 */
export interface MigrationConfig {
  /** The documentation platform to migrate from. */
  source: MigrationSource;
  /** Path to the local directory containing the source documentation. */
  dirPath: string;
  /** Name for the InkLoom project to create. */
  projectName: string;
  /** Optional URL of the live documentation site (used for asset resolution). */
  sourceUrl?: string;
}

/**
 * A parsed documentation page ready for import.
 */
export interface ParsedPage {
  /** Page title extracted from frontmatter or content. */
  title: string;
  /** URL-friendly slug for the page. */
  slug: string;
  /** File path relative to the source directory. */
  path: string;
  /** Converted MDX content string. */
  mdxContent: string;
  /** Folder path this page belongs to (empty string for root-level pages). */
  folderPath: string;
  /** Sort position within its folder. */
  position: number;
  /** Additional metadata extracted from frontmatter. */
  metadata: Record<string, unknown>;
}

/**
 * A parsed folder in the documentation structure.
 */
export interface ParsedFolder {
  /** Display name of the folder. */
  name: string;
  /** URL-friendly slug for the folder. */
  slug: string;
  /** Full path of this folder relative to the source root. */
  path: string;
  /** Path of the parent folder (undefined for top-level folders). */
  parentPath?: string;
  /** Sort position among sibling folders. */
  position: number;
}

/**
 * A navigation tab grouping pages and folders.
 */
export interface ParsedNavTab {
  /** Display name of the tab. */
  name: string;
  /** URL-friendly slug for the tab. */
  slug: string;
  /** Ordered list of top-level navigation item paths within this tab. */
  items: string[];
}

/**
 * Branding assets and configuration extracted from the source.
 */
export interface ParsedBranding {
  /** Primary/accent color (hex string). */
  primaryColor?: string;
  /** Path or URL to the logo image. */
  logoPath?: string;
  /** Path or URL to the dark-mode logo image. */
  logoDarkPath?: string;
  /** Path or URL to the favicon. */
  faviconPath?: string;
  /** Social media links extracted from source config. */
  socialLinks?: SocialLink[];
}

/**
 * A social media link from the source branding config.
 */
export interface SocialLink {
  /** Platform identifier (e.g. "github", "twitter", "discord"). */
  platform: string;
  /** URL to the social profile or page. */
  url: string;
}

/**
 * A redirect rule to preserve SEO when URLs change.
 */
export interface RedirectRule {
  /** Source URL path. */
  from: string;
  /** Destination URL path. */
  to: string;
  /** HTTP status code for the redirect. */
  status: 301 | 302;
}

/**
 * An asset (image, file) discovered during migration.
 */
export interface MigrationAsset {
  /** Original URL or path of the asset in the source docs. */
  originalUrl: string;
  /** Downloaded file content (populated during asset download phase). */
  buffer?: Buffer;
  /** Target filename for the asset in InkLoom storage. */
  filename: string;
  /** MIME type of the asset. */
  mimeType: string;
}

/**
 * Complete result of a migration run.
 */
export interface MigrationResult {
  /** All parsed pages ready for import. */
  pages: ParsedPage[];
  /** All parsed folders representing the navigation structure. */
  folders: ParsedFolder[];
  /** Navigation tabs (if the source uses tabbed navigation). */
  navTabs?: ParsedNavTab[];
  /** Redirect rules for URL preservation. */
  redirects: RedirectRule[];
  /** Assets discovered in the source content. */
  assets: MigrationAsset[];
  /** Warnings encountered during migration (non-fatal issues). */
  warnings: string[];
  /** Map of source URLs/paths to InkLoom URLs/paths. */
  urlMap: Map<string, string>;
  /** Branding configuration extracted from the source. */
  branding?: ParsedBranding;
}
