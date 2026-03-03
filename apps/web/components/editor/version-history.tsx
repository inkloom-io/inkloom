"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { History, X, RotateCcw, ArrowLeftRight } from "lucide-react";
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

interface VersionHistoryPanelProps {
  pageId: Id<"pages">;
  currentUserId?: Id<"users">;
  onClose: () => void;
  onCompare: (version: number) => void;
  onRestore?: (restoredContent: string) => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function VersionHistoryPanel({
  pageId,
  currentUserId,
  onClose,
  onCompare,
  onRestore,
}: VersionHistoryPanelProps) {
  const t = useTranslations("editor.versionHistory");
  const tc = useTranslations("common");
  const versions = useQuery(api.pages.listVersions, { pageId });
  const restoreVersion = useMutation(api.pages.restoreVersion);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  const handleRestore = async (version: number) => {
    setRestoringVersion(version);
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
      setRestoringVersion(null);
      setConfirmRestore(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-divider)]"
      >
        <div className="flex items-center gap-2">
          <History
            className="h-4 w-4 text-[var(--text-dim)]"
          />
          <h2
            className="text-sm font-semibold text-[var(--text-bright)]"
            style={{
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("title")}
          </h2>
          {versions && versions.length > 0 && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)]"
            >
              {versions.length}
            </span>
          )}
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-[var(--text-dim)] hover:bg-[var(--glass-hover)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-auto">
        {versions === undefined ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-active)] border border-[var(--glass-border)]"
            >
              <History
                className="h-5 w-5 text-[var(--text-dim)]"
              />
            </div>
            <p
              className="text-sm text-[var(--text-dim)]"
            >
              {t("noVersionsYet")}
            </p>
            <p
              className="text-xs text-[var(--text-dim)]"
              style={{ opacity: 0.65 }}
            >
              {t("noVersionsDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {versions.map((ver: any, index: number) => (
              <div
                key={ver._id}
                className="group rounded-lg p-3 transition-colors border border-transparent hover:bg-[var(--surface-active)] hover:border-[var(--glass-divider)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-primary/12 text-primary border border-primary/20"
                      >
                        v{ver.version}
                      </span>
                      {index === 0 && (
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)]"
                        >
                          {t("latest")}
                        </span>
                      )}
                    </div>
                    {ver.message && (
                      <p
                        className="mt-1 text-xs leading-relaxed text-[var(--text-medium)]"
                      >
                        {ver.message}
                      </p>
                    )}
                    <div
                      className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-dim)]"
                    >
                      {ver.creator && (
                        <div className="flex items-center gap-1.5">
                          {ver.creator.avatarUrl ? (
                            <img
                              src={ver.creator.avatarUrl}
                              alt=""
                              className="h-3.5 w-3.5 rounded-full"
                            />
                          ) : (
                            <div
                              className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)]"
                            >
                              {ver.creator.name?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                          <span>{ver.creator.name || t("unknown")}</span>
                        </div>
                      )}
                      <span>{timeAgo(ver.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors bg-[var(--glass-hover)] text-[var(--text-medium)] border border-[var(--glass-border)] hover:bg-[var(--glass-border)] hover:text-[var(--text-bright)]"
                    onClick={() => onCompare(ver.version)}
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    {t("compare")}
                  </button>
                  <button
                    className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:opacity-40 bg-[var(--glass-hover)] text-[var(--text-medium)] border border-[var(--glass-border)] hover:bg-[var(--glass-border)] hover:text-[var(--text-bright)]"
                    onClick={() => setConfirmRestore(ver.version)}
                    disabled={restoringVersion !== null}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("restore")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore confirmation */}
      <AlertDialog
        open={confirmRestore !== null}
        onOpenChange={(open) => !open && setConfirmRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreVersionTitle", { version: confirmRestore ?? 0 })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("restoreVersionDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestore !== null && handleRestore(confirmRestore)}
            >
              {t("restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
