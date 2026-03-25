import { resolveConfig, writeConfig, readConfig, type ResolvedConfig } from "./config.js";
import { CliError, exitCodeFromApiError, EXIT_AUTH, EXIT_PERMISSION, EXIT_NOT_FOUND, EXIT_GENERAL, EXIT_BILLING } from "./errors.js";

export interface ClientOptions {
  token?: string;
  org?: string;
  apiUrl?: string;
  verbose?: boolean;
  json?: boolean;
}

export interface ApiResponse<T = unknown> {
  data: T;
  pagination?: { cursor: string | null; hasMore: boolean };
}

export interface Client {
  get<T>(path: string): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  delete<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  config: ResolvedConfig;
}

export async function createClient(opts: ClientOptions): Promise<Client> {
  const config = await resolveConfig({
    token: opts.token,
    org: opts.org,
    apiUrl: opts.apiUrl,
  });

  if (!config.token) {
    throw new CliError(
      "Not authenticated. Run `inkloom auth login` or set INKLOOM_TOKEN.",
      EXIT_AUTH
    );
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${config.apiBaseUrl}${path}`;
    const start = Date.now();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    };

    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      headers["Idempotency-Key"] = crypto.randomUUID();
    }

    const fetchOpts: RequestInit = { method, headers };
    if (body !== undefined) {
      fetchOpts.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOpts);
    } catch (err) {
      throw new CliError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const elapsed = Date.now() - start;

    if (opts.verbose) {
      process.stderr.write(
        `[debug] ${method} ${url} → ${response.status} (${elapsed}ms)\n`
      );
      const remaining = response.headers.get("X-RateLimit-Remaining");
      const limit = response.headers.get("X-RateLimit-Limit");
      if (remaining !== null && limit !== null) {
        process.stderr.write(
          `[debug] X-RateLimit-Remaining: ${remaining}/${limit}\n`
        );
      }
    }

    if (!response.ok) {
      let apiError: { code: string; message: string; details?: Record<string, unknown> } | undefined;
      try {
        const errorBody = await response.json() as {
          error?: { code: string; message: string; details?: Record<string, unknown> };
        };
        if (errorBody.error) {
          apiError = errorBody.error;
        }
      } catch {
        // Response body wasn't JSON — fall through to generic error
      }

      if (apiError) {
        // Enrich 402 feature-gated errors with upgrade URL
        if (response.status === 402 && apiError.details?.upgradeUrl) {
          throw new CliError(
            `${apiError.message}\n  Upgrade at: ${config.apiBaseUrl}${apiError.details.upgradeUrl}`,
            EXIT_BILLING,
            apiError
          );
        }

        throw new CliError(
          `${apiError.message} (${apiError.code})`,
          exitCodeFromApiError(apiError.code),
          apiError
        );
      }

      throw new CliError(
        `API request failed with status ${response.status}`,
        response.status === 401
          ? EXIT_AUTH
          : response.status === 403
            ? EXIT_PERMISSION
            : response.status === 404
              ? EXIT_NOT_FOUND
              : EXIT_GENERAL
      );
    }

    const json = await response.json() as ApiResponse<T>;
    return json;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
    delete: <T>(path: string, body?: unknown) =>
      request<T>("DELETE", path, body),
    config,
  };
}

/**
 * Auto-resolve the user's orgId by listing their accessible projects
 * and extracting the unique organization ID.
 *
 * Falls back to undefined if no projects exist or multiple orgs are found.
 * Caches the resolved orgId in ~/.inkloom/config.json for future use.
 */
export async function resolveOrgId(client: Client): Promise<string | undefined> {
  try {
    const response = await client.get<Array<Record<string, unknown>>>("/api/v1/projects");
    const projects = response.data;
    if (!Array.isArray(projects) || projects.length === 0) {
      return undefined;
    }

    const orgIds = new Set<string>();
    for (const project of projects) {
      const orgId = project.workosOrgId;
      if (typeof orgId === "string" && orgId) {
        orgIds.add(orgId);
      }
    }

    if (orgIds.size === 1) {
      const resolved = [...orgIds][0];
      // Cache the resolved orgId so subsequent commands don't need the API call
      try {
        const cfg = readConfig();
        if (!cfg.defaultOrgId) {
          cfg.defaultOrgId = resolved;
          writeConfig(cfg);
        }
      } catch {
        // Config caching is best-effort — don't fail the command
      }
      return resolved;
    }

    return undefined;
  } catch {
    return undefined;
  }
}
