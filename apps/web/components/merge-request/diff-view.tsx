"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { BranchDiff, PageDiff } from "@/lib/diff-engine";
import { BlockDiff } from "./block-diff";
import { cn } from "@inkloom/ui/lib/utils";
import { ScrollArea } from "@inkloom/ui/scroll-area";
import {
  FileText,
  FolderOpen,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface DiffViewProps {
  sourceBranchId: Id<"branches">;
  targetBranchId: Id<"branches">;
  mergeRequestId: Id<"mergeRequests">;
}

// Group pages by their parent folder path
function groupByFolder(
  pageDiffs: PageDiff[]
): Map<string, PageDiff[]> {
  const groups = new Map<string, PageDiff[]>();

  for (const diff of pageDiffs) {
    const parts = diff.path.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "/";
    const existing = groups.get(folder) ?? [];
    existing.push(diff);
    groups.set(folder, existing);
  }

  return groups;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "added":
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          A
        </span>
      );
    case "removed":
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400">
          D
        </span>
      );
    case "modified":
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
          M
        </span>
      );
    default:
      return null;
  }
}

export function DiffView({
  sourceBranchId,
  targetBranchId,
  mergeRequestId,
}: DiffViewProps) {
  const t = useTranslations("mergeRequests.diffView");
  const computeDiff = useAction(api.mergeRequestDiff.computeDiff);
  const computePageDiffAction = useAction(
    api.mergeRequestDiff.computePageDiffAction
  );

  const [branchDiff, setBranchDiff] = useState<BranchDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedPageDiff, setSelectedPageDiff] = useState<PageDiff | null>(
    null
  );
  const [isLoadingPageDiff, setIsLoadingPageDiff] = useState(false);

  const [resolutions, setResolutions] = useState<
    Record<number, "source" | "target">
  >({});

  // Load the branch-level diff on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingDiff(true);
    setDiffError(null);

    computeDiff({ mergeRequestId })
      .then((diff) => {
        if (cancelled) return;
        setBranchDiff(diff as BranchDiff);
        // Auto-select the first changed page
        const pageDiffs = (diff as BranchDiff).pageDiffs;
        if (pageDiffs.length > 0) {
          setSelectedPath(pageDiffs[0]!.path);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setDiffError(
          err instanceof Error ? err.message : "Failed to compute diff"
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mergeRequestId, computeDiff]);

  // Load page-level diff when a page is selected
  useEffect(() => {
    if (!selectedPath) {
      setSelectedPageDiff(null);
      return;
    }

    let cancelled = false;
    setIsLoadingPageDiff(true);
    setResolutions({});

    computePageDiffAction({
      sourceBranchId,
      targetBranchId,
      pagePath: selectedPath,
      mergeRequestId,
    })
      .then((pageDiff) => {
        if (cancelled) return;
        setSelectedPageDiff(pageDiff as PageDiff);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load page diff:", err);
        setSelectedPageDiff(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPageDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPath, sourceBranchId, targetBranchId, computePageDiffAction]);

  const handleResolutionChange = useCallback(
    (blockIndex: number, resolution: "source" | "target") => {
      setResolutions((prev) => ({
        ...prev,
        [blockIndex]: resolution,
      }));
    },
    []
  );

  if (isLoadingDiff) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-[var(--text-dim)]">
            {t("computingChanges")}
          </span>
        </div>
      </div>
    );
  }

  if (diffError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <span className="text-sm text-destructive">{diffError}</span>
        </div>
      </div>
    );
  }

  if (!branchDiff || branchDiff.pageDiffs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="h-8 w-8 text-[var(--text-dim)]" />
          <span className="text-sm text-[var(--text-dim)]">
            {t("noChanges")}
          </span>
        </div>
      </div>
    );
  }

  const groupedPages = groupByFolder(branchDiff.pageDiffs);

  return (
    <div className="flex min-h-0 flex-1 border border-[var(--glass-border)] rounded-lg overflow-hidden">
      {/* Left sidebar: file tree */}
      <div className="w-64 shrink-0 border-r border-[var(--glass-border)] bg-[var(--surface-bg)]">
        <div className="flex h-10 items-center px-3 border-b border-[var(--glass-divider)]">
          <span className="text-xs font-medium text-[var(--text-medium)]">
            {t("changedFiles", { count: branchDiff.pageDiffs.length })}
          </span>
        </div>
        <ScrollArea className="h-[calc(100%-2.5rem)]">
          <div className="p-1">
            {Array.from(groupedPages.entries()).map(([folder, pages]) => (
              <div key={folder}>
                {/* Folder header */}
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <FolderOpen className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                  <span className="text-[11px] font-medium text-[var(--text-dim)] truncate">
                    {folder === "/" ? t("root") : folder}
                  </span>
                </div>
                {/* Pages in folder */}
                {pages.map((pageDiff) => {
                  const pageName =
                    pageDiff.path.split("/").pop() || pageDiff.path;
                  const isSelected = selectedPath === pageDiff.path;

                  return (
                    <button
                      key={pageDiff.path}
                      onClick={() => setSelectedPath(pageDiff.path)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "text-[var(--text-medium)] hover:bg-[var(--surface-active)]"
                      )}
                    >
                      <StatusBadge status={pageDiff.status} />
                      <span className="truncate">{pageName}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main area: page diff */}
      <div className="flex flex-1 flex-col min-w-0">
        {selectedPath ? (
          <>
            {/* Page diff header */}
            <div className="flex h-10 items-center gap-2 px-4 border-b border-[var(--glass-divider)] bg-[var(--surface-bg)]">
              <ChevronRight className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <span className="text-xs font-medium text-[var(--text-bright)] truncate">
                {selectedPath}
              </span>
              {selectedPageDiff && (
                <StatusBadge status={selectedPageDiff.status} />
              )}
            </div>

            {/* Page diff content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {isLoadingPageDiff ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : selectedPageDiff ? (
                  <div className="space-y-3">
                    {/* Title change indicator */}
                    {selectedPageDiff.titleChanged && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                        {t("pageTitleChanged")}
                      </div>
                    )}

                    {/* Description change indicator */}
                    {selectedPageDiff.descriptionChanged && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                        {t("pageDescriptionChanged")}
                      </div>
                    )}

                    {/* Block diffs */}
                    {selectedPageDiff.blockDiffs.length > 0 ? (
                      <BlockDiff
                        blockDiffs={selectedPageDiff.blockDiffs}
                        resolutions={resolutions}
                        onResolutionChange={handleResolutionChange}
                      />
                    ) : selectedPageDiff.status === "removed" ? (
                      <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {t("pageRemoved")}
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--text-dim)]">
                        {t("noBlockChanges")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-dim)]">
                    {t("failedToLoadDiff")}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-[var(--text-dim)]">
              {t("selectFileToView")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
