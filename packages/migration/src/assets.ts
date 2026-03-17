import { extname, resolve, basename, posix } from "path";
import { readFileSync, readdirSync, statSync } from "fs";
import type { MigrationAsset } from "./types.js";

/**
 * MIME type map — follows the pattern from core/packages/cli/src/commands/assets.ts
 */
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
};

/**
 * Detect MIME type from a file path or URL by extension.
 * Falls back to "application/octet-stream" for unknown types.
 */
export function detectMimeType(filePath: string): string {
  // Strip query params and fragments for URL-based paths
  const cleaned = filePath.split("?")[0].split("#")[0];
  const ext = extname(cleaned).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

// ── Regex patterns for discovering image references ──

/** Markdown image: ![alt](url) */
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

/** MDX/JSX image: <Image src="url" /> or <img src="url" /> */
const JSX_IMAGE_RE = /<(?:Image|img)\s[^>]*src=["']([^"']+)["'][^>]*\/?>/gi;

/**
 * Base64 data URI pattern — captures the full data URI.
 * Matches data:image/png;base64,... inside markdown or JSX image refs.
 */
const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

/**
 * Scan MDX/markdown content for image URLs.
 *
 * Finds:
 * - Markdown images: `![alt](url)`
 * - JSX/MDX images: `<Image src="url" />` and `<img src="url" />`
 *
 * Returns a deduplicated array of discovered URLs/paths.
 */
export function scanContentForImages(content: string): string[] {
  const urls = new Set<string>();

  let match: RegExpExecArray | null;

  // Markdown images
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  match = MARKDOWN_IMAGE_RE.exec(content);
  while (match) {
    const url = match[1].trim();
    if (url) {
      urls.add(url);
    }
    match = MARKDOWN_IMAGE_RE.exec(content);
  }

  // JSX images
  JSX_IMAGE_RE.lastIndex = 0;
  match = JSX_IMAGE_RE.exec(content);
  while (match) {
    const url = match[1].trim();
    if (url) {
      urls.add(url);
    }
    match = JSX_IMAGE_RE.exec(content);
  }

  return Array.from(urls);
}

/**
 * Scan a Gitbook `.gitbook/assets/` directory and return all files as asset references.
 */
export function scanGitbookAssetsDir(sourceDir: string): string[] {
  const assetsDir = resolve(sourceDir, ".gitbook", "assets");
  try {
    const stat = statSync(assetsDir);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  const files: string[] = [];
  const entries = readdirSync(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      // Return as relative path from sourceDir
      files.push(posix.join(".gitbook", "assets", entry.name));
    }
  }
  return files;
}

/**
 * Determine if a URL is absolute (http/https).
 */
function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Determine if a URL is a base64 data URI.
 */
function isDataUri(url: string): boolean {
  return url.startsWith("data:");
}

/**
 * Extract a sensible filename from a URL or path.
 */
function extractFilename(url: string): string {
  if (isDataUri(url)) {
    const match = url.match(DATA_URI_RE);
    if (match) {
      const mimeType = match[1];
      const ext = Object.entries(MIME_TYPES).find(([, v]) => v === mimeType)?.[0] ?? ".bin";
      return `data-uri-${Date.now()}${ext}`;
    }
    return `data-uri-${Date.now()}.bin`;
  }

  // Strip query params and fragments
  const cleaned = url.split("?")[0].split("#")[0];
  const name = basename(cleaned);
  return name || `asset-${Date.now()}`;
}

/**
 * Decode a base64 data URI to a buffer and extract its MIME type.
 */
function decodeDataUri(dataUri: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUri.match(DATA_URI_RE);
  if (!match) return null;

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");
  return { buffer, mimeType };
}

/**
 * Read a local file relative to the source directory.
 */
function readLocalFile(sourceDir: string, relativePath: string): Buffer | null {
  try {
    // Strip leading "/" so root-relative paths (e.g. "/images/foo.png" from Mintlify)
    // resolve against sourceDir instead of being treated as absolute filesystem paths.
    const normalized = relativePath.startsWith("/")
      ? relativePath.slice(1)
      : relativePath;
    const fullPath = resolve(sourceDir, normalized);
    return readFileSync(fullPath);
  } catch {
    return null;
  }
}

/**
 * Result of collecting assets — includes the assets and any warnings.
 */
export interface AssetCollectionResult {
  assets: MigrationAsset[];
  warnings: string[];
}

/**
 * Collect and download all image assets from a set of MDX/markdown content strings.
 *
 * This function:
 * 1. Scans all content for image URLs (markdown and JSX syntax)
 * 2. Optionally scans Gitbook `.gitbook/assets/` directory
 * 3. Downloads/reads each asset:
 *    - Absolute URLs: fetched via HTTP
 *    - Base64 data URIs: decoded to buffer
 *    - Relative paths: read from local filesystem
 * 4. Returns a map of discovered assets with their buffers
 *
 * Broken/unreachable URLs are logged as warnings but do not cause failure.
 *
 * @param contents - Array of MDX/markdown content strings to scan
 * @param sourceDir - Path to the source documentation directory (for resolving relative paths)
 * @param options - Optional configuration
 * @param options.includeGitbookAssets - Whether to scan `.gitbook/assets/` directory
 * @param options.fetchFn - Custom fetch function (for testing)
 * @returns Collection result with assets array and warnings
 */
export async function collectAssets(
  contents: string[],
  sourceDir: string,
  options: {
    includeGitbookAssets?: boolean;
    fetchFn?: typeof globalThis.fetch;
  } = {}
): Promise<AssetCollectionResult> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const assets: MigrationAsset[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  // 1. Scan all content for image URLs
  const allUrls: string[] = [];
  for (const content of contents) {
    const urls = scanContentForImages(content);
    allUrls.push(...urls);
  }

  // 2. Optionally scan Gitbook assets directory
  if (options.includeGitbookAssets) {
    const gitbookFiles = scanGitbookAssetsDir(sourceDir);
    allUrls.push(...gitbookFiles);
  }

  // 3. Process each URL (deduplicated)
  for (const url of allUrls) {
    if (seen.has(url)) continue;
    seen.add(url);

    const filename = extractFilename(url);
    const mimeType = detectMimeType(url);

    if (isDataUri(url)) {
      // Base64 data URI
      const decoded = decodeDataUri(url);
      if (decoded) {
        assets.push({
          originalUrl: url,
          buffer: decoded.buffer,
          filename,
          mimeType: decoded.mimeType,
        });
      } else {
        warnings.push(`Failed to decode data URI: ${url.slice(0, 60)}...`);
      }
    } else if (isAbsoluteUrl(url)) {
      // HTTP fetch
      try {
        const response = await fetchFn(url);
        if (!response.ok) {
          warnings.push(`Failed to fetch ${url}: HTTP ${response.status}`);
          assets.push({ originalUrl: url, filename, mimeType });
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use content-type from response if available
        const contentType = response.headers.get("content-type");
        const resolvedMimeType = contentType
          ? contentType.split(";")[0].trim()
          : mimeType;

        assets.push({
          originalUrl: url,
          buffer,
          filename,
          mimeType: resolvedMimeType,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to fetch ${url}: ${message}`);
        // Keep original reference — no buffer
        assets.push({ originalUrl: url, filename, mimeType });
      }
    } else {
      // Relative path — read from filesystem
      const buffer = readLocalFile(sourceDir, url);
      if (buffer) {
        assets.push({ originalUrl: url, buffer, filename, mimeType });
      } else {
        warnings.push(`Local file not found: ${url} (resolved from ${sourceDir})`);
        assets.push({ originalUrl: url, filename, mimeType });
      }
    }
  }

  return { assets, warnings };
}
