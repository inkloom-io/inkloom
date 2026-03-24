"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@inkloom/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@inkloom/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";
import { cn } from "@inkloom/ui/lib/utils";
import { Check, XCircle, MessageSquare, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

// ── Types ─────────────────────────────────────────────────────────────

interface ReviewStatusBadgesProps {
  mergeRequestId: Id<"mergeRequests">;
  reviewStatus?: string;
}

interface ReviewerInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface ReviewEntry {
  _id: string;
  reviewerId: string;
  status: "approved" | "changes_requested" | "commented";
  createdAt: number;
  reviewer: ReviewerInfo | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Compute the latest review status for each unique reviewer. */
function getLatestReviewPerReviewer(
  reviews: ReviewEntry[]
): Map<string, ReviewEntry> {
  const latestByReviewer = new Map<string, ReviewEntry>();

  const sorted = [...reviews].sort((a, b) => a.createdAt - b.createdAt);
  for (const review of sorted) {
    latestByReviewer.set(review.reviewerId, review);
  }

  return latestByReviewer;
}

// ── Component ─────────────────────────────────────────────────────────

export function ReviewStatusBadges({
  mergeRequestId,
  reviewStatus,
}: ReviewStatusBadgesProps) {
  const t = useTranslations("mergeRequests.review");

  const reviews = useQuery(api.mrReviews.listReviews, {
    mergeRequestId,
  });

  const reviewSummary = useQuery(api.mrReviews.getReviewSummary, {
    mergeRequestId,
  });

  if (!reviews || reviews.length === 0) return null;

  const latestByReviewer = getLatestReviewPerReviewer(
    reviews as ReviewEntry[]
  );
  const latestStatuses = Array.from(latestByReviewer.values());

  const approvalCount = latestStatuses.filter(
    (r) => r.status === "approved"
  ).length;
  return (
    <div className="flex items-center gap-2">
      {/* Overall status badge */}
      {reviewStatus === "approved" && (
        <Badge className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
          <Check className="h-3 w-3" />
          {t("approvedCount", { count: approvalCount })}
        </Badge>
      )}
      {reviewStatus === "changes_requested" && (
        <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <XCircle className="h-3 w-3" />
          {t("changesRequested")}
        </Badge>
      )}

      {/* Unresolved threads counter */}
      {reviewSummary && reviewSummary.openThreads > 0 && (
        <Badge
          variant="outline"
          className="gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30"
        >
          <MessageSquare className="h-3 w-3" />
          {t("unresolvedThreads", { count: reviewSummary.openThreads })}
        </Badge>
      )}

      {/* Reviewer avatars with status */}
      <TooltipProvider>
        <div className="flex -space-x-1.5">
          {latestStatuses.map((review) => {
            const reviewer = review.reviewer;
            if (!reviewer) return null;

            return (
              <Tooltip key={review.reviewerId}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className="h-6 w-6 border-2 border-background">
                      {reviewer.avatarUrl && (
                        <AvatarImage
                          src={reviewer.avatarUrl}
                          alt={reviewer.name}
                        />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(reviewer.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status indicator dot */}
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-background",
                        review.status === "approved" &&
                          "bg-emerald-500 text-white",
                        review.status === "changes_requested" &&
                          "bg-red-500 text-white",
                        review.status === "commented" &&
                          "bg-blue-500 text-white"
                      )}
                    >
                      {review.status === "approved" && (
                        <Check className="h-2 w-2" />
                      )}
                      {review.status === "changes_requested" && (
                        <XCircle className="h-2 w-2" />
                      )}
                      {review.status === "commented" && (
                        <MessageSquare className="h-1.5 w-1.5" />
                      )}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    <span className="font-medium">{reviewer.name}</span>
                    {" — "}
                    {review.status === "approved" && t("statusApproved")}
                    {review.status === "changes_requested" &&
                      t("statusChangesRequested")}
                    {review.status === "commented" && t("statusCommented")}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

// ── Merge Button Warning ──────────────────────────────────────────────

export function MergeReviewWarning({
  mergeRequestId,
}: {
  mergeRequestId: Id<"mergeRequests">;
}) {
  const t = useTranslations("mergeRequests.review");

  const reviewSummary = useQuery(api.mrReviews.getReviewSummary, {
    mergeRequestId,
  });

  if (!reviewSummary) return null;

  const hasChangesRequested =
    reviewSummary.reviewStatus === "changes_requested";
  const hasUnresolvedThreads = reviewSummary.openThreads > 0;

  if (!hasChangesRequested && !hasUnresolvedThreads) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        {hasChangesRequested && <p>{t("mergeWarningChangesRequested")}</p>}
        {hasUnresolvedThreads && (
          <p>
            {t("mergeWarningUnresolvedThreads", {
              count: reviewSummary.openThreads,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
