"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { getRelativeTimeKeyAndParams } from "@/lib/date-utils";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAppContext } from "@/hooks/use-app-context";
import {
  FolderOpen,
  FileText,
  Rocket,
  AlertCircle,
  ArrowUpRight,
  Globe,
  Clock,
  Plus,
  ArrowRight,
  ExternalLink,
  CreditCard,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-all duration-200"
      style={{
        backgroundColor: "var(--surface-bg)",
        borderColor: highlight ? "rgba(245, 158, 11, 0.3)" : "var(--glass-border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: highlight ? "rgba(245, 158, 11, 0.1)" : "var(--surface-hover)",
            border: `1px solid ${highlight ? "rgba(245, 158, 11, 0.2)" : "var(--glass-border)"}`,
          }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: highlight ? "#f59e0b" : "var(--text-dim)" }}
          />
        </div>
        <div>
          <div className="text-xs text-[var(--text-dim)]">{label}</div>
          <div
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-[var(--glass-border)] bg-[var(--surface-bg)] ${className}`}
    >
      <div className="p-6">
        <div className="mb-3 h-4 w-1/3 rounded bg-[var(--surface-hover)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--surface-hover)]" />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-bg)] p-4 transition-all duration-200 hover:border-[rgba(20,184,166,0.3)] hover:bg-[var(--surface-hover)]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--glass-border)" }}
      >
        <Icon className="h-4 w-4 text-[var(--text-dim)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-[var(--text-dim)]">{description}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ready: "#22c55e",
  error: "#ef4444",
  building: "#f59e0b",
  never_deployed: "#6b7280",
};

export default function DashboardPage() {
  const t = useTranslations("dashboard.overview");
  const tc = useTranslations("common");
  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }
  const { user, isLoading: userLoading } = useAuth();
  const { orgName, isMultiTenant, isLoading: ctxLoading } = useAppContext();

  const stats = useQuery(api.projects.getDashboardStats);

  const isLoading = userLoading || ctxLoading || stats === undefined;

  const firstName = user?.name?.split(" ")[0] || "there";
  const planLabel = isMultiTenant ? "Pro" : "Core";

  // Build recommended actions
  const actions: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; description: string; href: string }[] = [];
  if (stats) {
    if (stats.totalProjects === 0) {
      actions.push({
        icon: Plus,
        title: t("createFirstProjectAction"),
        description: t("createFirstProjectActionDescription"),
        href: "/projects?newProject=true",
      });
    }
    if (stats.unpublishedCount > 0) {
      const proj = stats.projects.find((p: { hasUnpublishedChanges: boolean; _id: string }) => p.hasUnpublishedChanges);
      actions.push({
        icon: Rocket,
        title: t("publishChanges"),
        description: t("publishChangesDescription", { count: stats.unpublishedCount }),
        href: proj ? `/projects/${proj._id}/editor` : "/projects",
      });
    }
    if (isMultiTenant) {
      actions.push({
        icon: CreditCard,
        title: t("upgradeToPro"),
        description: t("upgradeToProDescription"),
        href: "/organization/billing",
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Keyframes */}
      <style>{`
        @keyframes dashCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Section 1: Welcome header */}
      <div className="mb-8" style={{ animation: "dashCardIn 0.4s ease-out" }}>
        <h1
          className="text-2xl font-bold text-foreground md:text-3xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("welcomeBack", { firstName })}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          {orgName || t("organization")}
          {" \u00B7 "}
          <span className="capitalize">{typeof planLabel === "string" ? planLabel : "Free"}</span>
        </p>

      </div>

      {/* Section 2: Quick stats */}
      {isLoading ? (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} className="h-[80px]" />
          ))}
        </div>
      ) : stats ? (
        <div
          className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
          style={{ animation: "dashCardIn 0.4s ease-out 0.1s both" }}
        >
          <StatCard icon={FolderOpen} label={t("projects")} value={stats.totalProjects} />
          <StatCard icon={FileText} label={t("pages")} value={stats.totalPages} />
          <StatCard icon={Rocket} label={t("deployments")} value={stats.recentDeployments} />
          <StatCard
            icon={AlertCircle}
            label={t("unpublished")}
            value={stats.unpublishedCount}
            highlight={stats.unpublishedCount > 0}
          />
        </div>
      ) : null}

      {/* Section 3: Recent projects */}
      <div className="mb-8" style={{ animation: "dashCardIn 0.4s ease-out 0.2s both" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("recentProjects")}
          </h2>
          {stats && stats.totalProjects > 0 && (
            <Link
              href="/projects"
              className="flex items-center gap-1 text-xs text-[var(--text-dim)] transition-colors hover:text-[var(--text-medium)]"
            >
              {t("viewAllProjects")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} className="h-[160px]" />
            ))}
          </div>
        ) : stats && stats.projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.projects.map((project: any, index: number) => (
              <Link
                key={project._id}
                href={`/projects/${project._id}/editor`}
                className="group relative rounded-2xl p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--surface-bg)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                  animation: `dashCardIn 0.4s ease-out ${0.25 + index * 0.05}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                  e.currentTarget.style.boxShadow = "0 8px 40px rgba(0,0,0,0.3), 0 0 30px rgba(20,184,166,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--glass-border)";
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.15)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Status dot + project icon */}
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "rgba(20,184,166,0.1)",
                      border: "1px solid rgba(20,184,166,0.15)",
                    }}
                  >
                    <FileText className="h-5 w-5" style={{ color: "#14b8a6" }} />
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: STATUS_COLORS[project.deploymentStatus] || "#6b7280",
                        boxShadow: project.deploymentStatus === "ready"
                          ? "0 0 6px rgba(34,197,94,0.4)"
                          : project.deploymentStatus === "error"
                            ? "0 0 6px rgba(239,68,68,0.4)"
                            : undefined,
                      }}
                    />
                    <span className="text-[10px] text-[var(--text-dim)]">
                      {project.deploymentStatus === "ready" && !project.hasUnpublishedChanges
                        ? t("statusLive")
                        : project.deploymentStatus === "ready" && project.hasUnpublishedChanges
                          ? t("statusUnpublished")
                          : project.deploymentStatus === "error"
                            ? t("statusError")
                            : project.deploymentStatus === "building"
                              ? t("statusBuilding")
                              : t("statusNotDeployed")}
                    </span>
                  </div>
                </div>

                <div className="mb-1 flex items-center justify-between">
                  <h3
                    className="text-base font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {project.name}
                  </h3>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-dim)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>

                <p className="mb-4 line-clamp-1 text-sm text-[var(--text-dim)]">
                  {project.description || t("noDescription")}
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
                    <Globe className="h-3 w-3" />
                    <span className="max-w-[100px] truncate">{project.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                    <Clock className="h-3 w-3" />
                    {relTime(project.updatedAt)}
                  </div>
                </div>

                <div
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor:
                      project.plan === "ultimate"
                        ? "rgba(168,85,247,0.1)"
                        : project.plan === "pro"
                          ? "rgba(59,130,246,0.1)"
                          : "var(--surface-hover)",
                    color:
                      project.plan === "ultimate"
                        ? "#a855f7"
                        : project.plan === "pro"
                          ? "#3b82f6"
                          : "var(--text-dim)",
                    border: `1px solid ${
                      project.plan === "ultimate"
                        ? "rgba(168,85,247,0.2)"
                        : project.plan === "pro"
                          ? "rgba(59,130,246,0.2)"
                          : "var(--glass-border)"
                    }`,
                  }}
                >
                  {project.plan === "ultimate"
                    ? t("planUltimate")
                    : project.plan === "pro"
                      ? t("planPro")
                      : t("planHobby")}
                </div>

                {project.settings?.customDomain && (
                  <div
                    className="mt-3 ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                    style={{
                      backgroundColor: "rgba(20,184,166,0.08)",
                      color: "#14b8a6",
                      border: "1px solid rgba(20,184,166,0.15)",
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {project.settings.customDomain}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-[var(--glass-border)] bg-[var(--surface-bg)] p-8 text-center"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
          >
            <img
              src="/mascot-standard.svg"
              alt=""
              className="mx-auto mb-4 h-28 w-28 opacity-90"
              style={{ filter: "drop-shadow(0 4px 12px rgba(20,184,166,0.15))" }}
            />
            <h3
              className="mb-2 text-base font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("noProjectsYet")}
            </h3>
            <p className="mb-4 text-sm text-[var(--text-dim)]">
              {t("createFirstProjectDescription")}
            </p>
            <Link
              href="/projects?newProject=true"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
              style={{
                backgroundColor: "#14b8a6",
                boxShadow: "0 0 20px rgba(20,184,166,0.2)",
              }}
            >
              <Plus className="h-4 w-4" />
              {t("createFirstProject")}
            </Link>
          </div>
        )}
      </div>

      {/* Section 4: Recommended actions */}
      {!isLoading && actions.length > 0 && (
        <div style={{ animation: "dashCardIn 0.4s ease-out 0.3s both" }}>
          <h2
            className="mb-4 text-lg font-semibold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("recommended")}
          </h2>
          <div className="space-y-3">
            {actions.slice(0, 3).map((action: any) => (
              <ActionCard key={action.title} {...action} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
