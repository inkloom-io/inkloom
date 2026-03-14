"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { RefreshCw, Home } from "lucide-react";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";
import { ReportProblemButton } from "@/components/report-problem-button";

/**
 * Dashboard-level error boundary.
 *
 * Unlike the root error boundary, this renders _within_ the dashboard layout
 * (nav + header remain visible), giving users a less disorienting experience.
 * They can still navigate to other sections while the errored route recovers.
 */
export default function DashboardError({
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
      source: "dashboard-error-boundary",
      digest: error.digest,
      route: pathname,
    });
  }, [error, pathname]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div
        className="flex max-w-md flex-col items-center text-center"
        style={{ animation: "dashErrorIn 0.4s ease-out" }}
      >
        <img
          src="/mascot-fixing.svg"
          alt=""
          className="mb-6 h-32 w-32"
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))" }}
        />

        <h2
          className="mb-2 text-xl font-bold text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t("somethingWentWrong")}
        </h2>

        <p className="mb-2 max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
          {t("unexpectedError")}
        </p>

        {error.digest && (
          <p className="mb-5 font-mono text-xs text-[var(--text-dim)]/50">
            Error ID: {error.digest}
          </p>
        )}

        {!error.digest && <div className="mb-5" />}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
            style={{
              backgroundColor: "#14b8a6",
              boxShadow: "0 0 20px rgba(20,184,166,0.2)",
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {t("tryAgain")}
          </button>

          <a
            href="/overview"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-divider)] px-5 py-2 text-sm font-semibold text-foreground transition-all hover:bg-[rgba(255,255,255,0.05)]"
          >
            <Home className="h-4 w-4" />
            {t("backToDashboard")}
          </a>
        </div>

        {errorReportingAdapter.submitFeedback && (
          <div className="mt-4">
            <ReportProblemButton variant="full" className="text-sm text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-foreground hover:underline" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes dashErrorIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
