"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function SaveStatus({ status }: { status: "idle" | "saving" | "saved" }) {
  const t = useTranslations("settings.saveStatus");

  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t("saving")}</span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>{t("saved")}</span>
        </>
      )}
    </div>
  );
}
