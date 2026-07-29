export { VERSION } from "./version.js";

// Config
export { readConfig, writeConfig, resolveConfig, resolveConfigSync } from "./lib/config.js";
export type { CliConfig, ResolvedConfig, TokenSource } from "./lib/config.js";

// Client (REST API — platform mode)
export { createClient } from "./lib/client.js";
export type { Client, ClientOptions, ApiResponse } from "./lib/client.js";

// Client (D1 data API — core/OSS mode)
export { CoreDataClient, createCoreDataClient } from "./lib/data-client.js";
export type {
  CoreDataClientOptions,
  DataProject,
  DataBranch,
  DataPage,
  DataPageContent,
  DataFolder,
  DataAsset,
  DataDeployment,
  DataMergeRequest,
  ExportData,
} from "./lib/data-client.js";

// Error reporting (Sentry)
export {
  initErrorReporting,
  reportError,
  shutdown as shutdownErrorReporting,
} from "./lib/error-reporting.js";

// Errors
export {
  CliError,
  EXIT_SUCCESS,
  EXIT_GENERAL,
  EXIT_AUTH,
  EXIT_PERMISSION,
  EXIT_NOT_FOUND,
  exitCodeFromApiError,
} from "./lib/errors.js";

// Frontmatter
export { parseFrontmatter, serializeFrontmatter } from "./lib/frontmatter.js";
export type { PageFrontmatter } from "./lib/frontmatter.js";

// Push logic
export {
  walkMdxFiles,
  computeDiff,
  titleCase,
  applyDiff,
  formatDiffLines,
  formatSummary,
  formatDiffSummary,
} from "./lib/push.js";
export type {
  LocalPage,
  RemotePage,
  RemoteFolder,
  DiffResult,
  FolderToCreate,
  PageToUpdate,
  ApplyDiffOptions,
  ApplyDiffSummary,
} from "./lib/push.js";

// Build (static site generation)
export { buildSite } from "./lib/build.js";
export type { BuildOptions, BuildResult } from "./lib/build.js";
