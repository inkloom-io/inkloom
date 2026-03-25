"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { SettingsSidebar, type SettingsTab } from "@/components/settings/settings-sidebar";
import { GeneralTab } from "@/components/settings/tabs/general-tab";
import { BrandingTab } from "@/components/settings/tabs/branding-tab";
import { SeoTab } from "@/components/settings/tabs/seo-tab";
import { AnalyticsTab } from "@/components/settings/tabs/analytics-tab";

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const project = useQuery(api.projects.get, {
    id: projectId as Id<"projects">,
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Link>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your documentation project.
        </p>
      </div>

      {/* Settings layout */}
      <div className="flex flex-col md:flex-row gap-8">
        <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 min-w-0">
          {activeTab === "general" && (
            <GeneralTab projectId={projectId} project={project} />
          )}
          {activeTab === "branding" && (
            <BrandingTab projectId={projectId} project={project} />
          )}
          {activeTab === "seo" && (
            <SeoTab projectId={projectId} project={project} />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab projectId={projectId} project={project} />
          )}
        </div>
      </div>
    </div>
  );
}
