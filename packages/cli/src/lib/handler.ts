import { Command } from "commander";
import { createClient, type Client, type ClientOptions } from "./client.js";
import { CliError, EXIT_GENERAL } from "./errors.js";
import { printError, type OutputOptions } from "./output.js";

/**
 * Global options resolved from the Commander root program.
 */
export interface GlobalOpts extends ClientOptions, OutputOptions {}

/**
 * Extract global options from the Commander command chain.
 * Walks up to the root program to collect --json, --token, --org, --api-url, --verbose.
 */
export function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals<{
    json?: boolean;
    token?: string;
    org?: string;
    apiUrl?: string;
    verbose?: boolean;
  }>();
  return {
    json: opts.json,
    token: opts.token,
    org: opts.org,
    apiUrl: opts.apiUrl,
    verbose: opts.verbose,
  };
}

/**
 * Wrap a command action function with:
 * 1. Global options extraction
 * 2. HTTP client initialization
 * 3. Error boundary (catches CliError, prints formatted error, exits with correct code)
 *
 * Commander calls action handlers with positional args followed by the Options object
 * and finally the Command instance. This wrapper extracts the Command from the last
 * argument and passes the client, global opts, and all Commander-provided args to `fn`.
 *
 * Usage:
 * ```ts
 * cmd.action(handleAction(async (client, opts, projectId, localOpts, cmd) => {
 *   const { data } = await client.get(`/api/v1/projects/${projectId}`);
 *   printData(data, opts);
 * }));
 * ```
 */
export function handleAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (client: Client, opts: GlobalOpts, ...args: any[]) => Promise<void>
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    // Commander passes: positional args..., options object, Command instance
    // The last argument is always the Command instance
    const cmd = args[args.length - 1] as Command;
    const globalOpts = getGlobalOpts(cmd);

    try {
      const client = createClient(globalOpts);
      await fn(client, globalOpts, ...args.slice(0, -1));
    } catch (error) {
      if (error instanceof CliError) {
        printError(error, globalOpts);
        process.exit(error.exitCode);
      }
      // Unexpected errors
      const err = error instanceof Error ? error : new Error(String(error));
      printError(err, globalOpts);
      process.exit(EXIT_GENERAL);
    }
  };
}

/**
 * Like handleAction, but does NOT create an HTTP client.
 * Used for commands that don't need API access (e.g., auth login, auth logout).
 */
export function handleActionNoClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (opts: GlobalOpts, ...args: any[]) => Promise<void>
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    const cmd = args[args.length - 1] as Command;
    const globalOpts = getGlobalOpts(cmd);

    try {
      await fn(globalOpts, ...args.slice(0, -1));
    } catch (error) {
      if (error instanceof CliError) {
        printError(error, globalOpts);
        process.exit(error.exitCode);
      }
      const err = error instanceof Error ? error : new Error(String(error));
      printError(err, globalOpts);
      process.exit(EXIT_GENERAL);
    }
  };
}
