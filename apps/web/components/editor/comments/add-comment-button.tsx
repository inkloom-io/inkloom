"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@inkloom/ui/popover";
import { MessageSquarePlus } from "lucide-react";
import { CommentInput } from "./comment-input";

interface AddCommentButtonProps {
  pageId: Id<"pages">;
  blockId: string;
  currentUserId: Id<"users">;
  // For inline comments - character range
  anchorType: "block" | "inline";
  inlineStart?: number;
  inlineEnd?: number;
  // Callback when comment is created
  onCommentCreated?: (threadId: Id<"commentThreads">) => void;
  // Visual variant
  variant?: "default" | "toolbar";
}

export function AddCommentButton({
  pageId,
  blockId,
  currentUserId,
  anchorType,
  inlineStart,
  inlineEnd,
  onCommentCreated,
  variant = "default",
}: AddCommentButtonProps) {
  const t = useTranslations("editor.comments");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createThread = useMutation(api.comments.createThread);

  const handleSubmit = async (content: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const threadId = await createThread({
        pageId,
        blockId,
        anchorType,
        inlineStart,
        inlineEnd,
        content,
        userId: currentUserId,
      });

      setOpen(false);
      onCommentCreated?.(threadId);
    } catch (error) {
      console.error("Failed to create comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === "toolbar") {
    // Compact toolbar button for selection toolbar
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            title={t("addComment")}
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="text-xs">{t("comment")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <CommentInput
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            placeholder={t("addCommentPlaceholder")}
            submitLabel={t("comment")}
            disabled={isSubmitting}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Default button style
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {t("addComment")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <CommentInput
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          placeholder={t("addCommentPlaceholder")}
          submitLabel={t("comment")}
          disabled={isSubmitting}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
