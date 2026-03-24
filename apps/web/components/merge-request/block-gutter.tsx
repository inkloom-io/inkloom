"use client";

import { Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@inkloom/ui/tooltip";
import { cn } from "@inkloom/ui/lib/utils";

interface BlockGutterProps {
  /** Whether the "+" button is currently visible (hovered row). */
  visible: boolean;
  /** Number of existing open threads on this block. */
  threadCount?: number;
  /** Callback when user clicks the "+" to start a new comment. */
  onClick: () => void;
  /** Label for the tooltip. */
  tooltipLabel?: string;
}

/**
 * Renders a small "+" button in the left gutter of each diff block row.
 * Appears on hover (controlled via `visible` prop by parent).
 * If there are existing threads, shows a thread count badge.
 */
export function BlockGutter({
  visible,
  threadCount = 0,
  onClick,
  tooltipLabel = "Add a comment",
}: BlockGutterProps) {
  return (
    <div className="relative flex items-start justify-center w-8 shrink-0 pt-2">
      {/* Thread count badge — always visible when there are threads */}
      {threadCount > 0 && !visible && (
        <button
          onClick={onClick}
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary hover:bg-primary/25 transition-colors"
        >
          {threadCount}
        </button>
      )}

      {/* "+" button — shown on hover */}
      <div
        className={cn(
          "transition-opacity duration-100",
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              aria-label={tooltipLabel}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
