"use client";

import { useTranslations } from "next-intl";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ animation: "errorIn 0.5s ease-out" }}
      >
        <img
          src="/mascot-fixing.svg"
          alt=""
          className="mb-6 h-40 w-40"
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))" }}
        />
        <h1
          className="mb-3 text-2xl font-bold text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t("somethingWentWrong")}
        </h1>
        <p className="mb-8 max-w-sm text-sm text-[var(--text-dim)]">
          {t("unexpectedError")}
        </p>
        <button
          onClick={reset}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
          style={{
            backgroundColor: "#14b8a6",
            boxShadow: "0 0 20px rgba(20,184,166,0.2)",
          }}
        >
          {t("tryAgain")}
        </button>
      </div>
      <style>{`
        @keyframes errorIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
