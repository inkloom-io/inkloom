import { readFileSync } from "node:fs";
import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";

interface SettingsData {
  llmsTxt?: string;
  [key: string]: unknown;
}

/**
 * Register llms-txt commands: get, set.
 */
export function registerLlmsTxtCommands(program: Command): void {
  const llmsTxt = program
    .command("llms-txt")
    .description("Manage the llms.txt file for a project's published site");

  // --- llms-txt get ---
  llmsTxt
    .command("get")
    .description("Get the current llms.txt configuration")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<SettingsData>(
            `/api/v1/projects/${projectId}/settings`
          );

          const custom = response.data.llmsTxt;
          const mode = custom?.trim() ? "custom" : "auto";

          if (opts.json) {
            printData(
              { data: { llmsTxt: custom || "", mode } },
              opts
            );
            return;
          }

          if (mode === "auto") {
            process.stderr.write(
              "No custom llms.txt set — auto-generation is active.\n"
            );
            process.stderr.write(
              "Deploy your site to generate llms.txt from published pages.\n"
            );
          } else {
            process.stdout.write(custom! + "\n");
          }
        }
      )
    );

  // --- llms-txt set ---
  llmsTxt
    .command("set")
    .description("Set a custom llms.txt or revert to auto-generation")
    .argument("<projectId>", "Project ID")
    .option("--file <path>", "Path to llms.txt file to upload")
    .option("--clear", "Clear custom llms.txt and revert to auto-generation")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { file?: string; clear?: boolean }
        ) => {
          if (!localOpts.file && !localOpts.clear) {
            process.stderr.write(
              "Error: specify --file <path> or --clear\n"
            );
            process.exit(1);
          }

          if (localOpts.file && localOpts.clear) {
            process.stderr.write(
              "Error: --file and --clear are mutually exclusive\n"
            );
            process.exit(1);
          }

          let content: string;
          if (localOpts.clear) {
            content = "";
          } else {
            content = readFileSync(localOpts.file!, "utf-8");
          }

          const response = await client.patch<SettingsData>(
            `/api/v1/projects/${projectId}/settings`,
            { llmsTxt: content }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          if (localOpts.clear) {
            printSuccess(
              "Custom llms.txt cleared — auto-generation will be used on next deploy"
            );
          } else {
            printSuccess(
              "Custom llms.txt saved — it will be served on next deploy"
            );
          }
        }
      )
    );
}
