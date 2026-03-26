"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Input } from "@inkloom/ui/input";
import { Badge } from "@inkloom/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@inkloom/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@inkloom/ui/select";
import {
  Check,
  ChevronDown,
  GitBranch,
  GitPullRequest,
  Github,
  Loader2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";
import { CreateMergeRequestDialog } from "@/components/merge-request/create-dialog";
import { usePermissions } from "@/components/dashboard/permission-guard";
import { trackEvent } from "@/lib/analytics";
import { captureException } from "@/lib/sentry";
import { getErrorTranslationKey } from "@/lib/i18n-errors";

/** Minimal GitHub connection info passed from the parent (platform-only). */
export interface GitHubConnectionInfo {
  installationId: number;
  owner: string;
  repo: string;
  defaultBranch?: string;
}

interface RemoteBranch {
  name: string;
  isDefault: boolean;
}

/** Prefix used to distinguish remote branch values in the Select component. */
const REMOTE_PREFIX = "remote:";

interface BranchSwitcherProps {
  projectId: Id<"projects">;
  currentBranchId: Id<"branches">;
  onSwitchBranch: (branchId: Id<"branches">, branchName?: string) => void;
  onFlushContent?: () => Promise<void>;
  canManage?: boolean;
  canDelete?: boolean;
  /** When set to true externally, opens the create branch dialog */
  externalCreateOpen?: boolean;
  /** Called when the external create dialog state should be reset */
  onExternalCreateOpenChange?: (open: boolean) => void;
  /** GitHub connection details for the project (platform-only, optional). */
  githubConnection?: GitHubConnectionInfo | null;
}

export function BranchSwitcher({
  projectId,
  currentBranchId,
  onSwitchBranch,
  onFlushContent,
  canManage = true,
  canDelete = false,
  externalCreateOpen,
  onExternalCreateOpenChange,
  githubConnection,
}: BranchSwitcherProps) {
  const t = useTranslations("editor.branchSwitcher");
  const tc = useTranslations("common");
  const branches = useQuery(api.branches.list, { projectId });
  const createBranch = useMutation(api.branches.create);
  const renameBranch = useMutation(api.branches.rename);
  const deleteBranch = useMutation(api.branches.remove);
  const toggleLockMutation = useMutation(api.branches.toggleLock);
  const { canChangeRoles } = usePermissions();
  const { userId: currentUserId } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [newBranchName, setNewBranchName] = useState("");
  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [renameBranchId, setRenameBranchId] = useState<Id<"branches"> | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteBranchId, setDeleteBranchId] = useState<Id<"branches"> | null>(null);

  const [createMROpen, setCreateMROpen] = useState(false);
  const [createMRBranchId, setCreateMRBranchId] = useState<Id<"branches"> | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remote branch state
  const [showRemote, setShowRemote] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<RemoteBranch[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteFetchError, setRemoteFetchError] = useState<string | null>(null);

  // Allow parent to trigger the create branch dialog externally
  useEffect(() => {
    if (externalCreateOpen) {
      setError(null);
      setNewBranchName("");
      setSourceBranchId(currentBranchId);
      setShowRemote(false);
      setCreateOpen(true);
      onExternalCreateOpenChange?.(false);
    }
  }, [externalCreateOpen, currentBranchId, onExternalCreateOpenChange]);

  // If GitHub connection is removed while dialog is open, fall back to local-only
  useEffect(() => {
    if (!githubConnection && showRemote) {
      setShowRemote(false);
      setRemoteBranches([]);
      // If user had a remote branch selected, clear it
      if (sourceBranchId.startsWith(REMOTE_PREFIX)) {
        setSourceBranchId(currentBranchId);
      }
    }
  }, [githubConnection, showRemote, sourceBranchId, currentBranchId]);

  const currentBranch = branches?.find((b: Doc<"branches">) => b._id === currentBranchId);
  const defaultBranch = branches?.find((b: Doc<"branches">) => b.isDefault);
  const isOnNonDefaultBranch = currentBranch && !currentBranch.isDefault;

  const hasChanges = useQuery(
    api.branches.hasChanges,
    isOnNonDefaultBranch && defaultBranch
      ? { branchId: currentBranchId, compareToBranchId: defaultBranch._id }
      : "skip"
  );

  const openMR = useQuery(
    api.mergeRequests.getOpenForBranch,
    isOnNonDefaultBranch
      ? { sourceBranchId: currentBranchId }
      : "skip"
  );

  const fetchRemoteBranches = useCallback(async () => {
    if (!githubConnection) return;
    setIsLoadingRemote(true);
    setRemoteFetchError(null);
    try {
      const params = new URLSearchParams({
        installationId: String(githubConnection.installationId),
        owner: githubConnection.owner,
        repo: githubConnection.repo,
      });
      if (githubConnection.defaultBranch) {
        params.set("defaultBranch", githubConnection.defaultBranch);
      }
      const res = await fetch(`/api/github/branches?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch remote branches");
      }
      const data = await res.json();
      setRemoteBranches(data.branches ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch remote branches";
      setRemoteFetchError(message);
      captureException(e, { source: "branch-switcher", action: "fetch-remote-branches" });
    } finally {
      setIsLoadingRemote(false);
    }
  }, [githubConnection]);

  const handleToggleRemote = useCallback(() => {
    if (!githubConnection) return;
    const next = !showRemote;
    setShowRemote(next);
    if (next) {
      fetchRemoteBranches();
    } else {
      // If switching back to local and user had a remote branch selected, reset
      if (sourceBranchId.startsWith(REMOTE_PREFIX)) {
        setSourceBranchId(currentBranchId);
      }
    }
  }, [githubConnection, showRemote, fetchRemoteBranches, sourceBranchId, currentBranchId]);

  const isRemoteSource = sourceBranchId.startsWith(REMOTE_PREFIX);
  const selectedRemoteBranchName = isRemoteSource
    ? sourceBranchId.slice(REMOTE_PREFIX.length)
    : null;

  const handleCreate = async () => {
    if (!newBranchName.trim() || !sourceBranchId) return;
    setIsCreating(true);
    setError(null);
    try {
      if (isRemoteSource && selectedRemoteBranchName) {
        // Import from remote GitHub branch
        const res = await fetch("/api/github/import-branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            remoteBranch: selectedRemoteBranchName,
            localBranchName: newBranchName.trim().toLowerCase(),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t("failedToImportBranch"));
        }
        const data = await res.json();
        trackEvent("branch_imported_from_github", { projectId });
        setNewBranchName("");
        setSourceBranchId("");
        setShowRemote(false);
        setCreateOpen(false);
        onSwitchBranch(data.branchId as Id<"branches">, newBranchName.trim().toLowerCase());
      } else {
        // Local branch creation (existing behavior)
        if (onFlushContent) await onFlushContent();
        const branchId = await createBranch({
          projectId,
          name: newBranchName.trim().toLowerCase(),
          sourceBranchId: sourceBranchId as Id<"branches">,
        });
        trackEvent("branch_created", { projectId });
        setNewBranchName("");
        setSourceBranchId("");
        setShowRemote(false);
        setCreateOpen(false);
        onSwitchBranch(branchId, newBranchName.trim().toLowerCase());
      }
    } catch (e) {
      captureException(e, { source: "branch-switcher", action: "create-branch", projectId });
      const key = getErrorTranslationKey(e instanceof Error ? e.message : "");
      setError(key ? t(key) : (e instanceof Error ? e.message : t("failedToCreateBranch")));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameBranchId || !renameName.trim()) return;
    setIsRenaming(true);
    setError(null);
    try {
      await renameBranch({
        branchId: renameBranchId,
        name: renameName.trim().toLowerCase(),
      });
      setRenameOpen(false);
      setRenameBranchId(null);
      setRenameName("");
    } catch (e) {
      captureException(e, { source: "branch-switcher", action: "rename-branch", branchId: renameBranchId });
      const key = getErrorTranslationKey(e instanceof Error ? e.message : "");
      setError(key ? t(key) : t("failedToRenameBranch"));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBranchId) return;
    setIsDeleting(true);
    setError(null);
    try {
      // If deleting the current branch, switch to default first
      if (deleteBranchId === currentBranchId) {
        const defaultBranch = branches?.find((b: Doc<"branches">) => b.isDefault);
        if (defaultBranch) {
          onSwitchBranch(defaultBranch._id, defaultBranch.name);
        }
      }
      await deleteBranch({ branchId: deleteBranchId });
      setDeleteOpen(false);
      setDeleteBranchId(null);
    } catch (e) {
      captureException(e, { source: "branch-switcher", action: "delete-branch", branchId: deleteBranchId });
      const key = getErrorTranslationKey(e instanceof Error ? e.message : "");
      setError(key ? t(key) : t("failedToDeleteBranch"));
    } finally {
      setIsDeleting(false);
    }
  };

  const openRenameDialog = (branchId: Id<"branches">, name: string) => {
    setRenameBranchId(branchId);
    setRenameName(name);
    setError(null);
    setRenameOpen(true);
  };

  const openDeleteDialog = (branchId: Id<"branches">) => {
    setDeleteBranchId(branchId);
    setError(null);
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="flex w-full items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-medium)]"
            >
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[100px] truncate">{currentBranch?.name ?? "..."}</span>
              <ChevronDown className="h-3 w-3 opacity-40" />
            </button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {branches?.map((branch: Doc<"branches">) => (
            <DropdownMenuItem
              key={branch._id}
              className="flex items-center justify-between"
              onClick={() => onSwitchBranch(branch._id, branch.name)}
            >
              <div className="flex items-center gap-2">
                {branch._id === currentBranchId ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <div className="w-3.5" />
                )}
                <span className="truncate">{branch.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {branch.isDefault && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {t("default")}
                  </Badge>
                )}
                {canManage && !branch.isDefault && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameDialog(branch._id, branch.name);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {t("rename")}
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(branch._id);
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          {canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setError(null);
                  setNewBranchName("");
                  setSourceBranchId(currentBranchId);
                  setShowRemote(false);
                  setCreateOpen(true);
                }}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t("createBranch")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
        </DropdownMenu>

        {/* Lock toggle — only on default branch, only interactive for admins */}
        {currentBranch && currentBranch.isDefault && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={async () => {
                    if (canChangeRoles && !isTogglingLock) {
                      setIsTogglingLock(true);
                      setError(null);
                      try {
                        await toggleLockMutation({ branchId: currentBranchId, userId: currentUserId });
                      } catch (e) {
                        captureException(e, { source: "branch-switcher", action: "toggle-lock", branchId: currentBranchId });
                        const key = getErrorTranslationKey(e instanceof Error ? e.message : "");
                        setError(key ? t(key) : (e instanceof Error ? e.message : t("failedToToggleLock")));
                      } finally {
                        setIsTogglingLock(false);
                      }
                    }
                  }}
                  disabled={!canChangeRoles || isTogglingLock}
                  className={`ml-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    !canChangeRoles
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-[var(--surface-active)]"
                  }`}
                >
                  {isTogglingLock ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />
                  ) : currentBranch.isLocked ? (
                    <Lock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  ) : (
                    <LockOpen className="h-3.5 w-3.5 text-[var(--text-dim)]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {error
                  ? error
                  : !canChangeRoles
                    ? t("lockPermissionRequired")
                    : currentBranch.isLocked
                      ? t("unlockDefaultBranch")
                      : t("lockDefaultBranch")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Merge button — right-aligned, visible on non-default branches */}
        {isOnNonDefaultBranch && (
          <div className="ml-auto">
            {openMR ? (
              <Link
                href={`/projects/${projectId}/merge-requests/${openMR._id}`}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                {t("merge")}
              </Link>
            ) : (
              <button
                onClick={() => {
                  setCreateMRBranchId(currentBranchId);
                  setCreateMROpen(true);
                }}
                disabled={hasChanges === false}
                title={
                  hasChanges === false
                    ? t("noChangesTitle")
                    : t("createMergeRequest")
                }
                className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${hasChanges ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400" : "text-[var(--text-dim)] hover:bg-[var(--surface-active)] hover:text-[var(--text-medium)]"}`}
              >
                <GitPullRequest className="h-3.5 w-3.5" />
                {t("merge")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create branch dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createBranchTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("branchNameLabel")}</label>
              <Input
                value={newBranchName}
                onChange={(e) => {
                  setNewBranchName(e.target.value);
                  setError(null);
                }}
                placeholder={t("branchNamePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t("branchNameHint")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("branchFromLabel")}</label>
              <div className="flex items-center gap-2">
                <Select
                  value={sourceBranchId}
                  onValueChange={(val) => {
                    setSourceBranchId(val);
                    setError(null);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("selectSourceBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("localBranchesLabel")}</SelectLabel>
                      {branches?.map((branch: Doc<"branches">) => (
                        <SelectItem key={branch._id} value={branch._id}>
                          {branch.name}
                          {branch.isDefault ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {showRemote && (
                      <SelectGroup>
                        <SelectLabel>
                          <span className="flex items-center gap-1.5">
                            <Github className="h-3 w-3" />
                            {t("remoteBranchesLabel")}
                          </span>
                        </SelectLabel>
                        {isLoadingRemote && (
                          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("loadingRemoteBranches")}
                          </div>
                        )}
                        {remoteFetchError && (
                          <div className="px-2 py-1.5 text-xs text-destructive">
                            {remoteFetchError}
                          </div>
                        )}
                        {!isLoadingRemote && !remoteFetchError && remoteBranches.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {t("noRemoteBranches")}
                          </div>
                        )}
                        {!isLoadingRemote && remoteBranches.map((rb) => (
                          <SelectItem
                            key={`remote-${rb.name}`}
                            value={`${REMOTE_PREFIX}${rb.name}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Github className="h-3 w-3 shrink-0 opacity-60" />
                              {rb.name}
                              {rb.isDefault ? " (default)" : ""}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleToggleRemote}
                        disabled={!githubConnection}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          showRemote
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        } ${!githubConnection ? "opacity-40 cursor-not-allowed" : ""}`}
                        aria-label={t("toggleRemoteBranches")}
                        aria-pressed={showRemote}
                      >
                        <Github className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {githubConnection
                        ? showRemote
                          ? t("hideRemoteBranches")
                          : t("showRemoteBranches")
                        : t("connectGithubToImport")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {isRemoteSource && (
                <p className="text-xs text-muted-foreground">
                  {t("importRemoteBranchHint")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newBranchName.trim() || !sourceBranchId || isCreating}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRemoteSource ? t("importAndCreate") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameBranchTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Input
              value={renameName}
              onChange={(e) => {
                setRenameName(e.target.value);
                setError(null);
              }}
              placeholder={t("renameNewNamePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || isRenaming}
            >
              {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("rename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteBranchTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteBranchWarning")}
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create merge request dialog */}
      <CreateMergeRequestDialog
        projectId={projectId}
        currentBranchId={createMRBranchId ?? undefined}
        open={createMROpen}
        onOpenChange={setCreateMROpen}
      />
    </>
  );
}
