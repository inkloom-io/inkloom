"use client";

/**
 * Stub Developer tab for core (OSS) mode.
 *
 * In the dev app (platform mode), this file is overridden by
 * platform/components/settings/tabs/developer-tab.tsx via the component
 * merge in generate-dev-app.ts.
 */

import type { Doc } from "@/convex/_generated/dataModel";

interface DeveloperTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function DeveloperTab(_props: DeveloperTabProps) {
  return null;
}
