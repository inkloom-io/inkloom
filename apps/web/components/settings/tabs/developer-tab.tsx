"use client";

/**
 * Stub Developer tab for core (OSS) mode.
 *
 * In the dev app (platform mode), this file is overridden by
 * platform/components/settings/tabs/developer-tab.tsx via the component
 * merge in generate-dev-app.ts.
 */

import type { Project } from "@/db/schema";

interface DeveloperTabProps {
  projectId: string;
  project: Project;
}

export function DeveloperTab(_props: DeveloperTabProps) {
  return null;
}
