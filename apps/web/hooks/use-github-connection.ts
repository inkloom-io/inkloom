"use client";

/**
 * Core-mode GitHub connection stub.
 *
 * In core mode, no GitHub connection is available — always returns null.
 * The platform override queries the platform data service.
 */

export interface GitHubConnectionResult {
  installationId: number;
  owner: string;
  repo: string;
  defaultBranch?: string;
  lastPushedAt?: number;
}

export function useGitHubConnection(
  _projectId: string
): GitHubConnectionResult | null | undefined {
  return null;
}
