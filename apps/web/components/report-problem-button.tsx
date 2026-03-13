"use client";

import { MessageSquareWarning } from "lucide-react";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";

/**
 * "Report a problem" button for the app shell.
 *
 * Opens the Sentry feedback dialog so users can report issues from anywhere
 * in the app — not just from error pages. Only renders when the error
 * reporting adapter supports the feedback dialog (i.e. platform mode with Sentry).
 */

interface ReportProblemButtonProps {
  /** Display variant. "icon" shows only the icon, "full" shows icon + label. */
  variant?: "icon" | "full";
  /** Optional CSS class names */
  className?: string;
}

export function ReportProblemButton({
  variant = "icon",
  className = "",
}: ReportProblemButtonProps) {
  // Only render when feedback dialog is available (platform mode with Sentry)
  if (!errorReportingAdapter.showFeedbackDialog) {
    return null;
  }

  const handleClick = () => {
    if (errorReportingAdapter.showFeedbackDialog) {
      errorReportingAdapter.showFeedbackDialog();
    }
  };

  if (variant === "full") {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
        title="Report a problem"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span>Report a problem</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
      title="Report a problem"
      aria-label="Report a problem"
    >
      <MessageSquareWarning className="h-4 w-4" />
    </button>
  );
}
