"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  FileText,
  Book,
  Code,
  Loader2,
  Plus,
  Clock,
  Globe,
  ArrowUpRight,
} from "lucide-react";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { useAppContext } from "@/hooks/use-app-context";
import { captureException } from "@/lib/sentry";

const templateIcons = {
  file: FileText,
  book: Book,
  code: Code,
} as const;

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageContent />
    </Suspense>
  );
}

function ProjectsPageContent() {
  const t = useTranslations("dashboard.projects");
  const tc = useTranslations("common");

  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }
  const router = useRouter();
  const searchParams = useSearchParams();

  const { tenantId } = useAppContext();
  const projects = useQuery(
    api.projects.listByOrg,
    tenantId ? { workosOrgId: tenantId } : "skip"
  );

  const createProject = useMutation(api.projects.create);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Auto-open dialog from URL param
  useEffect(() => {
    if (searchParams.get("newProject") === "true") {
      setIsOpen(true);
    }
  }, [searchParams]);

  // Clean up URL params when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && searchParams.get("newProject")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("newProject");
      window.history.replaceState({}, "", url.pathname);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      // Pass workosOrgId for platform mode compatibility (core mode ignores it)
      const projectId = await (createProject as unknown as (args: Record<string, unknown>) => Promise<string>)({
        name: name.trim(),
        templateId: selectedTemplate,
        workosOrgId: tenantId,
      });

      setName("");
      setSelectedTemplate("blank");
      setIsOpen(false);
      router.push(`/projects/${projectId}/editor`);
    } catch (error) {
      captureException(error, { source: "projects-page", action: "create-project" });
      setCreateError(t("failedToCreate"));
    } finally {
      setIsCreating(false);
    }
  };

  const isLoading = projects === undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <style>{`
        @keyframes projCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            {t("subtitle")}
          </p>
        </div>

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
              {t("createProject")}
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg" style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--glass-border)" }}>
            <DialogTitle
              className="text-lg font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("newProject")}
            </DialogTitle>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Project name */}
              <div>
                <label className="mb-1.5 block text-sm text-[var(--text-dim)]">
                  {t("projectName")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("projectNamePlaceholder")}
                  className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--surface-hover)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--text-dim)] focus:border-teal-500/50 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Template selector */}
              <div>
                <label className="mb-1.5 block text-sm text-[var(--text-dim)]">
                  {t("template")}
                </label>
                <Select
                  value={selectedTemplate}
                  onValueChange={(v) => setSelectedTemplate(v as TemplateId)}
                >
                  <SelectTrigger className="w-full border-[var(--glass-border)] bg-[var(--surface-hover)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((tmpl) => {
                      const Icon = templateIcons[tmpl.icon as keyof typeof templateIcons] || FileText;
                      return (
                        <SelectItem key={tmpl.id} value={tmpl.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-[var(--text-dim)]" />
                            <span>{tmpl.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}

              <button
                type="submit"
                disabled={!name.trim() || isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: "#14b8a6",
                  boxShadow: "0 0 20px rgba(20,184,166,0.2)",
                }}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  t("create")
                )}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-[var(--glass-border)] bg-[var(--surface-bg)] p-6"
            >
              <div className="mb-3 h-4 w-1/3 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-2/3 rounded bg-[var(--surface-hover)]" />
            </div>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: any, index: any) => (
            <Link
              key={project._id}
              href={`/projects/${project._id}/editor`}
              className="group relative rounded-2xl p-6 transition-all duration-300"
              style={{
                backgroundColor: "var(--surface-bg)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                animation: `projCardIn 0.4s ease-out ${0.05 + index * 0.05}s both`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--glass-border)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
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
                <ArrowUpRight className="ml-auto h-4 w-4 text-[var(--text-dim)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>

              <h3
                className="mb-1 text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {project.name}
              </h3>

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
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
            style={{
              backgroundColor: "#14b8a6",
              boxShadow: "0 0 20px rgba(20,184,166,0.2)",
            }}
          >
            <Plus className="h-4 w-4" />
            {t("createFirstProject")}
          </button>
        </div>
      )}
    </div>
  );
}
