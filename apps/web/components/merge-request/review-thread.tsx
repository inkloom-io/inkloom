"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@inkloom/ui/button";
import { Badge } from "@inkloom/ui/badge";
import { cn } from "@inkloom/ui/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ReplyForm } from "./review-comment-form";
import { wordDiff } from "@/lib/diff-engine";

// ── Types ─────────────────────────────────────────────────────────────────

/** Shape of enriched thread from listThreadsByPage / listThreadsByMR. */
export interface ReviewThreadData {
  _id: Id<"mrReviewThreads">;
  mergeRequestId: Id<"mergeRequests">;
  pagePath: string;
  blockId: string;
  blockIndex: number;
  quotedContent?: string;
  threadType: "comment" | "suggestion";
  suggestedContent?: string;
  suggestionStatus?: "pending" | "accepted" | "dismissed";
  status: "open" | "resolved";
  resolvedBy?: Id<"users">;
  resolvedAt?: number;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  creator: {
    id: Id<"users">;
    name: string;
    avatarUrl?: string;
  } | null;
  comments: ReviewCommentData[];
  commentCount: number;
}

export interface ReviewCommentData {
  _id: Id<"mrReviewComments">;
  threadId: Id<"mrReviewThreads">;
  content: string;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  isEdited: boolean;
  user: {
    id: Id<"users">;
    name: string;
    avatarUrl?: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function UserAvatar({
  user,
  size = "sm",
}: {
  user: { name: string; avatarUrl?: string } | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={cn(dim, "flex-shrink-0 rounded-full object-cover")}
      />
    );
  }

  const initials = user
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div
      className={cn(
        dim,
        textSize,
        "flex flex-shrink-0 items-center justify-center rounded-full bg-muted font-medium"
      )}
    >
      {initials}
    </div>
  );
}

// ── Suggestion Diff Display ───────────────────────────────────────────────

export function SuggestionDiff({
  original,
  suggested,
}: {
  original?: string;
  suggested?: string;
}) {
  if (!original && !suggested) return null;

  const diffOps =
    original && suggested ? wordDiff(original, suggested) : undefined;

  return (
    <div className="rounded-md border border-[var(--glass-border)] overflow-hidden text-xs font-mono">
      {original && (
        <div className="bg-red-500/5 border-b border-[var(--glass-border)] px-3 py-1.5">
          <span className="text-red-600 dark:text-red-400 select-none mr-2">
            −
          </span>
          <span className="text-red-800 dark:text-red-200">
            {diffOps
              ? diffOps
                  .filter((op) => op.type !== "insert")
                  .map((op, i) =>
                    op.type === "delete" ? (
                      <span
                        key={i}
                        className="bg-red-500/30 rounded-sm px-0.5"
                      >
                        {op.text}
                      </span>
                    ) : (
                      <span key={i}>{op.text}</span>
                    )
                  )
              : original}
          </span>
        </div>
      )}
      {suggested && (
        <div className="bg-emerald-500/5 px-3 py-1.5">
          <span className="text-emerald-600 dark:text-emerald-400 select-none mr-2">
            +
          </span>
          <span className="text-emerald-800 dark:text-emerald-200">
            {diffOps
              ? diffOps
                  .filter((op) => op.type !== "delete")
                  .map((op, i) =>
                    op.type === "insert" ? (
                      <span
                        key={i}
                        className="bg-emerald-500/30 rounded-sm px-0.5"
                      >
                        {op.text}
                      </span>
                    ) : (
                      <span key={i}>{op.text}</span>
                    )
                  )
              : suggested}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Individual Comment ────────────────────────────────────────────────────

function CommentItem({ comment }: { comment: ReviewCommentData }) {
  return (
    <div className="flex gap-2">
      <UserAvatar user={comment.user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-[var(--text-bright)] truncate">
            {comment.user?.name ?? "Unknown"}
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-[10px] text-[var(--text-dim)] italic">
              (edited)
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-medium)] mt-0.5 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

// ── Thread Component ──────────────────────────────────────────────────────

interface ReviewThreadProps {
  thread: ReviewThreadData;
  /** Whether this user can resolve/accept (MR creator or admin). */
  canManage?: boolean;
  /** When true, skip the collapsed state (used inside ResolvedThreadGroup). */
  forceExpanded?: boolean;
}

export function ReviewThread({ thread, canManage = false, forceExpanded }: ReviewThreadProps) {
  const { userId } = useAuth();

  const resolveThread = useMutation(api.mrReviews.resolveThread);
  const unresolveThread = useMutation(api.mrReviews.unresolveThread);
  const acceptSuggestion = useMutation(api.mrReviews.acceptSuggestion);
  const dismissSuggestion = useMutation(api.mrReviews.dismissSuggestion);

  const [isResolving, setIsResolving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const isResolved = thread.status === "resolved";
  const isSuggestion = thread.threadType === "suggestion";
  const isPendingSuggestion =
    isSuggestion && thread.suggestionStatus === "pending";
  const isAcceptedSuggestion =
    isSuggestion && thread.suggestionStatus === "accepted";
  const isDismissedSuggestion =
    isSuggestion && thread.suggestionStatus === "dismissed";

  const handleResolve = useCallback(async () => {
    if (!userId) return;
    setIsResolving(true);
    try {
      await resolveThread({ threadId: thread._id, userId });
    } catch {
      // ignore
    } finally {
      setIsResolving(false);
    }
  }, [userId, thread._id, resolveThread]);

  const handleUnresolve = useCallback(async () => {
    setIsResolving(true);
    try {
      await unresolveThread({ threadId: thread._id });
    } catch {
      // ignore
    } finally {
      setIsResolving(false);
    }
  }, [thread._id, unresolveThread]);

  const handleAccept = useCallback(async () => {
    if (!userId) return;
    setIsAccepting(true);
    try {
      await acceptSuggestion({ threadId: thread._id, userId });
    } catch {
      // ignore
    } finally {
      setIsAccepting(false);
    }
  }, [userId, thread._id, acceptSuggestion]);

  const handleDismiss = useCallback(async () => {
    if (!userId) return;
    setIsDismissing(true);
    try {
      await dismissSuggestion({ threadId: thread._id, userId });
    } catch {
      // ignore
    } finally {
      setIsDismissing(false);
    }
  }, [userId, thread._id, dismissSuggestion]);

  return (
    <ReviewThreadView
      thread={thread}
      isResolved={isResolved}
      isSuggestion={isSuggestion}
      isPendingSuggestion={isPendingSuggestion}
      isAcceptedSuggestion={isAcceptedSuggestion}
      isDismissedSuggestion={isDismissedSuggestion}
      canManage={canManage}
      forceExpanded={forceExpanded}
      isResolving={isResolving}
      isAccepting={isAccepting}
      isDismissing={isDismissing}
      onResolve={handleResolve}
      onUnresolve={handleUnresolve}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
    />
  );
}

// ── Thread View (pure render) ─────────────────────────────────────────────

function ReviewThreadView({
  thread,
  isResolved,
  isSuggestion,
  isPendingSuggestion,
  isAcceptedSuggestion,
  isDismissedSuggestion,
  canManage,
  forceExpanded,
  isResolving,
  isAccepting,
  isDismissing,
  onResolve,
  onUnresolve,
  onAccept,
  onDismiss,
}: {
  thread: ReviewThreadData;
  isResolved: boolean;
  isSuggestion: boolean;
  isPendingSuggestion: boolean;
  isAcceptedSuggestion: boolean;
  isDismissedSuggestion: boolean;
  canManage: boolean;
  forceExpanded?: boolean;
  isResolving: boolean;
  isAccepting: boolean;
  isDismissing: boolean;
  onResolve: () => void;
  onUnresolve: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("mergeRequests.review");
  const [isExpanded, setIsExpanded] = useState(!isResolved || !!forceExpanded);

  // Resolved threads collapse to a single line (skip when forceExpanded)
  if (isResolved && !isExpanded && !forceExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--glass-border)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-dim)] hover:bg-[var(--surface-active)] transition-colors"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <ChevronRight className="h-3 w-3" />
        <span>
          {isSuggestion ? t("resolvedSuggestion") : t("resolvedComment")}
        </span>
        {isAcceptedSuggestion && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {t("changesApplied")}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        isResolved
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-[var(--glass-border)] bg-[var(--surface-bg)]"
      )}
    >
      {/* Thread header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--glass-divider)]">
        {isSuggestion ? (
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="text-xs font-medium text-[var(--text-medium)]">
          {isSuggestion ? t("suggestion") : t("comment")}
        </span>

        {/* Status badges */}
        {isAcceptedSuggestion && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3 mr-0.5" />
            {t("changesApplied")}
          </Badge>
        )}
        {isDismissedSuggestion && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {t("dismissed")}
          </Badge>
        )}
        {isResolved && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {t("resolved")}
          </Badge>
        )}

        <div className="flex-1" />

        {/* Collapse button for resolved threads */}
        {isResolved && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-0.5 rounded hover:bg-[var(--surface-active)] text-[var(--text-dim)]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Suggestion diff */}
      {isSuggestion && (thread.quotedContent || thread.suggestedContent) && (
        <div className="px-3 pt-3">
          <SuggestionDiff
            original={thread.quotedContent}
            suggested={thread.suggestedContent}
          />
        </div>
      )}

      {/* Comments */}
      <div className="p-3 space-y-3">
        {thread.comments.map((comment) => (
          <CommentItem key={comment._id} comment={comment} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {/* Suggestion actions */}
        {isPendingSuggestion && canManage && (
          <>
            <Button
              size="sm"
              variant="default"
              onClick={onAccept}
              disabled={isAccepting}
              className="h-7 text-xs"
            >
              {isAccepting && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              <Check className="mr-1 h-3 w-3" />
              {t("acceptSuggestion")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={isDismissing}
              className="h-7 text-xs"
            >
              {isDismissing && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              <X className="mr-1 h-3 w-3" />
              {t("dismissSuggestion")}
            </Button>
          </>
        )}

        {/* Resolve / Unresolve */}
        {canManage && !isResolved && !isPendingSuggestion && (
          <Button
            size="sm"
            variant="outline"
            onClick={onResolve}
            disabled={isResolving}
            className="h-7 text-xs"
          >
            {isResolving && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t("resolve")}
          </Button>
        )}
        {canManage && isResolved && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onUnresolve}
            disabled={isResolving}
            className="h-7 text-xs"
          >
            {isResolving && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            {t("unresolve")}
          </Button>
        )}
      </div>

      {/* Reply form — only for open threads */}
      {!isResolved && (
        <div className="px-3 pb-3">
          <ReplyForm threadId={thread._id} />
        </div>
      )}
    </div>
  );
}

// ── Resolved Thread Group ─────────────────────────────────────────────────

interface ResolvedThreadGroupProps {
  threads: ReviewThreadData[];
  canManage?: boolean;
}

/**
 * Shows resolved threads as a collapsed group: "N resolved comments (expandable)"
 */
export function ResolvedThreadGroup({
  threads,
  canManage,
}: ResolvedThreadGroupProps) {
  const t = useTranslations("mergeRequests.review");
  const [isExpanded, setIsExpanded] = useState(false);

  if (threads.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--glass-border)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-dim)] hover:bg-[var(--surface-active)] transition-colors"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>
          {t("resolvedComments", { count: threads.length })}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 pl-2">
          {threads.map((thread) => (
            <ReviewThread
              key={thread._id}
              thread={thread}
              canManage={canManage}
              forceExpanded
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Thread Resolution Counter ─────────────────────────────────────────

interface ThreadResolutionCounterProps {
  mergeRequestId: Id<"mergeRequests">;
  pagePath?: string;
}

export function ThreadResolutionCounter({
  mergeRequestId,
  pagePath,
}: ThreadResolutionCounterProps) {
  const t = useTranslations("mergeRequests.review");

  // Use page-specific or MR-wide query based on whether pagePath is provided
  const pageThreads = useQuery(
    api.mrReviews.listThreadsByPage,
    pagePath ? { mergeRequestId, pagePath } : "skip"
  );
  const mrThreads = useQuery(
    api.mrReviews.listThreadsByMR,
    pagePath ? "skip" : { mergeRequestId }
  );

  const threads = pagePath ? pageThreads : mrThreads;

  if (!threads || threads.length === 0) return null;

  const resolved = threads.filter(
    (th: { status: string }) => th.status === "resolved"
  ).length;
  const total = threads.length;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        resolved === total
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400"
      )}
    >
      <MessageSquare className="h-3 w-3" />
      {t("resolvedCount", { resolved, total })}
    </span>
  );
}

// ── Page Thread List ──────────────────────────────────────────────────

interface PageThreadListProps {
  mergeRequestId: Id<"mergeRequests">;
  pagePath: string;
}

export function PageThreadList({
  mergeRequestId,
  pagePath,
}: PageThreadListProps) {
  const { userId } = useAuth();
  const threads = useQuery(api.mrReviews.listThreadsByPage, {
    mergeRequestId,
    pagePath,
  });

  // Any authenticated user can manage threads (server-side mutations
  // enforce ownership rules for destructive operations).
  const canManage = !!userId;

  if (!threads || threads.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {(threads as ReviewThreadData[]).map((thread) => (
        <ReviewThread
          key={thread._id}
          thread={thread}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
