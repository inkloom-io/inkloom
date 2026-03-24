"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@inkloom/ui/button";
import { Textarea } from "@inkloom/ui/textarea";
import { cn } from "@inkloom/ui/lib/utils";
import { MessageSquare, Lightbulb, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

type ThreadType = "comment" | "suggestion";

interface ReviewCommentFormProps {
  mergeRequestId: Id<"mergeRequests">;
  pagePath: string;
  blockId: string;
  blockIndex: number;
  /** The current text content of the block (used to pre-fill suggestion). */
  quotedContent?: string;
  /** Called after successful submit or when cancelled. */
  onClose: () => void;
  /** Called after successful submit so parent can refresh. */
  onSubmitted?: () => void;
}

/**
 * Inline comment/suggestion form that appears below a selected block.
 * Supports toggling between "Comment" and "Suggest a change" modes.
 */
export function ReviewCommentForm({
  mergeRequestId,
  pagePath,
  blockId,
  blockIndex,
  quotedContent,
  onClose,
  onSubmitted,
}: ReviewCommentFormProps) {
  const t = useTranslations("mergeRequests.review");
  const { userId } = useAuth();
  const createThread = useMutation(api.mrReviews.createThread);

  const [threadType, setThreadType] = useState<ThreadType>("comment");
  const [content, setContent] = useState("");
  const [suggestedContent, setSuggestedContent] = useState(
    quotedContent ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // When switching to suggestion mode, reset suggested content
  useEffect(() => {
    if (threadType === "suggestion") {
      setSuggestedContent(quotedContent ?? "");
    }
  }, [threadType, quotedContent]);

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await createThread({
        mergeRequestId,
        pagePath,
        blockId,
        blockIndex,
        quotedContent,
        threadType,
        suggestedContent:
          threadType === "suggestion" ? suggestedContent : undefined,
        content: content.trim(),
        userId,
      });
      onSubmitted?.();
      onClose();
    } catch {
      // Error is handled silently for now; the mutation will throw on backend issues
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    content,
    threadType,
    suggestedContent,
    mergeRequestId,
    pagePath,
    blockId,
    blockIndex,
    quotedContent,
    createThread,
    onClose,
    onSubmitted,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  return (
    <div className="rounded-lg border border-primary/30 bg-[var(--surface-bg)] shadow-sm overflow-hidden">
      {/* Mode toggle tabs */}
      <div className="flex items-center border-b border-[var(--glass-divider)]">
        <button
          onClick={() => setThreadType("comment")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            threadType === "comment"
              ? "text-primary border-b-2 border-primary"
              : "text-[var(--text-dim)] hover:text-[var(--text-medium)]"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t("comment")}
        </button>
        <button
          onClick={() => setThreadType("suggestion")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            threadType === "suggestion"
              ? "text-primary border-b-2 border-primary"
              : "text-[var(--text-dim)] hover:text-[var(--text-medium)]"
          )}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {t("suggestChange")}
        </button>

        {/* Close button */}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="mr-2 p-1 rounded hover:bg-[var(--surface-active)] text-[var(--text-dim)]"
          aria-label={t("cancel")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Suggestion editor */}
        {threadType === "suggestion" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-wide">
              {t("suggestedReplacement")}
            </label>
            <Textarea
              ref={suggestionRef}
              value={suggestedContent}
              onChange={(e) => setSuggestedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("suggestedContentPlaceholder")}
              className="min-h-[60px] resize-y text-sm font-mono bg-emerald-500/5 border-emerald-500/20 focus-visible:ring-emerald-500/30"
            />
            {quotedContent && suggestedContent !== quotedContent && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {t("suggestionModified")}
              </p>
            )}
          </div>
        )}

        {/* Comment textarea */}
        <div className="space-y-1.5">
          {threadType === "suggestion" && (
            <label className="text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-wide">
              {t("commentLabel")}
            </label>
          )}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              threadType === "suggestion"
                ? t("suggestionCommentPlaceholder")
                : t("commentPlaceholder")
            }
            className="min-h-[80px] resize-y text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-dim)]">
            {t("submitHint")}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {threadType === "suggestion"
                ? t("submitSuggestion")
                : t("submitComment")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reply Form ──────────────────────────────────────────────────────────

interface ReplyFormProps {
  threadId: Id<"mrReviewThreads">;
  onSubmitted?: () => void;
}

/**
 * Compact reply form for adding comments to existing threads.
 */
export function ReplyForm({ threadId, onSubmitted }: ReplyFormProps) {
  const t = useTranslations("mergeRequests.review");
  const { userId } = useAuth();
  const addComment = useMutation(api.mrReviews.addComment);

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await addComment({
        threadId,
        content: content.trim(),
        userId,
      });
      setContent("");
      setIsExpanded(false);
      onSubmitted?.();
    } catch {
      // silently ignore
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, content, threadId, addComment, onSubmitted]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsExpanded(false);
        setContent("");
      }
    },
    [handleSubmit]
  );

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full rounded-md border border-dashed border-[var(--glass-border)] px-3 py-2 text-xs text-[var(--text-dim)] hover:bg-[var(--surface-active)] hover:text-[var(--text-medium)] transition-colors text-left"
      >
        {t("replyPlaceholder")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("replyPlaceholder")}
        className="min-h-[60px] resize-y text-sm"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(false);
            setContent("");
          }}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          {t("reply")}
        </Button>
      </div>
    </div>
  );
}
