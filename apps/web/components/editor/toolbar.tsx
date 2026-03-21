"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { BlockNoteEditor } from "@blocknote/core";
import { Button } from "@inkloom/ui/button";
import { usePublish } from "@/hooks/use-publish";
import { Tooltip, TooltipContent, TooltipTrigger } from "@inkloom/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@inkloom/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@inkloom/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import {
  AlertTriangle,
  BarChart3,
  Eye,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  GitPullRequest,
  History,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Redo2,
  Rocket,
  Save,
  Search,
  Settings,
  Sparkles,
  TextSearch,
  Undo2,
  XCircle,
  PanelRightOpen,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { AnimatedFlyingMascot } from "@/components/illustrations/animated-flying-mascot";
import { ToolbarCollaboration } from "./toolbar-collaboration";
import type { CollaborationState } from "./toolbar-collaboration";
import { getProductionUrl, toVanityUrl } from "@/lib/domain-utils";
import { ReaderReactionsModal } from "./reader-reactions-modal";

interface EditorToolbarProps {
  project: Doc<"projects">;
  page?: Doc<"pages"> | null;
  isPreviewOpen?: boolean;
  onTogglePreview?: () => void;
  editor?: BlockNoteEditor | null;
  onOpenSearch?: () => void;
  collaboration?: CollaborationState;
  collaborationGated?: boolean;
  isCommentsOpen?: boolean;
  onToggleComments?: () => void;
  commentCount?: number;
  isSaving?: boolean;
  branchId?: Id<"branches">;
  branchName?: string;
  isDefaultBranch?: boolean;
  isVersionHistoryOpen?: boolean;
  onToggleVersionHistory?: () => void;
  isPageSeoOpen?: boolean;
  onTogglePageSeo?: () => void;
  pageId?: Id<"pages">;
  currentUserId?: Id<"users">;
  onDisableCollaboration?: () => void;
  onEnableCollaboration?: () => void;
  collaborationDisabled?: boolean;
}

// DeploymentStatus and DeploymentState types are now in hooks/use-publish.ts

// ---------------------------------------------------------------------------
// 2-step deploy progress (Build → Deploy)
// ---------------------------------------------------------------------------

type StepState = "pending" | "in-progress" | "complete";

interface StepInfo {
  label: string;
  state: StepState;
}

function deriveSteps(
  dep: { buildPhase?: string; status?: string } | null | undefined
): StepInfo[] {
  if (!dep) {
    // POST still in-flight, no record visible yet
    return [
      { label: "build", state: "in-progress" },
      { label: "deploy", state: "pending" },
      { label: "live", state: "pending" },
    ];
  }

  const phases = ["generating", "uploading", "propagating"];
  const idx = dep.buildPhase ? phases.indexOf(dep.buildPhase) : -1;

  return [
    {
      label: "build",
      state: idx > 0 ? "complete" : idx === 0 ? "in-progress" : "complete",
    },
    {
      label: "deploy",
      state: idx >= 1 ? "in-progress" : "pending",
    },
    {
      label: "live",
      state: dep.status === "ready" ? "complete" : "pending",
    },
  ];
}

function DeploySteps({ steps, t }: { steps: StepInfo[]; t: (key: string) => string }) {
  return (
    <div className="flex flex-col gap-3 py-6 px-2">
      {steps.map((step: any, i: number) => (
        <div key={step.label} className="flex items-center gap-3">
          {/* Step circle */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              step.state === "complete"
                ? "bg-[rgba(20,184,166,0.15)]"
                : step.state === "in-progress"
                  ? "bg-[rgba(20,184,166,0.15)]"
                  : "bg-muted"
            }`}
          >
            {step.state === "complete" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8.5L6.5 11.5L12.5 4.5"
                  stroke="#14b8a6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : step.state === "in-progress" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#14b8a6]" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>

          {/* Label */}
          <span
            className={`text-sm font-medium ${
              step.state === "complete"
                ? "text-[#14b8a6]"
                : step.state === "in-progress"
                  ? "text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {step.label === "build"
              ? t("buildStep")
              : step.label === "deploy"
                ? t("deployStep")
                : t("liveStep")}
          </span>

          {/* Connecting line (except last step) */}
          {i < steps.length - 1 && (
            <div className="ml-auto h-px flex-1 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

export function EditorToolbar({
  project,
  page,
  isPreviewOpen,
  onTogglePreview,
  editor,
  onOpenSearch,
  collaboration,
  collaborationGated,
  isCommentsOpen,
  onToggleComments,
  commentCount,
  isSaving,
  branchId,
  branchName,
  isDefaultBranch = true,
  isVersionHistoryOpen,
  onToggleVersionHistory,
  isPageSeoOpen,
  onTogglePageSeo,
  pageId,
  currentUserId,
  onDisableCollaboration,
  onEnableCollaboration,
  collaborationDisabled,
}: EditorToolbarProps) {
  const t = useTranslations("editor.toolbar");
  const tc = useTranslations("common");
  const [publishOpen, setPublishOpen] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [versionMessage, setVersionMessage] = useState("");
  const [publishedHoverOpen, setPublishedHoverOpen] = useState(false);
  const publishedHoverTimer = useRef<NodeJS.Timeout | null>(null);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const createVersion = useMutation(api.pages.createVersion);

  // Publish/deploy state machine (extracted to hook)
  const {
    deployment,
    target,
    setTarget,
    handlePublish,
    resetDeployment,
    isPublishing,
    latestDeployment,
    lastSuccessfulDeployment,
    trackedDeployment,
    unpublishedChanges,
  } = usePublish({ project, branchId });

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update undo/redo state when editor changes
  useEffect(() => {
    if (!editor) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bnEditor = editor as any;
    const stateManager = bnEditor._stateManager;
    const tiptapEditor = bnEditor._tiptapEditor;

    if (!stateManager || !tiptapEditor) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    // Find the UndoManager for Yjs collaboration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let undoManager: any = null;
    const yUndoExtension = bnEditor.getExtension?.("yUndo");
    if (yUndoExtension) {
      const state = tiptapEditor.state;
      for (const plugin of state.plugins) {
        const pluginState = plugin.getState?.(state);
        if (
          pluginState &&
          typeof pluginState === "object" &&
          "undoManager" in pluginState
        ) {
          undoManager = (pluginState as { undoManager: unknown }).undoManager;
          break;
        }
      }
    }

    const updateUndoRedoState = () => {
      try {
        let canUndoResult = false;
        let canRedoResult = false;

        if (undoManager) {
          // For Yjs collaboration, check the UndoManager's stacks directly
          canUndoResult = undoManager.undoStack?.length > 0;
          canRedoResult = undoManager.redoStack?.length > 0;
        } else {
          // Fallback to standard history check for non-collaboration mode
          canUndoResult = stateManager.can(() => bnEditor.undo());
          canRedoResult = stateManager.can(() => bnEditor.redo());
        }

        setCanUndo(canUndoResult);
        setCanRedo(canRedoResult);
      } catch {
        setCanUndo(false);
        setCanRedo(false);
      }
    };

    // Initial state
    updateUndoRedoState();

    // Subscribe to UndoManager events for immediate updates
    if (undoManager) {
      const onStackChange = () => {
        // Use setTimeout to ensure we check after the stack is fully updated
        setTimeout(updateUndoRedoState, 0);
      };
      undoManager.on("stack-item-added", onStackChange);
      undoManager.on("stack-item-popped", onStackChange);

      return () => {
        undoManager.off("stack-item-added", onStackChange);
        undoManager.off("stack-item-popped", onStackChange);
      };
    }

    // Fallback: Subscribe to editor changes via TipTap's event system
    const onUpdate = () => updateUndoRedoState();
    tiptapEditor.on("update", onUpdate);

    return () => {
      tiptapEditor.off("update", onUpdate);
    };
  }, [editor]);

  const handleUndo = useCallback(() => {
    if (!editor) return;
    editor.focus();
    (editor as unknown as { undo: () => void }).undo();
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (!editor) return;
    editor.focus();
    (editor as unknown as { redo: () => void }).redo();
  }, [editor]);

  const handleSaveVersion = useCallback(async () => {
    if (!pageId) return;
    setIsSavingVersion(true);
    try {
      await createVersion({
        pageId,
        createdBy: currentUserId,
        message: versionMessage.trim() || undefined,
      });
      setSaveVersionOpen(false);
      setVersionMessage("");
    } catch (error) {
      console.error("Failed to save version:", error);
    } finally {
      setIsSavingVersion(false);
    }
  }, [pageId, currentUserId, versionMessage, createVersion]);

  // Custom domains — used to show custom domain in publish success modal
  const customDomains = useQuery(api.customDomains.listByProject, {
    projectId: project._id,
  });
  const activeCustomDomain = (customDomains as Array<{ status: string; hostname: string }> | undefined)
    ?.find((d) => d.status === "active")?.hostname;

  // Merge request count
  const openMRCount = useQuery(api.mergeRequests.getOpenCountForProject, {
    projectId: project._id,
  });

  // GitHub connection state (github module is platform-only, may not exist in core)
  const githubApi = (api as Record<string, any>).github;
  const githubConnection = useQuery(
    githubApi?.getConnection ?? ("skip" as any),
    githubApi ? { projectId: project._id } : "skip",
  );
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);

  const handleSyncToGitHub = useCallback(async () => {
    setIsSyncingGitHub(true);
    try {
      await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project._id,
          ...(branchId && { branchId }),
        }),
      });
    } catch (e) {
      console.error("GitHub sync failed:", e);
    } finally {
      setIsSyncingGitHub(false);
    }
  }, [project._id, branchId]);

  // Query all pages for the current branch to find unpublished (draft) pages
  const effectiveBranchId = branchId || project.defaultBranchId;
  const allPages = useQuery(
    api.pages.listByBranch,
    effectiveBranchId ? { branchId: effectiveBranchId } : "skip"
  );
  const unpublishedPages = allPages?.filter((p: any) => !p.isPublished) ?? [];
  const updatePage = useMutation(api.pages.update);
  const [publishingPageIds, setPublishingPageIds] = useState<Set<string>>(
    new Set()
  );

  const handlePublishPage = async (pageId: Id<"pages">) => {
    setPublishingPageIds((prev) => new Set(prev).add(pageId));
    try {
      await updatePage({ pageId, isPublished: true });
    } finally {
      setPublishingPageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  };

  const handlePublishAll = async () => {
    const ids = unpublishedPages.map((p: any) => p._id);
    setPublishingPageIds(new Set(ids));
    try {
      await Promise.all(
        ids.map((id: any) => updatePage({ pageId: id, isPublished: true }))
      );
    } finally {
      setPublishingPageIds(new Set());
    }
  };

  // Derive per-target boolean for the selected target
  const hasChanges = unpublishedChanges
    ? unpublishedChanges[target]
    : undefined;

  // Track when the debounce just finished but the hasChanges query hasn't
  // caught up yet, so we avoid a brief "Published" flash.
  const [recentlySaved, setRecentlySaved] = useState(false);

  useEffect(() => {
    if (isSaving) {
      setRecentlySaved(true);
    }
  }, [isSaving]);

  useEffect(() => {
    if (recentlySaved && !isSaving && hasChanges === true) {
      setRecentlySaved(false);
    }
  }, [recentlySaved, isSaving, hasChanges]);

  // Fallback: clear recentlySaved after 5s in case the edit didn't
  // actually produce a content difference (e.g. type then undo).
  useEffect(() => {
    if (recentlySaved && !isSaving) {
      const timeout = setTimeout(() => setRecentlySaved(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [recentlySaved, isSaving]);

  const showSaving = isSaving || (recentlySaved && hasChanges !== true);

  const displayTarget = target === "production" ? "Production" : "Preview";
  const boldTag = (chunks: ReactNode) => <strong>{chunks}</strong>;

  const renderDialogContent = () => {
    switch (deployment.status) {
      case "publishing":
      case "polling": {
        const steps = deriveSteps(trackedDeployment);
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t("publishingTitle")}</DialogTitle>
              <DialogDescription>
                {t.rich("publishingDescription", {
                  target: displayTarget,
                  bold: boldTag,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center pt-2">
              <AnimatedFlyingMascot className="h-20 w-20" />
            </div>
            <DeploySteps steps={steps} t={t} />
          </>
        );
      }

      case "success": {
        const successUrl =
          target === "production" && productionUrl
            ? productionUrl
            : deployment.url && project.cfSlug
              ? toVanityUrl(deployment.url, project.cfSlug)
              : deployment.url;
        return (
          <>
            <DialogHeader>
              <div className="flex justify-center pb-2">
                <img
                  src="/mascot-success.svg"
                  alt=""
                  className="h-24 w-24"
                  style={{ filter: "drop-shadow(0 4px 12px rgba(20,184,166,0.15))" }}
                />
              </div>
              <DialogTitle className="flex items-center justify-center gap-2 text-teal-500">
                {t("publishedTitle")}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t.rich("publishedDescription", {
                  target: displayTarget,
                  bold: boldTag,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              {successUrl && (
                <a
                  href={successUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-md border bg-muted p-4 text-sm hover:bg-muted/80"
                >
                  {successUrl}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishOpen(false)}>
                {tc("close")}
              </Button>
              {successUrl && (
                <Button asChild>
                  <a
                    href={successUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("openSite")}
                  </a>
                </Button>
              )}
            </DialogFooter>
          </>
        );
      }

      case "error":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                {t("publishFailedTitle")}
              </DialogTitle>
              <DialogDescription>
                {t.rich("publishFailedDescription", {
                  target: displayTarget,
                  bold: boldTag,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {deployment.error || t("publishFailedGenericError")}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishOpen(false)}>
                {tc("close")}
              </Button>
              <Button onClick={resetDeployment}>{t("tryAgain")}</Button>
            </DialogFooter>
          </>
        );

      default: {
        const lastUrl =
          target === "production" && productionUrl
            ? productionUrl
            : latestDeployment?.url;
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t("publishDialogTitle")}</DialogTitle>
              <DialogDescription>
                {t.rich("publishDialogDescription", {
                  target: displayTarget,
                  bold: boldTag,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!isDefaultBranch && branchName && (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {t("publishingFromBranch", { branchName })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("publishingFromBranchWarning")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {latestDeployment && lastUrl && (
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("lastDeployment")}
                  </p>
                  <a
                    href={lastUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {lastUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {unpublishedPages.length > 0 && (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-medium text-foreground">
                        {t("draftPages", { count: unpublishedPages.length })}
                      </p>
                    </div>
                    <button
                      onClick={handlePublishAll}
                      disabled={publishingPageIds.size > 0}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      {t("publishAll")}
                    </button>
                  </div>
                  <p className="px-3 pb-2 text-xs text-muted-foreground">
                    {t("draftPagesWarning")}
                  </p>
                  <div className="max-h-[160px] overflow-y-auto border-t border-amber-500/10">
                    {unpublishedPages.map((draftPage: any) => (
                      <div
                        key={draftPage._id}
                        className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-amber-500/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">
                              {draftPage.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {draftPage.path}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handlePublishPage(draftPage._id)}
                          disabled={publishingPageIds.has(draftPage._id)}
                          className="shrink-0 flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                        >
                          {publishingPageIds.has(draftPage._id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          {t("publish")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={handlePublish}>
                <Rocket className="mr-2 h-4 w-4" />
                {t("publishNow")}
              </Button>
            </DialogFooter>
          </>
        );
      }
    }
  };

  const productionUrl = project.cfSlug
    ? getProductionUrl(project.cfSlug, activeCustomDomain)
    : undefined;
  const deploymentUrl = lastSuccessfulDeployment?.url;
  const viewSiteUrl = target === "production" ? productionUrl : deploymentUrl;
  const hasDeployedSite = lastSuccessfulDeployment && (target === "production" ? productionUrl : deploymentUrl);

  return (
    <div className="relative z-10 flex h-12 items-center justify-between border-b border-[var(--glass-divider)] bg-[var(--surface-bg)] px-3">
      {/* Left: Breadcrumb navigation context */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate max-w-[140px] text-sm font-medium text-[var(--text-bright)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {project.name}
        </span>
        {project.settings?.accessControl?.mode && project.settings.accessControl.mode !== "public" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <Shield className="h-2.5 w-2.5" />
            {t("protected")}
          </span>
        )}
        {!isDefaultBranch && branchName && (
          <>
            <span className="text-xs text-[var(--glass-border)]">/</span>
            <span className="truncate max-w-[100px] text-sm text-[var(--text-dim)]">
              {branchName}
            </span>
          </>
        )}
        {page && (
          <>
            <span className="text-xs text-[var(--glass-border)]">/</span>
            <span className="truncate max-w-[160px] text-sm text-[var(--text-dim)]">
              {page.title}
            </span>
            {page.isPublished ? (
              <span className="shrink-0 ml-1.5 inline-flex items-center rounded-full border border-primary/20 bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t("published")}
              </span>
            ) : (
              <span className="shrink-0 ml-1.5 inline-flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--surface-active)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-dim)]">
                {t("draft")}
              </span>
            )}
          </>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-0.5">
        {/* Group 1: Editing actions (undo/redo/search) */}
        {editor && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] disabled:opacity-30"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("undoTooltip")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] disabled:opacity-30"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("redoTooltip")}</TooltipContent>
            </Tooltip>
          </>
        )}
        {onOpenSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                onClick={onOpenSearch}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("searchTooltip")}</TooltipContent>
          </Tooltip>
        )}

        {/* Divider */}
        <div className="mx-1.5 h-5 w-px bg-[var(--glass-border)]" />

        {/* Group 2: Collaboration (conditional on multi-tenant mode) */}
        <ToolbarCollaboration
          collaboration={collaboration}
          collaborationGated={collaborationGated}
          onDisableCollaboration={onDisableCollaboration}
          onEnableCollaboration={onEnableCollaboration}
          collaborationDisabled={collaborationDisabled}
        />

        {/* Group 3: View toggles (icon-only) */}
        {onTogglePageSeo && pageId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isPageSeoOpen
                    ? "bg-primary/12 text-primary"
                    : "text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                }`}
                onClick={onTogglePageSeo}
                aria-label="Toggle page SEO"
              >
                <TextSearch className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("pageSeoTooltip")}</TooltipContent>
          </Tooltip>
        )}
        {onToggleVersionHistory && pageId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isVersionHistoryOpen
                    ? "bg-primary/12 text-primary"
                    : "text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                }`}
                onClick={onToggleVersionHistory}
                aria-label="Toggle version history"
              >
                <History className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("versionHistoryTooltip")}</TooltipContent>
          </Tooltip>
        )}
        {onToggleComments && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isCommentsOpen
                    ? "bg-primary/12 text-primary"
                    : "text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                }`}
                onClick={onToggleComments}
                aria-label="Toggle comments"
              >
                <MessageSquare className="h-4 w-4" />
                {commentCount !== undefined && commentCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {commentCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {commentCount ? t("commentsCount", { count: commentCount }) : t("commentsTooltip")}
            </TooltipContent>
          </Tooltip>
        )}
        {onTogglePreview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isPreviewOpen
                    ? "bg-primary/12 text-primary"
                    : "text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                }`}
                onClick={onTogglePreview}
                aria-label="Toggle preview"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isPreviewOpen ? t("closePreview") : t("preview")}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Open deployed site shortcut */}
        {hasDeployedSite && viewSiteUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                onClick={() => window.open(viewSiteUrl, "_blank")}
                aria-label="Open deployed site"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("openDeployedSite")}</TooltipContent>
          </Tooltip>
        )}

        {/* Group 4: Overflow menu (settings, view site) */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("moreOptions")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            {hasDeployedSite && viewSiteUrl && (
              <>
                <DropdownMenuItem asChild>
                  <a
                    href={viewSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("viewPublishedSite")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {pageId && (
              <>
                <DropdownMenuItem
                  onClick={() => setSaveVersionOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {t("saveVersion")}
                </DropdownMenuItem>
                {page && (
                  <DropdownMenuItem
                    onClick={() => setReactionsOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {t("readerReactions")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link
                href={`/projects/${project._id}/generate`}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t("generateWithAI")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={`/projects/${project._id}/merge-requests`}
                className="flex items-center gap-2"
              >
                <GitPullRequest className="h-4 w-4" />
                {t("mergeRequests")}
                {openMRCount !== undefined && openMRCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                    {openMRCount}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {githubConnection && (
              <>
                <DropdownMenuItem
                  onClick={handleSyncToGitHub}
                  disabled={isSyncingGitHub}
                  className="flex items-center gap-2"
                >
                  {isSyncingGitHub ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                  {t("syncToGitHub")}
                  {githubConnection.lastPushedAt && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(
                        githubConnection.lastPushedAt
                      ).toLocaleDateString()}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link
                href={`/projects/${project._id}/settings`}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {t("projectSettings")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider before primary action */}
        <div className="mx-1.5 h-5 w-px bg-[var(--glass-border)]" />

        {/* Group 5: Target selector + Publish */}
        <div className="flex h-8 items-center rounded-lg border border-[var(--glass-divider)] bg-[var(--surface-active)] p-0.5">
          <button
            className={`flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all ${
              target === "preview"
                ? "bg-[var(--glass-hover)] text-[var(--text-bright)]"
                : "text-[var(--text-dim)]"
            }`}
            onClick={() => setTarget("preview")}
          >
            {t("previewTarget")}
            {unpublishedChanges && !unpublishedChanges.preview && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
            )}
          </button>
          <button
            className={`flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all disabled:opacity-30 ${
              target === "production"
                ? "bg-[var(--glass-hover)] text-[var(--text-bright)]"
                : "text-[var(--text-dim)]"
            }`}
            onClick={() => setTarget("production")}
            disabled={!isDefaultBranch}
          >
            {t("productionTarget")}
            {unpublishedChanges &&
              !unpublishedChanges.production &&
              isDefaultBranch && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
              )}
          </button>
        </div>
        <Dialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
        >
          <Popover open={publishedHoverOpen} onOpenChange={setPublishedHoverOpen}>
            <PopoverTrigger asChild>
              <span
                className="inline-flex"
                onMouseEnter={() => {
                  if (publishedHoverTimer.current) {
                    clearTimeout(publishedHoverTimer.current);
                    publishedHoverTimer.current = null;
                  }
                  if (hasChanges === false && !showSaving && !isPublishing) {
                    setPublishedHoverOpen(true);
                  }
                }}
                onMouseLeave={() => {
                  publishedHoverTimer.current = setTimeout(() => setPublishedHoverOpen(false), 200);
                }}
              >
                <DialogTrigger asChild>
                  <button
                    className={`ml-1 flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                      hasChanges === false || showSaving || isPublishing
                        ? "bg-primary/15 text-primary/60"
                        : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(20,184,166,0.2)]"
                    }`}
                    disabled={hasChanges === false || showSaving || isPublishing}
                    onClick={() => {
                      // Reset deployment state to idle before the dialog opens so the
                      // user always sees the target-selector view instead of a stale
                      // success/error screen from a prior deployment.
                      if (
                        deployment.status !== "polling" &&
                        deployment.status !== "publishing"
                      ) {
                        resetDeployment();
                      }
                    }}
                  >
                    {showSaving || isPublishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5" />
                    )}
                    {showSaving
                      ? t("saving")
                      : isPublishing
                        ? t("publishing")
                        : hasChanges === false
                          ? t("published")
                          : t("publish")}
                  </button>
                </DialogTrigger>
              </span>
            </PopoverTrigger>
            {hasChanges === false && !showSaving && !isPublishing && (
              <PopoverContent
                side="bottom"
                align="end"
                className="w-auto max-w-56 px-3 py-2"
                onMouseEnter={() => {
                  if (publishedHoverTimer.current) {
                    clearTimeout(publishedHoverTimer.current);
                    publishedHoverTimer.current = null;
                  }
                }}
                onMouseLeave={() => setPublishedHoverOpen(false)}
              >
                <p className="text-xs text-muted-foreground">
                  {t("publishedUpToDate")}
                </p>
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:outline-none"
                  onClick={() => {
                    setPublishedHoverOpen(false);
                    resetDeployment();
                    setPublishOpen(true);
                  }}
                >
                  {t("publishAnyway")} →
                </button>
              </PopoverContent>
            )}
          </Popover>
          <DialogContent>{renderDialogContent()}</DialogContent>
        </Dialog>
      </div>

      {/* Reader Reactions Modal */}
      {page && (
        <ReaderReactionsModal
          open={reactionsOpen}
          onOpenChange={setReactionsOpen}
          projectId={project._id}
          pageSlug={page.slug}
          pageTitle={page.title}
        />
      )}

      {/* Save Version Dialog */}
      <Dialog
        open={saveVersionOpen}
        onOpenChange={(open) => {
          setSaveVersionOpen(open);
          if (!open) setVersionMessage("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("saveVersionTitle")}</DialogTitle>
            <DialogDescription>
              {t("saveVersionDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="version-message" className="text-sm font-medium">
              {t("versionNoteLabel")}
            </Label>
            <Input
              id="version-message"
              placeholder={t("versionNotePlaceholder")}
              value={versionMessage}
              onChange={(e) => setVersionMessage(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSavingVersion) {
                  handleSaveVersion();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveVersionOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSaveVersion} disabled={isSavingVersion}>
              {isSavingVersion ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("saveVersion")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
