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
        {/* Light preview: force light-theme CSS variables so all child components render correctly */}
        <div
          className="rounded-lg border border-gray-200 dark:border-gray-200 p-4 bg-white dark:bg-white"
          style={{
            "--color-foreground": "#171717",
            "--color-background": "#ffffff",
            "--color-muted": "#f5f5f5",
            "--color-muted-foreground": "#737373",
            "--color-border": "#e5e5e5",
            "--color-input": "#e5e5e5",
            "--color-ring": "#14b8a6",
            "--color-primary": "#14b8a6",
            "--color-primary-foreground": "#ffffff",
            "--color-secondary": "#f5f5f5",
            "--color-secondary-foreground": "#171717",
            "--color-accent": "#f5f5f5",
            "--color-accent-foreground": "#171717",
            "--color-destructive": "#ef4444",
            "--color-destructive-foreground": "#ffffff",
          } as React.CSSProperties}
        >
          <p className="text-xs font-medium text-gray-700 dark:text-gray-700 mb-3">{t("logoVariants.lightModeLogo")}</p>
          <LogoUpload
            projectId={projectId}
            assetId={lightAssetId}
            onUpload={onLightUpload}
            onRemove={onLightRemove}
          />
        </div>
        {/* Dark preview: force dark-theme CSS variables so all child components render correctly */}
        <div
          className="rounded-lg border border-gray-700 dark:border-gray-700 p-4 bg-gray-900 dark:bg-gray-900"
          style={{
            "--color-foreground": "#f0f0f0",
            "--color-background": "#09090b",
            "--color-muted": "#131316",
            "--color-muted-foreground": "#737380",
            "--color-border": "#1e1e24",
            "--color-input": "#1e1e24",
            "--color-ring": "#14b8a6",
            "--color-primary": "#14b8a6",
            "--color-primary-foreground": "#000000",
            "--color-secondary": "#161619",
            "--color-secondary-foreground": "#e0e0e0",
            "--color-accent": "#1a1a1f",
            "--color-accent-foreground": "#f0f0f0",
            "--color-destructive": "#ef4444",
            "--color-destructive-foreground": "#f0f0f0",
          } as React.CSSProperties}
        >
          <p className="text-xs font-medium text-gray-300 dark:text-gray-300 mb-3">{t("logoVariants.darkModeLogo")}</p>
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
