"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Badge } from "@inkloom/ui/badge";
import { MessageSquare, X, Quote } from "lucide-react";
import { CommentThreadCard } from "./comment-thread-card";
import { CommentThreadDetail } from "./comment-thread-detail";
import { CommentInput } from "./comment-input";

type FilterStatus = "all" | "open" | "resolved";

interface CommentSelection {
  blockId: string;
  quotedText?: string;
  inlineStart?: number;
  inlineEnd?: number;
}

interface CommentsPanelProps {
  pageId: Id<"pages">;
  currentUserId: Id<"users">;
  onClose: () => void;
  onScrollToBlock?: (blockId: string) => void;
  // When set, shows a "new comment" input for this selection
  newCommentSelection?: CommentSelection | null;
  onClearNewComment?: () => void;
  // When set, auto-selects this thread (e.g., when clicking a highlight)
  initialSelectedThreadId?: string | null;
  onClearSelectedThread?: () => void;
  // Admins can delete any comment thread
  isAdmin?: boolean;
}

export function CommentsPanel({
  pageId,
  currentUserId,
  onClose,
  onScrollToBlock,
  newCommentSelection,
  onClearNewComment,
  initialSelectedThreadId,
  onClearSelectedThread,
  isAdmin = false,
}: CommentsPanelProps) {
  const t = useTranslations("editor.comments");
  const [filter, setFilter] = useState<FilterStatus>("all");
  // Initialize with the prop value to avoid flash when opening from highlight click
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"commentThreads"> | null>(
    initialSelectedThreadId ? (initialSelectedThreadId as Id<"commentThreads">) : null
  );
  const [isCreatingComment, setIsCreatingComment] = useState(false);

  const createThread = useMutation(api.comments.createThread);

  // Show new comment input when newCommentSelection is set
  // Also clear selectedThreadId to exit thread detail view and show list view
  useEffect(() => {
    if (newCommentSelection) {
      setIsCreatingComment(true);
      setSelectedThreadId(null);
    }
  }, [newCommentSelection]);

  // Auto-select thread when initialSelectedThreadId is provided
  useEffect(() => {
    if (initialSelectedThreadId) {
      setSelectedThreadId(initialSelectedThreadId as Id<"commentThreads">);
      // Clear the external state after consuming
      onClearSelectedThread?.();
    }
    // Only run when initialSelectedThreadId changes, not when callback changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedThreadId]);

  // Handle creating a new comment thread
  const handleCreateComment = async (content: string) => {
    if (!newCommentSelection) {
      console.error("Cannot create comment: no selection");
      return;
    }

    if (!currentUserId) {
      console.error("Cannot create comment: no user ID");
      return;
    }

    try {
      const threadId = await createThread({
        pageId,
        blockId: newCommentSelection.blockId,
        anchorType: newCommentSelection.quotedText ? "inline" : "block",
        inlineStart: newCommentSelection.inlineStart,
        inlineEnd: newCommentSelection.inlineEnd,
        quotedText: newCommentSelection.quotedText,
        content,
        userId: currentUserId,
      });

      setIsCreatingComment(false);
      onClearNewComment?.();
      // Select the new thread to show it
      setSelectedThreadId(threadId);
    } catch (error) {
      console.error("Failed to create comment:", error);
      // Show user-friendly error
      alert("Failed to create comment. Please try again.");
    }
  };

  const handleCancelNewComment = () => {
    setIsCreatingComment(false);
    onClearNewComment?.();
  };

  // Fetch threads based on filter
  const threads = useQuery(api.comments.listByPage, {
    pageId,
    status: filter === "all" ? undefined : filter,
  });

  // Fetch selected thread details
  const selectedThread = useQuery(
    api.comments.getThread,
    selectedThreadId ? { threadId: selectedThreadId } : "skip"
  );

  // Count open threads
  const openCount = threads?.filter((t: any) => t.status === "open").length ?? 0;
  const resolvedCount = threads?.filter((t: any) => t.status === "resolved").length ?? 0;

  // Show thread detail view (or loading state while fetching)
  if (selectedThreadId) {
    if (selectedThread) {
      return (
        <div className="flex h-full flex-col">
          <CommentThreadDetail
            thread={selectedThread}
            currentUserId={currentUserId}
            onBack={() => setSelectedThreadId(null)}
            onScrollToBlock={onScrollToBlock}
            isAdmin={isAdmin}
          />
        </div>
      );
    }
    // Show loading state while fetching thread details
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="font-semibold">{t("thread")}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--glass-divider)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--text-dim)]" />
          <h2 className="text-sm font-semibold text-[var(--text-bright)]" style={{ fontFamily: "var(--font-heading)" }}>{t("title")}</h2>
          {threads && threads.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--glass-hover)] px-1.5 text-[10px] font-medium text-[var(--text-dim)]">
              {threads.length}
            </span>
          )}
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--glass-divider)] px-4 py-2">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          {t("all")}
          {threads && (
            <Badge variant="outline" className="ml-1">
              {threads.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "open" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("open")}
        >
          {t("open")}
          <Badge variant="outline" className="ml-1">
            {openCount}
          </Badge>
        </Button>
        <Button
          variant={filter === "resolved" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("resolved")}
        >
          {t("resolved")}
          <Badge variant="outline" className="ml-1">
            {resolvedCount}
          </Badge>
        </Button>
      </div>

      {/* New comment input */}
      {isCreatingComment && newCommentSelection && (
        <div className="border-b border-[var(--glass-divider)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--text-medium)]">{t("newComment")}</p>
          {newCommentSelection.quotedText && (
            <div className="mb-3 flex gap-2 rounded-md bg-muted p-2">
              <Quote className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground line-clamp-3">
                "{newCommentSelection.quotedText}"
              </p>
            </div>
          )}
          <CommentInput
            onSubmit={handleCreateComment}
            onCancel={handleCancelNewComment}
            placeholder={t("writeYourComment")}
            submitLabel={t("addLabel")}
            autoFocus
          />
        </div>
      )}

      {/* Thread list */}
      <div className="flex-1 overflow-auto">
        {threads === undefined ? (
          // Loading state
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : threads.length === 0 ? (
          // Empty state
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--glass-divider)] bg-[var(--surface-active)]">
              <MessageSquare className="h-5 w-5 text-[var(--text-dim)]" />
            </div>
            <p className="text-sm text-[var(--text-dim)]">
              {filter === "all"
                ? t("noCommentsYet")
                : t("noFilteredComments", { filter })}
            </p>
            <p className="text-xs text-[var(--text-dim)]">
              {t("addCommentHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {threads.map((thread: any) => (
              <CommentThreadCard
                key={thread._id}
                thread={thread}
                onClick={() => setSelectedThreadId(thread._id)}
                isSelected={selectedThreadId === thread._id}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
