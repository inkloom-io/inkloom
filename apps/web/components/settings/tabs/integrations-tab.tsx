"use client";

/**
 * Stub Integrations tab for core (OSS) mode.
 *
 * In the dev app (platform mode), this file is overridden by
 * platform/components/settings/tabs/integrations-tab.tsx via the component
 * merge in generate-dev-app.ts.
 */

import type { Project } from "@/db/schema";

interface IntegrationsTabProps {
  projectId: string;
  project: Project;
}

export function IntegrationsTab(_props: IntegrationsTabProps) {
  return null;
}
