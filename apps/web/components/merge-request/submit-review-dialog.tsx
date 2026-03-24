"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@inkloom/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import { Textarea } from "@inkloom/ui/textarea";
import { cn } from "@inkloom/ui/lib/utils";
import {
  MessageSquare,
  Check,
  XCircle,
  ChevronDown,
  Loader2,
  Eye,
} from "lucide-react";
import { useTranslations } from "next-intl";

type ReviewStatus = "approved" | "changes_requested" | "commented";

interface SubmitReviewDialogProps {
  mergeRequestId: Id<"mergeRequests">;
  userId: Id<"users">;
  mrStatus: string;
}

export function SubmitReviewDialog({
  mergeRequestId,
  userId,
  mrStatus,
}: SubmitReviewDialogProps) {
  const t = useTranslations("mergeRequests.review");

  const [open, setOpen] = useState(false);
  const [reviewType, setReviewType] = useState<ReviewStatus>("commented");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReview = useMutation(api.mrReviews.submitReview);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await submitReview({
        mergeRequestId,
        reviewerId: userId,
        status: reviewType,
        body: body.trim() || undefined,
      });
      setOpen(false);
      setBody("");
      setReviewType("commented");
    } catch (error) {
      console.error("Failed to submit review:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [mergeRequestId, userId, reviewType, body, submitReview]);

  // Only show for open MRs
  if (mrStatus !== "open") return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            {t("reviewButton")}
            <ChevronDown className="ml-1.5 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              setReviewType("commented");
              setOpen(true);
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{t("typeComment")}</div>
              <div className="text-xs text-muted-foreground">
                {t("typeCommentDescription")}
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setReviewType("approved");
              setOpen(true);
            }}
          >
            <Check className="mr-2 h-4 w-4 text-emerald-500" />
            <div>
              <div className="font-medium">{t("typeApprove")}</div>
              <div className="text-xs text-muted-foreground">
                {t("typeApproveDescription")}
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setReviewType("changes_requested");
              setOpen(true);
            }}
          >
            <XCircle className="mr-2 h-4 w-4 text-red-500" />
            <div>
              <div className="font-medium">{t("typeRequestChanges")}</div>
              <div className="text-xs text-muted-foreground">
                {t("typeRequestChangesDescription")}
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("submitReviewTitle")}</DialogTitle>
            <DialogDescription>
              {t("submitReviewDescription")}
            </DialogDescription>
          </DialogHeader>

          {/* Review type indicator */}
          <div className="space-y-4">
            <div className="flex gap-2">
              {(
                [
                  "commented",
                  "approved",
                  "changes_requested",
                ] as ReviewStatus[]
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setReviewType(type)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
                    reviewType === type
                      ? type === "approved"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : type === "changes_requested"
                          ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                          : "border-primary/50 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  {type === "commented" && (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  {type === "approved" && <Check className="h-3.5 w-3.5" />}
                  {type === "changes_requested" && (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {type === "commented" && t("typeComment")}
                  {type === "approved" && t("typeApprove")}
                  {type === "changes_requested" && t("typeRequestChanges")}
                </button>
              ))}
            </div>

            <Textarea
              placeholder={t("reviewBodyPlaceholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t("cancelButton")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                reviewType === "approved" &&
                  "bg-emerald-600 hover:bg-emerald-700 text-white",
                reviewType === "changes_requested" &&
                  "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {reviewType === "commented" && t("submitComment")}
              {reviewType === "approved" && t("submitApprove")}
              {reviewType === "changes_requested" &&
                t("submitRequestChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
