"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@inkloom/ui/card";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { Textarea } from "@inkloom/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@inkloom/ui/dialog";
import { Check, Globe, Loader2, Trash2, X } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";
import { DomainConfig } from "@/components/settings/domain-config";
import { DeploymentHistory } from "@/components/settings/deployment-history";
import { GatedSection } from "@/components/gated-section";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";

interface GeneralTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function GeneralTab({ projectId, project }: GeneralTabProps) {
  const router = useRouter();
  const t = useTranslations("settings.general");
  const tc = useTranslations("common");

  const updateProject = useMutation(api.projects.update);
  const updateCfSlug = useMutation(api.projects.updateCfSlug);
  const deleteProject = useMutation(api.projects.remove);

  // General settings
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [generalInitialized, setGeneralInitialized] = useState(false);

  // Deployment slug
  const [cfSlug, setCfSlug] = useState("");
  const [cfSlugInput, setCfSlugInput] = useState("");
  const [cfSlugInitialized, setCfSlugInitialized] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Real-time uniqueness check for cfSlug
  const cfSlugCheckResult = useQuery(
    api.projects.checkCfSlugAvailable,
    cfSlugInput.length >= 3 && cfSlugInput !== cfSlug
      ? { cfSlug: cfSlugInput, excludeProjectId: projectId as Id<"projects"> }
      : "skip"
  );

  const cfSlugFormatValid =
    cfSlugInput.length >= 3 &&
    cfSlugInput.length <= 40 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(cfSlugInput);
  const cfSlugChanged = cfSlugInput !== cfSlug;
  const cfSlugAvailable = cfSlugCheckResult?.available ?? null;

  // Initialize form when project loads
  useEffect(() => {
    if (project && !generalInitialized) {
      setName(project.name);
      setDescription(project.description || "");
      setGeneralInitialized(true);
    }
  }, [project, generalInitialized]);

  useEffect(() => {
    if (project && !cfSlugInitialized) {
      const slug = project.cfSlug || "";
      setCfSlug(slug);
      setCfSlugInput(slug);
      setCfSlugInitialized(true);
    }
  }, [project, cfSlugInitialized]);

  // Auto-save callbacks
  const saveGeneral = useCallback(
    async ({ name, description }: { name: string; description: string }) => {
      await updateProject({
        projectId: projectId as Id<"projects">,
        name,
        description,
      });
      trackEvent("project_settings_updated", { projectId, setting: "general" });
    },
    [updateProject, projectId]
  );

  const saveCfSlug = useCallback(
    async (slug: string) => {
      await updateCfSlug({
        projectId: projectId as Id<"projects">,
        cfSlug: slug,
      });
      setCfSlug(slug);
    },
    [updateCfSlug, projectId]
  );

  const generalStatus = useAutoSave(
    { name, description },
    saveGeneral,
    800,
    generalInitialized
  );

  const cfSlugStatus = useAutoSave(
    cfSlugInput,
    saveCfSlug,
    800,
    cfSlugInitialized && cfSlugFormatValid && (!cfSlugChanged || cfSlugAvailable === true)
  );

  const handleDelete = async () => {
    if (deleteConfirmation !== project.name) return;
    setIsDeleting(true);
    try {
      await deleteProject({ projectId: projectId as Id<"projects"> });
      trackEvent("project_deleted", { projectId });
      router.push("/projects");
    } catch (error) {
      console.error("Failed to delete:", error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Name & Description */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>
                {t("description")}
              </CardDescription>
            </div>
            <SaveStatus status={generalStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="name">{t("projectName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Deployment Slug */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("deploymentSlug")}</CardTitle>
              <CardDescription>
                {t("deploymentSlugDescription")}
              </CardDescription>
            </div>
            <SaveStatus status={cfSlugStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="cfSlug">{t("slugLabel")}</Label>
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Input
                id="cfSlug"
                value={cfSlugInput}
                onChange={(e) => setCfSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={t("slugPlaceholder")}
                className="pr-8"
                maxLength={40}
              />
              {cfSlugChanged && cfSlugInput.length >= 3 && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {cfSlugAvailable === null ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : cfSlugAvailable && cfSlugFormatValid ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              .{process.env.NEXT_PUBLIC_DOCS_DOMAIN || "pages.dev"}
            </span>
          </div>
          {cfSlugChanged && cfSlugInput.length >= 3 && cfSlugAvailable !== null && (
            <p className={`text-xs ${cfSlugAvailable && cfSlugFormatValid ? "text-green-600" : "text-destructive"}`}>
              {!cfSlugFormatValid
                ? t("slugFormatError")
                : cfSlugAvailable
                  ? t("slugAvailable")
                  : t("slugTaken")}
            </p>
          )}
          {cfSlugChanged && cfSlugInput.length > 0 && cfSlugInput.length < 3 && (
            <p className="text-xs text-destructive">{t("slugMinLength")}</p>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains */}
      <GatedSection
        feature="custom_domains"
        projectId={projectId as Id<"projects">}
        title={t("domains")}
        description={t("domainsDescription")}
        icon={Globe}
        valueProp={t("domainsValueProp")}
      >
        <DomainConfig
          projectId={projectId as Id<"projects">}
          cfSlug={project.cfSlug}
        />
      </GatedSection>

      {/* Deployment History */}
      <DeploymentHistory projectId={projectId as Id<"projects">} cfSlug={project.cfSlug} />

      {/* Delete Project */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
          <CardDescription>
            {t("dangerZoneDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirmation(""); }}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteProject")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t.rich("deleteConfirmDescription", {
                    projectName: project.name,
                    strong: (chunks: React.ReactNode) => <strong className="font-semibold">{chunks}</strong>,
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  {t.rich("typeToConfirm", {
                    projectName: project.name,
                    strong: (chunks: React.ReactNode) => <strong className="font-semibold">{chunks}</strong>,
                  })}
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  autoFocus
                  placeholder={project.name}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConfirmation !== project.name || isDeleting}
                >
                  {isDeleting ? t("deleting") : t("deleteProject")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
