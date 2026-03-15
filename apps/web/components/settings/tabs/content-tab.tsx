"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@inkloom/ui/card";
import { Code, Layers } from "lucide-react";
import { NavTabsConfig } from "@/components/settings/nav-tabs-config";
import { OpenApiConfig } from "@/components/settings/openapi-config";
import { GatedSection } from "@/components/gated-section";
import { useTranslations } from "next-intl";

interface FolderInfo {
  path: string;
  name: string;
  parentId?: string;
}

interface ContentTabProps {
  projectId: string;
  project: Doc<"projects">;
  folders: FolderInfo[];
}

export function ContentTab({ projectId, project, folders }: ContentTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);
  const t = useTranslations("settings.content");

  return (
    <div className="space-y-6">
      <GatedSection
        feature="navigation_tabs"
        projectId={projectId as Id<"projects">}
        title={t("navigationTabs")}
        description={t("navigationTabsDescription")}
        icon={Layers}
        valueProp={t("navigationTabsValueProp")}
      >
        {project.defaultBranchId && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                <div>
                  <CardTitle>{t("navigationTabs")}</CardTitle>
                  <CardDescription>
                    {t("navigationTabsDescription")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <NavTabsConfig
                branchId={project.defaultBranchId}
                initialTabs={project.settings?.navTabs ?? []}
                onSave={async (tabs) => {
                  await updateSettings({
                    projectId: projectId as Id<"projects">,
                    settings: { navTabs: tabs },
                  });
                }}
              />
            </CardContent>
          </Card>
        )}
      </GatedSection>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <div>
              <CardTitle>{t("apiReference")}</CardTitle>
              <CardDescription>
                {t("apiReferenceDescription")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OpenApiConfig
            projectId={projectId}
            initialConfig={project.settings?.openapi}
            folders={folders}
            onSave={async (openapiConfig: NonNullable<typeof project.settings>["openapi"]) => {
              await updateSettings({
                projectId: projectId as Id<"projects">,
                settings: { openapi: openapiConfig ?? null },
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
