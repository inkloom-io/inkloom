#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(
  process.cwd(),
  process.argv[2] ?? defaultRepositoryRoot
);

const git = spawnSync(
  "git",
  ["-C", repositoryRoot, "ls-files", "-z", "--", "."],
  {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  }
);

if (git.status !== 0) {
  process.stderr.write(git.stderr?.toString("utf8") ?? "");
  process.stderr.write(
    `Could not list tracked files under ${repositoryRoot}.\n`
  );
  process.exit(git.status ?? 1);
}

const trackedFiles = git.stdout.toString("utf8").split("\0").filter(Boolean);

const checkerPaths = new Set([
  "scripts/check-convex-retired.mjs",
  "scripts/check-convex-retired.test.mjs",
  "core/scripts/check-convex-retired.mjs",
  "core/scripts/check-convex-retired.test.mjs",
  "scripts/lib/data-platform-infra.ts",
  "scripts/__tests__/data-platform-infra.test.ts",
]);

const forbiddenContent = [
  {
    label: "retired package import",
    pattern:
      /\b(?:from|require\s*\(|import\s*(?:\(\s*)?)\s*["'](?:@convex\/|convex(?:-helpers)?(?:\/|["']))/,
  },
  {
    label: "retired environment variable",
    pattern: /\b(?:NEXT_PUBLIC_|VITE_|PUBLIC_)?CONVEX_[A-Z0-9_]+\b/,
  },
  {
    label: "retired hosted endpoint",
    pattern: /https?:\/\/[^\s"'`]*(?:convex\.cloud|convex\.site)\b/i,
  },
  {
    label: "retired React provider",
    pattern: /\bConvexProvider(?:WithAuth0|WithClerk)?\b/,
  },
];

const violations = [];

for (const relativePath of trackedFiles) {
  const normalizedPath = relativePath.replaceAll(path.sep, "/");
  if (checkerPaths.has(normalizedPath)) continue;

  if (/(^|\/)convex(?:-helpers)?(?:\/|\.json$)/i.test(normalizedPath)) {
    violations.push(`${normalizedPath}: retired backend path`);
  }

  const absolutePath = path.join(repositoryRoot, relativePath);
  let contents;
  try {
    contents = fs.readFileSync(absolutePath);
  } catch (error) {
    violations.push(
      `${normalizedPath}: could not read tracked file (${error.message})`
    );
    continue;
  }
  if (contents.includes(0)) continue;

  const text = contents.toString("utf8");
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of forbiddenContent) {
      if (rule.pattern.test(lines[index])) {
        violations.push(`${normalizedPath}:${index + 1}: ${rule.label}`);
      }
    }
  }

  if (normalizedPath.endsWith("package.json")) {
    let manifest;
    try {
      manifest = JSON.parse(text);
    } catch {
      continue;
    }
    for (const section of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        if (
          dependency === "convex" ||
          dependency === "convex-helpers" ||
          dependency.startsWith("@convex/")
        ) {
          violations.push(
            `${normalizedPath}: retired dependency ${dependency} in ${section}`
          );
        }
      }
    }
  }

  if (
    /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(
      normalizedPath
    ) &&
    /(?:^|[\s/"'])convex(?:-helpers)?@/m.test(text)
  ) {
    violations.push(`${normalizedPath}: retired dependency in lockfile`);
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Retired Convex integration detected in tracked files:\n${violations
      .map((violation) => `- ${violation}`)
      .join("\n")}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Convex retirement check passed (${trackedFiles.length} tracked files scanned).\n`
);
