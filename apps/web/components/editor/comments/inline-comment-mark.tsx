"use client";

import { forwardRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { CommentPopover } from "./comment-popover";

interface InlineCommentMarkProps {
  threadId: Id<"commentThreads">;
  currentUserId: Id<"users">;
  status: "open" | "resolved";
  children: React.ReactNode;
  onOpenSidebar?: () => void;
}

/**
 * Inline comment mark that wraps text with a highlight.
 * Clicking opens a popover to view/reply to the comment.
 */
export const InlineCommentMark = forwardRef<
  HTMLSpanElement,
  InlineCommentMarkProps
>(function InlineCommentMark(
  { threadId, currentUserId, status, children, onOpenSidebar },
  ref
) {
  return (
    <CommentPopover
      threadId={threadId}
      currentUserId={currentUserId}
      onOpenSidebar={onOpenSidebar}
    >
      <span
        ref={ref}
        className={`cursor-pointer rounded-sm transition-colors ${
          status === "open"
            ? "bg-yellow-200/60 hover:bg-yellow-200/80 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/40"
            : "bg-green-200/40 hover:bg-green-200/60 dark:bg-green-500/20 dark:hover:bg-green-500/30"
        }`}
        data-comment-thread={threadId}
        data-comment-status={status}
      >
        {children}
      </span>
    </CommentPopover>
  );
});

/**
 * Creates CSS for comment highlights to be injected into the editor
 */
export function getCommentHighlightStyles(): string {
  return `
    [data-comment-thread] {
      position: relative;
    }

    [data-comment-status="open"] {
      background-color: rgba(253, 224, 71, 0.4);
      border-bottom: 2px solid rgba(234, 179, 8, 0.6);
    }

    [data-comment-status="open"]:hover {
      background-color: rgba(253, 224, 71, 0.6);
    }

    [data-comment-status="resolved"] {
      background-color: rgba(134, 239, 172, 0.3);
      border-bottom: 2px solid rgba(34, 197, 94, 0.4);
    }

    [data-comment-status="resolved"]:hover {
      background-color: rgba(134, 239, 172, 0.5);
    }

    .dark [data-comment-status="open"] {
      background-color: rgba(234, 179, 8, 0.25);
      border-bottom-color: rgba(234, 179, 8, 0.5);
    }

    .dark [data-comment-status="open"]:hover {
      background-color: rgba(234, 179, 8, 0.35);
    }

    .dark [data-comment-status="resolved"] {
      background-color: rgba(34, 197, 94, 0.2);
      border-bottom-color: rgba(34, 197, 94, 0.4);
    }

    .dark [data-comment-status="resolved"]:hover {
      background-color: rgba(34, 197, 94, 0.3);
    }
  `;
}
