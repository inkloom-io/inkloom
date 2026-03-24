"use client";

import { use, useState, useCallback, lazy, Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@inkloom/ui/button";
import { Badge } from "@inkloom/ui/badge";
import { Textarea } from "@inkloom/ui/textarea";
import { Separator } from "@inkloom/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@inkloom/ui/dialog";
import { cn } from "@inkloom/ui/lib/utils";
import { getRelativeTimeKeyAndParams } from "@/lib/date-utils";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  ArrowRight,
  Loader2,
  MessageSquare,
  FileCode,
  GitMerge,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { SubmitReviewDialog } from "@/components/merge-request/submit-review-dialog";
import {
  ReviewStatusBadges,
  MergeReviewWarning,
} from "@/components/merge-request/review-status-badges";
import { ActivityTimeline } from "@/components/merge-request/activity-timeline";
import type { ReviewThread } from "@/components/merge-request/review-thread-card";

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("mergeRequests.detail");
  switch (status) {
    case "open":
      return (
        <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t("statusOpen")}
        </Badge>
      );
    case "merged":
      return (
        <Badge className="border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          {t("statusMerged")}
        </Badge>
      );
    case "closed":
      return <Badge variant="secondary">{t("statusClosed")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────

interface MergeRequestDetailPageProps {
  params: Promise<{ projectId: string; mrId: string }>;
}

export default function MergeRequestDetailPage(
  props: MergeRequestDetailPageProps
) {
  const { projectId, mrId } = use(
    props.params as Promise<{ projectId: string; mrId: string }>
  );

  const { userId } = useAuth();

  const t = useTranslations("mergeRequests.detail");
  const tc = useTranslations("common");

  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }

  const mr = useQuery(api.mergeRequests.get, {
    mergeRequestId: mrId as Id<"mergeRequests">,
  });

  const comments = useQuery(api.mergeRequests.listComments, {
    mergeRequestId: mrId as Id<"mergeRequests">,
  });

  const mergeMutation = useMutation(api.mergeRequests.merge);
  const closeMutation = useMutation(api.mergeRequests.close);
  const reopenMutation = useMutation(api.mergeRequests.reopen);
  const updateMutation = useMutation(api.mergeRequests.update);
  const addCommentMutation = useMutation(api.mergeRequests.addComment);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "changes">(
    "overview"
  );

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteSourceBranch, setDeleteSourceBranch] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  // Action states
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleMerge = useCallback(async () => {
    if (!userId) return;
    setIsMerging(true);
    try {
      await mergeMutation({
        mergeRequestId: mrId as Id<"mergeRequests">,
        mergedBy: userId,
        deleteSourceBranch,
      });
      trackEvent("merge_request_merged", { projectId });
      setMergeDialogOpen(false);
    } catch (error) {
      console.error("Failed to merge:", error);
    } finally {
      setIsMerging(false);
    }
  }, [userId, mergeMutation, mrId, deleteSourceBranch]);

  const handleClose = useCallback(async () => {
    if (!userId) return;
    setIsClosing(true);
    try {
      await closeMutation({
        mergeRequestId: mrId as Id<"mergeRequests">,
        closedBy: userId,
      });
    } catch (error) {
      console.error("Failed to close:", error);
    } finally {
      setIsClosing(false);
    }
  }, [userId, closeMutation, mrId]);

  const handleReopen = useCallback(async () => {
    setIsReopening(true);
    try {
      await reopenMutation({
        mergeRequestId: mrId as Id<"mergeRequests">,
      });
    } catch (error) {
      console.error("Failed to reopen:", error);
    } finally {
      setIsReopening(false);
    }
  }, [reopenMutation, mrId]);

  const handleTitleSave = useCallback(async () => {
    if (!editedTitle.trim() || editedTitle.trim() === mr?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateMutation({
        mergeRequestId: mrId as Id<"mergeRequests">,
        title: editedTitle.trim(),
      });
    } catch (error) {
      console.error("Failed to update title:", error);
    }
    setIsEditingTitle(false);
  }, [editedTitle, mr?.title, updateMutation, mrId]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !userId) return;
    setIsSubmittingComment(true);
    try {
      await addCommentMutation({
        mergeRequestId: mrId as Id<"mergeRequests">,
        content: commentText.trim(),
        createdBy: userId,
      });
      setCommentText("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, userId, addCommentMutation, mrId]);

  // ── Loading / Not Found ──────────────────────────────────────────────

  if (mr === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mr === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}/merge-requests`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToMergeRequests")}
          </Link>
        </Button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Link
          href={`/projects/${projectId}/merge-requests`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToMergeRequests")}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            {/* Title */}
            <div className="flex items-center gap-3">
              {isEditingTitle ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                    autoFocus
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button size="sm" onClick={handleTitleSave}>
                    {t("saveButton")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingTitle(false)}
                  >
                    {t("cancelButton")}
                  </Button>
                </div>
              ) : (
                <h1
                  className="text-2xl font-bold cursor-pointer hover:text-muted-foreground transition-colors"
                  onClick={() => {
                    if (mr.status === "open") {
                      setEditedTitle(mr.title);
                      setIsEditingTitle(true);
                    }
                  }}
                  title={mr.status === "open" ? t("clickToEditTitle") : undefined}
                >
                  {mr.title}
                </h1>
              )}
              <StatusBadge status={mr.status} />
              <ReviewStatusBadges
                mergeRequestId={mrId as Id<"mergeRequests">}
                reviewStatus={mr.reviewStatus}
              />
            </div>

            {/* Branch info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">
                {mr.sourceBranchName}
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">
                {mr.targetBranchName}
              </span>
            </div>

            {/* Meta line */}
            <p className="text-sm text-muted-foreground">
              {t("openedBy", { name: mr.creator?.name ?? mr.creator?.email ?? t("unknownUser"), timeAgo: relTime(mr.createdAt) })}
              {mr.status === "merged" && mr.mergedAt && (
                <span>
                  {" "}
                  &middot; {t("mergedBy", { name: mr.mergedByUser?.name ?? mr.mergedByUser?.email ?? t("unknownUser"), timeAgo: relTime(mr.mergedAt) })}
                </span>
              )}
              {mr.status === "closed" && mr.closedAt && (
                <span>
                  {" "}
                  &middot; {t("closedBy", { name: mr.closedByUser?.name ?? mr.closedByUser?.email ?? t("unknownUser"), timeAgo: relTime(mr.closedAt) })}
                </span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {mr.githubPrUrl && (
              <a
                href={mr.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1.5 hover:bg-muted"
                >
                  {t("githubPr", { number: mr.githubPrNumber ?? 0 })}
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </a>
            )}

            {mr.status === "open" && userId && (
              <>
                <SubmitReviewDialog
                  mergeRequestId={mrId as Id<"mergeRequests">}
                  userId={userId}
                  mrStatus={mr.status}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isClosing || !userId}
                >
                  {isClosing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t("closeButton")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDeleteSourceBranch(false);
                    setMergeDialogOpen(true);
                  }}
                  disabled={!userId}
                >
                  <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                  {t("mergeButton")}
                </Button>
              </>
            )}

            {mr.status === "closed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopen}
                disabled={isReopening || !userId}
              >
                {isReopening ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("reopenButton")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex gap-6 border-b">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "overview"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("overview")}
          >
            <MessageSquare className="h-4 w-4" />
            {t("overviewTab")}
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "changes"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("changes")}
          >
            <FileCode className="h-4 w-4" />
            {t("changesTab")}
            {mr.diffSummary && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {mr.diffSummary.pagesAdded +
                  mr.diffSummary.pagesRemoved +
                  mr.diffSummary.pagesModified}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────── */}
        <div className="pt-6">
          {activeTab === "overview" && (
            <OverviewTab
              mergeRequestId={mrId as Id<"mergeRequests">}
              mr={mr}
              comments={comments ?? []}
              commentText={commentText}
              onCommentTextChange={setCommentText}
              onSubmitComment={handleAddComment}
              isSubmittingComment={isSubmittingComment}
              userId={userId}
              onSwitchToChangesTab={(_thread: ReviewThread) => setActiveTab("changes")}
            />
          )}

          {activeTab === "changes" && (
            <ChangesTab
              sourceBranchId={mr.sourceBranchId}
              targetBranchId={mr.targetBranchId}
              mergeRequestId={mrId as Id<"mergeRequests">}
            />
          )}
        </div>
      </div>

      {/* ── Merge Dialog ──────────────────────────────────────────────── */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmMergeTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmMergeDescription", { source: mr.sourceBranchName, target: mr.targetBranchName })}
            </DialogDescription>
          </DialogHeader>

          <MergeReviewWarning mergeRequestId={mrId as Id<"mergeRequests">} />

          <div className="py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteSourceBranch}
                onChange={(e) => setDeleteSourceBranch(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm">
                {t("deleteSourceBranch")}
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(false)}
              disabled={isMerging}
            >
              {t("cancelButton")}
            </Button>
            <Button onClick={handleMerge} disabled={isMerging}>
              {isMerging ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("merging")}
                </>
              ) : (
                <>
                  <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                  {t("confirmMergeButton")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────

interface OverviewTabProps {
  mergeRequestId: Id<"mergeRequests">;
  mr: {
    description?: string;
    createdAt: number;
    status: string;
    mergedAt?: number;
    closedAt?: number;
    creator: { name?: string; avatarUrl?: string } | null;
    mergedByUser?: { name?: string; avatarUrl?: string } | null;
    closedByUser?: { name?: string; avatarUrl?: string } | null;
  };
  comments: Array<{
    _id: Id<"mergeRequestComments">;
    content: string;
    createdAt: number;
    creator: { name?: string; avatarUrl?: string } | null;
  }>;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  isSubmittingComment: boolean;
  userId: Id<"users"> | undefined;
  onSwitchToChangesTab?: (thread: ReviewThread) => void;
}

function OverviewTab({
  mergeRequestId,
  mr,
  comments,
  commentText,
  onCommentTextChange,
  onSubmitComment,
  isSubmittingComment,
  userId,
  onSwitchToChangesTab,
}: OverviewTabProps) {
  const t = useTranslations("mergeRequests.detail");
  const tc = useTranslations("common");
  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }
  return (
    <div className="space-y-6">
      {/* Description */}
      {mr.description && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {t("descriptionHeading")}
          </h3>
          <p className="text-sm whitespace-pre-wrap">{mr.description}</p>
        </div>
      )}

      {/* Unified Activity Timeline */}
      <ActivityTimeline
        mergeRequestId={mergeRequestId}
        mr={mr}
        comments={comments}
        userId={userId}
        relTime={relTime}
        onNavigateToThread={onSwitchToChangesTab}
      />

      {/* Add comment form */}
      <Separator />
      <div className="space-y-3">
        <Textarea
          placeholder={t("commentPlaceholder")}
          value={commentText}
          onChange={(e) => onCommentTextChange(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmitComment();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {t("submitHint")}
          </span>
          <Button
            size="sm"
            onClick={onSubmitComment}
            disabled={!commentText.trim() || isSubmittingComment || !userId}
          >
            {isSubmittingComment ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t("commentButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Changes Tab ──────────────────────────────────────────────────────────

const LazyDiffView = lazy(() =>
  import("@/components/merge-request/diff-view").then((mod) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (mod as any).DiffView ?? (mod as any).default,
  }))
) as React.LazyExoticComponent<React.ComponentType<any>>;

interface ChangesTabProps {
  sourceBranchId: Id<"branches">;
  targetBranchId: Id<"branches">;
  mergeRequestId: Id<"mergeRequests">;
}

function ChangesTab({
  sourceBranchId,
  targetBranchId,
  mergeRequestId,
}: ChangesTabProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LazyDiffView
        sourceBranchId={sourceBranchId}
        targetBranchId={targetBranchId}
        mergeRequestId={mergeRequestId}
      />
    </Suspense>
  );
}
