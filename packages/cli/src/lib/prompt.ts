import prompts from "prompts";
import { CliError, EXIT_GENERAL } from "./errors.js";

/**
 * Detect whether the CLI is running in an interactive terminal.
 * Returns false in CI environments or when stdin is not a TTY.
 */
export function isInteractive(): boolean {
  if (process.env.CI) return false;
  if (!process.stdin.isTTY) return false;
  return true;
}

/**
 * Prompt the user for confirmation.
 *
 * - If `force` is true, returns true immediately (no prompt).
 * - In non-interactive mode (CI, piped stdin), throws a CliError
 *   instructing the user to pass --force.
 * - Otherwise, displays a y/N prompt via the `prompts` library.
 */
export async function confirm(
  message: string,
  opts?: { force?: boolean }
): Promise<boolean> {
  if (opts?.force) return true;

  if (!isInteractive()) {
    throw new CliError(
      "Confirmation required. Use --force in non-interactive mode.",
      EXIT_GENERAL
    );
  }

  const response = await prompts({
    type: "confirm",
    name: "value",
    message,
    initial: false,
  });

  // prompts returns {} if the user cancels (Ctrl+C)
  if (response.value === undefined) return false;

  return response.value;
}
