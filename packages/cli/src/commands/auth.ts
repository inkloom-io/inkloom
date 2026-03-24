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
import { setToken, deleteToken } from "../lib/credential-store.js";
import { browserLogin } from "../lib/browser-auth.js";

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
    .description("Authenticate with InkLoom")
    .option("--no-browser", "Skip browser login; prompt for token instead")
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom auth login                          Open browser to authenticate
  $ inkloom auth login --no-browser             Interactive prompt for API key
  $ inkloom auth login --token ik_live_user_... Store key directly (CI usage)
  $ INKLOOM_TOKEN=ik_live_user_... inkloom auth status  Use env var instead`
    )
    .action(
      handleActionNoClient(async (opts: GlobalOpts, localOpts: { browser: boolean }) => {
        // --token global flag: direct token flow (CI/CD usage)
        if (opts.token) {
          await setToken(opts.token);
          printSuccess("Token saved to credential store.");
          return;
        }

        // --no-browser: fall back to interactive token prompt
        if (!localOpts.browser) {
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

          await setToken(response.token);
          printSuccess("Token saved to credential store.");
          return;
        }

        // Default: browser-based login flow
        if (!isInteractive()) {
          throw new CliError(
            "Browser login requires an interactive terminal. Use --token <key> instead.",
            EXIT_AUTH
          );
        }

        await browserLogin({
          apiUrl: opts.apiUrl,
          org: opts.org,
        });
      })
    );

  // --- auth logout ---
  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(
      handleActionNoClient(async () => {
        const removedSources: string[] = [];

        // Clear credential store (keychain)
        const deletedFromKeychain = await deleteToken();
        if (deletedFromKeychain) {
          removedSources.push("keychain");
        }

        // Clear legacy config token
        const config = readConfig();
        if (config.token) {
          delete config.token;
          writeConfig(config);
          removedSources.push("config file");
        }

        if (removedSources.length > 0) {
          printSuccess(`Logged out. Token removed from ${removedSources.join(" and ")}.`);
        } else {
          printSuccess("Logged out. No stored credentials found.");
        }
      })
    );

  // --- auth status ---
  auth
    .command("status")
    .description("Show current authentication status")
    .action(
      handleActionNoClient(async (opts: GlobalOpts) => {
        const config = await resolveConfig({
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

        const sourceLabels: Record<string, string> = {
          flag: "CLI flag",
          environment: "environment variable",
          keychain: "keychain",
          config: "config file (legacy)",
        };

        const sourceLabel = config.tokenSource
          ? sourceLabels[config.tokenSource] ?? config.tokenSource
          : "unknown";

        if (opts.json) {
          printData(
            {
              authenticated: true,
              token: masked,
              tokenSource: config.tokenSource,
              orgId: config.orgId ?? null,
              apiBaseUrl: config.apiBaseUrl,
            },
            opts
          );
          return;
        }

        process.stderr.write("Authenticated\n");
        process.stderr.write(`  Token: ${masked}\n`);
        process.stderr.write(`  Token source: ${sourceLabel}\n`);
        if (config.orgId) {
          process.stderr.write(`  Organization: ${config.orgId}\n`);
        }
        process.stderr.write(`  API: ${config.apiBaseUrl}\n`);

        // Legacy migration hint: token in config file but not in keychain
        if (config.tokenSource === "config") {
          process.stderr.write(
            "\nTip: Run `inkloom auth login` to upgrade to secure keychain storage.\n"
          );
        }
      })
    );
}
