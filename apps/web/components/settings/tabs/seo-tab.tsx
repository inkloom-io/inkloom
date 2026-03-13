"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@inkloom/ui/card";
import { Image, Search } from "lucide-react";
import { SeoSettings } from "@/components/settings/seo-settings";
import { OgImageUpload } from "@/components/settings/og-image-upload";
import { GatedSection } from "@/components/gated-section";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";
import { useTranslations } from "next-intl";

interface SeoTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function SeoTab({ projectId, project }: SeoTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);
  const t = useTranslations("settings.seo");

  // SEO settings
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [twitterCard, setTwitterCard] = useState<"summary" | "summary_large_image">("summary_large_image");
  const [robotsTxtCustom, setRobotsTxtCustom] = useState("");
  const [ogImageAssetId, setOgImageAssetId] = useState<Id<"assets"> | undefined>();
  const [seoInitialized, setSeoInitialized] = useState(false);

  // Initialize SEO
  useEffect(() => {
    if (project && !seoInitialized) {
      setOgTitle(project.settings?.seo?.ogTitle || "");
      setOgDescription(project.settings?.seo?.ogDescription || "");
      setTwitterCard(project.settings?.seo?.twitterCard || "summary_large_image");
      setRobotsTxtCustom(project.settings?.seo?.robotsTxtCustom || "");
      setOgImageAssetId(project.settings?.seo?.ogImageAssetId);
      setSeoInitialized(true);
    }
  }, [project, seoInitialized]);

  // Auto-save callbacks
  const saveSeo = useCallback(
    async (data: { ogTitle: string; ogDescription: string; twitterCard: "summary" | "summary_large_image"; robotsTxtCustom: string; ogImageAssetId?: Id<"assets"> }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          seo: {
            ogTitle: data.ogTitle || undefined,
            ogDescription: data.ogDescription || undefined,
            twitterCard: data.twitterCard,
            robotsTxtCustom: data.robotsTxtCustom || undefined,
            ogImageAssetId: data.ogImageAssetId,
          },
        },
      });
    },
    [updateSettings, projectId]
  );

  // Auto-save hooks
  const seoStatus = useAutoSave(
    { ogTitle, ogDescription, twitterCard, robotsTxtCustom, ogImageAssetId },
    saveSeo,
    800,
    seoInitialized
  );

  // Resolve asset URLs for the social preview
  const logoAssetId = project.settings?.logoAssetId;
  const logoAsset = useQuery(
    api.assets.getAsset,
    logoAssetId ? { assetId: logoAssetId } : "skip"
  );
  const ogImageAsset = useQuery(
    api.assets.getAsset,
    ogImageAssetId ? { assetId: ogImageAssetId } : "skip"
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <div>
                <CardTitle>{t("seoSettings")}</CardTitle>
                <CardDescription>
                  {t("seoSettingsDescription")}
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
            logoUrl={logoAsset?.url}
            customOgImageUrl={ogImageAsset?.url}
          />
        </CardContent>
      </Card>

      <GatedSection
        feature="custom_og_image"
        projectId={projectId as Id<"projects">}
        title={t("customOgImage")}
        description={t("customOgImageDescription")}
        icon={Image}
        valueProp={t("customOgImageValueProp")}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              <div>
                <CardTitle>{t("customOgImage")}</CardTitle>
                <CardDescription>
                  {t("customOgImageCardDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <OgImageUpload
              projectId={projectId as Id<"projects">}
              assetId={ogImageAssetId}
              onUpload={(id) => setOgImageAssetId(id)}
              onRemove={() => setOgImageAssetId(undefined)}
            />
          </CardContent>
        </Card>
      </GatedSection>
    </div>
  );
}
