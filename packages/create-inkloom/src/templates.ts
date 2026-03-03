import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface VercelFile {
  file: string;
  data: string;
  encoding: "base64" | "utf-8";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the absolute path to the templates directory
 */
export function getTemplatePath(template: string = "default"): string {
  // In production (built), templates are at ../templates relative to dist/
  // In development, they're at ../templates relative to src/
  const possiblePaths = [
    path.join(__dirname, "..", "templates", template),
    path.join(__dirname, "..", "..", "templates", template),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`Template "${template}" not found`);
}

/**
 * Walk a directory recursively and return all file paths relative to the root
 */
function walkDirectory(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Skip hidden files and directories (except .gitignore which is named 'gitignore')
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") {
      continue;
    }

    // Skip node_modules and other common directories to exclude
    if (entry.name === "node_modules" || entry.name === ".turbo") {
      continue;
    }

    // Skip the docs folder - all docs content should come from generated files
    // This prevents template placeholder content from being deployed
    if (entry.name === "docs" && dir === baseDir) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Get template files in Vercel deployment format
 * Returns all files from the specified template as base64-encoded data
 */
export function getTemplateFiles(template: string = "default"): VercelFile[] {
  const templatePath = getTemplatePath(template);
  const filePaths = walkDirectory(templatePath);

  return filePaths.map((relativePath) => {
    const fullPath = path.join(templatePath, relativePath);
    const content = fs.readFileSync(fullPath);

    // Handle the 'gitignore' -> '.gitignore' rename
    let outputPath = relativePath;
    if (relativePath === "gitignore") {
      outputPath = ".gitignore";
    }

    // Normalize path separators for Vercel (use forward slashes)
    outputPath = outputPath.replace(/\\/g, "/");

    return {
      file: outputPath,
      data: content.toString("base64"),
      encoding: "base64" as const,
    };
  });
}

/**
 * Get the list of template file paths (without content)
 * Useful for debugging or listing available files
 */
export function getTemplateFilePaths(template: string = "default"): string[] {
  const templatePath = getTemplatePath(template);
  return walkDirectory(templatePath).map((p) => p.replace(/\\/g, "/"));
}

/**
 * Get pre-built assets from the template's dist/ directory.
 * These are the Vite build outputs (JS + CSS bundles) that are
 * the same for every published docs site.
 */
export function getPrebuiltAssets(
  template: string = "default"
): { path: string; content: Buffer }[] {
  const templatePath = getTemplatePath(template);
  const distPath = path.join(templatePath, "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Pre-built assets not found at ${distPath}. Run 'npm run build' in the template directory first.`
    );
  }

  const assets: { path: string; content: Buffer }[] = [];
  const filePaths = walkDirectory(distPath);

  for (const relativePath of filePaths) {
    const fullPath = path.join(distPath, relativePath);
    assets.push({
      path: relativePath.replace(/\\/g, "/"),
      content: fs.readFileSync(fullPath),
    });
  }

  return assets;
}

/**
 * Get the asset manifest listing JS and CSS files from the build output.
 * Used by the HTML generator to create <script> and <link> tags.
 */
export function getAssetManifest(
  template: string = "default"
): { js: string[]; css: string[] } {
  const assets = getPrebuiltAssets(template);
  const js: string[] = [];
  const css: string[] = [];

  for (const asset of assets) {
    if (asset.path.endsWith(".js")) {
      js.push(asset.path);
    } else if (asset.path.endsWith(".css")) {
      css.push(asset.path);
    }
  }

  return { js, css };
}
