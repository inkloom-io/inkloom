"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDataMutation, useDataQuery } from "@/data/hooks";
import { api } from "@/data/operations";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@inkloom/ui/button";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { Textarea } from "@inkloom/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { GitBranch, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";
import { ErrorAlert } from "@/components/error-alert";
import { captureException } from "@/lib/sentry";

interface CreateMergeRequestDialogProps {
  projectId: string;
  currentBranchId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMergeRequestDialog({
  projectId,
  currentBranchId,
  open,
  onOpenChange,
}: CreateMergeRequestDialogProps) {
  const t = useTranslations("mergeRequests.createDialog");
  const tc = useTranslations("common");
  const router = useRouter();
  const { userId } = useAuth();
  const branches = useDataQuery(api.branches.list, { projectId });
  const createMergeRequest = useDataMutation(api.mergeRequests.create);

  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-select source branch if provided
  useEffect(() => {
    if (currentBranchId && open) {
      setSourceBranchId(currentBranchId);
    }
  }, [currentBranchId, open]);

  // Auto-select the default branch as target when branches load
  useEffect(() => {
    if (branches && !targetBranchId) {
      const defaultBranch = branches.find((branch) => branch.isDefault);
      if (defaultBranch) {
        setTargetBranchId(defaultBranch.id);
      }
    }
  }, [branches, targetBranchId]);

  // Auto-populate title based on branch selection
  useEffect(() => {
    if (!branches) return;
    const source = branches.find((branch) => branch.id === sourceBranchId);
    const target = branches.find((branch) => branch.id === targetBranchId);
    if (source && target) {
      setTitle(t("mergeInto", { source: source.name, target: target.name }));
    }
  }, [sourceBranchId, targetBranchId, branches]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSourceBranchId(currentBranchId ?? "");
      setTargetBranchId("");
      setTitle("");
      setDescription("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, currentBranchId]);

  const handleSubmit = async () => {
    if (!sourceBranchId || !targetBranchId || !title.trim() || !userId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const mrId = await createMergeRequest({
        projectId,
        sourceBranchId,
        targetBranchId,
        title: title.trim(),
        description: description.trim() || undefined,
        createdBy: userId,
      });

      trackEvent("merge_request_created", { projectId });
      onOpenChange(false);
      router.push(`/projects/${projectId}/merge-requests/${mrId}`);
    } catch (e) {
      captureException(e, {
        source: "create-merge-request-dialog",
        action: "create-merge-request",
        projectId,
      });
      setError(t("failedToCreate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    sourceBranchId &&
    targetBranchId &&
    sourceBranchId !== targetBranchId &&
    title.trim() &&
    userId &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <ErrorAlert message={error} onDismiss={() => setError(null)} />
          )}

          {/* Source branch */}
          <div className="space-y-2">
            <Label>{t("sourceBranch")}</Label>
            <Select value={sourceBranchId} onValueChange={setSourceBranchId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectSourceBranch")} />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.isDefault ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("sourceDescription")}
            </p>
          </div>

          {/* Target branch */}
          <div className="space-y-2">
            <Label>{t("targetBranch")}</Label>
            <Select value={targetBranchId} onValueChange={setTargetBranchId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectTargetBranch")} />
              </SelectTrigger>
              <SelectContent>
                {branches
                  ?.filter((branch) => branch.id !== sourceBranchId)
                  .map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("targetDescription")}
            </p>
          </div>

          {sourceBranchId &&
            targetBranchId &&
            sourceBranchId === targetBranchId && (
              <ErrorAlert message={t("branchesMustDiffer")} />
            )}

          {/* Title */}
          <div className="space-y-2">
            <Label>{t("mrTitle")}</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder={t("titlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t("descriptionLabel")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("createMergeRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
