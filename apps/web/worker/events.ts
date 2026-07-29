import type { Context } from "hono";

import type { WorkerEnv } from "@/worker/env";

export type DataMutationEvent =
  | {
      type: "comment.reply";
      threadId: string;
      commenterId: string;
      commentContent: string;
      pageId: string;
    }
  | {
      type: "merge_request.created";
      mergeRequestId: string;
      projectId: string;
      creatorId: string;
    }
  | {
      type: "merge_request.merged";
      mergeRequestId: string;
      projectId: string;
      creatorId: string;
      mergedById: string;
    }
  | {
      type: "merge_request.review_comment";
      threadId: string;
      mergeRequestId: string;
      commenterId: string;
      commentContent: string;
      isReply: boolean;
    }
  | {
      type: "merge_request.thread_resolved";
      threadId: string;
      mergeRequestId: string;
      resolvedById: string;
    }
  | {
      type: "merge_request.suggestion_accepted";
      threadId: string;
      mergeRequestId: string;
      acceptedById: string;
    }
  | {
      type: "merge_request.review_status";
      mergeRequestId: string;
      reviewerId: string;
      status: "approved" | "changes_requested";
      body?: string;
    };

export type DataMutationEventPublisher = (
  context: Context<WorkerEnv>,
  event: DataMutationEvent,
) => Promise<void>;
