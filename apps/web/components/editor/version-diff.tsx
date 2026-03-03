"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { PreviewPanel } from "@/components/editor/preview-panel";
import type { ThemePreset } from "@/lib/theme-presets";
import { X, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@inkloom/ui/alert-dialog";

interface BreadcrumbFolder {
  _id: string;
  name: string;
  parentId?: string;
}

interface NavTab {
  name: string;
  slug: string;
  icon?: string;
  folderId?: string;
  items?: Array<{ type: string; folderId?: string; pageId?: string }>;
}

interface VersionDiffProps {
  pageId: Id<"pages">;
  version: number;
  currentContent: string;
  currentUserId?: Id<"users">;
  onExit: () => void;
  onRestore?: (restoredContent: string) => void;
  pageTitle: string;
  pageFolderId?: string;
  folders: BreadcrumbFolder[];
  navTabs: NavTab[];
  themePreset: ThemePreset;
  customPrimaryColor?: string;
  customBackgroundColorLight?: string;
  customBackgroundColorDark?: string;
  customBackgroundSubtleColorLight?: string;
  customBackgroundSubtleColorDark?: string;
}

export function VersionDiff({
  pageId,
  version,
  currentContent,
  currentUserId,
  onExit,
  onRestore,
  pageTitle,
  pageFolderId,
  folders,
  navTabs,
  themePreset,
  customPrimaryColor,
  customBackgroundColorLight,
  customBackgroundColorDark,
  customBackgroundSubtleColorLight,
  customBackgroundSubtleColorDark,
}: VersionDiffProps) {
  const t = useTranslations("editor.versionDiff");
  const tc = useTranslations("common");
  const versionData = useQuery(api.pages.getVersion, { pageId, version });
  const restoreVersion = useMutation(api.pages.restoreVersion);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restoredContent = await restoreVersion({
        pageId,
        version,
        restoredBy: currentUserId,
      });
      onRestore?.(restoredContent);
    } catch (error) {
      console.error("Failed to restore version:", error);
    } finally {
      setIsRestoring(false);
      setConfirmRestore(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4 bg-[var(--surface-bg)] border-b border-[var(--glass-divider)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-bright)]">
            {t("comparingVersions")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-40 bg-primary/12 text-primary border border-primary/20 hover:bg-primary/20"
            onClick={() => setConfirmRestore(true)}
            disabled={isRestoring || !versionData}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("restoreVersion", { version })}
          </button>
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors bg-[var(--glass-hover)] text-[var(--text-medium)] border border-[var(--glass-border)] hover:bg-[var(--glass-border)] hover:text-[var(--text-bright)]"
            onClick={onExit}
          >
            <X className="h-3.5 w-3.5" />
            {t("exitComparison")}
          </button>
        </div>
      </div>

      {/* Side-by-side panels */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Historical version */}
        <div className="flex flex-1 flex-col border-r border-[var(--glass-divider)]">
          <div className="flex h-9 shrink-0 items-center px-4 bg-[var(--surface-bg)] border-b border-[var(--surface-active)]">
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-primary/12 text-primary border border-primary/20">
              v{version}
            </span>
            {versionData?.message && (
              <span className="ml-2 truncate text-xs text-[var(--text-dim)]">
                {versionData.message}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {versionData ? (
              <PreviewPanel
                content={versionData.content}
                pageTitle={pageTitle}
                pageId={pageId}
                folderId={pageFolderId}
                folders={folders}
                navTabs={navTabs}
                themePreset={themePreset}
                customPrimaryColor={customPrimaryColor}
                customBackgroundColorLight={customBackgroundColorLight}
                customBackgroundColorDark={customBackgroundColorDark}
                customBackgroundSubtleColorLight={customBackgroundSubtleColorLight}
                customBackgroundSubtleColorDark={customBackgroundSubtleColorDark}
              />
            ) : (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Current content */}
        <div className="flex flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center px-4 bg-[var(--surface-bg)] border-b border-[var(--surface-active)]">
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)]">
              {t("current")}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PreviewPanel
              content={currentContent}
              pageTitle={pageTitle}
              pageId={pageId}
              folderId={pageFolderId}
              folders={folders}
              navTabs={navTabs}
              themePreset={themePreset}
              customPrimaryColor={customPrimaryColor}
              customBackgroundColorLight={customBackgroundColorLight}
              customBackgroundColorDark={customBackgroundColorDark}
              customBackgroundSubtleColorLight={customBackgroundSubtleColorLight}
              customBackgroundSubtleColorDark={customBackgroundSubtleColorDark}
            />
          </div>
        </div>
      </div>

      {/* Restore confirmation */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreVersionTitle", { version })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("restoreVersionDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t("restoreVersion", { version })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
