"use client";

/**
 * Core-mode GitHub connection stub.
 *
 * In core mode, no GitHub connection is available — always returns null.
 * The platform override queries the githubConnections table via Convex.
 */

import type { Id } from "@/convex/_generated/dataModel";

export interface GitHubConnectionResult {
  installationId: number;
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export function useGitHubConnection(
  _projectId: Id<"projects">
): GitHubConnectionResult | null | undefined {
  return null;
}
