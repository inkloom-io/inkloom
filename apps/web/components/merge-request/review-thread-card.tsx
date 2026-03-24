"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarImage, AvatarFallback } from "@inkloom/ui/avatar";
import { Badge } from "@inkloom/ui/badge";
import { Button } from "@inkloom/ui/button";
import { Textarea } from "@inkloom/ui/textarea";
import { cn } from "@inkloom/ui/lib/utils";
import {
  MessageSquare,
  Lightbulb,
  Check,
  X,
  CornerDownRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ReviewThreadComment {
  _id: string;
  content: string;
  createdAt: number;
  isEdited: boolean;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  } | null;
}

export interface ReviewThread {
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
    id: string;
    name: string;
    avatarUrl?: string;
  } | null;
  comments: ReviewThreadComment[];
  commentCount: number;
}

interface ReviewThreadCardProps {
  thread: ReviewThread;
  userId: Id<"users"> | undefined;
  relTime: (ts: number) => string;
  onNavigateToThread?: (thread: ReviewThread) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatPagePath(path: string): string {
  // Convert something like "docs/getting-started/quickstart" to a readable label
  const segments = path.split("/");
  return "/" + segments.join("/");
}

// ── Component ─────────────────────────────────────────────────────────────

export function ReviewThreadCard({
  thread,
  userId,
  relTime,
  onNavigateToThread,
}: ReviewThreadCardProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const addCommentMutation = useMutation(api.mrReviews.addComment);
  const resolveThreadMutation = useMutation(api.mrReviews.resolveThread);
  const unresolveThreadMutation = useMutation(api.mrReviews.unresolveThread);
  const acceptSuggestionMutation = useMutation(api.mrReviews.acceptSuggestion);
  const dismissSuggestionMutation = useMutation(
    api.mrReviews.dismissSuggestion
  );

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !userId) return;
    setIsReplying(true);
    try {
      await addCommentMutation({
        threadId: thread._id,
        content: replyText.trim(),
        userId,
      });
      setReplyText("");
      setShowReplyForm(false);
    } catch (error) {
      console.error("Failed to add reply:", error);
    } finally {
      setIsReplying(false);
    }
  }, [replyText, userId, addCommentMutation, thread._id]);

  const handleResolve = useCallback(async () => {
    if (!userId) return;
    setIsResolving(true);
    try {
      if (thread.status === "resolved") {
        await unresolveThreadMutation({ threadId: thread._id });
      } else {
        await resolveThreadMutation({ threadId: thread._id, userId });
      }
    } catch (error) {
      console.error("Failed to resolve/unresolve thread:", error);
    } finally {
      setIsResolving(false);
    }
  }, [
    userId,
    thread._id,
    thread.status,
    resolveThreadMutation,
    unresolveThreadMutation,
  ]);

  const handleAcceptSuggestion = useCallback(async () => {
    if (!userId) return;
    setIsAccepting(true);
    try {
      await acceptSuggestionMutation({ threadId: thread._id, userId });
    } catch (error) {
      console.error("Failed to accept suggestion:", error);
    } finally {
      setIsAccepting(false);
    }
  }, [userId, thread._id, acceptSuggestionMutation]);

  const handleDismissSuggestion = useCallback(async () => {
    if (!userId) return;
    setIsDismissing(true);
    try {
      await dismissSuggestionMutation({ threadId: thread._id, userId });
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    } finally {
      setIsDismissing(false);
    }
  }, [userId, thread._id, dismissSuggestionMutation]);

  const isSuggestion = thread.threadType === "suggestion";
  const isResolved = thread.status === "resolved";
  const firstComment = thread.comments[0];
  const replies = thread.comments.slice(1);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isResolved
          ? "border-muted bg-muted/30"
          : isSuggestion
            ? "border-amber-200 dark:border-amber-800/50"
            : "border-border"
      )}
    >
      {/* Thread header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit bg-muted/40 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSuggestion ? (
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          <span className="font-medium text-foreground">
            {thread.creator?.name ?? "Unknown"}
          </span>
          <span>commented on</span>
          <button
            type="button"
            className="font-mono text-xs rounded bg-muted px-1.5 py-0.5 hover:bg-accent transition-colors inline-flex items-center gap-1"
            onClick={() => onNavigateToThread?.(thread)}
          >
            {formatPagePath(thread.pagePath)}, block {thread.blockIndex + 1}
            <ExternalLink className="h-3 w-3" />
          </button>
          <span>&middot;</span>
          <span>{relTime(thread.createdAt)}</span>
        </div>

        {isResolved && (
          <Badge
            variant="outline"
            className="ml-auto text-xs border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        )}

        {isSuggestion && thread.suggestionStatus === "accepted" && (
          <Badge
            variant="outline"
            className="ml-auto text-xs border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
          >
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        )}

        {isSuggestion && thread.suggestionStatus === "dismissed" && (
          <Badge
            variant="outline"
            className="ml-auto text-xs border-muted-foreground/30 text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Dismissed
          </Badge>
        )}
      </div>

      {/* Quoted content snippet */}
      {thread.quotedContent && (
        <div className="mx-4 mt-3 rounded border bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
            {thread.quotedContent}
          </p>
        </div>
      )}

      {/* First comment / thread body — skip if no comment (suggestion-only thread) */}
      {firstComment && firstComment.content && (
        <div className="px-4 py-3">
          <div className="flex gap-3">
            <Avatar className="h-7 w-7 shrink-0">
              {firstComment.user?.avatarUrl && (
                <AvatarImage
                  src={firstComment.user.avatarUrl}
                  alt={firstComment.user.name}
                />
              )}
              <AvatarFallback className="text-[10px]">
                {getInitials(firstComment.user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm whitespace-pre-wrap">
                {firstComment.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion diff */}
      {isSuggestion && thread.suggestedContent && (
        <div className="mx-4 mb-3 rounded border overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/20 px-3 py-1.5 border-b">
            <p className="text-xs font-mono text-red-700 dark:text-red-400 line-clamp-2">
              <span className="select-none mr-1.5 text-red-400">−</span>
              {thread.quotedContent ?? "Original content"}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 px-3 py-1.5">
            <p className="text-xs font-mono text-green-700 dark:text-green-400 line-clamp-2">
              <span className="select-none mr-1.5 text-green-400">+</span>
              {thread.suggestedContent}
            </p>
          </div>
        </div>
      )}

      {/* Suggestion actions */}
      {isSuggestion && thread.suggestionStatus === "pending" && userId && (
        <div className="mx-4 mb-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleAcceptSuggestion}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Accept suggestion
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={handleDismissSuggestion}
            disabled={isDismissing}
          >
            {isDismissing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <X className="h-3 w-3 mr-1" />
            )}
            Dismiss
          </Button>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-inherit">
          {replies.map((reply) => (
            <div
              key={reply._id}
              className="flex gap-3 px-4 py-3 border-b border-inherit last:border-b-0"
            >
              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              <Avatar className="h-6 w-6 shrink-0">
                {reply.user?.avatarUrl && (
                  <AvatarImage
                    src={reply.user.avatarUrl}
                    alt={reply.user.name}
                  />
                )}
                <AvatarFallback className="text-[10px]">
                  {getInitials(reply.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">
                    {reply.user?.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relTime(reply.createdAt)}
                  </span>
                  {reply.isEdited && (
                    <span className="text-xs text-muted-foreground italic">
                      (edited)
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-inherit bg-muted/20 rounded-b-lg">
        {userId && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Reply
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleResolve}
              disabled={isResolving}
            >
              {isResolving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : isResolved ? (
                <XCircle className="h-3 w-3 mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              {isResolved ? "Unresolve" : "Resolve"}
            </Button>
          </>
        )}
      </div>

      {/* Reply form */}
      {showReplyForm && userId && (
        <div className="px-4 pb-3 space-y-2">
          <Textarea
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={2}
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleReply();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setShowReplyForm(false);
                setReplyText("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleReply}
              disabled={!replyText.trim() || isReplying}
            >
              {isReplying && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
