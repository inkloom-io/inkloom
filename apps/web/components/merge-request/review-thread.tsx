"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Textarea } from "@inkloom/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@inkloom/ui/avatar";
import { cn } from "@inkloom/ui/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getRelativeTimeKeyAndParams } from "@/lib/date-utils";

// ── Types ─────────────────────────────────────────────────────────────

interface ThreadComment {
  _id: Id<"mrReviewComments">;
  content: string;
  createdAt: number;
  isEdited: boolean;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  } | null;
}

interface ReviewThreadData {
  _id: Id<"mrReviewThreads">;
  mergeRequestId: Id<"mergeRequests">;
  pagePath: string;
  blockId: string;
  blockIndex: number;
  threadType: "comment" | "suggestion";
  quotedContent?: string;
  suggestedContent?: string;
  suggestionStatus?: "pending" | "accepted" | "dismissed";
  status: "open" | "resolved";
  resolvedBy?: Id<"users">;
  resolvedAt?: number;
  createdBy: Id<"users">;
  createdAt: number;
  creator: {
    id: string;
    name: string;
    avatarUrl?: string;
  } | null;
  comments: ThreadComment[];
  commentCount: number;
}

interface ReviewThreadProps {
  thread: ReviewThreadData;
  userId?: Id<"users">;
  mrCreatorId?: Id<"users">;
  isAdmin?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Thread Component ──────────────────────────────────────────────────

export function ReviewThread({
  thread,
  userId,
  mrCreatorId,
  isAdmin,
}: ReviewThreadProps) {
  const t = useTranslations("mergeRequests.reviewThread");
  const tc = useTranslations("common");

  const [isExpanded, setIsExpanded] = useState(thread.status === "open");
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const resolveThread = useMutation(api.mrReviews.resolveThread);
  const unresolveThread = useMutation(api.mrReviews.unresolveThread);
  const addComment = useMutation(api.mrReviews.addComment);

  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }

  // Permission: can current user resolve this thread?
  const canResolve = (() => {
    if (!userId) return false;
    // MR creator can resolve any thread
    if (mrCreatorId && userId === mrCreatorId) return true;
    // Admin can resolve any thread
    if (isAdmin) return true;
    // Thread creator can resolve their own thread
    if (thread.createdBy === userId) return true;
    // Thread participants can resolve
    const isParticipant = thread.comments.some(
      (c) => c.user && c.user.id === userId
    );
    return isParticipant;
  })();

  const handleResolve = useCallback(async () => {
    if (!userId) return;
    setIsResolving(true);
    try {
      await resolveThread({
        threadId: thread._id,
        userId,
      });
    } catch (error) {
      console.error("Failed to resolve thread:", error);
    } finally {
      setIsResolving(false);
    }
  }, [userId, resolveThread, thread._id]);

  const handleUnresolve = useCallback(async () => {
    if (!userId) return;
    setIsResolving(true);
    try {
      await unresolveThread({
        threadId: thread._id,
      });
    } catch (error) {
      console.error("Failed to unresolve thread:", error);
    } finally {
      setIsResolving(false);
    }
  }, [userId, unresolveThread, thread._id]);

  const handleAddReply = useCallback(async () => {
    if (!replyText.trim() || !userId) return;
    setIsSubmittingReply(true);
    try {
      await addComment({
        threadId: thread._id,
        content: replyText.trim(),
        userId,
      });
      setReplyText("");
    } catch (error) {
      console.error("Failed to add reply:", error);
    } finally {
      setIsSubmittingReply(false);
    }
  }, [replyText, userId, addComment, thread._id]);

  const isResolved = thread.status === "resolved";

  // Resolved collapsed state
  if (isResolved && !isExpanded) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-[var(--glass-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-muted-foreground flex-1">
          {t("resolvedClickToExpand")}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border overflow-hidden",
        isResolved
          ? "border-[var(--glass-border)] bg-zinc-50/50 dark:bg-zinc-800/30"
          : "border-blue-500/20"
      )}
    >
      {/* Thread header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        {/* Quoted content preview */}
        {thread.quotedContent && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate italic">
              &ldquo;{thread.quotedContent}&rdquo;
            </p>
          </div>
        )}
        {!thread.quotedContent && <div className="flex-1" />}

        {/* Resolve / Unresolve buttons */}
        {canResolve && (
          <>
            {isResolved ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleUnresolve}
                disabled={isResolving}
              >
                {isResolving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                {t("unresolve")}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                onClick={handleResolve}
                disabled={isResolving}
              >
                {isResolving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {t("resolve")}
              </Button>
            )}
          </>
        )}

        {/* Collapse resolved thread */}
        {isResolved && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Comments */}
      <div className="divide-y divide-[var(--glass-divider)]">
        {thread.comments.map((comment) => (
          <div key={comment._id} className="flex gap-2.5 px-3 py-2.5">
            <Avatar className="h-6 w-6 shrink-0">
              {comment.user?.avatarUrl && (
                <AvatarImage
                  src={comment.user.avatarUrl}
                  alt={comment.user?.name ?? ""}
                />
              )}
              <AvatarFallback className="text-[9px]">
                {getInitials(comment.user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium">
                  {comment.user?.name ?? t("unknownUser")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {relTime(comment.createdAt)}
                </span>
                {comment.isEdited && (
                  <span className="text-[10px] text-muted-foreground italic">
                    {t("edited")}
                  </span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Suggested change display */}
      {thread.threadType === "suggestion" && thread.suggestedContent && (
        <div className="mx-3 my-2 rounded-md border border-dashed border-blue-500/30 bg-blue-500/5 p-3">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
            {t("suggestedChange")}
          </p>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
            {thread.suggestedContent}
          </pre>
          {thread.suggestionStatus === "accepted" && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {t("suggestionAccepted")}
            </span>
          )}
          {thread.suggestionStatus === "dismissed" && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-muted-foreground line-through">
              {t("suggestionDismissed")}
            </span>
          )}
        </div>
      )}

      {/* Reply form (only for open threads) */}
      {!isResolved && userId && (
        <div className="border-t border-[var(--glass-divider)] px-3 py-2">
          <div className="flex gap-2">
            <Textarea
              placeholder={t("replyPlaceholder")}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={1}
              className="min-h-[32px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddReply();
                }
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 shrink-0"
              onClick={handleAddReply}
              disabled={!replyText.trim() || isSubmittingReply}
            >
              {isSubmittingReply ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
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
  const t = useTranslations("mergeRequests.reviewThread");

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
  userId?: Id<"users">;
  mrCreatorId?: Id<"users">;
  isAdmin?: boolean;
}

export function PageThreadList({
  mergeRequestId,
  pagePath,
  userId,
  mrCreatorId,
  isAdmin,
}: PageThreadListProps) {
  const threads = useQuery(api.mrReviews.listThreadsByPage, {
    mergeRequestId,
    pagePath,
  });

  if (!threads || threads.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {threads.map((thread: ReviewThreadData) => (
        <ReviewThread
          key={thread._id}
          thread={thread}
          userId={userId}
          mrCreatorId={mrCreatorId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
