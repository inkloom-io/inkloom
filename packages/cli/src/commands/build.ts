import { Command } from "commander";
import { resolve } from "node:path";
import pc from "picocolors";
import { createConvexClient } from "../lib/convex-client.js";
import { buildSite } from "../lib/build.js";
import { CliError, EXIT_GENERAL } from "../lib/errors.js";
import { printData, printSuccess } from "../lib/output.js";
import { handleActionNoClient, type GlobalOpts, getGlobalOpts } from "../lib/handler.js";

/**
 * Register the `build` command for generating static sites.
 *
 * This command is the core deployment mechanism for OSS users:
 * fetch project data from Convex → generate site files → write to dist/
 */
export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description(
      "Generate a static documentation site from your Convex project"
    )
    .argument("<projectId>", "Project ID to build")
    .option(
      "-o, --output <dir>",
      "Output directory (default: dist)",
      "dist"
    )
    .option("--branch <branchId>", "Branch to build (default: project default)")
    .option(
      "--clean",
      "Remove output directory before building (default: true)"
    )
    .option("--no-clean", "Do not clean output directory before building")
    .option(
      "--convex-url <url>",
      "Convex deployment URL (overrides NEXT_PUBLIC_CONVEX_URL)"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom build proj_abc                    Build default branch to dist/
  $ inkloom build proj_abc -o public          Build to public/ directory
  $ inkloom build proj_abc --branch br_xyz    Build a specific branch
  $ inkloom build proj_abc --no-clean         Keep existing files in output dir

Environment:
  NEXT_PUBLIC_CONVEX_URL    Convex deployment URL (required)
  CONVEX_URL                Alternative Convex URL variable`
    )
    .action(async (...args: unknown[]) => {
      // Commander passes: projectId, options object, Command instance
      const cmd = args[args.length - 1] as Command;
      const globalOpts = getGlobalOpts(cmd);
      const projectId = args[0] as string;
      const localOpts = args[args.length - 2] as {
        output: string;
        branch?: string;
        clean?: boolean;
        convexUrl?: string;
      };

      try {
        // Create Convex client
        const client = createConvexClient({
          convexUrl: localOpts.convexUrl,
          verbose: globalOpts.verbose,
        });

        const outDir = resolve(localOpts.output);
        const cleanOutput = localOpts.clean !== false; // Default true

        if (!globalOpts.json) {
          process.stderr.write(
            `Building project ${pc.bold(projectId)}...\n`
          );
        }

        const result = await buildSite(client, {
          projectId,
          branchId: localOpts.branch,
          outDir,
          clean: cleanOutput,
          verbose: globalOpts.verbose,
        });

        client.close();

        if (globalOpts.json) {
          printData(
            {
              data: {
                pageCount: result.pageCount,
                fileCount: result.fileCount,
                outDir: result.outDir,
              },
            },
            globalOpts
          );
          return;
        }

        process.stderr.write(
          `  Pages: ${result.pageCount}\n`
        );
        process.stderr.write(
          `  Files: ${result.fileCount}\n`
        );
        process.stderr.write(
          `  Output: ${result.outDir}/\n`
        );
        printSuccess(
          `Static site generated. Serve with any static file server.`
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
        process.exit(EXIT_GENERAL);
      }
    });
}
