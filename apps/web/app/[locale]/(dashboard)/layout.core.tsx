import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardHeader } from "@/components/dashboard/header";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

/**
 * Core-mode dashboard layout.
 *
 * Differences from platform layout:
 * - No `requireAuth()` — core mode has no authentication
 * - No `BillingBanner` — core mode has no billing
 * - No `OnboardingRedirect` — core mode has no onboarding flow
 * - Static local user passed to nav/header (actual user context
 *   comes from CoreContextProvider higher in the tree)
 */

const LOCAL_USER = {
  id: "local_user",
  email: "local@inkloom.dev",
  firstName: "Local",
  lastName: "User",
  profilePictureUrl: null,
};

export default function CoreDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${jakarta.variable} flex min-h-screen bg-background text-foreground`}
      style={{
        fontFamily:
          "var(--font-body), 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Dot matrix background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[length:32px_32px] bg-[radial-gradient(circle,var(--glass-divider)_1px,transparent_1px)]" />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--color-primary)_5%,transparent)_0%,transparent_70%)]" />

      <DashboardNav user={LOCAL_USER} />
      <div className="relative z-10 flex flex-1 flex-col">
        <DashboardHeader user={LOCAL_USER} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
