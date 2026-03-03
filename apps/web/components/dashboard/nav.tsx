"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2,
  FolderOpen,
  Home,
  Settings,
} from "lucide-react";
import { useAppContext } from "@/hooks/use-app-context";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface DashboardNavProps {
  user: User;
}

export function DashboardNav({ user: _user }: DashboardNavProps) {
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");
  const { isMultiTenant } = useAppContext();

  const navItems = [
    { href: "/overview", label: t("overview"), icon: Home, exact: true },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    ...(isMultiTenant
      ? [{ href: "/organization/settings", label: t("organization"), icon: Building2 }]
      : []),
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <aside
      className="relative z-10 hidden w-60 shrink-0 border-r border-[var(--glass-divider)] bg-[var(--surface-bg)] lg:block"
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center border-b border-[var(--glass-divider)] px-6"
      >
        <Link href="/overview" className="flex items-center">
          <img
            src="/logo.svg"
            alt="InkLoom"
            className="h-7 object-contain"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-3">
        <div className="space-y-1">
          {navItems.map((item: any) => {
            const isActive = "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "border-l-primary bg-[var(--active-bg)] text-primary"
                    : "border-l-transparent text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-medium)]"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
