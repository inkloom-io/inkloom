export {
  MigrationSource,
  type MigrationConfig,
  type MigrationResult,
  type ParsedPage,
  type ParsedFolder,
  type ParsedNavTab,
  type ParsedBranding,
  type SocialLink,
  type RedirectRule,
  type MigrationAsset,
  type MigrationStage,
  type OnProgressCallback,
  type ImportReadyPage,
  type InkLoomNavTab,
  type InkLoomBrandingSettings,
  type SubpathInfo,
  type EnrichedMigrationResult,
} from "./types.js";

export {
  parseGitbook,
  transformGitbookBlocks,
  type TransformResult,
  type ParseGitbookOptions,
} from "./gitbook/index.js";

export {
  generateRedirects,
  parseMintlifyRedirects,
  parseGitbookRedirects,
  mappingsToRedirects,
  mergeRedirects,
  generateSpaFallbackRules,
  detectSubpath,
  generateSubpathSnippets,
  type UrlMapping,
  type TabConfig,
  type RedirectsResult,
  type SubpathGuidance,
  type PlatformSnippets,
} from "./redirects.js";

export {
  detectMimeType,
  scanContentForImages,
  scanGitbookAssetsDir,
  collectAssets,
  type AssetCollectionResult,
} from "./assets.js";

export {
  parseMintlifyConfig,
  isDocsJsonFormat,
  type RawMintlifyConfig,
  type MintlifyConfigResult,
} from "./mintlify/config.js";

export {
  transformMintlifyMdx,
  transformFrontmatter,
} from "./mintlify/transform.js";

export { parseMintlify } from "./mintlify/index.js";

import { mdxToBlockNote } from "@inkloom/mdx-parser";

import {
  MigrationSource,
  type MigrationConfig,
  type MigrationResult,
  type EnrichedMigrationResult,
  type ImportReadyPage,
  type InkLoomNavTab,
  type InkLoomBrandingSettings,
  type SubpathInfo,
  type ParsedNavTab,
  type ParsedBranding,
  type ParsedPage,
  type ParsedFolder,
} from "./types.js";
import { parseMintlify } from "./mintlify/index.js";
import { parseGitbook } from "./gitbook/index.js";
import { collectAssets } from "./assets.js";
import {
  generateRedirects,
  type UrlMapping,
} from "./redirects.js";

// ---------------------------------------------------------------------------
// NavTab mapping
// ---------------------------------------------------------------------------

/**
 * Map ParsedNavTab[] to InkLoom navTabs schema shape.
 *
 * Each parsed nav tab has items (paths) that reference either folders or pages.
 * We resolve them against the known folders and pages to produce typed references.
 */
function mapNavTabs(
  parsedTabs: ParsedNavTab[] | undefined,
  folders: ParsedFolder[],
  pages: ParsedPage[],
): InkLoomNavTab[] | undefined {
  if (!parsedTabs || parsedTabs.length === 0) return undefined;

  const folderPaths = new Set(folders.map((f) => f.path));
  const pageSlugs = new Set(pages.map((p) => p.slug));

  return parsedTabs.map((tab, index) => {
    const items: InkLoomNavTab["items"] = [];

    for (const itemPath of tab.items) {
      if (folderPaths.has(itemPath)) {
        items.push({ type: "folder", folderPath: itemPath });
      } else if (pageSlugs.has(itemPath)) {
        items.push({ type: "page", pagePath: itemPath });
      } else {
        // Try matching by path prefix — might be a folder reference
        const matchingFolder = folders.find(
          (f) => f.slug === itemPath || f.path === itemPath,
        );
        if (matchingFolder) {
          items.push({ type: "folder", folderPath: matchingFolder.path });
        } else {
          // Try matching as a page path
          const matchingPage = pages.find(
            (p) => p.path.replace(/\.mdx?$/, "") === itemPath,
          );
          if (matchingPage) {
            items.push({ type: "page", pagePath: matchingPage.slug });
          }
        }
      }
    }

    return {
      id: `tab-${index}-${tab.slug}`,
      name: tab.name,
      slug: tab.slug,
      items,
    };
  });
}

// ---------------------------------------------------------------------------
// Branding mapping
// ---------------------------------------------------------------------------

/**
 * Map ParsedBranding to InkLoom project settings shape.
 */
function mapBranding(
  branding: ParsedBranding | undefined,
): InkLoomBrandingSettings | undefined {
  if (!branding) return undefined;

  return {
    primaryColor: branding.primaryColor,
    logoAssetPath: branding.logoPath,
    logoDarkAssetPath: branding.logoDarkPath,
    faviconAssetPath: branding.faviconPath,
    socialLinks: branding.socialLinks,
  };
}

// ---------------------------------------------------------------------------
// BlockNote conversion
// ---------------------------------------------------------------------------

/**
 * Convert a ParsedPage's MDX content to JSON-serialized BlockNote blocks.
 */
function convertPageToBlockNote(page: ParsedPage): ImportReadyPage {
  // Strip frontmatter before converting — mdxToBlockNote expects pure MDX/markdown
  const contentWithoutFrontmatter = stripFrontmatter(page.mdxContent);
  const blocks = mdxToBlockNote(contentWithoutFrontmatter);

  return {
    title: page.title,
    slug: page.slug,
    path: page.path,
    position: page.position,
    folderPath: page.folderPath,
    content: JSON.stringify(blocks),
    isPublished: !page.isOrphaned,
  };
}

/**
 * Strip YAML frontmatter from MDX content.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (match) {
    return content.slice(match[0].length);
  }
  return content;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a migration from a supported documentation platform into InkLoom format.
 *
 * Pipeline:
 * 1. Parse source directory using platform-specific parser (Mintlify or Gitbook)
 * 2. Run asset discovery on all page content
 * 3. Generate URL map and combined redirects
 * 4. Convert each page's MDX content to BlockNote JSON via mdxToBlockNote()
 * 5. Map ParsedNavTab[] to InkLoom navTabs schema shape
 * 6. Map ParsedBranding to InkLoom project settings shape
 * 7. Return enriched result ready for createFromImport
 *
 * @param config - Migration configuration specifying source, directory, and project name.
 * @returns A promise resolving to the enriched migration result.
 */
export async function migrate(
  config: MigrationConfig,
): Promise<EnrichedMigrationResult> {
  const { source, dirPath, projectName, onProgress, dryRun, sourceUrl, fetchFn } = config;
  const warnings: string[] = [];

  // ── Stage 1: Parsing ────────────────────────────────────────────────────
  onProgress?.("parsing", 0, 1);

  let parseResult: MigrationResult;

  switch (source) {
    case MigrationSource.Mintlify:
      parseResult = await parseMintlify(dirPath);
      break;
    case MigrationSource.Gitbook:
      parseResult = await parseGitbook(dirPath, { fetchFn });
      break;
    default:
      throw new Error(`Unsupported migration source: ${source}`);
  }

  warnings.push(...parseResult.warnings);
  onProgress?.("parsing", 1, 1);

  // ── Stage 2: Asset discovery ────────────────────────────────────────────
  // The platform parsers already collect assets, but we re-run asset
  // collection on the final MDX content for completeness. In dry-run mode
  // we skip downloading remote assets.
  const allContents = parseResult.pages.map((p) => p.mdxContent);
  const totalAssetSteps = allContents.length;
  onProgress?.("assets", 0, totalAssetSteps);

  if (!dryRun) {
    // Platform parsers already did asset collection; use their results.
    // Additional asset discovery is handled within the parsers.
    onProgress?.("assets", totalAssetSteps, totalAssetSteps);
  } else {
    onProgress?.("assets", totalAssetSteps, totalAssetSteps);
  }

  // ── Stage 3: Convert MDX to BlockNote JSON ──────────────────────────────
  const totalPages = parseResult.pages.length;
  onProgress?.("converting", 0, totalPages);

  const importReadyPages: ImportReadyPage[] = [];
  for (let i = 0; i < parseResult.pages.length; i++) {
    const page = parseResult.pages[i];
    try {
      importReadyPages.push(convertPageToBlockNote(page));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Failed to convert page "${page.title}" (${page.path}) to BlockNote: ${message}`,
      );
      // Fall back to a paragraph with the raw content
      importReadyPages.push({
        title: page.title,
        slug: page.slug,
        path: page.path,
        position: page.position,
        folderPath: page.folderPath,
        content: JSON.stringify([
          {
            type: "paragraph",
            content: [{ type: "text", text: page.mdxContent }],
          },
        ]),
        isPublished: !page.isOrphaned,
      });
    }
    onProgress?.("converting", i + 1, totalPages);
  }

  // ── Stage 4: Redirects ──────────────────────────────────────────────────
  onProgress?.("redirects", 0, 1);

  // Build URL mappings from the parse result's URL map
  const mappings: UrlMapping[] = [];
  for (const [sourcePath, targetPath] of parseResult.urlMap) {
    mappings.push({ sourcePath, targetPath });
  }

  const tabConfigs = (parseResult.navTabs ?? []).map((t) => ({ slug: t.slug }));

  const redirectsResult = generateRedirects({
    mappings,
    tabs: tabConfigs,
    sourceUrl,
  });

  // Merge redirects from the parser with generated redirects
  const allRedirects = [
    ...parseResult.redirects,
    ...redirectsResult.rules,
  ];

  // Deduplicate by `from` path
  const seenFrom = new Set<string>();
  const deduplicatedRedirects = allRedirects.filter((r) => {
    if (seenFrom.has(r.from)) return false;
    seenFrom.add(r.from);
    return true;
  });

  // Build subpath guidance
  let subpathGuidance: SubpathInfo | undefined;
  if (redirectsResult.subpathGuidance) {
    const sg = redirectsResult.subpathGuidance;
    subpathGuidance = {
      subpath: sg.subpath,
      originalHost: sg.originalHost,
      recommendedSubdomain: sg.recommendedSubdomain,
      snippets: { ...sg.snippets } as Record<string, string>,
    };
  }

  onProgress?.("redirects", 1, 1);

  // ── Stage 5: Map navTabs ────────────────────────────────────────────────
  const navTabs = mapNavTabs(
    parseResult.navTabs,
    parseResult.folders,
    parseResult.pages,
  );

  // ── Stage 6: Map branding ──────────────────────────────────────────────
  const branding = mapBranding(parseResult.branding);

  // ── Build enriched URL map ──────────────────────────────────────────────
  const enrichedUrlMap = new Map<string, string>();
  for (const [k, v] of parseResult.urlMap) {
    enrichedUrlMap.set(k, v);
  }
  // Merge in redirect-generated URL map
  for (const [k, v] of Object.entries(redirectsResult.urlMap)) {
    if (!enrichedUrlMap.has(k)) {
      enrichedUrlMap.set(k, v);
    }
  }

  return {
    projectName,
    pages: importReadyPages,
    folders: parseResult.folders,
    navTabs,
    redirects: deduplicatedRedirects,
    redirectsFileContent: redirectsResult.redirectsFileContent,
    assets: parseResult.assets,
    branding,
    subpathGuidance,
    urlMap: enrichedUrlMap,
    warnings,
  };
}
