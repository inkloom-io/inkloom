"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
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
  const t = useTranslations("errors");
  const pathname = usePathname();

  // Report synchronously during first render via useState initializer.
  // useEffect would be skipped if the component fails to mount.
  const [eventId] = useState(() => {
    return errorReportingAdapter.captureError(error, {
      source: "locale-error-boundary",
      digest: error.digest,
      route: pathname,
    });
  });

  return (
    <ErrorLayout
      mascot="/mascot-fixing.svg"
      badge={t("somethingWentWrong")}
      title={t("somethingWentWrong")}
      description={t("unexpectedError")}
      errorDigest={eventId ?? error.digest}
      primaryAction={{
        label: t("tryAgain"),
        onClick: reset,
        icon: "refresh",
      }}
      secondaryAction={{ label: t("backToDashboard"), href: "/overview" }}
    >
      {errorReportingAdapter.submitFeedback && (
        <ReportProblemButton variant="full" associatedEventId={eventId} className="text-sm text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-foreground hover:underline" />
      )}
    </ErrorLayout>
  );
}
