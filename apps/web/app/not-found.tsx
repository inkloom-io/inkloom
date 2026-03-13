import Link from "next/link";
import { ErrorLayout } from "@/components/error-layout";

export default function NotFound() {
  return (
    <ErrorLayout
      mascot="/mascot-confused.svg"
      badge="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved. Check the URL or head back to the dashboard."
      primaryAction={{
        label: "Back to dashboard",
        href: "/overview",
        icon: "home",
      }}
    >
      <p className="text-xs text-[var(--text-dim)]/60">
        If you think this is a mistake,{" "}
        <Link
          href="/settings"
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          contact support
        </Link>
        .
      </p>
    </ErrorLayout>
  );
}
