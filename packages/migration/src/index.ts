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

import type { MigrationConfig, MigrationResult } from "./types.js";

/**
 * Run a migration from a supported documentation platform into InkLoom format.
 *
 * This is a placeholder implementation. Source-specific parsers (Mintlify, Gitbook)
 * will be added in subsequent tasks.
 *
 * @param config - Migration configuration specifying source, directory, and project name.
 * @returns A promise resolving to the complete migration result.
 */
export async function migrate(config: MigrationConfig): Promise<MigrationResult> {
  return {
    pages: [],
    folders: [],
    redirects: [],
    assets: [],
    warnings: [
      `Migration from ${config.source} is not yet implemented. Source directory: ${config.dirPath}`,
    ],
    urlMap: new Map(),
  };
}
