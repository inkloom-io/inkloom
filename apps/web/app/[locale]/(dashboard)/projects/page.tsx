"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getRelativeTimeKeyAndParams } from "@/lib/date-utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@inkloom/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inkloom/ui/select";
import {
  ExternalLink,
  FileText,
  Book,
  Code,
  Github,
  Loader2,
  Link as LinkIcon,
  Upload,
  Plus,
  Clock,
  Globe,
  ArrowUpRight,
} from "lucide-react";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { useWorkOS } from "@/lib/workos-context";
import { usePermissions } from "@/components/dashboard/permission-guard";
import { PlanSelector, type PlanOption } from "@/components/dashboard/plan-selector";
import type { Repo } from "@/lib/github";

const templateIcons = {
  file: FileText,
  book: Book,
  code: Code,
} as const;

export default function ProjectsPage() {
  const t = useTranslations("dashboard.projects");
  const tc = useTranslations("common");

  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg, isLoading: isOrgLoading } = useWorkOS();
  const { canCreateProjects } = usePermissions();

  const projects = useQuery(
    api.projects.listByOrg,
    currentOrg ? { workosOrgId: currentOrg.id } : "skip"
  );

  // Trial availability for plan selector
  const trialAvailability = useQuery(
    api.billing.getTrialAvailability,
    currentOrg ? { workosOrgId: currentOrg.id } : "skip"
  );

  const createProject = useMutation(api.projects.create);
  const updateSettings = useMutation(api.projects.updateSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | "github">("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Plan selection
  const planFromUrl = searchParams.get("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(
    (planFromUrl === "pro" || planFromUrl === "ultimate") ? planFromUrl : "ultimate"
  );

  // Auto-open dialog from URL param
  useEffect(() => {
    if (searchParams.get("newProject") === "true" && canCreateProjects) {
      setIsOpen(true);
    }
  }, [searchParams, canCreateProjects]);

  // Clean up URL params when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && (searchParams.get("newProject") || searchParams.get("plan"))) {
      const url = new URL(window.location.href);
      url.searchParams.delete("newProject");
      url.searchParams.delete("plan");
      url.searchParams.delete("canceled");
      window.history.replaceState({}, "", url.pathname);
    }
  };

  const [openapiUrl, setOpenapiUrl] = useState("");
  const [openapiFile, setOpenapiFile] = useState<File | null>(null);
  const openapiFileRef = useRef<HTMLInputElement>(null);

  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [installations, setInstallations] = useState<Array<{ installationId: number; accountLogin: string; accountType: string }>>([]);
  const [selectedInstallation, setSelectedInstallation] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [docsPath, setDocsPath] = useState("docs/");
  const [importLoading, setImportLoading] = useState(false);

  const githubAppUrlBase = process.env.NEXT_PUBLIC_GITHUB_APP_URL;
  const githubAppUrl = githubAppUrlBase && currentOrg
    ? `${githubAppUrlBase}?state=${encodeURIComponent(currentOrg.id)}`
    : githubAppUrlBase;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (selectedTemplate === "github") {
      if (importStep < 4) return;
      setIsCreating(true);
      setCreateError(null);
      try {
        const repo = repos.find((r: any) => r.fullName === selectedRepo);
        if (!repo) throw new Error(t("repositoryNotFound"));
        const [owner, repoName] = repo.fullName.split("/");
        const response = await fetch("/api/github/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            installationId: parseInt(selectedInstallation, 10),
            owner,
            repo: repoName,
            branch: selectedBranch || repo.defaultBranch,
            docsPath: docsPath || "docs/",
            projectName: name.trim(),
            workosOrgId: currentOrg?.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Import failed");
        setName("");
        setSelectedTemplate("blank");
        resetImportState();
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to import:", error);
        setCreateError(
          error instanceof Error ? error.message : t("failedToImportFromGitHub")
        );
      } finally {
        setIsCreating(false);
      }
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const hasOpenApiSpec = selectedTemplate === "sdk-api-docs" && (openapiUrl.trim() || openapiFile);
      if (!currentOrg) throw new Error("No organization selected");
      const projectId = await createProject({
        workosOrgId: currentOrg.id,
        name: name.trim(),
        templateId: selectedTemplate as TemplateId,
        ...(hasOpenApiSpec ? { skipFolderPaths: ["/api-reference"] } : {}),
      });

      if (selectedTemplate === "sdk-api-docs" && (openapiUrl.trim() || openapiFile)) {
        try {
          let response: Response;
          if (openapiFile) {
            const formData = new FormData();
            formData.append("file", openapiFile);
            formData.append("projectId", projectId);
            response = await fetch("/api/openapi/validate", {
              method: "POST",
              body: formData,
            });
          } else {
            response = await fetch("/api/openapi/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, url: openapiUrl.trim() }),
            });
          }
          const data = await response.json();
          if (response.ok) {
            await updateSettings({
              projectId,
              settings: {
                openapi: {
                  assetId: data.assetId,
                  ...(openapiUrl.trim() && !openapiFile ? { specUrl: openapiUrl.trim() } : {}),
                  specFormat: data.specFormat,
                  title: data.summary.title,
                  version: data.summary.version,
                  endpointCount: data.summary.endpointCount,
                  tagGroups: data.summary.tagGroups,
                  basePath: "/api-reference",
                  updatedAt: Date.now(),
                },
              },
            });
          }
        } catch {
          // OpenAPI import failed silently
        }
      }

      setName("");
      setSelectedTemplate("blank");
      setOpenapiUrl("");
      setOpenapiFile(null);

      // Handle paid plan checkout
      if (selectedPlan !== "free" && currentOrg) {
        const checkoutRes = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workosOrgId: currentOrg.id,
            projectId,
            tier: selectedPlan,
            interval: "monthly",
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.clientSecret) {
          // Redirect to embedded checkout page
          const params = new URLSearchParams({
            projectId,
            tier: selectedPlan,
            interval: "monthly",
          });
          setIsOpen(false);
          router.push(`/organization/billing/checkout?${params.toString()}`);
          return;
        }
        if (checkoutData.success) {
          // Org already has subscription, project upgraded inline
          setIsOpen(false);
          return;
        }
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
      setCreateError(
        error instanceof Error ? error.message : t("failedToCreateProject")
      );
    } finally {
      setIsCreating(false);
    }
  };

  const resetImportState = () => {
    setImportStep(1);
    setSelectedInstallation("");
    setSelectedRepo("");
    setSelectedBranch("main");
    setDocsPath("docs/");
    setInstallations([]);
    setRepos([]);
  };

  const fetchInstallations = async () => {
    setImportLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentOrg) params.set("workosOrgId", currentOrg.id);
      const response = await fetch(`/api/github/installations?${params.toString()}`);
      const data = await response.json();
      setInstallations(data.installations || []);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("failedToFetchInstallations"));
    } finally {
      setImportLoading(false);
    }
  };

  const fetchRepos = async (installationId: string) => {
    setImportLoading(true);
    try {
      const response = await fetch(`/api/github/repos?installationId=${installationId}`);
      const data = await response.json();
      setRepos(data.repos || []);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("failedToFetchRepos"));
    } finally {
      setImportLoading(false);
    }
  };

  // Loading state
  if (isOrgLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div
              className="mb-2 h-9 w-32 animate-pulse rounded-lg bg-[var(--surface-active)]"
            />
            <div
              className="h-5 w-56 animate-pulse rounded-lg bg-[var(--surface-hover)]"
            />
          </div>
          <div
            className="h-10 w-36 animate-pulse rounded-xl bg-[var(--surface-active)]"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i: any) => (
            <div
              key={i}
              className="rounded-2xl p-6 bg-[var(--surface-bg)] border border-[var(--glass-border)]"
            >
              <div
                className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-active)]"
              />
              <div
                className="mb-2 h-5 w-32 animate-pulse rounded bg-[var(--surface-active)]"
              />
              <div
                className="h-4 w-48 animate-pulse rounded bg-[var(--surface-hover)]"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const accountName = currentOrg?.name;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1
            className="mb-1 text-3xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("heading")}
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            {accountName ? t("subtitleWithOrg", { accountName }) : t("subtitle")}
          </p>
        </div>
        {canCreateProjects && (
          <Dialog open={isOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                style={{
                  backgroundColor: "#14b8a6",
                  boxShadow: "0 0 20px rgba(20,184,166,0.2)",
                }}
              >
                <Plus className="h-4 w-4" />
                {t("newProject")}
              </button>
            </DialogTrigger>
            <DialogContent
              className="!rounded-2xl !border-0 !p-0 !shadow-none sm:!max-w-[520px]"
              style={{
                backgroundColor: "rgba(14,14,18,0.98)",
                border: "1px solid var(--glass-border)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(20,184,166,0.04)",
                color: "#f0f0f0",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <DialogTitle className="sr-only">{t("newProjectDialogTitle")}</DialogTitle>
              <form onSubmit={handleCreate} className="flex flex-col overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
                {/* Header */}
                <div className="shrink-0 px-6 pt-6 pb-0">
                  <h2
                    className="text-xl font-bold text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {t("newProjectDialogTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    {t("newProjectSubtitle")}
                  </p>
                </div>

                <div className="px-6 pt-5 pb-2 space-y-5 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
                  {/* Error */}
                  {createError && (
                    <div
                      className="rounded-xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171",
                      }}
                    >
                      {createError}
                    </div>
                  )}

                  {/* ── Template selection (first per UX recommendation) ── */}
                  <div>
                    <label
                      className="mb-2.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]"
                    >
                      {t("templateLabel")}
                    </label>
                    <div className="space-y-2">
                      {TEMPLATES.map((template: any) => {
                        const Icon = templateIcons[template.icon as keyof typeof templateIcons];
                        const isSelected = selectedTemplate === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(template.id);
                              setOpenapiUrl("");
                              setOpenapiFile(null);
                              resetImportState();
                            }}
                            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all duration-200"
                            style={{
                              backgroundColor: isSelected
                                ? "rgba(20,184,166,0.08)"
                                : "var(--surface-bg)",
                              border: isSelected
                                ? "1px solid rgba(20,184,166,0.3)"
                                : "1px solid var(--glass-border)",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                                e.currentTarget.style.borderColor = "var(--glass-border)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = "var(--surface-bg)";
                                e.currentTarget.style.borderColor = "var(--glass-border)";
                              }
                            }}
                          >
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: isSelected
                                  ? "rgba(20,184,166,0.15)"
                                  : "var(--surface-hover)",
                                border: isSelected
                                  ? "1px solid rgba(20,184,166,0.25)"
                                  : "1px solid var(--glass-border)",
                              }}
                            >
                              <Icon
                                className={`h-4 w-4 ${isSelected ? "" : "text-[var(--text-dim)]"}`}
                                style={isSelected ? { color: "#14b8a6" } : undefined}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-[var(--text-bright)]"}`}
                              >
                                {template.name}
                              </p>
                              <p
                                className="text-xs truncate text-[var(--text-dim)]"
                              >
                                {template.description}
                              </p>
                            </div>
                            {/* Selection radio */}
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                              style={{
                                border: isSelected
                                  ? "2px solid #14b8a6"
                                  : "2px solid var(--glass-border)",
                              }}
                            >
                              {isSelected && (
                                <div
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: "#14b8a6" }}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* GitHub import option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate("github");
                          setOpenapiUrl("");
                          setOpenapiFile(null);
                          setImportStep(1);
                          fetchInstallations();
                        }}
                        className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all duration-200"
                        style={{
                          backgroundColor: selectedTemplate === "github"
                            ? "rgba(20,184,166,0.08)"
                            : "var(--surface-bg)",
                          border: selectedTemplate === "github"
                            ? "1px solid rgba(20,184,166,0.3)"
                            : "1px solid var(--glass-border)",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedTemplate !== "github") {
                            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                            e.currentTarget.style.borderColor = "var(--glass-border)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTemplate !== "github") {
                            e.currentTarget.style.backgroundColor = "var(--surface-bg)";
                            e.currentTarget.style.borderColor = "var(--glass-border)";
                          }
                        }}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: selectedTemplate === "github"
                              ? "rgba(20,184,166,0.15)"
                              : "var(--surface-hover)",
                            border: selectedTemplate === "github"
                              ? "1px solid rgba(20,184,166,0.25)"
                              : "1px solid var(--glass-border)",
                          }}
                        >
                          <Github
                            className={`h-4 w-4 ${selectedTemplate === "github" ? "" : "text-[var(--text-dim)]"}`}
                            style={selectedTemplate === "github" ? { color: "#14b8a6" } : undefined}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${selectedTemplate === "github" ? "text-foreground" : "text-[var(--text-bright)]"}`}
                          >
                            {t("importFromGitHub")}
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              {t("proBadge")}
                            </span>
                          </p>
                          <p
                            className="text-xs text-[var(--text-dim)]"
                          >
                            {t("importFromGitHubDescription")}
                          </p>
                        </div>
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{
                            border: selectedTemplate === "github"
                              ? "2px solid #14b8a6"
                              : "2px solid var(--glass-border)",
                          }}
                        >
                          {selectedTemplate === "github" && (
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: "#14b8a6" }}
                            />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* ── Divider ── */}
                  <div
                    className="h-px bg-[var(--glass-border)]"
                  />

                  {/* ── Project name ── */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]"
                    >
                      {t("projectNameLabel")}
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setCreateError(null);
                      }}
                      placeholder={
                        selectedTemplate === "sdk-api-docs"
                          ? t("projectNamePlaceholderSdk")
                          : selectedTemplate === "product-docs"
                            ? t("projectNamePlaceholderProduct")
                            : t("projectNamePlaceholderDefault")
                      }
                      autoFocus
                      className="w-full rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-[var(--text-dim)] outline-none transition-all duration-200"
                      style={{
                        backgroundColor: "var(--surface-hover)",
                        border: "1px solid var(--glass-border)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(20,184,166,0.4)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(20,184,166,0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--glass-border)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  {/* ── OpenAPI spec (sdk-api-docs only) ── */}
                  {selectedTemplate === "sdk-api-docs" && (
                    <div
                      className="space-y-3 rounded-xl p-4 bg-[var(--surface-bg)] border border-[var(--glass-border)]"
                    >
                      <div className="flex items-center justify-between">
                        <label
                          className="text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]"
                        >
                          {t("openapiSpecLabel")}
                        </label>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] bg-[var(--surface-hover)] text-[var(--text-dim)]"
                        >
                          {t("optionalBadge")}
                        </span>
                      </div>
                      {openapiFile ? (
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{
                            backgroundColor: "rgba(20,184,166,0.06)",
                            border: "1px solid rgba(20,184,166,0.15)",
                          }}
                        >
                          <FileText className="h-4 w-4 shrink-0" style={{ color: "#14b8a6" }} />
                          <span className="text-sm truncate flex-1 text-[var(--text-medium)]">
                            {openapiFile.name}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-xs transition-colors text-[var(--text-dim)] hover:text-red-400"
                            onClick={() => {
                              setOpenapiFile(null);
                              if (openapiFileRef.current) openapiFileRef.current.value = "";
                            }}
                          >
                            {t("remove")}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <LinkIcon
                              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]"
                            />
                            <input
                              type="text"
                              placeholder="https://api.example.com/openapi.json"
                              value={openapiUrl}
                              onChange={(e) => setOpenapiUrl(e.target.value)}
                              autoComplete="off"
                              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm text-foreground placeholder-[var(--text-dim)] outline-none transition-all"
                              style={{
                                backgroundColor: "var(--surface-bg)",
                                border: "1px solid var(--glass-border)",
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "var(--glass-border)";
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-[var(--glass-border)]" />
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t("or")}</span>
                            <div className="h-px flex-1 bg-[var(--glass-border)]" />
                          </div>
                          <input
                            ref={openapiFileRef}
                            type="file"
                            accept=".json,.yaml,.yml"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setOpenapiFile(file);
                                setOpenapiUrl("");
                              }
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => openapiFileRef.current?.click()}
                            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm transition-all text-[var(--text-dim)]"
                            style={{
                              border: "1px dashed var(--glass-border)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                              e.currentTarget.style.color = "var(--text-medium)";
                              e.currentTarget.style.backgroundColor = "rgba(20,184,166,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--glass-border)";
                              e.currentTarget.style.color = "var(--text-dim)";
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {t("uploadFile")}
                          </button>
                        </>
                      )}
                      <p className="text-xs text-[var(--text-dim)]">
                        {t("openapiHint")}
                      </p>
                    </div>
                  )}

                  {/* ── Plan selection ── */}
                  {selectedTemplate !== "github" && (
                    <>
                      <div className="h-px bg-[var(--glass-border)]" />
                      <div>
                        <label className="mb-2.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]">
                          {t("planLabel")}
                        </label>
                        <PlanSelector
                          selectedPlan={selectedPlan}
                          onPlanChange={setSelectedPlan}
                          compact
                          trialsRemaining={trialAvailability?.trialsRemaining}
                          projectHadTrial={false}
                        />
                      </div>
                    </>
                  )}

                  {/* ── GitHub import flow ── */}
                  {selectedTemplate === "github" && (
                    <div
                      className="space-y-4 rounded-xl p-4 bg-[var(--surface-bg)] border border-[var(--glass-border)]"
                    >
                      {/* Step indicator */}
                      {installations.length > 0 && (
                        <div className="flex items-center gap-2">
                          {[
                            { n: 1, label: t("githubStepAccount") },
                            { n: 2, label: t("githubStepRepository") },
                            { n: 3, label: t("githubStepConfigure") },
                          ].map((step: any, i: number) => {
                            const stepDone = (step.n === 1 && selectedInstallation) ||
                              (step.n === 2 && selectedRepo) ||
                              (step.n === 3 && importStep >= 4);
                            const stepActive = (step.n === 1 && !selectedInstallation) ||
                              (step.n === 2 && selectedInstallation && !selectedRepo) ||
                              (step.n === 3 && selectedRepo && importStep < 4);
                            return (
                              <div key={step.n} className="flex items-center gap-2 flex-1">
                                <div
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                  style={{
                                    backgroundColor: stepDone
                                      ? "rgba(20,184,166,0.2)"
                                      : stepActive
                                        ? "rgba(20,184,166,0.1)"
                                        : "var(--surface-hover)",
                                    border: stepDone
                                      ? "1px solid rgba(20,184,166,0.4)"
                                      : stepActive
                                        ? "1px solid rgba(20,184,166,0.25)"
                                        : "1px solid var(--glass-border)",
                                    color: stepDone || stepActive
                                      ? "#14b8a6"
                                      : "var(--text-dim)",
                                  }}
                                >
                                  {stepDone ? (
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                      <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  ) : (
                                    step.n
                                  )}
                                </div>
                                <span
                                  className="text-xs truncate"
                                  style={{
                                    color: stepDone || stepActive
                                      ? "var(--text-medium)"
                                      : "var(--text-dim)",
                                  }}
                                >
                                  {step.label}
                                </span>
                                {i < 2 && (
                                  <div
                                    className="h-px flex-1"
                                    style={{
                                      backgroundColor: stepDone
                                        ? "rgba(20,184,166,0.2)"
                                        : "var(--glass-border)",
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {importLoading && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#14b8a6" }} />
                        </div>
                      )}

                      {!importLoading && importStep >= 1 && installations.length === 0 && (
                        <div className="py-4 text-center space-y-3">
                          <div
                            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)]"
                          >
                            <Github className="h-5 w-5 text-[var(--text-dim)]" />
                          </div>
                          <p className="text-sm text-[var(--text-dim)]">
                            {t("noInstallationsFound")}
                          </p>
                          {githubAppUrl && (
                            <a
                              href={githubAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all text-[var(--text-medium)] border border-[var(--glass-border)] hover:bg-[var(--surface-hover)]"
                            >
                              <Github className="h-4 w-4" />
                              {t("installGitHubApp")}
                            </a>
                          )}
                          <p className="text-xs text-[var(--text-dim)]">
                            {t("afterInstallingHint")}
                          </p>
                        </div>
                      )}

                      {!importLoading && importStep >= 1 && installations.length > 0 && (
                        <div className="space-y-2">
                          <label
                            className="text-xs font-medium text-[var(--text-dim)]"
                          >
                            {t("githubAccountLabel")}
                          </label>
                          <Select
                            value={selectedInstallation}
                            onValueChange={(val) => {
                              setSelectedInstallation(val);
                              setSelectedRepo("");
                              setImportStep(2);
                              fetchRepos(val);
                            }}
                          >
                            <SelectTrigger
                              className="!rounded-lg !text-sm text-[var(--text-bright)]"
                              style={{
                                backgroundColor: "var(--surface-hover)",
                                border: "1px solid var(--glass-border)",
                              }}
                            >
                              <SelectValue placeholder={t("selectAccountPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {installations.map((inst: any) => (
                                <SelectItem key={inst.installationId} value={inst.installationId.toString()}>
                                  {inst.accountLogin}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {githubAppUrl && (
                            <p className="text-xs text-[var(--text-dim)]">
                              {t("dontSeeAccount")}{" "}
                              <a
                                href={githubAppUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#14b8a6" }}
                                className="hover:underline"
                              >
                                {t("installTheGitHubApp")}
                              </a>
                            </p>
                          )}
                        </div>
                      )}

                      {!importLoading && importStep >= 2 && selectedInstallation && (
                        <div className="space-y-2">
                          <label
                            className="text-xs font-medium text-[var(--text-dim)]"
                          >
                            {t("repositoryLabel")}
                          </label>
                          <Select
                            value={selectedRepo}
                            onValueChange={(val) => {
                              setSelectedRepo(val);
                              const repo = repos.find((r: any) => r.fullName === val);
                              if (repo) setSelectedBranch(repo.defaultBranch);
                              setImportStep(4);
                            }}
                          >
                            <SelectTrigger
                              className="!rounded-lg !text-sm text-[var(--text-bright)]"
                              style={{
                                backgroundColor: "var(--surface-hover)",
                                border: "1px solid var(--glass-border)",
                              }}
                            >
                              <SelectValue placeholder={t("selectRepositoryPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {repos.map((repo: any) => (
                                <SelectItem key={repo.id} value={repo.fullName}>
                                  {repo.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {importStep >= 3 && selectedRepo && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label
                              className="text-xs font-medium text-[var(--text-dim)]"
                            >
                              {t("branchLabel")}
                            </label>
                            <input
                              type="text"
                              value={selectedBranch}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              placeholder="main"
                              className="w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder-[var(--text-dim)] outline-none transition-all"
                              style={{
                                backgroundColor: "var(--surface-hover)",
                                border: "1px solid var(--glass-border)",
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "var(--glass-border)";
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              className="text-xs font-medium text-[var(--text-dim)]"
                            >
                              {t("docsPathLabel")}
                            </label>
                            <input
                              type="text"
                              value={docsPath}
                              onChange={(e) => setDocsPath(e.target.value)}
                              placeholder="docs/"
                              className="w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder-[var(--text-dim)] outline-none transition-all"
                              style={{
                                backgroundColor: "var(--surface-hover)",
                                border: "1px solid var(--glass-border)",
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "var(--glass-border)";
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  className="flex shrink-0 items-center justify-end gap-3 px-6 py-4 mt-1"
                  style={{ borderTop: "1px solid var(--glass-border)" }}
                >
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all text-[var(--text-dim)] hover:text-[var(--text-bright)] hover:bg-[var(--surface-hover)]"
                    style={{
                      border: "1px solid var(--glass-border)",
                      backgroundColor: "transparent",
                    }}
                  >
                    {t("cancelButton")}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !name.trim() ||
                      isCreating ||
                      (selectedTemplate === "github" && importStep < 4)
                    }
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor: (!name.trim() || isCreating || (selectedTemplate === "github" && importStep < 4))
                        ? "rgba(20,184,166,0.3)"
                        : "#14b8a6",
                      color: "var(--color-primary-foreground)",
                      boxShadow: (!name.trim() || isCreating || (selectedTemplate === "github" && importStep < 4))
                        ? "none"
                        : "0 0 20px rgba(20,184,166,0.2)",
                    }}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {selectedTemplate === "github" ? t("importing") : t("creating")}
                      </>
                    ) : selectedTemplate === "github" ? (
                      <>
                        <Github className="h-4 w-4" />
                        {t("importButton")}
                      </>
                    ) : selectedPlan !== "free" ? (
                      <>
                        <Plus className="h-4 w-4" />
                        {(trialAvailability?.trialsRemaining ?? 3) > 0
                          ? t("createAndStartTrial")
                          : t("createAndSubscribe")}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        {t("createProject")}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Projects grid */}
      {projects === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i: any) => (
            <div
              key={i}
              className="rounded-2xl p-6 bg-[var(--surface-bg)] border border-[var(--glass-border)]"
            >
              <div
                className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-active)]"
              />
              <div
                className="mb-2 h-5 w-32 animate-pulse rounded bg-[var(--surface-active)]"
              />
              <div
                className="h-4 w-48 animate-pulse rounded bg-[var(--surface-hover)]"
              />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-16 bg-[var(--surface-bg)] border border-[var(--glass-border)]"
        >
          <img
            src="/mascot-standard.svg"
            alt=""
            className="mb-4 h-32 w-32 opacity-90"
            style={{ filter: "drop-shadow(0 4px 12px rgba(20,184,166,0.15))" }}
          />
          <h3
            className="mb-2 text-lg font-semibold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("noProjectsYet")}
          </h3>
          <p
            className="mb-6 max-w-sm text-center text-sm text-[var(--text-dim)]"
          >
            {canCreateProjects
              ? t("emptyStateCanCreate")
              : t("emptyStateNoPermission")}
          </p>
          {canCreateProjects && (
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
              style={{
                backgroundColor: "#14b8a6",
                boxShadow: "0 0 20px rgba(20,184,166,0.2)",
              }}
            >
              <Plus className="h-4 w-4" />
              {t("createProject")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: Doc<"projects">, index: number) => (
            <Link
              key={project._id}
              href={`/projects/${project._id}/editor`}
              className="group relative rounded-2xl p-6 transition-all duration-300"
              style={{
                backgroundColor: "var(--surface-bg)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                animation: `projectCardIn 0.4s ease-out ${index * 0.05}s both`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                e.currentTarget.style.backgroundColor = "var(--surface-bg)";
                e.currentTarget.style.boxShadow = "0 8px 40px rgba(0,0,0,0.3), 0 0 30px rgba(20,184,166,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--glass-border)";
                e.currentTarget.style.backgroundColor = "var(--surface-bg)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Project icon */}
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "rgba(20,184,166,0.1)",
                  border: "1px solid rgba(20,184,166,0.15)",
                }}
              >
                <FileText className="h-5 w-5" style={{ color: "#14b8a6" }} />
              </div>

              {/* Project name + arrow */}
              <div className="mb-1 flex items-center justify-between">
                <h3
                  className="text-base font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {project.name}
                </h3>
                <ArrowUpRight
                  className="h-4 w-4 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-[var(--text-dim)]"
                />
              </div>

              {/* Description */}
              <p
                className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--text-dim)]"
              >
                {project.description || t("noDescription")}
              </p>

              {/* Metadata row */}
              <div className="flex items-center gap-3">
                {/* Slug */}
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-[var(--surface-hover)] text-[var(--text-dim)]"
                >
                  <Globe className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{project.slug}</span>
                </div>

                {/* Time */}
                <div
                  className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]"
                >
                  <Clock className="h-3 w-3" />
                  {relTime(project.updatedAt)}
                </div>
              </div>

              {/* Plan badge */}
              <div
                className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor:
                    project.plan === "ultimate"
                      ? "rgba(168, 85, 247, 0.1)"
                      : project.plan === "pro"
                        ? "rgba(59, 130, 246, 0.1)"
                        : "var(--surface-hover)",
                  color:
                    project.plan === "ultimate"
                      ? "#a855f7"
                      : project.plan === "pro"
                        ? "#3b82f6"
                        : "var(--text-dim)",
                  border: `1px solid ${
                    project.plan === "ultimate"
                      ? "rgba(168, 85, 247, 0.2)"
                      : project.plan === "pro"
                        ? "rgba(59, 130, 246, 0.2)"
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

              {/* Custom domain badge */}
              {project.settings?.customDomain && (
                <div
                  className="mt-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
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
      )}

      {/* Keyframes for card animation */}
      <style>{`
        @keyframes projectCardIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
