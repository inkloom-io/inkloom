import { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import { handleAction } from "../lib/handler.js";
import { printData, printSuccess } from "../lib/output.js";
import { CliError, EXIT_GENERAL } from "../lib/errors.js";
import { trackEvent } from "../lib/telemetry.js";
import type { ExportData } from "../lib/convex-client.js";

/**
 * Register the `migrate` command for importing data into InkLoom Cloud.
 *
 * This is the OSS → SaaS conversion funnel:
 * 1. User runs `inkloom export` to dump their local Convex data
 * 2. User runs `inkloom migrate --to-cloud --file inkloom-export.json`
 * 3. CLI uploads the export file to POST /api/import on InkLoom Cloud
 * 4. SaaS creates the project(s) under the user's organization
 */
export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate data between InkLoom instances")
    .option("--to-cloud", "Import local export into InkLoom Cloud")
    .option(
      "--file <path>",
      "Path to inkloom-export.json file",
      "inkloom-export.json"
    )
    .option("--dry-run", "Validate the export file without uploading")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom migrate --to-cloud --file inkloom-export.json
  $ inkloom migrate --to-cloud --file backup.json --dry-run
  $ inkloom migrate --to-cloud --file inkloom-export.json --json

Prerequisites:
  1. Export your data:    inkloom export -o inkloom-export.json
  2. Authenticate:        inkloom auth login
  3. Set organization:    inkloom auth login --org <orgId>

Environment:
  INKLOOM_TOKEN          API key for InkLoom Cloud
  INKLOOM_API_URL        API base URL (default: https://app.inkloom.io)`
    )
    .action(
      handleAction(async (client, opts, localOpts) => {
        const { toCloud, file, dryRun } = localOpts as {
          toCloud?: boolean;
          file: string;
          dryRun?: boolean;
        };

        if (!toCloud) {
          throw new CliError(
            "Please specify a migration target. Currently supported: --to-cloud",
            EXIT_GENERAL
          );
        }

        // Resolve and read the export file
        const filePath = resolve(file);

        if (!existsSync(filePath)) {
          throw new CliError(
            `Export file not found: ${filePath}\nRun 'inkloom export' first to create the export file.`,
            EXIT_GENERAL
          );
        }

        let rawData: string;
        try {
          rawData = readFileSync(filePath, "utf-8");
        } catch (err) {
          throw new CliError(
            `Failed to read export file: ${err instanceof Error ? err.message : String(err)}`,
            EXIT_GENERAL
          );
        }

        // Parse and validate
        let exportData: ExportData;
        try {
          exportData = JSON.parse(rawData) as ExportData;
        } catch {
          throw new CliError(
            `Invalid JSON in export file: ${filePath}`,
            EXIT_GENERAL
          );
        }

        // Validate export format
        const validationErrors = validateExportData(exportData);
        if (validationErrors.length > 0) {
          throw new CliError(
            `Invalid export file:\n${validationErrors.map((e) => `  - ${e}`).join("\n")}`,
            EXIT_GENERAL
          );
        }

        // Summary stats
        const stats = {
          projects: exportData.projects.length,
          branches: exportData.branches.length,
          pages: exportData.pages.length,
          folders: exportData.folders.length,
          assets: exportData.assets.length,
          exportedAt: exportData.exportedAt,
        };

        if (!opts.json) {
          process.stderr.write(
            pc.bold("Export file summary:\n")
          );
          process.stderr.write(`  Projects: ${stats.projects}\n`);
          process.stderr.write(`  Branches: ${stats.branches}\n`);
          process.stderr.write(`  Pages:    ${stats.pages}\n`);
          process.stderr.write(`  Folders:  ${stats.folders}\n`);
          process.stderr.write(`  Assets:   ${stats.assets}\n`);
          process.stderr.write(`  Exported: ${stats.exportedAt}\n`);
          process.stderr.write("\n");
        }

        if (dryRun) {
          if (opts.json) {
            printData(
              { data: { valid: true, stats, dryRun: true } },
              opts
            );
          } else {
            printSuccess(
              "Export file is valid. Remove --dry-run to upload to InkLoom Cloud."
            );
          }
          return;
        }

        // Upload to InkLoom Cloud
        if (!opts.json) {
          process.stderr.write(
            `Uploading to InkLoom Cloud (${client.config.apiBaseUrl})...\n`
          );
        }

        const response = await client.post<{
          projects: Array<{
            sourceId: string;
            importedId: string;
            name: string;
          }>;
          summary: {
            projectsImported: number;
            pagesImported: number;
            foldersImported: number;
          };
        }>("/api/import", exportData);

        if (opts.json) {
          printData(response, opts);
          return;
        }

        // Print results
        const { summary } = response.data;
        process.stderr.write("\n");
        process.stderr.write(
          `  Projects imported: ${summary.projectsImported}\n`
        );
        process.stderr.write(
          `  Pages imported:    ${summary.pagesImported}\n`
        );
        process.stderr.write(
          `  Folders imported:  ${summary.foldersImported}\n`
        );
        process.stderr.write("\n");

        for (const proj of response.data.projects) {
          process.stderr.write(
            `  ${pc.green("+")} ${proj.name} → ${pc.dim(proj.importedId)}\n`
          );
        }
        process.stderr.write("\n");

        printSuccess(
          `Migration complete! Visit ${client.config.apiBaseUrl} to access your projects.`
        );

        // Fire-and-forget telemetry
        trackEvent(
          "migrate_completed",
          {
            projects: summary.projectsImported,
            pages: summary.pagesImported,
            target: "cloud",
          },
          opts.noTelemetry
        ).catch(() => {});
      })
    );
}

/**
 * Validate an ExportData object for import compatibility.
 * Returns an array of error messages (empty = valid).
 */
export function validateExportData(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return ["Export data must be a JSON object"];
  }

  const d = data as Record<string, unknown>;

  // Version check
  if (d.version !== 1) {
    errors.push(
      `Unsupported export version: ${d.version}. Expected version 1.`
    );
  }

  // Required fields
  if (!d.exportedAt || typeof d.exportedAt !== "string") {
    errors.push("Missing or invalid 'exportedAt' timestamp");
  }

  // Required arrays
  const requiredArrays = [
    "projects",
    "branches",
    "pages",
    "folders",
    "assets",
  ] as const;

  for (const field of requiredArrays) {
    if (!Array.isArray(d[field])) {
      errors.push(`Missing or invalid '${field}' array`);
    }
  }

  if (errors.length > 0) return errors;

  // Projects must have required fields
  const projects = d.projects as Array<Record<string, unknown>>;
  if (projects.length === 0) {
    errors.push("Export must contain at least one project");
  }
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (!p.name || typeof p.name !== "string") {
      errors.push(`projects[${i}]: missing or invalid 'name'`);
    }
    if (!p._id || typeof p._id !== "string") {
      errors.push(`projects[${i}]: missing or invalid '_id'`);
    }
  }

  // Branches must reference existing projects
  const projectIds = new Set(projects.map((p) => p._id));
  const branches = d.branches as Array<Record<string, unknown>>;
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    if (!b.projectId || !projectIds.has(b.projectId)) {
      errors.push(
        `branches[${i}]: references non-existent project '${b.projectId}'`
      );
    }
  }

  // Pages must reference existing branches
  const branchIds = new Set(branches.map((b) => b._id));
  const pages = d.pages as Array<Record<string, unknown>>;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (!p.branchId || !branchIds.has(p.branchId)) {
      errors.push(
        `pages[${i}]: references non-existent branch '${p.branchId}'`
      );
    }
    if (!p.title || typeof p.title !== "string") {
      errors.push(`pages[${i}]: missing or invalid 'title'`);
    }
    if (!p.slug || typeof p.slug !== "string") {
      errors.push(`pages[${i}]: missing or invalid 'slug'`);
    }
  }

  return errors;
}
