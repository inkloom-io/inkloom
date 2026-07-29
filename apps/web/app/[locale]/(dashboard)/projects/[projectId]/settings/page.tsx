"use client";

import { use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDataQuery } from "@/data/hooks";
import { api } from "@/data/operations";
import { Button } from "@inkloom/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  SettingsSidebar,
  type SettingsTab,
} from "@/components/settings/settings-sidebar";
import { GeneralTab } from "@/components/settings/tabs/general-tab";
import { BrandingTab } from "@/components/settings/tabs/branding-tab";
import { ContentTab } from "@/components/settings/tabs/content-tab";
import { SeoTab } from "@/components/settings/tabs/seo-tab";
import { AiTab } from "@/components/settings/tabs/ai-tab";
import { IntegrationsTab } from "@/components/settings/tabs/integrations-tab";
import { DeveloperTab } from "@/components/settings/tabs/developer-tab";
import { AccessControlTab } from "@/components/settings/tabs/access-control-tab";

interface SettingsPageProps {
  params: Promise<{ projectId: string }>;
}

const VALID_TABS: SettingsTab[] = [
  "general",
  "branding",
  "content",
  "seo",
  "ai",
  "integrations",
  "developer",
  "access-control",
];

function SettingsContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("settings.page");

  const rawTab = searchParams.get("tab");
  const activeTab: SettingsTab =
    rawTab && VALID_TABS.includes(rawTab as SettingsTab)
      ? (rawTab as SettingsTab)
      : "general";

  const project = useDataQuery(api.projects.get, {
    projectId,
  });
  const folders = useDataQuery(api.folders.listByProject, {
    projectId,
  });

  const handleTabChange = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(`/projects/${projectId}/settings${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  };

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const folderInfos = (folders ?? []).map((f) => ({
    path: f.path,
    name: f.name,
    parentId: f.parentId ?? undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}/editor`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:gap-8">
        <SettingsSidebar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab content */}
        <div className="min-w-0 flex-1 mt-4 md:mt-0">
          {activeTab === "general" && (
            <GeneralTab projectId={projectId} project={project} />
          )}
          {activeTab === "branding" && (
            <BrandingTab projectId={projectId} project={project} />
          )}
          {activeTab === "content" && (
            <ContentTab
              projectId={projectId}
              project={project}
              folders={folderInfos}
            />
          )}
          {activeTab === "seo" && (
            <SeoTab projectId={projectId} project={project} />
          )}
          {activeTab === "ai" && (
            <AiTab projectId={projectId} project={project} />
          )}
          {activeTab === "integrations" && (
            <IntegrationsTab projectId={projectId} project={project} />
          )}
          {activeTab === "developer" && (
            <DeveloperTab projectId={projectId} project={project} />
          )}
          {activeTab === "access-control" && (
            <AccessControlTab projectId={projectId} project={project} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { projectId } = use(params);
  const t = useTranslations("settings.page");

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      }
    >
      <SettingsContent projectId={projectId} />
    </Suspense>
  );
}
