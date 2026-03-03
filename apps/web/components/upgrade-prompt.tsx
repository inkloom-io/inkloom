/**
 * Core-mode upgrade prompt stub.
 *
 * In core mode, all features are available — no upgrade prompts.
 * This component renders null so the editor page compiles cleanly.
 */
export function UpgradePrompt(_props: {
  feature?: string;
  requiredPlan?: string;
  currentPlan?: string;
  compact?: boolean;
}) {
  return null;
}
