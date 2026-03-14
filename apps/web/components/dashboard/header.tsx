"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { ThemeToggle } from "./theme-toggle";
import {
  ReportProblemButton,
  type SessionContext,
} from "@/components/report-problem-button";
import { useAppContext } from "@/hooks/use-app-context";
import { useAuth } from "@/hooks/use-auth";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface DashboardHeaderProps {
  user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const t = useTranslations("dashboard.header");
  const { isMultiTenant, tenantId, orgName } = useAppContext();
  const { signOut, user: authUser } = useAuth();
  const params = useParams<{ projectId?: string }>();

  const sessionContext = useMemo((): SessionContext => {
    const ctx: SessionContext = {};
    if (authUser) {
      ctx.userId = String(authUser._id);
      ctx.userEmail = authUser.email;
    }
    if (tenantId && tenantId !== "local") {
      ctx.orgId = tenantId;
      ctx.orgName = orgName;
    }
    if (params?.projectId) {
      ctx.projectId = params.projectId;
    }
    return ctx;
  }, [authUser, tenantId, orgName, params?.projectId]);

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <header
      className="relative z-20 flex h-16 items-center justify-between border-b border-[var(--glass-divider)] px-6"
    >
      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <Link href="/overview" className="flex items-center">
            <img
              src="/logo.svg"
              alt="InkLoom"
              className="h-6 object-contain"
            />
          </Link>
        </div>
        {isMultiTenant && <OrgSwitcher />}
        {!isMultiTenant && (
          <span className="hidden text-sm font-medium text-[var(--text-medium)] lg:inline">
            InkLoom Core
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ReportProblemButton
          variant="icon"
          userName={`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || undefined}
          userEmail={user.email}
          sessionContext={sessionContext}
        />
        <ThemeToggle />
        {/* User avatar dropdown */}
        <div className="relative group">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/15 text-xs font-semibold text-primary transition-all"
          >
            {user.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt={user.firstName || "User"}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </button>

          {/* Dropdown */}
          <div
            className="invisible absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-1 opacity-0 shadow-[var(--glass-shadow)] backdrop-blur-[20px] transition-all duration-200 group-hover:visible group-hover:opacity-100"
          >
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-[var(--text-dim)]">
                {user.email}
              </p>
            </div>
            <div
              className="my-1 h-px bg-[var(--glass-divider)]"
            />
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Link>
            {isMultiTenant && (
              <>
                <div
                  className="my-1 h-px bg-[var(--glass-divider)]"
                />
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)]"
                >
                  <LogOut className="h-4 w-4" />
                  {t("signOut")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
