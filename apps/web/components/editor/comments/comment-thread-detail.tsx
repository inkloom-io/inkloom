"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow, formatDateTime } from "@/lib/date-utils";
import { getUserInitials } from "@/lib/collaboration-utils";
import { Button } from "@inkloom/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import {
  ArrowLeft,
  CheckCircle,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { CommentInput } from "./comment-input";

interface CommentUser {
  id: Id<"users">;
  name: string;
  avatarUrl?: string | null;
}

interface Comment extends Doc<"comments"> {
  user: CommentUser | null;
}

interface CommentThreadDetailProps {
  thread: Doc<"commentThreads"> & {
    creator: CommentUser | null;
    comments: Comment[];
  };
  currentUserId: Id<"users">;
  onBack: () => void;
  onScrollToBlock?: (blockId: string) => void;
  isAdmin?: boolean;
}

export function CommentThreadDetail({
  thread,
  currentUserId,
  onBack,
  onScrollToBlock,
  isAdmin = false,
}: CommentThreadDetailProps) {
  const t = useTranslations("editor.comments");
  const tc = useTranslations("common");
  const [editingCommentId, setEditingCommentId] = useState<Id<"comments"> | null>(
    null
  );

  const addComment = useMutation(api.comments.addComment);
  const updateComment = useMutation(api.comments.updateComment);
  const deleteComment = useMutation(api.comments.deleteComment);
  const deleteThread = useMutation(api.comments.deleteThread);
  const resolveThread = useMutation(api.comments.resolveThread);
  const reopenThread = useMutation(api.comments.reopenThread);

  const handleAddReply = async (content: string) => {
    await addComment({
      threadId: thread._id,
      content,
      userId: currentUserId,
    });
  };

  const handleUpdateComment = async (commentId: Id<"comments">, content: string) => {
    await updateComment({
      commentId,
      content,
      userId: currentUserId,
    });
    setEditingCommentId(null);
  };

  const handleDeleteComment = async (commentId: Id<"comments">) => {
    const result = await deleteComment({
      commentId,
      userId: currentUserId,
      isAdmin,
    });
    // If the whole thread was deleted, go back
    if (result.threadDeleted) {
      onBack();
    }
  };

  const handleResolve = async () => {
    await resolveThread({ threadId: thread._id });
  };

  const handleReopen = async () => {
    await reopenThread({ threadId: thread._id });
  };

  const handleDeleteThread = async () => {
    if (window.confirm(t("deleteThreadConfirmation"))) {
      await deleteThread({
        threadId: thread._id,
        userId: currentUserId,
        isAdmin,
      });
      onBack();
    }
  };

  // Admins can delete any thread, creators can delete their own
  const canDeleteThread = thread.createdBy === currentUserId || isAdmin;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">{t("thread")}</span>
        </div>
        <div className="flex items-center gap-2">
          {onScrollToBlock && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onScrollToBlock(thread.blockId)}
            >
              {t("goToLocation")}
            </Button>
          )}
          {thread.status === "open" ? (
            <Button variant="outline" size="sm" onClick={handleResolve}>
              <CheckCircle className="mr-1 h-4 w-4" />
              {t("resolve")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleReopen}>
              <RotateCcw className="mr-1 h-4 w-4" />
              {t("reopen")}
            </Button>
          )}
          {/* Thread actions dropdown */}
          {canDeleteThread && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDeleteThread}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deleteThread")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {thread.comments.map((comment: any) => (
            <div key={comment._id} className="group">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {comment.user?.avatarUrl ? (
                  <img
                    src={comment.user.avatarUrl}
                    alt={comment.user.name}
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {comment.user
                      ? getUserInitials(comment.user.name)
                      : "?"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {comment.user?.name || t("unknownUser")}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(comment.createdAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateTime(comment.createdAt)}
                      </TooltipContent>
                    </Tooltip>
                    {comment.isEdited && (
                      <span className="text-xs text-muted-foreground">
                        {t("edited")}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {editingCommentId === comment._id ? (
                    <div className="mt-2">
                      <CommentInput
                        initialValue={comment.content}
                        onSubmit={(content) =>
                          handleUpdateComment(comment._id, content)
                        }
                        onCancel={() => setEditingCommentId(null)}
                        submitLabel={tc("save")}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {comment.content}
                    </p>
                  )}
                </div>

                {/* Actions (own comments can edit/delete, admins can delete any) */}
                {(comment.user?.id === currentUserId || isAdmin) &&
                  editingCommentId !== comment._id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Edit only available for own comments */}
                        {comment.user?.id === currentUserId && (
                          <DropdownMenuItem
                            onClick={() => setEditingCommentId(comment._id)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {tc("edit")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteComment(comment._id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply input */}
      {thread.status === "open" && (
        <div className="border-t p-4">
          <CommentInput
            onSubmit={handleAddReply}
            placeholder={t("writeReply")}
            submitLabel={t("reply")}
          />
        </div>
      )}

      {thread.status === "resolved" && (
        <div className="border-t bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
          {t("threadResolved")}
        </div>
      )}
    </div>
  );
}
