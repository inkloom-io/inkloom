"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";
import { ErrorLayout } from "@/components/error-layout";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const pathname = usePathname();

  useEffect(() => {
    errorReportingAdapter.captureError(error, {
      source: "locale-error-boundary",
      digest: error.digest,
      route: pathname,
    });
  }, [error, pathname]);

  return (
    <ErrorLayout
      mascot="/mascot-fixing.svg"
      badge={t("somethingWentWrong")}
      title={t("somethingWentWrong")}
      description={t("unexpectedError")}
      errorDigest={error.digest}
      primaryAction={{
        label: t("tryAgain"),
        onClick: reset,
        icon: "refresh",
      }}
      secondaryAction={
        errorReportingAdapter.showFeedbackDialog
          ? {
              label: t("tellUsWhatHappened"),
              onClick: () => errorReportingAdapter.showFeedbackDialog?.(),
            }
          : { label: t("backToDashboard"), href: "/overview" }
      }
    >
      {errorReportingAdapter.showFeedbackDialog && (
        <a
          href="/overview"
          className="text-sm text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {t("backToDashboard")}
        </a>
      )}
    </ErrorLayout>
  );
}
