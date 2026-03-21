"use client";

import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDistanceToNow } from "@/lib/date-utils";
import { getUserInitials } from "@/lib/collaboration-utils";
import { Badge } from "@inkloom/ui/badge";
import { Button } from "@inkloom/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import { MessageSquare, CheckCircle, Quote, MoreVertical, Trash2 } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface CommentUser {
  id: Id<"users">;
  name: string;
  avatarUrl?: string | null;
}

interface CommentThreadCardProps {
  thread: Doc<"commentThreads"> & {
    creator: CommentUser | null;
    commentCount: number;
    comments: Array<{
      content: string;
      user: CommentUser | null;
    }>;
  };
  onClick: () => void;
  isSelected?: boolean;
  currentUserId?: Id<"users">;
  isAdmin?: boolean;
}

export function CommentThreadCard({
  thread,
  onClick,
  isSelected = false,
  currentUserId,
  isAdmin = false,
}: CommentThreadCardProps) {
  const t = useTranslations("editor.comments");
  const deleteThread = useMutation(api.comments.deleteThread);

  // Get the first comment as preview
  const firstComment = thread.comments[0];

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger onClick
    if (!currentUserId) return;

    if (window.confirm("Are you sure you want to delete this entire thread?")) {
      await deleteThread({
        threadId: thread._id,
        userId: currentUserId,
        isAdmin,
      });
    }
  };

  // Admins can delete any thread, creators can delete their own
  const canDelete = currentUserId && (thread.createdBy === currentUserId || isAdmin);

  return (
    <div
      className={`group relative w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
        isSelected ? "border-primary bg-muted/30" : "border-transparent"
      }`}
    >
      {/* Delete button (visible on hover, only for thread creator) */}
      {canDelete && (
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteThreadCard")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
          {thread.creator?.avatarUrl ? (
            <img
              src={thread.creator.avatarUrl}
              alt={thread.creator.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {thread.creator
                ? getUserInitials(thread.creator.name)
                : "?"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {thread.creator?.name || t("unknownUser")}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(thread.createdAt)}
            </span>
            {thread.status === "resolved" && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs"
              >
                <CheckCircle className="h-3 w-3" />
                {t("resolved")}
              </Badge>
            )}
          </div>

          {/* Quoted text */}
          {thread.quotedText && (
            <div className="mb-2 flex gap-1.5 rounded bg-muted/50 px-2 py-1">
              <Quote className="h-3 w-3 flex-shrink-0 text-muted-foreground mt-0.5" />
              <p className="line-clamp-1 text-xs italic text-muted-foreground">
                &ldquo;{thread.quotedText}&rdquo;
              </p>
            </div>
          )}

          {/* Preview text */}
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {firstComment?.content || t("noContent")}
          </p>

          {/* Footer */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {t("replyCount", { count: thread.commentCount })}
            </span>
            {thread.anchorType === "inline" && (
              <Badge variant="outline" className="text-xs">
                {t("inline")}
              </Badge>
            )}
          </div>
        </div>
      </div>
      </button>
    </div>
  );
}
