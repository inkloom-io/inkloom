"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDataQuery } from "@/data/hooks";
import { api } from "@/data/operations";
import type { Deployment, Project } from "@/db/schema";
// Import from the deploy switchpoint — NOT from the main barrel (@/lib/adapters).
// The main barrel re-exports authAdapter which transitively imports lib/auth.ts
// (uses next/headers), breaking client component builds. The deploy switchpoint
// re-exports only the deploy adapter, avoiding the auth dependency.
import { deployAdapter } from "@/lib/adapters/deploy";
import { trackEvent } from "@/lib/analytics";
import { captureException } from "@/lib/sentry";

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
  project: Project;
  branchId?: string;
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
  latestDeployment: Deployment | undefined;
  /** The most recent deployment with status "ready" (for view-site links). */
  lastSuccessfulDeployment: Deployment | undefined;
  /** The tracked in-progress deployment (for progress UI). */
  trackedDeployment:
    | { buildPhase?: string; status?: string; url?: string }
    | undefined;
  /** Per-target unpublished changes state. */
  unpublishedChanges: { preview: boolean; production: boolean } | undefined;
  /** Human-readable label for the deploy action (e.g., "Build" or "Deploy"). */
  actionLabel: string;
  /** Get a URL for a given project slug (mode-aware). */
  getDeployUrl: (projectSlug: string) => string;
}

export function getDeploymentRefetchInterval(
  status: DeploymentStatus,
  intervalMs: number
): number | false {
  return status === "publishing" || status === "polling" ? intervalMs : false;
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
 * - Polling the D1 data service for deployment progress
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

  // After a successful deploy, locally override `hasChanges` to `false` for
  // the deployed target until the D1 query re-evaluates with the new
  // content hashes. This closes the race window where the button briefly
  // shows "Publish" (enabled) between deploy success and query confirmation.
  // We also track the deploymentId so we can clear the override when the
  // specific deployment reaches "ready", preventing the button from getting
  // permanently stuck if the user edits content during the deploy window.
  const [deployedTarget, setDeployedTarget] = useState<{
    target: string;
    deploymentId: string;
    setAt: number;
  } | null>(null);

  // Guard: when the user explicitly resets, prevent the resume-tracking effect
  // from immediately transitioning back to "polling" in the same render cycle.
  const justResetRef = useRef(false);

  // ---------------------------------------------------------------------------
  // D1-backed queries
  // ---------------------------------------------------------------------------

  const deployments = useDataQuery(
    api.deployments.listByProject,
    { projectId: project.id },
    {
      refetchInterval: getDeploymentRefetchInterval(deployment.status, 1_500),
    }
  );

  const latestDeployment = deployments?.[0];
  const lastSuccessfulDeployment = deployments?.find(
    (d) => d.status === "ready"
  );

  const inProgressDeployment = useDataQuery(
    api.deployments.getInProgressDeployment,
    { projectId: project.id },
    {
      refetchInterval: getDeploymentRefetchInterval(deployment.status, 1_500),
    }
  );

  const unpublishedChanges = useDataQuery(
    api.deployments.hasUnpublishedChanges,
    {
      projectId: project.id,
      ...(branchId && { branchId }),
    },
    {
      refetchInterval: getDeploymentRefetchInterval(deployment.status, 5_000),
    }
  );

  // ---------------------------------------------------------------------------
  // Resume tracking after page refresh
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (inProgressDeployment && deployment.status === "idle") {
      // Skip resume if the user just explicitly reset — this prevents the
      // effect from immediately re-entering "polling" after a deliberate reset
      // (e.g. when reopening the publish dialog after a prior success).
      if (justResetRef.current) {
        justResetRef.current = false;
        return;
      }
      setDeployment({
        status: "polling",
        deploymentId: inProgressDeployment.id,
        url: inProgressDeployment.url ?? undefined,
      });
    } else if (
      inProgressDeployment &&
      deployment.status === "publishing" &&
      !deployment.deploymentId
    ) {
      // POST is still in-flight but the early-created record appeared —
      // capture the ID so the data query can track progress
      setDeployment({
        status: "publishing",
        deploymentId: inProgressDeployment.id,
        url: inProgressDeployment.url ?? undefined,
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
  // Watch D1 polling results for deployment status changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      (deployment.status === "polling" || deployment.status === "publishing") &&
      deployment.deploymentId &&
      deployments
    ) {
      const current = deployments.find(
        (candidate) => candidate.id === deployment.deploymentId
      );
      if (current?.status === "ready") {
        trackEvent("deployment_completed", {
          projectId: project.id,
          success: true,
        });
        setDeployment({
          status: "success",
          deploymentId: deployment.deploymentId,
          url: current.url ?? undefined,
        });
        setDeployedTarget({
          target,
          deploymentId: deployment.deploymentId,
          setAt: Date.now(),
        });
      } else if (
        current?.status === "error" ||
        current?.status === "canceled"
      ) {
        trackEvent("deployment_completed", {
          projectId: project.id,
          success: false,
        });
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

  // Clear the deployed-target override when either:
  // 1. The D1 query confirms no unpublished changes (query caught up), OR
  // 2. The specific deployment reached "ready" status — this guarantees the
  //    override is temporary even if the user edited content during the deploy
  //    window, which would otherwise prevent condition 1 from ever being met.
  // 3. Safety timeout: 30 seconds after the override was set, as a final
  //    fallback in case neither condition 1 nor 2 fires (e.g. network issues).
  useEffect(() => {
    if (!deployedTarget) return;

    // Condition 3 (safety timeout): clear override after 30s regardless.
    const elapsed = Date.now() - deployedTarget.setAt;
    if (elapsed >= 30_000) {
      setDeployedTarget(null);
      return;
    }

    // Condition 1: D1 query caught up — no unpublished changes for target.
    const targetKey = deployedTarget.target as "preview" | "production";
    if (unpublishedChanges?.[targetKey] === false) {
      setDeployedTarget(null);
      return;
    }

    // Condition 2: The tracked deployment reached "ready" — the propagation
    // window is over, so the override is no longer needed. The query will now
    // correctly reflect whether there are unpublished changes.
    if (deployments) {
      const tracked = deployments.find(
        (candidate) => candidate.id === deployedTarget.deploymentId
      );
      if (tracked && tracked.status === "ready") {
        setDeployedTarget(null);
      }
    }

    // Schedule a re-check when the safety timeout expires
    const remaining = 30_000 - elapsed;
    const timer = setTimeout(() => {
      // Force a state update to trigger re-evaluation of this effect
      setDeployedTarget((prev) => (prev ? { ...prev } : null));
    }, remaining + 100);
    return () => clearTimeout(timer);
  }, [deployedTarget, unpublishedChanges, deployments]);

  const isPublishing =
    deployment.status === "publishing" || deployment.status === "polling";

  const trackedDeploymentRecord = (() => {
    if (deployment.status === "publishing") {
      return inProgressDeployment ?? undefined;
    }
    if (
      deployment.status === "polling" &&
      deployment.deploymentId &&
      deployments
    ) {
      return deployments.find(
        (candidate) => candidate.id === deployment.deploymentId
      );
    }
    return undefined;
  })();
  const trackedDeployment = trackedDeploymentRecord
    ? {
        buildPhase: trackedDeploymentRecord.buildPhase ?? undefined,
        status: trackedDeploymentRecord.status,
        url: trackedDeploymentRecord.url ?? undefined,
      }
    : undefined;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    setDeployment({ status: "publishing" });
    trackEvent("deployment_triggered", {
      projectId: project.id,
      trigger: "manual",
    });

    try {
      const endpoint = deployAdapter.getPublishEndpoint(project.id);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          ...(branchId && { branchId }),
          ...(target === "production" && { target: "production" }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const apiError = new Error(
          result.error?.message || "Failed to publish"
        );
        captureException(apiError, {
          source: "use-publish",
          action: "publish",
          projectId: project.id,
          target,
        });
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
      captureException(error, {
        source: "use-publish",
        action: "publish",
        projectId: project.id,
        target,
      });
      setDeployment({
        status: "error",
        error: "Failed to publish",
      });
    }
  }, [project.id, branchId, target]);

  const resetDeployment = useCallback(() => {
    justResetRef.current = true;
    setDeployedTarget(null);
    setDeployment({ status: "idle" });
  }, []);

  // Override unpublished-changes for the just-deployed target so downstream
  // consumers (e.g. the toolbar button) immediately see `false` after a
  // successful deploy, even before the D1 query re-evaluates.
  const effectiveUnpublishedChanges = unpublishedChanges
    ? {
        ...unpublishedChanges,
        ...(deployedTarget ? { [deployedTarget.target]: false as const } : {}),
      }
    : undefined;

  return {
    deployment,
    target,
    setTarget,
    handlePublish,
    resetDeployment,
    isPublishing,
    latestDeployment,
    lastSuccessfulDeployment,
    trackedDeployment,
    unpublishedChanges: effectiveUnpublishedChanges,
    actionLabel: deployAdapter.actionLabel,
    getDeployUrl: deployAdapter.getDeployUrl,
  };
}
