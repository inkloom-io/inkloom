"use client";

/**
 * Core-mode feature gate stub.
 *
 * In core mode, all features are available — no plan-based gating.
 * Feature gates only apply in the platform SaaS.
 */

interface FeatureGateResult {
  available: boolean;
  isLoading: boolean;
  requiredPlan: string;
  currentPlan: string;
}

export function useFeatureGate(
  _feature: string,
  _projectId?: string
): FeatureGateResult {
  return {
    available: true,
    isLoading: false,
    requiredPlan: "core",
    currentPlan: "core",
  };
}
