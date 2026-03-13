"use client";

/**
 * Stub AI tab for core (OSS) mode.
 *
 * In the dev app (platform mode), this file is overridden by
 * platform/components/settings/tabs/ai-tab.tsx via the component merge
 * in generate-dev-app.ts.
 *
 * The stub exists so the core settings page can reference AiTab without
 * a build error in core-only mode. It renders nothing because the sidebar
 * never shows the AI tab when isMultiTenant is false.
 */

import type { Doc } from "@/convex/_generated/dataModel";

interface AiTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function AiTab(_props: AiTabProps) {
  return null;
}
