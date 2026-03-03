"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "@/lib/date-utils";
import { getUserInitials } from "@/lib/collaboration-utils";
import { MessageSquare, CheckCircle } from "lucide-react";

interface CommentTooltipData {
  threadId: string;
  quotedText?: string;
  status: "open" | "resolved";
  authorName?: string;
  authorAvatar?: string | null;
  commentContent?: string;
  commentCount?: number;
  createdAt?: number;
}

interface CommentHoverTooltipProps {
  data: CommentTooltipData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onClick?: (threadId: string) => void;
}

export function CommentHoverTooltip({
  data,
  position,
  onClose,
  onClick,
}: CommentHoverTooltipProps) {
  const t = useTranslations("editor.comments");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep tooltip in viewport
  useEffect(() => {
    if (!position || !tooltipRef.current) {
      setAdjustedPosition(position);
      return;
    }

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const padding = 10;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position - show above cursor if near bottom
    if (y + rect.height > window.innerHeight - padding) {
      y = position.y - rect.height - 10;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  if (!data || !position) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick(data.threadId);
    }
  };

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] max-w-xs animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        left: adjustedPosition?.x ?? position.x,
        top: adjustedPosition?.y ?? position.y,
      }}
      onMouseLeave={onClose}
    >
      <div
        className="rounded-lg border bg-popover p-3 shadow-lg cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleClick}
      >
        {/* Header with author */}
        <div className="flex items-center gap-2 mb-2">
          {data.authorAvatar ? (
            <img
              src={data.authorAvatar}
              alt={data.authorName || t("unknownUser")}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {data.authorName ? getUserInitials(data.authorName) : "?"}
            </div>
          )}
          <span className="text-sm font-medium truncate">
            {data.authorName || t("unknownUser")}
          </span>
          {data.createdAt && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(data.createdAt)}
            </span>
          )}
          {data.status === "resolved" && (
            <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          )}
        </div>

        {/* Comment content preview */}
        {data.commentContent && (
          <p className="text-sm text-foreground line-clamp-3">
            {data.commentContent}
          </p>
        )}

        {/* Footer */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {data.commentCount !== undefined && data.commentCount > 1 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {t("replyCount", { count: data.commentCount })}
            </span>
          )}
          <span className="text-primary">{t("clickToViewThread")}</span>
        </div>
      </div>
    </div>
  );
}
