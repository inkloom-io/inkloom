"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "@/lib/date-utils";
import { getUserInitials } from "@/lib/collaboration-utils";
import { Button } from "@inkloom/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@inkloom/ui/popover";
import { CheckCircle, MessageSquare, RotateCcw } from "lucide-react";
import { CommentInput } from "./comment-input";

interface CommentPopoverProps {
  threadId: Id<"commentThreads">;
  currentUserId: Id<"users">;
  children: React.ReactNode;
  onOpenSidebar?: () => void;
}

export function CommentPopover({
  threadId,
  currentUserId,
  children,
  onOpenSidebar,
}: CommentPopoverProps) {
  const t = useTranslations("editor.comments");
  const [open, setOpen] = useState(false);

  const thread = useQuery(
    api.comments.getThread,
    open ? { threadId } : "skip"
  );

  const addComment = useMutation(api.comments.addComment);
  const resolveThread = useMutation(api.comments.resolveThread);
  const reopenThread = useMutation(api.comments.reopenThread);

  const handleAddReply = async (content: string) => {
    await addComment({
      threadId,
      content,
      userId: currentUserId,
    });
  };

  const handleResolve = async () => {
    await resolveThread({ threadId });
  };

  const handleReopen = async () => {
    await reopenThread({ threadId });
  };

  // Show first few comments
  const visibleComments = thread?.comments.slice(0, 3) ?? [];
  const remainingCount = (thread?.comments.length ?? 0) - visibleComments.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        {thread ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">
                {thread.status === "resolved" ? t("resolved") : t("comment")}
              </span>
              <div className="flex gap-1">
                {onOpenSidebar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onOpenSidebar();
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                {thread.status === "open" ? (
                  <Button variant="ghost" size="sm" onClick={handleResolve}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleReopen}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Comments preview */}
            <div className="max-h-64 overflow-auto p-3">
              <div className="space-y-3">
                {visibleComments.map((comment: any) => (
                  <div key={comment._id} className="flex gap-2">
                    {comment.user?.avatarUrl ? (
                      <img
                        src={comment.user.avatarUrl}
                        alt={comment.user.name}
                        className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                        {comment.user
                          ? getUserInitials(comment.user.name)
                          : "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium">
                          {comment.user?.name || t("unknownUser")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}

                {remainingCount > 0 && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setOpen(false);
                      onOpenSidebar?.();
                    }}
                  >
                    {t("viewMoreReplies", { count: remainingCount })}
                  </button>
                )}
              </div>
            </div>

            {/* Reply input */}
            {thread.status === "open" && (
              <div className="border-t p-3">
                <CommentInput
                  onSubmit={handleAddReply}
                  placeholder={t("writeReply")}
                  submitLabel={t("reply")}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
