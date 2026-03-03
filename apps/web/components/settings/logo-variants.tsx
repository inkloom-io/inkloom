"use client";

import { useTranslations } from "next-intl";
import type { Id } from "@/convex/_generated/dataModel";
import { Label } from "@inkloom/ui/label";
import { LogoUpload } from "./logo-upload";

interface LogoVariantsProps {
  projectId: Id<"projects">;
  lightAssetId?: Id<"assets">;
  darkAssetId?: Id<"assets">;
  onLightUpload: (assetId: Id<"assets">) => void;
  onLightRemove: () => void;
  onDarkUpload: (assetId: Id<"assets">) => void;
  onDarkRemove: () => void;
}

export function LogoVariants({
  projectId,
  lightAssetId,
  darkAssetId,
  onLightUpload,
  onLightRemove,
  onDarkUpload,
  onDarkRemove,
}: LogoVariantsProps) {
  const t = useTranslations("settings");
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{t("logoVariants.title")}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("logoVariants.description")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 bg-white dark:bg-white">
          <p className="text-xs font-medium text-gray-700 mb-3">{t("logoVariants.lightModeLogo")}</p>
          <LogoUpload
            projectId={projectId}
            assetId={lightAssetId}
            onUpload={onLightUpload}
            onRemove={onLightRemove}
          />
        </div>
        <div className="rounded-lg border p-4 bg-gray-900 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-300 mb-3">{t("logoVariants.darkModeLogo")}</p>
          <LogoUpload
            projectId={projectId}
            assetId={darkAssetId}
            onUpload={onDarkUpload}
            onRemove={onDarkRemove}
          />
        </div>
      </div>
    </div>
  );
}
