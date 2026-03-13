"use client";

import { useEffect } from "react";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";
import { ErrorLayout } from "@/components/error-layout";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    errorReportingAdapter.captureError(error, {
      source: "root-error-boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorLayout
      mascot="/mascot-fixing.svg"
      badge="Error"
      title="Something went wrong"
      description="An unexpected error occurred. Our team has been notified and is looking into it."
      errorDigest={error.digest}
      primaryAction={{
        label: "Try again",
        onClick: reset,
        icon: "refresh",
      }}
      secondaryAction={
        errorReportingAdapter.showFeedbackDialog
          ? {
              label: "Tell us what happened",
              onClick: () => errorReportingAdapter.showFeedbackDialog?.(),
            }
          : { label: "Back to dashboard", href: "/overview" }
      }
    >
      {/* Show "Back to dashboard" as a text link when feedback button takes the secondary slot */}
      {errorReportingAdapter.showFeedbackDialog && (
        <a
          href="/overview"
          className="text-sm text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Back to dashboard
        </a>
      )}
    </ErrorLayout>
  );
}
