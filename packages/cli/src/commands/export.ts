import { Command } from "commander";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import pc from "picocolors";
import { createConvexClient } from "../lib/convex-client.js";
import { CliError, EXIT_GENERAL, EXIT_NOT_FOUND } from "../lib/errors.js";
import { printData, printSuccess } from "../lib/output.js";
import { getGlobalOpts } from "../lib/handler.js";

/**
 * Register the `export` command for dumping Convex data to a portable JSON file.
 *
 * This is the data portability mechanism for OSS users:
 * fetch all project data from Convex → write to `inkloom-export.json`.
 *
 * The export format is designed for migration to InkLoom Cloud via `inkloom migrate --to-cloud`.
 */
export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description(
      "Export all project data from Convex to a portable JSON file"
    )
    .option(
      "-o, --output <file>",
      "Output file path (default: inkloom-export.json)",
      "inkloom-export.json"
    )
    .option(
      "--project <projectId>",
      "Export a single project (default: export all projects)"
    )
    .option(
      "--convex-url <url>",
      "Convex deployment URL (overrides NEXT_PUBLIC_CONVEX_URL)"
    )
    .option("--pretty", "Pretty-print JSON output (default: true)")
    .option("--no-pretty", "Minify JSON output")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom export                                  Export all projects to inkloom-export.json
  $ inkloom export -o backup.json                   Export to a custom file
  $ inkloom export --project proj_abc               Export a single project
  $ inkloom export --no-pretty                      Export minified JSON
  $ inkloom export --json                           Output export metadata as JSON to stdout

Environment:
  NEXT_PUBLIC_CONVEX_URL    Convex deployment URL (required)
  CONVEX_URL                Alternative Convex URL variable`
    )
    .action(async (...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const globalOpts = getGlobalOpts(cmd);
      const localOpts = args[args.length - 2] as {
        output: string;
        project?: string;
        convexUrl?: string;
        pretty?: boolean;
      };

      try {
        const client = createConvexClient({
          convexUrl: localOpts.convexUrl,
          verbose: globalOpts.verbose,
        });

        const outputPath = resolve(localOpts.output);
        const prettyPrint = localOpts.pretty !== false;

        if (!globalOpts.json) {
          if (localOpts.project) {
            process.stderr.write(
              `Exporting project ${pc.bold(localOpts.project)}...\n`
            );
          } else {
            process.stderr.write(
              `Exporting all projects...\n`
            );
          }
        }

        const exportData = localOpts.project
          ? await client.exportProject(localOpts.project)
          : await client.exportAll();

        client.close();

        // Ensure output directory exists
        const dir = dirname(outputPath);
        mkdirSync(dir, { recursive: true });

        // Write export file
        const json = prettyPrint
          ? JSON.stringify(exportData, null, 2)
          : JSON.stringify(exportData);
        writeFileSync(outputPath, json + "\n", "utf-8");

        // Summary stats
        const stats = {
          projects: exportData.projects.length,
          branches: exportData.branches.length,
          pages: exportData.pages.length,
          folders: exportData.folders.length,
          assets: exportData.assets.length,
          deployments: exportData.deployments.length,
          mergeRequests: exportData.mergeRequests.length,
          outputFile: outputPath,
          sizeBytes: Buffer.byteLength(json, "utf-8"),
        };

        if (globalOpts.json) {
          printData({ data: stats }, globalOpts);
          return;
        }

        process.stderr.write(
          `  Projects:       ${stats.projects}\n`
        );
        process.stderr.write(
          `  Branches:       ${stats.branches}\n`
        );
        process.stderr.write(
          `  Pages:          ${stats.pages}\n`
        );
        process.stderr.write(
          `  Folders:        ${stats.folders}\n`
        );
        process.stderr.write(
          `  Assets:         ${stats.assets}\n`
        );
        process.stderr.write(
          `  Merge requests: ${stats.mergeRequests}\n`
        );
        process.stderr.write(
          `  Output:         ${outputPath}\n`
        );
        process.stderr.write(
          `  Size:           ${formatBytes(stats.sizeBytes)}\n`
        );
        printSuccess(
          `Export complete. Use 'inkloom migrate --to-cloud --file ${localOpts.output}' to import into InkLoom Cloud.`
        );
      } catch (error) {
        if (error instanceof CliError) {
          if (globalOpts.json) {
            process.stderr.write(
              JSON.stringify(
                { error: { message: error.message } },
                null,
                2
              ) + "\n"
            );
          } else {
            process.stderr.write(pc.red("Error: ") + error.message + "\n");
          }
          process.exit(error.exitCode);
        }

        const err =
          error instanceof Error ? error : new Error(String(error));

        // Map "Project not found" to NOT_FOUND exit code
        const exitCode = err.message.includes("Project not found")
          ? EXIT_NOT_FOUND
          : EXIT_GENERAL;

        if (globalOpts.json) {
          process.stderr.write(
            JSON.stringify(
              { error: { message: err.message } },
              null,
              2
            ) + "\n"
          );
        } else {
          process.stderr.write(pc.red("Error: ") + err.message + "\n");
        }
        process.exit(exitCode);
      }
    });
}

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
