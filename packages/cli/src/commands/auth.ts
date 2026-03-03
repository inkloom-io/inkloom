import { Command } from "commander";
import prompts from "prompts";
import {
  readConfig,
  writeConfig,
  resolveConfig,
} from "../lib/config.js";
import { handleActionNoClient, type GlobalOpts } from "../lib/handler.js";
import { printData, printSuccess } from "../lib/output.js";
import { CliError, EXIT_AUTH } from "../lib/errors.js";
import { isInteractive } from "../lib/prompt.js";

/**
 * Register auth commands: login, logout, status.
 */
export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage authentication credentials");

  // --- auth login ---
  auth
    .command("login")
    .description("Authenticate with an API key")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom auth login                          Interactive prompt for API key
  $ inkloom auth login --token ik_live_user_... Store key directly (CI usage)
  $ INKLOOM_TOKEN=ik_live_user_... inkloom auth status  Use env var instead`
    )
    .action(
      handleActionNoClient(async (opts: GlobalOpts) => {
        // --token is a global flag; use it directly for non-interactive login
        let token = opts.token;

        if (!token) {
          if (!isInteractive()) {
            throw new CliError(
              "No token provided. Use --token <key> in non-interactive mode.",
              EXIT_AUTH
            );
          }

          const response = await prompts({
            type: "password",
            name: "token",
            message: "Enter your API key",
          });

          // User cancelled (Ctrl+C)
          if (!response.token) {
            throw new CliError("Login cancelled.", EXIT_AUTH);
          }

          token = response.token;
        }

        const config = readConfig();
        config.token = token;
        writeConfig(config);

        printSuccess("Token saved to ~/.inkloom/config.json");
      })
    );

  // --- auth logout ---
  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(
      handleActionNoClient(async () => {
        const config = readConfig();
        delete config.token;
        writeConfig(config);

        printSuccess("Logged out. Token removed from ~/.inkloom/config.json");
      })
    );

  // --- auth status ---
  auth
    .command("status")
    .description("Show current authentication status")
    .action(
      handleActionNoClient(async (opts: GlobalOpts) => {
        const config = resolveConfig({
          token: opts.token,
          org: opts.org,
          apiUrl: opts.apiUrl,
        });

        if (!config.token) {
          process.stderr.write("Not authenticated\n");
          process.exit(EXIT_AUTH);
        }

        const masked =
          config.token.length > 16
            ? config.token.slice(0, 16) + "..."
            : config.token;

        if (opts.json) {
          printData(
            {
              authenticated: true,
              token: masked,
              orgId: config.orgId ?? null,
              apiBaseUrl: config.apiBaseUrl,
            },
            opts
          );
          return;
        }

        process.stderr.write("Authenticated\n");
        process.stderr.write(`  Token: ${masked}\n`);
        if (config.orgId) {
          process.stderr.write(`  Organization: ${config.orgId}\n`);
        }
        process.stderr.write(`  API: ${config.apiBaseUrl}\n`);
      })
    );
}
