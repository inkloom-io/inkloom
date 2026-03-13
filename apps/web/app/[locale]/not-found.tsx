import { getTranslations } from "next-intl/server";
import { ErrorLayout } from "@/components/error-layout";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <ErrorLayout
      mascot="/mascot-confused.svg"
      badge="404"
      title={t("notFound")}
      description={t("notFoundDescription")}
      primaryAction={{
        label: t("backToDashboard"),
        href: "/overview",
        icon: "home",
      }}
    >
      <p className="text-xs text-[var(--text-dim)]/60">
        {t("contactSupportHint", {
          defaultMessage: "If you think this is a mistake, contact support.",
        })}
      </p>
    </ErrorLayout>
  );
}
