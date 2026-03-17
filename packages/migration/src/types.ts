/**
 * Supported migration sources.
 */
export enum MigrationSource {
  Mintlify = "mintlify",
  Gitbook = "gitbook",
}

/**
 * Progress stage identifiers for migration progress reporting.
 */
export type MigrationStage = "parsing" | "converting" | "assets" | "redirects";

/**
 * Callback for reporting migration progress.
 *
 * @param stage - Current stage of the migration pipeline.
 * @param current - Current item number within the stage.
 * @param total - Total items in the stage.
 */
export type OnProgressCallback = (
  stage: MigrationStage,
  current: number,
  total: number,
) => void;

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
  /** Optional progress callback for CLI progress bars and dashboard UI. */
  onProgress?: OnProgressCallback;
  /** When true, return the result without side effects (no asset downloads). */
  dryRun?: boolean;
  /** Custom fetch function for downloading remote assets (useful for testing). */
  fetchFn?: typeof globalThis.fetch;
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
  /** True when the page was found on disk but not referenced in navigation. */
  isOrphaned?: boolean;
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
 * An OpenAPI spec file discovered during migration.
 */
export interface MigrationOpenApiSpec {
  /** Relative path to spec file in source directory. */
  path: string;
  /** Raw file content. */
  buffer: Buffer;
  /** Spec file format. */
  format: "json" | "yaml";
  /** Base path for generated endpoint pages, derived from API tab slug. */
  basePath: string;
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
  /** OpenAPI spec files referenced in the source config. */
  openapiSpecs?: MigrationOpenApiSpec[];
}

/**
 * A page with content converted to BlockNote JSON, ready for createFromImport.
 */
export interface ImportReadyPage {
  /** Page title. */
  title: string;
  /** URL-friendly slug. */
  slug: string;
  /** File path relative to the source directory. */
  path: string;
  /** Sort position within its folder. */
  position: number;
  /** Folder path this page belongs to (empty string for root-level pages). */
  folderPath: string;
  /** JSON-serialized BlockNote blocks. */
  content: string;
  /** Whether the page should be published on import. */
  isPublished: boolean;
}

/**
 * A navigation tab in the InkLoom schema shape.
 * Matches core/apps/web/convex/schema/coreTables.ts navTabs structure.
 */
export interface InkLoomNavTab {
  /** Unique tab identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** URL-friendly slug. */
  slug: string;
  /** Optional icon name. */
  icon?: string;
  /** Ordered items within the tab (folder or page references). */
  items: Array<
    | { type: "folder"; folderPath: string }
    | { type: "page"; pagePath: string }
  >;
}

/**
 * Branding settings in the InkLoom project settings shape.
 */
export interface InkLoomBrandingSettings {
  /** Primary accent color (hex). */
  primaryColor?: string;
  /** Logo asset path (for upload to R2). */
  logoAssetPath?: string;
  /** Dark-mode logo asset path. */
  logoDarkAssetPath?: string;
  /** Favicon asset path. */
  faviconAssetPath?: string;
  /** Social media links. */
  socialLinks?: SocialLink[];
}

/**
 * Subpath guidance returned when source URL contains a path component.
 */
export interface SubpathInfo {
  /** Detected subpath (e.g. "/docs"). */
  subpath: string;
  /** Original hostname. */
  originalHost: string;
  /** Recommended subdomain. */
  recommendedSubdomain: string;
  /** Platform-specific redirect snippets. */
  snippets: Record<string, string>;
}

/**
 * Enriched migration result with BlockNote-converted content,
 * ready for createFromImport.
 */
export interface EnrichedMigrationResult {
  /** Project name for the import. */
  projectName: string;
  /** Pages with JSON-serialized BlockNote content. */
  pages: ImportReadyPage[];
  /** Folder structure for import. */
  folders: ParsedFolder[];
  /** Navigation tabs in InkLoom schema shape. */
  navTabs?: InkLoomNavTab[];
  /** Redirect rules for URL preservation. */
  redirects: RedirectRule[];
  /** Cloudflare _redirects file content. */
  redirectsFileContent: string;
  /** Discovered assets. */
  assets: MigrationAsset[];
  /** Branding settings in InkLoom project settings shape. */
  branding?: InkLoomBrandingSettings;
  /** Subpath hosting guidance (if source URL has a path component). */
  subpathGuidance?: SubpathInfo;
  /** OpenAPI spec files referenced in the source config. */
  openapiSpecs?: MigrationOpenApiSpec[];
  /** URL map from source paths to InkLoom paths. */
  urlMap: Map<string, string>;
  /** Warnings encountered during migration. */
  warnings: string[];
}
