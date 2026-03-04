"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
// Import from the deploy switchpoint — NOT from the main barrel (@/lib/adapters).
// The main barrel re-exports authAdapter which transitively imports lib/auth.ts
// (uses next/headers), breaking client component builds. The deploy switchpoint
// re-exports only the deploy adapter, avoiding the auth dependency.
import { deployAdapter } from "@/lib/adapters/deploy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeploymentStatus =
  | "idle"
  | "publishing"
  | "polling"
  | "success"
  | "error";

export interface DeploymentState {
  status: DeploymentStatus;
  deploymentId?: string;
  url?: string;
  error?: string;
}

export interface UsePublishOptions {
  project: Doc<"projects">;
  branchId?: Id<"branches">;
}

export interface UsePublishReturn {
  /** Current deployment state machine status. */
  deployment: DeploymentState;
  /** The target being deployed to ("preview" | "production"). */
  target: "preview" | "production";
  /** Set the deploy target. */
  setTarget: (target: "preview" | "production") => void;
  /** Trigger a deploy/build. */
  handlePublish: () => Promise<void>;
  /** Reset deployment state to idle. */
  resetDeployment: () => void;
  /** Whether a deploy is currently in-flight. */
  isPublishing: boolean;
  /** The latest deployment record for the project. */
  latestDeployment: Doc<"deployments"> | undefined;
  /** The tracked in-progress deployment (for progress UI). */
  trackedDeployment:
    | { buildPhase?: string; status?: string; url?: string }
    | undefined;
  /** Per-target unpublished changes state. */
  unpublishedChanges:
    | { preview: boolean; production: boolean }
    | undefined;
  /** Human-readable label for the deploy action (e.g., "Build" or "Deploy"). */
  actionLabel: string;
  /** Get a URL for a given project slug (mode-aware). */
  getDeployUrl: (projectSlug: string) => string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Extracts the publish/deploy state machine from the editor toolbar.
 *
 * Handles:
 * - Deploy target selection (preview/production)
 * - Triggering the deploy via the API
 * - Polling Convex for real-time deployment progress
 * - Resuming tracking after page refresh
 * - Mode-aware action labels ("Build" vs "Deploy")
 */
export function usePublish({
  project,
  branchId,
}: UsePublishOptions): UsePublishReturn {
  const [target, setTarget] = useState<"preview" | "production">("preview");
  const [deployment, setDeployment] = useState<DeploymentState>({
    status: "idle",
  });

  // ---------------------------------------------------------------------------
  // Convex subscriptions
  // ---------------------------------------------------------------------------

  const deployments = useQuery(api.deployments.listByProject, {
    projectId: project._id,
  });

  const latestDeployment = deployments?.[0];

  const inProgressDeployment = useQuery(
    api.deployments.getInProgressDeployment,
    { projectId: project._id }
  );

  const unpublishedChanges = useQuery(api.deployments.hasUnpublishedChanges, {
    projectId: project._id,
    ...(branchId && { branchId }),
  });

  // ---------------------------------------------------------------------------
  // Resume tracking after page refresh
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (inProgressDeployment && deployment.status === "idle") {
      setDeployment({
        status: "polling",
        deploymentId: inProgressDeployment._id,
        url: inProgressDeployment.url,
      });
    } else if (
      inProgressDeployment &&
      deployment.status === "publishing" &&
      !deployment.deploymentId
    ) {
      // POST is still in-flight but the early-created record appeared —
      // capture the ID so the Convex watcher can track progress
      setDeployment({
        status: "publishing",
        deploymentId: inProgressDeployment._id,
        url: inProgressDeployment.url,
      });
    } else if (
      inProgressDeployment === null &&
      deployment.status === "polling"
    ) {
      // Database shows no in-progress deployment, but local state is polling
      // This can happen if deployment completed while component was unmounted
      setDeployment({ status: "idle" });
    }
  }, [inProgressDeployment, deployment.status, deployment.deploymentId]);

  // ---------------------------------------------------------------------------
  // Watch Convex subscription for deployment status changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      (deployment.status === "polling" || deployment.status === "publishing") &&
      deployment.deploymentId &&
      deployments
    ) {
      const current = deployments.find(
        (d: { _id: string }) => d._id === deployment.deploymentId
      );
      if (
        current?.status === "ready" ||
        (current?.buildPhase === "propagating" && current?.url)
      ) {
        setDeployment({
          status: "success",
          deploymentId: deployment.deploymentId,
          url: current.url,
        });
      } else if (
        current?.status === "error" ||
        current?.status === "canceled"
      ) {
        setDeployment({
          status: "error",
          deploymentId: deployment.deploymentId,
          error: "Deployment failed",
        });
      }
    }
  }, [deployment.status, deployment.deploymentId, deployments]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isPublishing =
    deployment.status === "publishing" || deployment.status === "polling";

  const trackedDeployment = (() => {
    if (deployment.status === "publishing") {
      return inProgressDeployment ?? undefined;
    }
    if (
      deployment.status === "polling" &&
      deployment.deploymentId &&
      deployments
    ) {
      return deployments.find(
        (d: { _id: string }) => d._id === deployment.deploymentId
      );
    }
    return undefined;
  })();

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    setDeployment({ status: "publishing" });

    try {
      const endpoint = deployAdapter.getPublishEndpoint(project._id);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project._id,
          ...(branchId && { branchId }),
          ...(target === "production" && { target: "production" }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDeployment({
          status: "error",
          error: result.error?.message || "Failed to publish",
        });
        return;
      }

      setDeployment({
        status: "polling",
        deploymentId: result.data.deploymentId,
        url: result.data.url,
      });
    } catch (error) {
      setDeployment({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to publish",
      });
    }
  }, [project._id, branchId, target]);

  const resetDeployment = useCallback(() => {
    setDeployment({ status: "idle" });
  }, []);

  return {
    deployment,
    target,
    setTarget,
    handlePublish,
    resetDeployment,
    isPublishing,
    latestDeployment,
    trackedDeployment,
    unpublishedChanges,
    actionLabel: deployAdapter.actionLabel,
    getDeployUrl: deployAdapter.getDeployUrl,
  };
}
