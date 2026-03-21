/**
 * Shared docs-config module for parsing `docs.json` navigation config files
 * and resolving them to InkLoom navTabs and page positions.
 *
 * Used by both the CLI `pages push` command and the GitHub sync `pullFromGitHub()` function.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CliError, EXIT_GENERAL } from "./errors.js";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface DocsConfigGroup {
  group: string; // Display name (e.g., "Getting Started")
  folder: string; // Folder slug (e.g., "getting-started")
  pages?: string[]; // Page slugs in order (e.g., ["introduction", "quickstart"])
}

export interface DocsConfigTab {
  name: string; // Tab display name
  slug: string; // Tab URL slug
  icon?: string; // Lucide icon name
  groups: DocsConfigGroup[];
}

export interface DocsConfig {
  name?: string;
  openapi?: string; // Relative path to OpenAPI spec file
  tabs: DocsConfigTab[];
}

export interface NavTabItem {
  type: "folder";
  folderId: string;
}

export interface NavTab {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  items: NavTabItem[];
}

// ── Functions ───────────────────────────────────────────────────────────────

/**
 * Read and parse a `docs.json` config file from the given directory.
 * Returns `null` if no `docs.json` exists.
 * Throws a `CliError` on parse failure.
 */
export function readDocsConfig(dir: string): DocsConfig | null {
  const configPath = path.join(dir, "docs.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf-8");

  try {
    return parseDocsConfig(content);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to parse docs.json: ${message}`,
      EXIT_GENERAL,
    );
  }
}

/**
 * Parse a JSON string into a validated DocsConfig.
 * Throws descriptive errors on malformed input.
 */
export function parseDocsConfig(content: string): DocsConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new CliError(
      "docs.json contains invalid JSON",
      EXIT_GENERAL,
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new CliError(
      "docs.json must be a JSON object",
      EXIT_GENERAL,
    );
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.tabs)) {
    throw new CliError(
      "docs.json is missing required \"tabs\" array",
      EXIT_GENERAL,
    );
  }

  const tabs: DocsConfigTab[] = [];

  for (let i = 0; i < obj.tabs.length; i++) {
    const tab = obj.tabs[i] as Record<string, unknown>;

    if (typeof tab !== "object" || tab === null || Array.isArray(tab)) {
      throw new CliError(
        `docs.json tabs[${i}] must be an object`,
        EXIT_GENERAL,
      );
    }

    if (typeof tab.name !== "string" || !tab.name) {
      throw new CliError(
        `docs.json tabs[${i}] is missing required "name" field`,
        EXIT_GENERAL,
      );
    }

    if (typeof tab.slug !== "string" || !tab.slug) {
      throw new CliError(
        `docs.json tabs[${i}] is missing required "slug" field`,
        EXIT_GENERAL,
      );
    }

    if (!Array.isArray(tab.groups)) {
      throw new CliError(
        `docs.json tabs[${i}] is missing required "groups" array`,
        EXIT_GENERAL,
      );
    }

    const groups: DocsConfigGroup[] = [];

    for (let j = 0; j < tab.groups.length; j++) {
      const group = tab.groups[j] as Record<string, unknown>;

      if (typeof group !== "object" || group === null || Array.isArray(group)) {
        throw new CliError(
          `docs.json tabs[${i}].groups[${j}] must be an object`,
          EXIT_GENERAL,
        );
      }

      if (typeof group.group !== "string" || !group.group) {
        throw new CliError(
          `docs.json tabs[${i}].groups[${j}] is missing required "group" field`,
          EXIT_GENERAL,
        );
      }

      if (typeof group.folder !== "string" || !group.folder) {
        throw new CliError(
          `docs.json tabs[${i}].groups[${j}] is missing required "folder" field`,
          EXIT_GENERAL,
        );
      }

      const pages = Array.isArray(group.pages)
        ? (group.pages as string[])
        : undefined;

      groups.push({
        group: group.group,
        folder: group.folder,
        ...(pages ? { pages } : {}),
      });
    }

    tabs.push({
      name: tab.name,
      slug: tab.slug,
      ...(typeof tab.icon === "string" ? { icon: tab.icon } : {}),
      groups,
    });
  }

  return {
    ...(typeof obj.name === "string" ? { name: obj.name } : {}),
    ...(typeof obj.openapi === "string" ? { openapi: obj.openapi } : {}),
    tabs,
  };
}

/**
 * Resolve a DocsConfig into NavTab objects by matching folder slugs
 * to remote folder IDs.
 *
 * Folder slugs that don't match any remote folder are skipped with a
 * stderr warning.
 */
export function resolveNavTabs(
  config: DocsConfig,
  remoteFolders: Array<{ id: string; slug: string; parentId?: string }>,
  _remotePages: Array<{ id: string; slug: string; folderId?: string }>,
): NavTab[] {
  const folderSlugToId = new Map<string, string>();
  for (const folder of remoteFolders) {
    folderSlugToId.set(folder.slug, folder.id);
  }

  const navTabs: NavTab[] = [];

  for (const tab of config.tabs) {
    const items: NavTabItem[] = [];

    for (const group of tab.groups) {
      const folderId = folderSlugToId.get(group.folder);

      if (!folderId) {
        process.stderr.write(
          `Warning: folder slug "${group.folder}" in tab "${tab.name}" does not match any remote folder, skipping\n`,
        );
        continue;
      }

      items.push({ type: "folder", folderId });
    }

    navTabs.push({
      id: crypto.randomUUID(),
      name: tab.name,
      slug: tab.slug,
      ...(tab.icon ? { icon: tab.icon } : {}),
      items,
    });
  }

  return navTabs;
}

/**
 * Resolve page ordering from a DocsConfig.
 *
 * Returns a map of `"folderSlug/pageSlug"` → position (0-based index
 * within the group's pages array).
 */
export function resolvePagePositions(
  config: DocsConfig,
): Map<string, number> {
  const positions = new Map<string, number>();

  for (const tab of config.tabs) {
    for (const group of tab.groups) {
      if (!group.pages) continue;

      for (let i = 0; i < group.pages.length; i++) {
        const key = `${group.folder}/${group.pages[i]}`;
        positions.set(key, i);
      }
    }
  }

  return positions;
}
