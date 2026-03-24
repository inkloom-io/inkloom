"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { getRelativeTimeKeyAndParams } from "@/lib/date-utils";
import { Button } from "@inkloom/ui/button";
import { Badge } from "@inkloom/ui/badge";
import {
  Card,
  CardContent,
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
} from "@inkloom/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inkloom/ui/select";
import {
  ArrowLeft,
  GitBranch,
  GitPullRequest,
  Plus,
  ArrowRight,
  Loader2,
  GitMerge,
  XCircle,
  FileText,
  FilePlus,
  FileMinus,
  FolderPlus,
  FolderMinus,
} from "lucide-react";
import { captureException } from "@/lib/sentry";

// ── Helpers ───────────────────────────────────────────────────────────────

type MRStatus = "open" | "merged" | "closed";

// ── Create Merge Request Dialog ───────────────────────────────────────────

function CreateMergeRequestDialog({
  projectId,
  currentUserId,
  open,
  onOpenChange,
}: {
  projectId: Id<"projects">;
  currentUserId: Id<"users"> | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("mergeRequests.list");
  const branches = useQuery(api.branches.list, { projectId });
  const createMR = useMutation(api.mergeRequests.create);

  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate title when source/target branches change
  useEffect(() => {
    if (sourceBranchId && targetBranchId && branches) {
      const source = branches.find((b: any) => b._id === sourceBranchId);
      const target = branches.find((b: any) => b._id === targetBranchId);
      if (source && target) {
        setTitle(t("mergeInto", { source: source.name, target: target.name }));
      }
    }
  }, [sourceBranchId, targetBranchId, branches]);

  // Pre-select the default branch as target
  useEffect(() => {
    if (branches && !targetBranchId) {
      const defaultBranch = branches.find((b: any) => b.isDefault);
      if (defaultBranch) {
        setTargetBranchId(defaultBranch._id);
      }
    }
  }, [branches, targetBranchId]);

  const handleSubmit = async () => {
    if (!sourceBranchId || !targetBranchId || !title.trim() || !currentUserId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createMR({
        projectId,
        sourceBranchId: sourceBranchId as Id<"branches">,
        targetBranchId: targetBranchId as Id<"branches">,
        title: title.trim(),
        description: description.trim() || undefined,
        createdBy: currentUserId,
      });
      // Reset form and close dialog
      setSourceBranchId("");
      setTargetBranchId("");
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (err) {
      captureException(err, { source: "merge-requests-page", action: "create-merge-request", projectId });
      setError(t("failedToCreate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !!sourceBranchId &&
    !!targetBranchId &&
    sourceBranchId !== targetBranchId &&
    !!title.trim() &&
    !!currentUserId &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("createDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source Branch */}
          <div className="space-y-2">
            <Label htmlFor="source-branch">{t("sourceBranchLabel")}</Label>
            <Select value={sourceBranchId} onValueChange={setSourceBranchId}>
              <SelectTrigger id="source-branch">
                <SelectValue placeholder={t("selectSourceBranch")} />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch: any) => (
                  <SelectItem key={branch._id} value={branch._id}>
                    <span className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      {branch.name}
                      {branch.isDefault && (
                        <span className="text-xs text-muted-foreground">{t("defaultBadge")}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Branch */}
          <div className="space-y-2">
            <Label htmlFor="target-branch">{t("targetBranchLabel")}</Label>
            <Select value={targetBranchId} onValueChange={setTargetBranchId}>
              <SelectTrigger id="target-branch">
                <SelectValue placeholder={t("selectTargetBranch")} />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch: any) => (
                  <SelectItem key={branch._id} value={branch._id}>
                    <span className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      {branch.name}
                      {branch.isDefault && (
                        <span className="text-xs text-muted-foreground">{t("defaultBadge")}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceBranchId && targetBranchId && sourceBranchId === targetBranchId && (
            <p className="text-xs text-destructive">
              {t("branchesMustDiffer")}
            </p>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="mr-title">{t("titleLabel")}</Label>
            <Input
              id="mr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="mr-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="mr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancelButton")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              <>
                <GitPullRequest className="mr-2 h-4 w-4" />
                {t("createMergeRequest")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MRStatus }) {
  const t = useTranslations("mergeRequests.list");
  switch (status) {
    case "open":
      return (
        <Badge className="bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/15">
          <GitPullRequest className="mr-1 h-3 w-3" />
          {t("statusOpen")}
        </Badge>
      );
    case "merged":
      return (
        <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/20 hover:bg-purple-500/15">
          <GitMerge className="mr-1 h-3 w-3" />
          {t("statusMerged")}
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          {t("statusClosed")}
        </Badge>
      );
  }
}

// ── Diff Summary Badges ───────────────────────────────────────────────────

function DiffSummaryBadges({
  diffSummary,
}: {
  diffSummary?: {
    pagesAdded: number;
    pagesRemoved: number;
    pagesModified: number;
    foldersAdded: number;
    foldersRemoved: number;
  };
}) {
  const t = useTranslations("mergeRequests.list");
  if (!diffSummary) return null;

  const items: { icon: React.ReactNode; label: string; count: number; color: string }[] = [];

  if (diffSummary.pagesAdded > 0) {
    items.push({
      icon: <FilePlus className="h-3 w-3" />,
      label: t("diffAdded"),
      count: diffSummary.pagesAdded,
      color: "text-green-600",
    });
  }
  if (diffSummary.pagesModified > 0) {
    items.push({
      icon: <FileText className="h-3 w-3" />,
      label: t("diffModified"),
      count: diffSummary.pagesModified,
      color: "text-amber-600",
    });
  }
  if (diffSummary.pagesRemoved > 0) {
    items.push({
      icon: <FileMinus className="h-3 w-3" />,
      label: t("diffRemoved"),
      count: diffSummary.pagesRemoved,
      color: "text-red-600",
    });
  }
  if (diffSummary.foldersAdded > 0) {
    items.push({
      icon: <FolderPlus className="h-3 w-3" />,
      label: t("diffFoldersAdded"),
      count: diffSummary.foldersAdded,
      color: "text-green-600",
    });
  }
  if (diffSummary.foldersRemoved > 0) {
    items.push({
      icon: <FolderMinus className="h-3 w-3" />,
      label: t("diffFoldersRemoved"),
      count: diffSummary.foldersRemoved,
      color: "text-red-600",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item: any) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${item.color}`}
          style={{ borderColor: "var(--glass-border)" }}
        >
          {item.icon}
          {item.count} {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

interface MergeRequestsPageProps {
  params: Promise<{ projectId: string }>;
}

export default function MergeRequestsPage(props: MergeRequestsPageProps) {
  const { projectId } = use(props.params as Promise<{ projectId: string }>);
  const { userId: currentUserId } = useAuth();
  const t = useTranslations("mergeRequests.list");
  const tc = useTranslations("common");

  const [activeFilter, setActiveFilter] = useState<MRStatus>("open");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const mergeRequests = useQuery(api.mergeRequests.list, {
    projectId: projectId as Id<"projects">,
    status: activeFilter,
  });

  const counts = useQuery(api.mergeRequests.countByStatus, {
    projectId: projectId as Id<"projects">,
  });

  function relTime(ts: number) {
    const { key, params } = getRelativeTimeKeyAndParams(ts);
    return tc(key, params);
  }

  const filterTabs: { status: MRStatus; label: string; icon: React.ReactNode }[] = [
    {
      status: "open",
      label: t("statusOpen"),
      icon: <GitPullRequest className="h-3.5 w-3.5" />,
    },
    {
      status: "merged",
      label: t("statusMerged"),
      icon: <GitMerge className="h-3.5 w-3.5" />,
    },
    {
      status: "closed",
      label: t("statusClosed"),
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/editor`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-bright)]">
              {t("heading")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newMergeRequest")}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex gap-1 rounded-lg border p-1"
        style={{
          backgroundColor: "var(--surface-bg)",
          borderColor: "var(--glass-border)",
        }}
      >
        {filterTabs.map((tab: any) => {
          const count = counts?.[tab.status as keyof typeof counts] ?? 0;
          const isActive = activeFilter === tab.status;

          return (
            <button
              key={tab.status}
              onClick={() => setActiveFilter(tab.status)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  isActive
                    ? "bg-muted text-muted-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* MR List */}
      <div className="space-y-3">
        {mergeRequests === undefined ? (
          // Loading state
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mergeRequests.length === 0 ? (
          // Empty state
          <Card
            style={{
              backgroundColor: "var(--surface-bg)",
              borderColor: "var(--glass-border)",
            }}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <img
                src="/mascot-search.svg"
                alt=""
                className="mb-2 h-24 w-24 opacity-80"
              />
              <h3 className="mt-2 text-sm font-medium text-[var(--text-bright)]">
                {t("emptyTitle", { status: activeFilter })}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeFilter === "open"
                  ? t("emptyDescriptionOpen")
                  : t("emptyDescriptionOther", { status: activeFilter })}
              </p>
              {activeFilter === "open" && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newMergeRequest")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // MR cards
          mergeRequests.map((mr: any) => (
            <Link
              key={mr._id}
              href={`/projects/${projectId}/merge-requests/${mr._id}`}
              className="block"
            >
              <Card
                className="transition-colors hover:border-foreground/20"
                style={{
                  backgroundColor: "var(--surface-bg)",
                  borderColor: "var(--glass-border)",
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: title, branch info, meta */}
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Title row */}
                      <div className="flex items-center gap-2">
                        <StatusBadge status={mr.status} />
                        <h3 className="truncate text-sm font-medium text-[var(--text-bright)]">
                          {mr.title}
                        </h3>
                      </div>

                      {/* Branch info */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">
                          {mr.sourceBranchName}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <GitBranch className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">
                          {mr.targetBranchName}
                        </span>
                      </div>

                      {/* Diff summary */}
                      <DiffSummaryBadges diffSummary={mr.diffSummary} />

                      {/* Author + date */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {mr.creator && (
                          <div className="flex items-center gap-1.5">
                            {mr.creator.avatarUrl ? (
                              <img
                                src={mr.creator.avatarUrl}
                                alt={mr.creator.name ?? mr.creator.email ?? ""}
                                className="h-4 w-4 rounded-full"
                              />
                            ) : (
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-medium">
                                {(mr.creator.name ?? mr.creator.email ?? "?")[0]?.toUpperCase()}
                              </div>
                            )}
                            <span>{mr.creator.name ?? mr.creator.email ?? t("unknownUser")}</span>
                          </div>
                        )}
                        <span>{t("opened", { timeAgo: relTime(mr.createdAt) })}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <CreateMergeRequestDialog
        projectId={projectId as Id<"projects">}
        currentUserId={currentUserId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
