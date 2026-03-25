"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search } from "lucide-react";
import { SeoSettings } from "@/components/settings/seo-settings";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";

interface SeoTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function SeoTab({ projectId, project }: SeoTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);

  // SEO settings
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [twitterCard, setTwitterCard] = useState<"summary" | "summary_large_image">("summary_large_image");
  const [robotsTxtCustom, setRobotsTxtCustom] = useState("");
  const [seoInitialized, setSeoInitialized] = useState(false);

  // Initialize SEO
  useEffect(() => {
    if (project && !seoInitialized) {
      setOgTitle(project.settings?.seo?.ogTitle || "");
      setOgDescription(project.settings?.seo?.ogDescription || "");
      setTwitterCard(project.settings?.seo?.twitterCard || "summary_large_image");
      setRobotsTxtCustom(project.settings?.seo?.robotsTxtCustom || "");
      setSeoInitialized(true);
    }
  }, [project, seoInitialized]);

  // Auto-save callback
  const saveSeo = useCallback(
    async (data: { ogTitle: string; ogDescription: string; twitterCard: "summary" | "summary_large_image"; robotsTxtCustom: string }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          seo: {
            ogTitle: data.ogTitle || undefined,
            ogDescription: data.ogDescription || undefined,
            twitterCard: data.twitterCard,
            robotsTxtCustom: data.robotsTxtCustom || undefined,
          },
        },
      });
    },
    [updateSettings, projectId]
  );

  const seoStatus = useAutoSave(
    { ogTitle, ogDescription, twitterCard, robotsTxtCustom },
    saveSeo,
    800,
    seoInitialized
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <div>
                <CardTitle>SEO Settings</CardTitle>
                <CardDescription>
                  Configure search engine optimization and social sharing metadata.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={seoStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <SeoSettings
            ogTitle={ogTitle}
            ogDescription={ogDescription}
            twitterCard={twitterCard}
            robotsTxtCustom={robotsTxtCustom}
            onOgTitleChange={setOgTitle}
            onOgDescriptionChange={setOgDescription}
            onTwitterCardChange={setTwitterCard}
            onRobotsTxtCustomChange={setRobotsTxtCustom}
            projectName={project.name}
            primaryColor={project.settings?.primaryColor}
          />
        </CardContent>
      </Card>
    </div>
  );
}
