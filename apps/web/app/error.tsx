"use client";

import { useEffect } from "react";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";
import { ErrorLayout } from "@/components/error-layout";
import { ReportProblemButton } from "@/components/report-problem-button";

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
      secondaryAction={{ label: "Back to dashboard", href: "/overview" }}
    >
      {errorReportingAdapter.submitFeedback && (
        <ReportProblemButton variant="full" className="text-sm text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-foreground hover:underline" />
      )}
    </ErrorLayout>
  );
}
