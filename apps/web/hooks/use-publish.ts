"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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

  // After a successful deploy, locally override `hasChanges` to `false` for
  // the deployed target until the Convex query re-evaluates with the new
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
      // Skip resume if the user just explicitly reset — this prevents the
      // effect from immediately re-entering "polling" after a deliberate reset
      // (e.g. when reopening the publish dialog after a prior success).
      if (justResetRef.current) {
        justResetRef.current = false;
        return;
      }
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
        trackEvent("deployment_completed", {
          projectId: project._id,
          success: true,
        });
        setDeployment({
          status: "success",
          deploymentId: deployment.deploymentId,
          url: current.url,
        });
        setDeployedTarget({ target, deploymentId: deployment.deploymentId, setAt: Date.now() });
      } else if (
        current?.status === "error" ||
        current?.status === "canceled"
      ) {
        trackEvent("deployment_completed", {
          projectId: project._id,
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
  // 1. The Convex query confirms no unpublished changes (query caught up), OR
  // 2. The specific deployment reached "ready" status — this guarantees the
  //    override is temporary even if the user edited content during the deploy
  //    window, which would otherwise prevent condition 1 from ever being met.
  // 3. Safety timeout: 30 seconds after the override was set. This prevents
  //    permanent stuck state if the fire-and-forget CF polling in the deploy
  //    route never completes (e.g., serverless runtime killed the background
  //    IIFE before it could update the deployment status to "ready").
  useEffect(() => {
    if (!deployedTarget) return;

    // Condition 3 (safety timeout): clear override after 30s regardless.
    const elapsed = Date.now() - deployedTarget.setAt;
    if (elapsed >= 30_000) {
      setDeployedTarget(null);
      return;
    }

    // Condition 1: Convex query caught up — no unpublished changes for target.
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
        (d: { _id: string }) => d._id === deployedTarget.deploymentId
      );
      if (tracked && tracked.status === "ready") {
        setDeployedTarget(null);
      }
    }

    // Schedule a re-check when the safety timeout expires
    const remaining = 30_000 - elapsed;
    const timer = setTimeout(() => {
      // Force a state update to trigger re-evaluation of this effect
      setDeployedTarget((prev) => prev ? { ...prev } : null);
    }, remaining + 100);
    return () => clearTimeout(timer);
  }, [deployedTarget, unpublishedChanges, deployments]);

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
    trackEvent("deployment_triggered", {
      projectId: project._id,
      trigger: "manual",
    });

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
        const apiError = new Error(result.error?.message || "Failed to publish");
        captureException(apiError, { source: "use-publish", action: "publish", projectId: project._id, target });
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
      captureException(error, { source: "use-publish", action: "publish", projectId: project._id, target });
      setDeployment({
        status: "error",
        error: "Failed to publish",
      });
    }
  }, [project._id, branchId, target]);

  const resetDeployment = useCallback(() => {
    justResetRef.current = true;
    setDeployedTarget(null);
    setDeployment({ status: "idle" });
  }, []);

  // Override unpublished-changes for the just-deployed target so downstream
  // consumers (e.g. the toolbar button) immediately see `false` after a
  // successful deploy, even before the Convex query re-evaluates.
  const effectiveUnpublishedChanges = unpublishedChanges
    ? {
        ...unpublishedChanges,
        ...(deployedTarget
          ? { [deployedTarget.target]: false as const }
          : {}),
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
    trackedDeployment,
    unpublishedChanges: effectiveUnpublishedChanges,
    actionLabel: deployAdapter.actionLabel,
    getDeployUrl: deployAdapter.getDeployUrl,
  };
}
