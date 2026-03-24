"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarImage, AvatarFallback } from "@inkloom/ui/avatar";
import { cn } from "@inkloom/ui/lib/utils";
import {
  GitMerge,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  Loader2,
} from "lucide-react";
import {
  ReviewThreadCard,
  type ReviewThread,
} from "./review-thread-card";

// ── Types ─────────────────────────────────────────────────────────────────

interface MRComment {
  _id: Id<"mergeRequestComments">;
  content: string;
  createdAt: number;
  creator: { name?: string; avatarUrl?: string } | null;
}

interface MRData {
  status: string;
  createdAt: number;
  mergedAt?: number;
  closedAt?: number;
  creator: { name?: string; avatarUrl?: string } | null;
  mergedByUser?: { name?: string; avatarUrl?: string } | null;
  closedByUser?: { name?: string; avatarUrl?: string } | null;
}

type ActivityEntry =
  | {
      type: "comment";
      id: string;
      timestamp: number;
      data: MRComment;
    }
  | {
      type: "review_thread";
      id: string;
      timestamp: number;
      data: ReviewThread;
    }
  | {
      type: "review_submission";
      id: string;
      timestamp: number;
      data: {
        status: "approved" | "changes_requested" | "commented";
        body?: string;
        reviewer: { id: string; name: string; avatarUrl?: string } | null;
        createdAt: number;
      };
    }
  | {
      type: "state_change";
      id: string;
      timestamp: number;
      data: {
        action: "merged" | "closed";
        user: { name?: string; avatarUrl?: string } | null;
      };
    };

interface ActivityTimelineProps {
  mergeRequestId: Id<"mergeRequests">;
  mr: MRData;
  comments: MRComment[];
  userId: Id<"users"> | undefined;
  relTime: (ts: number) => string;
  onNavigateToThread?: (thread: ReviewThread) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function reviewStatusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "approved this merge request";
    case "changes_requested":
      return "requested changes";
    case "commented":
      return "left a review";
    default:
      return "reviewed";
  }
}

function ReviewStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "changes_requested":
      return <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    default:
      return <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function ActivityTimeline({
  mergeRequestId,
  mr,
  comments,
  userId,
  relTime,
  onNavigateToThread,
}: ActivityTimelineProps) {
  // Fetch review threads
  const reviewThreads = useQuery(api.mrReviews.listThreadsByMR, {
    mergeRequestId,
  });

  // Fetch review submissions
  const reviews = useQuery(api.mrReviews.listReviews, {
    mergeRequestId,
  });

  const isLoading = reviewThreads === undefined || reviews === undefined;

  // Build unified timeline
  const timeline = useMemo(() => {
    const entries: ActivityEntry[] = [];

    // Add flat MR comments
    for (const comment of comments) {
      entries.push({
        type: "comment",
        id: `comment-${comment._id}`,
        timestamp: comment.createdAt,
        data: comment,
      });
    }

    // Add review threads (only the thread creation, not individual replies)
    if (reviewThreads) {
      for (const thread of reviewThreads) {
        entries.push({
          type: "review_thread",
          id: `thread-${thread._id}`,
          timestamp: thread.createdAt,
          data: thread as ReviewThread,
        });
      }
    }

    // Add review submissions
    if (reviews) {
      for (const review of reviews) {
        entries.push({
          type: "review_submission",
          id: `review-${review._id}`,
          timestamp: review.createdAt,
          data: {
            status: review.status,
            body: review.body,
            reviewer: review.reviewer,
            createdAt: review.createdAt,
          },
        });
      }
    }

    // Add state change events
    if (mr.status === "merged" && mr.mergedAt) {
      entries.push({
        type: "state_change",
        id: "state-merged",
        timestamp: mr.mergedAt,
        data: {
          action: "merged",
          user: mr.mergedByUser ?? null,
        },
      });
    }
    if (mr.status === "closed" && mr.closedAt) {
      entries.push({
        type: "state_change",
        id: "state-closed",
        timestamp: mr.closedAt,
        data: {
          action: "closed",
          user: mr.closedByUser ?? null,
        },
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    return entries;
  }, [comments, reviewThreads, reviews, mr]);

  const totalCount =
    comments.length +
    (reviewThreads?.length ?? 0) +
    (reviews?.length ?? 0) +
    (mr.status === "merged" || mr.status === "closed" ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Activity
          {!isLoading && (
            <span className="ml-1.5 text-xs rounded-full bg-muted px-1.5 py-0.5">
              {totalCount}
            </span>
          )}
        </h3>
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {!isLoading && timeline.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No activity yet.
        </p>
      )}

      <div className="space-y-4">
        {timeline.map((entry) => {
          switch (entry.type) {
            case "comment":
              return (
                <CommentEntry
                  key={entry.id}
                  comment={entry.data}
                  relTime={relTime}
                />
              );

            case "review_thread":
              return (
                <ReviewThreadCard
                  key={entry.id}
                  thread={entry.data}
                  userId={userId}
                  relTime={relTime}
                  onNavigateToThread={onNavigateToThread}
                />
              );

            case "review_submission":
              return (
                <ReviewSubmissionEntry
                  key={entry.id}
                  data={entry.data}
                  relTime={relTime}
                />
              );

            case "state_change":
              return (
                <StateChangeEntry
                  key={entry.id}
                  data={entry.data}
                  timestamp={entry.timestamp}
                  relTime={relTime}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function CommentEntry({
  comment,
  relTime,
}: {
  comment: MRComment;
  relTime: (ts: number) => string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border p-4">
      <Avatar className="h-8 w-8 shrink-0">
        {comment.creator?.avatarUrl && (
          <AvatarImage
            src={comment.creator.avatarUrl}
            alt={comment.creator?.name ?? "Unknown"}
          />
        )}
        <AvatarFallback className="text-xs">
          {getInitials(comment.creator?.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {comment.creator?.name ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {relTime(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  );
}

function ReviewSubmissionEntry({
  data,
  relTime,
}: {
  data: {
    status: string;
    body?: string;
    reviewer: { id: string; name: string; avatarUrl?: string } | null;
    createdAt: number;
  };
  relTime: (ts: number) => string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        data.status === "approved" &&
          "border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-950/20",
        data.status === "changes_requested" &&
          "border-orange-200 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-950/20"
      )}
    >
      <ReviewStatusIcon status={data.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {data.reviewer?.name ?? "Unknown"}
          </span>
          <span className="text-sm text-muted-foreground">
            {reviewStatusLabel(data.status)}
          </span>
          <span className="text-xs text-muted-foreground">
            {relTime(data.createdAt)}
          </span>
        </div>
        {data.body && (
          <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">
            {data.body}
          </p>
        )}
      </div>
    </div>
  );
}

function StateChangeEntry({
  data,
  timestamp,
  relTime,
}: {
  data: {
    action: "merged" | "closed";
    user: { name?: string; avatarUrl?: string } | null;
  };
  timestamp: number;
  relTime: (ts: number) => string;
}) {
  const isMerged = data.action === "merged";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        isMerged
          ? "border-purple-200 bg-purple-50/50 dark:border-purple-800/50 dark:bg-purple-950/20"
          : "border-muted bg-muted/30"
      )}
    >
      {isMerged ? (
        <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {data.user?.name ?? "Unknown"}
        </span>
        <span className="text-sm text-muted-foreground">
          {isMerged ? "merged this merge request" : "closed this merge request"}
        </span>
        <span className="text-xs text-muted-foreground">
          {relTime(timestamp)}
        </span>
      </div>
    </div>
  );
}
