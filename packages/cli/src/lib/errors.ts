/**
 * CLI exit codes mapped from API error codes.
 * See docs/CLI_SPEC.md lines 102-122.
 */
export const EXIT_SUCCESS = 0;
export const EXIT_GENERAL = 1; // validation_error, conflict, rate_limit_exceeded, internal_error
export const EXIT_AUTH = 2; // unauthorized (401)
export const EXIT_PERMISSION = 3; // forbidden (403)
export const EXIT_NOT_FOUND = 4; // not_found (404)
export const EXIT_BILLING = 5; // feature_gated (402), payment_required (402)

/**
 * Structured error class for CLI operations.
 * Carries an exit code and optional API error details for formatted output.
 */
export class CliError extends Error {
  public readonly exitCode: number;
  public readonly apiError?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };

  constructor(
    message: string,
    exitCode: number = EXIT_GENERAL,
    apiError?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.apiError = apiError;
  }
}

/**
 * Map an API error code string to the appropriate CLI exit code.
 */
const API_ERROR_TO_EXIT: Record<string, number> = {
  unauthorized: EXIT_AUTH,
  forbidden: EXIT_PERMISSION,
  not_found: EXIT_NOT_FOUND,
  feature_gated: EXIT_BILLING,
  payment_required: EXIT_BILLING,
  validation_error: EXIT_GENERAL,
  conflict: EXIT_GENERAL,
  rate_limit_exceeded: EXIT_GENERAL,
  internal_error: EXIT_GENERAL,
};

export function exitCodeFromApiError(code: string): number {
  return API_ERROR_TO_EXIT[code] ?? EXIT_GENERAL;
}
