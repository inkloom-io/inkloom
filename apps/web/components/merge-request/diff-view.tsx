"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { BranchDiff, PageDiff, DiffResult } from "@/lib/diff-engine";
import { computeCharCounts } from "@/lib/diff-engine";
import { useAuth } from "@/hooks/use-auth";
import { BlockDiff } from "./block-diff";
import type { ReviewThreadData } from "./review-thread";
import { ThreadResolutionCounter } from "./review-thread";
import { cn } from "@inkloom/ui/lib/utils";
import { ScrollArea } from "@inkloom/ui/scroll-area";
import {
  FileText,
  FolderOpen,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { captureException } from "@/lib/sentry";

// ── Constants ─────────────────────────────────────────────────────────────

/** Pages with more changed blocks than this default to collapsed */
const LARGE_DIFF_THRESHOLD = 50;

// ── Types ─────────────────────────────────────────────────────────────────

interface DiffViewProps {
  sourceBranchId: Id<"branches">;
  targetBranchId: Id<"branches">;
  mergeRequestId: Id<"mergeRequests">;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Group pages by their parent folder path */
function groupByFolder(pageDiffs: PageDiff[]): Map<string, PageDiff[]> {
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

/** Encode a page path for use as an HTML id */
function encodePageId(path: string): string {
  return `diff-page-${path.replace(/[^a-zA-Z0-9-_]/g, "-")}`;
}

/** Format a number with commas */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Count changed blocks in a diff (non-unchanged status) */
function countChangedBlocks(blockDiffs: DiffResult[]): number {
  return blockDiffs.filter((d) => d.status !== "unchanged").length;
}

// ── Sub-components ────────────────────────────────────────────────────────

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

function CharCountBadge({
  added,
  removed,
}: {
  added: number;
  removed: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      {added > 0 && (
        <span className="text-[#1a7f37] dark:text-[#3fb950]">
          +{formatNumber(added)}
        </span>
      )}
      {removed > 0 && (
        <span className="text-[#cf222e] dark:text-[#f85149]">
          -{formatNumber(removed)}
        </span>
      )}
    </span>
  );
}

function ViewedCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded border transition-colors",
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "border-[var(--glass-border)] hover:border-[var(--text-dim)]"
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      {label && (
        <span className="text-xs text-[var(--text-dim)]">{label}</span>
      )}
    </label>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function ReviewSidebar({
  pageDiffs,
  activePagePath,
  viewedPages,
  charCountsMap,
  onFileClick,
}: {
  pageDiffs: PageDiff[];
  activePagePath: string | null;
  viewedPages: Set<string>;
  charCountsMap: Map<string, { added: number; removed: number }>;
  onFileClick: (path: string) => void;
}) {
  const t = useTranslations("mergeRequests.diffView");
  const groupedPages = useMemo(() => groupByFolder(pageDiffs), [pageDiffs]);

  return (
    <div className="w-64 shrink-0 border-r border-[var(--glass-border)] bg-[var(--surface-bg)] sticky top-0 self-start h-screen overflow-hidden flex flex-col">
      <div className="flex h-10 items-center px-3 border-b border-[var(--glass-divider)] shrink-0">
        <span className="text-xs font-medium text-[var(--text-medium)]">
          {t("changedFiles", { count: pageDiffs.length })}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {Array.from(groupedPages.entries()).map(([folder, pages]) => (
            <div key={folder}>
              <div className="flex items-center gap-1.5 px-2 py-1">
                <FolderOpen className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                <span className="text-[11px] font-medium text-[var(--text-dim)] truncate">
                  {folder === "/" ? t("root") : folder}
                </span>
              </div>
              {pages.map((pageDiff) => {
                const pageName =
                  pageDiff.path.split("/").pop() || pageDiff.path;
                const isActive = activePagePath === pageDiff.path;
                const isViewed = viewedPages.has(pageDiff.path);
                const counts = charCountsMap.get(pageDiff.path);

                return (
                  <button
                    key={pageDiff.path}
                    onClick={() => onFileClick(pageDiff.path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-[var(--text-medium)] hover:bg-[var(--surface-active)]",
                      isViewed && !isActive && "opacity-60"
                    )}
                  >
                    <StatusBadge status={pageDiff.status} />
                    <span className="truncate flex-1">{pageName}</span>
                    {isViewed && (
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                    )}
                    {counts && (counts.added > 0 || counts.removed > 0) && (
                      <span className="shrink-0 text-[10px] font-semibold">
                        {counts.added > 0 && (
                          <span className="text-[#1a7f37] dark:text-[#3fb950]">
                            +{counts.added}
                          </span>
                        )}
                        {counts.added > 0 && counts.removed > 0 && " "}
                        {counts.removed > 0 && (
                          <span className="text-[#cf222e] dark:text-[#f85149]">
                            -{counts.removed}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Page Diff Section ─────────────────────────────────────────────────────

function PageDiffSection({
  pageDiff,
  loadedPageDiff,
  isLoadingPageDiff,
  isExpanded,
  isLargeDiff,
  isLargeDiffLoaded,
  isViewed,
  charCounts,
  resolutions,
  mergeRequestId,
  threadsByBlock,
  canManageThreads,
  onToggleExpand,
  onToggleViewed,
  onLoadLargeDiff,
  onResolutionChange,
}: {
  pageDiff: PageDiff;
  loadedPageDiff: PageDiff | null;
  isLoadingPageDiff: boolean;
  isExpanded: boolean;
  isLargeDiff: boolean;
  isLargeDiffLoaded: boolean;
  isViewed: boolean;
  charCounts: { added: number; removed: number } | null;
  resolutions: Record<number, "source" | "target">;
  mergeRequestId: Id<"mergeRequests">;
  threadsByBlock?: Map<string, ReviewThreadData[]>;
  canManageThreads?: boolean;
  onToggleExpand: () => void;
  onToggleViewed: () => void;
  onLoadLargeDiff: () => void;
  onResolutionChange: (blockIndex: number, resolution: "source" | "target") => void;
}) {
  const t = useTranslations("mergeRequests.diffView");
  const pageId = encodePageId(pageDiff.path);
  const changedBlockCount = loadedPageDiff
    ? countChangedBlocks(loadedPageDiff.blockDiffs)
    : 0;

  return (
    <div
      id={pageId}
      className="rounded-lg border border-[var(--glass-border)] overflow-hidden"
    >
      {/* Sticky page header */}
      <div
        className="flex items-center gap-2 px-4 h-10 bg-[var(--surface-bg)] border-b border-[var(--glass-divider)] sticky top-0 z-10 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Collapse toggle */}
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
        )}

        {/* Page path */}
        <span className="text-xs font-medium text-[var(--text-bright)] truncate">
          {pageDiff.path}
        </span>

        {/* Status badge */}
        <StatusBadge status={pageDiff.status} />

        {/* Char counts */}
        {charCounts && (
          <CharCountBadge
            added={charCounts.added}
            removed={charCounts.removed}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Thread resolution counter */}
        <div onClick={(e) => e.stopPropagation()}>
          <ThreadResolutionCounter
            mergeRequestId={mergeRequestId}
            pagePath={pageDiff.path}
          />
        </div>

        {/* Viewed checkbox */}
        <div onClick={(e) => e.stopPropagation()}>
          <ViewedCheckbox
            checked={isViewed}
            onChange={onToggleViewed}
            label={t("viewed")}
          />
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="p-4">
          {/* Large diff placeholder */}
          {isLargeDiff && !isLargeDiffLoaded ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-sm text-[var(--text-dim)]">
                {t("largeDiffWarning", { count: changedBlockCount || "many" })}
              </p>
              {charCounts && (
                <CharCountBadge
                  added={charCounts.added}
                  removed={charCounts.removed}
                />
              )}
              <button
                onClick={onLoadLargeDiff}
                className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                {t("loadDiff")}
              </button>
            </div>
          ) : isLoadingPageDiff ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : loadedPageDiff ? (
            <div className="space-y-3">
              {/* Title change indicator */}
              {loadedPageDiff.titleChanged && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("pageTitleChanged")}
                </div>
              )}

              {/* Description change indicator */}
              {loadedPageDiff.descriptionChanged && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("pageDescriptionChanged")}
                </div>
              )}

              {/* Block diffs */}
              {loadedPageDiff.blockDiffs.length > 0 ? (
                <BlockDiff
                  blockDiffs={loadedPageDiff.blockDiffs}
                  resolutions={resolutions}
                  onResolutionChange={onResolutionChange}
                  mergeRequestId={mergeRequestId}
                  pagePath={pageDiff.path}
                  threadsByBlock={threadsByBlock}
                  canManageThreads={canManageThreads}
                />
              ) : loadedPageDiff.status === "removed" ? (
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
      )}
    </div>
  );
}

// ── Review Header Bar ─────────────────────────────────────────────────────

function ReviewHeaderBar({
  fileCount,
  totalAdded,
  totalRemoved,
  viewedCount,
  allExpanded,
  onExpandAll,
  onCollapseAll,
}: {
  fileCount: number;
  totalAdded: number;
  totalRemoved: number;
  viewedCount: number;
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const t = useTranslations("mergeRequests.diffView");

  return (
    <div className="flex items-center gap-3 px-4 h-12 bg-[var(--surface-bg)] border-b border-[var(--glass-divider)] shrink-0">
      <span className="text-sm font-medium text-[var(--text-medium)]">
        {t("filesChanged", { count: fileCount })}
      </span>

      <CharCountBadge added={totalAdded} removed={totalRemoved} />

      <div className="flex-1" />

      <span className="text-xs text-[var(--text-dim)]">
        {t("viewedCount", { viewed: viewedCount, total: fileCount })}
      </span>

      <button
        onClick={allExpanded ? onCollapseAll : onExpandAll}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-medium)] hover:bg-[var(--surface-active)] transition-colors"
      >
        <ChevronsUpDown className="h-3.5 w-3.5" />
        {allExpanded ? t("collapseAll") : t("expandAll")}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function DiffView({
  sourceBranchId,
  targetBranchId,
  mergeRequestId,
}: DiffViewProps) {
  const t = useTranslations("mergeRequests.diffView");
  const { userId } = useAuth();
  const computeDiff = useAction(api.mergeRequestDiff.computeDiff);
  const computePageDiffAction = useAction(
    api.mergeRequestDiff.computePageDiffAction
  );

  // ── Review threads ──────────────────────────────────────────────────
  const allThreads = useQuery(api.mrReviews.listThreadsByMR, {
    mergeRequestId,
  });

  // Group threads by pagePath → blockId (stable block ID, not positional index)
  const threadsByPage = useMemo(() => {
    const map = new Map<string, Map<string, ReviewThreadData[]>>();
    if (!allThreads) return map;
    for (const thread of allThreads as ReviewThreadData[]) {
      let pageMap = map.get(thread.pagePath);
      if (!pageMap) {
        pageMap = new Map();
        map.set(thread.pagePath, pageMap);
      }
      const existing = pageMap.get(thread.blockId) ?? [];
      existing.push(thread);
      pageMap.set(thread.blockId, existing);
    }
    return map;
  }, [allThreads]);

  // For now, any authenticated user can manage threads (server-side
  // mutations enforce ownership rules for destructive operations).
  const canManageThreads = !!userId;

  // Branch-level diff state
  const [branchDiff, setBranchDiff] = useState<BranchDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Per-page loaded diffs
  const [pageDiffsMap, setPageDiffsMap] = useState<Map<string, PageDiff>>(
    new Map()
  );
  const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set());

  // Expand/collapse state
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [largeDiffLoadedPages, setLargeDiffLoadedPages] = useState<Set<string>>(
    new Set()
  );

  // Viewed state (persisted in localStorage)
  const viewedStorageKey = `mr-viewed-${mergeRequestId}`;
  const [viewedPages, setViewedPages] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const stored = localStorage.getItem(viewedStorageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Active page tracking via IntersectionObserver
  const [activePagePath, setActivePagePath] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track accepted suggestions that have already triggered a diff refetch
  const processedAcceptedThreadsRef = useRef<Set<string>>(new Set());

  // Resolution state per page
  const [pageResolutions, setPageResolutions] = useState<
    Record<string, Record<number, "source" | "target">>
  >({});

  // Persist viewed state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        viewedStorageKey,
        JSON.stringify(Array.from(viewedPages))
      );
    } catch {
      // localStorage not available
    }
  }, [viewedPages, viewedStorageKey]);

  // Load branch-level diff on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingDiff(true);
    setDiffError(null);

    computeDiff({ mergeRequestId })
      .then((diff) => {
        if (cancelled) return;
        const typedDiff = diff as BranchDiff;
        setBranchDiff(typedDiff);

        // Initialize expanded state: expand all non-large pages
        const expanded = new Set<string>();
        for (const pd of typedDiff.pageDiffs) {
          const changedCount = countChangedBlocks(pd.blockDiffs);
          if (changedCount <= LARGE_DIFF_THRESHOLD) {
            expanded.add(pd.path);
          }
        }
        setExpandedPages(expanded);
      })
      .catch((err) => {
        if (cancelled) return;
        captureException(err, {
          source: "diff-view",
          action: "compute-diff",
          mergeRequestId,
        });
        setDiffError(t("failedToComputeDiff"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mergeRequestId, computeDiff]);

  // Load page-level diffs for all pages once branchDiff is loaded
  useEffect(() => {
    if (!branchDiff) return;

    for (const pageDiff of branchDiff.pageDiffs) {
      // For "removed" pages, we already have the data from branchDiff
      if (pageDiff.status === "removed") {
        setPageDiffsMap((prev) => {
          const next = new Map(prev);
          next.set(pageDiff.path, pageDiff);
          return next;
        });
        continue;
      }

      // Check if this is a large diff that shouldn't auto-load
      const changedCount = countChangedBlocks(pageDiff.blockDiffs);
      if (changedCount > LARGE_DIFF_THRESHOLD) {
        // Store the branch-level data (has block diffs from computeDiff)
        setPageDiffsMap((prev) => {
          const next = new Map(prev);
          next.set(pageDiff.path, pageDiff);
          return next;
        });
        continue;
      }

      // Load the detailed page diff
      loadPageDiff(pageDiff.path);
    }
  }, [branchDiff]);

  const loadPageDiff = useCallback(
    (pagePath: string) => {
      setLoadingPages((prev) => {
        const next = new Set(prev);
        next.add(pagePath);
        return next;
      });

      computePageDiffAction({
        sourceBranchId,
        targetBranchId,
        pagePath,
        mergeRequestId,
      })
        .then((result) => {
          setPageDiffsMap((prev) => {
            const next = new Map(prev);
            next.set(pagePath, result as PageDiff);
            return next;
          });
        })
        .catch((err) => {
          captureException(err, {
            source: "diff-view",
            action: "compute-page-diff",
            pagePath,
            mergeRequestId,
          });
        })
        .finally(() => {
          setLoadingPages((prev) => {
            const next = new Set(prev);
            next.delete(pagePath);
            return next;
          });
        });
    },
    [sourceBranchId, targetBranchId, mergeRequestId, computePageDiffAction]
  );

  // Recompute page diffs when suggestions are accepted
  // allThreads is reactive (via useQuery), so when a suggestion's status
  // changes to "accepted", this effect detects it and refetches the diff.
  useEffect(() => {
    if (!allThreads) return;
    for (const thread of allThreads as ReviewThreadData[]) {
      if (
        thread.suggestionStatus === "accepted" &&
        !processedAcceptedThreadsRef.current.has(thread._id)
      ) {
        processedAcceptedThreadsRef.current.add(thread._id);
        const cachedDiff = pageDiffsMap.get(thread.pagePath);
        if (cachedDiff) {
          loadPageDiff(thread.pagePath);
        }
      }
    }
  }, [allThreads, pageDiffsMap, loadPageDiff]);

  // IntersectionObserver for active page tracking
  useEffect(() => {
    if (!branchDiff || branchDiff.pageDiffs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (
              !topEntry ||
              entry.boundingClientRect.top < topEntry.boundingClientRect.top
            ) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const id = topEntry.target.id;
          // Decode the path from the id
          const matchingPage = branchDiff.pageDiffs.find(
            (pd) => encodePageId(pd.path) === id
          );
          if (matchingPage) {
            setActivePagePath(matchingPage.path);
          }
        }
      },
      {
        rootMargin: "-64px 0px -80% 0px",
        threshold: 0,
      }
    );

    // Observe all page section elements
    const timer = setTimeout(() => {
      for (const pageDiff of branchDiff.pageDiffs) {
        const el = document.getElementById(encodePageId(pageDiff.path));
        if (el) {
          observer.observe(el);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [branchDiff]);

  // Compute char counts for all loaded pages
  const charCountsMap = useMemo(() => {
    const map = new Map<string, { added: number; removed: number }>();
    for (const [path, pageDiff] of pageDiffsMap) {
      if (pageDiff.blockDiffs.length > 0) {
        map.set(path, computeCharCounts(pageDiff.blockDiffs));
      }
    }
    return map;
  }, [pageDiffsMap]);

  // Total char counts
  const totalCharCounts = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const counts of charCountsMap.values()) {
      added += counts.added;
      removed += counts.removed;
    }
    return { added, removed };
  }, [charCountsMap]);

  // Handlers
  const handleFileClick = useCallback((path: string) => {
    const el = document.getElementById(encodePageId(path));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Also expand if collapsed
    setExpandedPages((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleToggleViewed = useCallback((path: string) => {
    setViewedPages((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleLoadLargeDiff = useCallback(
    (path: string) => {
      setLargeDiffLoadedPages((prev) => {
        const next = new Set(prev);
        next.add(path);
        return next;
      });
      loadPageDiff(path);
    },
    [loadPageDiff]
  );

  const handleExpandAll = useCallback(() => {
    if (!branchDiff) return;
    setExpandedPages(new Set(branchDiff.pageDiffs.map((pd) => pd.path)));
  }, [branchDiff]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPages(new Set());
  }, []);

  const handleResolutionChange = useCallback(
    (pagePath: string, blockIndex: number, resolution: "source" | "target") => {
      setPageResolutions((prev) => ({
        ...prev,
        [pagePath]: {
          ...(prev[pagePath] ?? {}),
          [blockIndex]: resolution,
        },
      }));
    },
    []
  );

  // Check if all are expanded
  const allExpanded = branchDiff
    ? branchDiff.pageDiffs.every((pd) => expandedPages.has(pd.path))
    : false;

  // ── Render ──────────────────────────────────────────────────────────────

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

  return (
    <div className="flex min-h-0 flex-1 border border-[var(--glass-border)] rounded-lg overflow-hidden">
      {/* Sticky sidebar */}
      <ReviewSidebar
        pageDiffs={branchDiff.pageDiffs}
        activePagePath={activePagePath}
        viewedPages={viewedPages}
        charCountsMap={charCountsMap}
        onFileClick={handleFileClick}
      />

      {/* Main scrollable content area */}
      <div className="flex flex-1 flex-col min-w-0" ref={contentRef}>
        {/* Review header bar */}
        <ReviewHeaderBar
          fileCount={branchDiff.pageDiffs.length}
          totalAdded={totalCharCounts.added}
          totalRemoved={totalCharCounts.removed}
          viewedCount={viewedPages.size}
          allExpanded={allExpanded}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
        />

        {/* Scrollable page sections */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {branchDiff.pageDiffs.map((pageDiff) => {
              const loadedDiff = pageDiffsMap.get(pageDiff.path) ?? null;
              const isLoading = loadingPages.has(pageDiff.path);
              const isExpanded = expandedPages.has(pageDiff.path);
              const changedCount = countChangedBlocks(
                pageDiff.blockDiffs
              );
              const isLargeDiff = changedCount > LARGE_DIFF_THRESHOLD;
              const isLargeDiffLoaded = largeDiffLoadedPages.has(
                pageDiff.path
              );
              const isViewed = viewedPages.has(pageDiff.path);
              const charCounts = charCountsMap.get(pageDiff.path) ?? null;

              return (
                <PageDiffSection
                  key={pageDiff.path}
                  pageDiff={pageDiff}
                  loadedPageDiff={loadedDiff}
                  isLoadingPageDiff={isLoading}
                  isExpanded={isExpanded}
                  isLargeDiff={isLargeDiff}
                  isLargeDiffLoaded={isLargeDiffLoaded}
                  isViewed={isViewed}
                  charCounts={charCounts}
                  resolutions={pageResolutions[pageDiff.path] ?? {}}
                  mergeRequestId={mergeRequestId}
                  threadsByBlock={threadsByPage.get(pageDiff.path)}
                  canManageThreads={canManageThreads}
                  onToggleExpand={() => handleToggleExpand(pageDiff.path)}
                  onToggleViewed={() => handleToggleViewed(pageDiff.path)}
                  onLoadLargeDiff={() => handleLoadLargeDiff(pageDiff.path)}
                  onResolutionChange={(blockIndex, resolution) =>
                    handleResolutionChange(pageDiff.path, blockIndex, resolution)
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
