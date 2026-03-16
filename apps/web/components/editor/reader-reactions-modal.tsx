"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@inkloom/ui/dialog";
import { Loader2, MessageCircle } from "lucide-react";

type DateRange = "7d" | "30d" | "90d" | "all";

interface ReaderReactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  pageSlug: string;
  pageTitle?: string;
}

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

function getSinceTimestamp(range: DateRange): number | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 86_400_000;
}

function ReactionBar({
  label,
  count,
  percent,
  color,
  emoji,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
  emoji: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center text-base" aria-hidden="true">
        {emoji}
      </span>
      <div className="flex-1">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">
            {count} ({percent}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              backgroundColor: color,
              minWidth: count > 0 ? "4px" : "0",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: "160px" }}>
      {data.map((bucket) => {
        const barHeight = (bucket.total / maxTotal) * 100;
        const positiveH =
          bucket.total > 0 ? (bucket.positive / bucket.total) * barHeight : 0;
        const neutralH =
          bucket.total > 0 ? (bucket.neutral / bucket.total) * barHeight : 0;
        const negativeH =
          bucket.total > 0 ? (bucket.negative / bucket.total) * barHeight : 0;

        const dateLabel = new Date(bucket.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });

        return (
          <div
            key={bucket.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
              <span className="font-medium">{dateLabel}</span>: {bucket.total}{" "}
              reactions
            </div>
            {/* Stacked bar */}
            <div
              className="flex w-full min-w-[4px] max-w-[32px] flex-col justify-end overflow-hidden rounded-t"
              style={{ height: `${barHeight}%`, minHeight: bucket.total > 0 ? "2px" : "0" }}
            >
              {positiveH > 0 && (
                <div
                  style={{
                    height: `${(positiveH / barHeight) * 100}%`,
                    backgroundColor: "#22c55e",
                    minHeight: "1px",
                  }}
                />
              )}
              {neutralH > 0 && (
                <div
                  style={{
                    height: `${(neutralH / barHeight) * 100}%`,
                    backgroundColor: "#eab308",
                    minHeight: "1px",
                  }}
                />
              )}
              {negativeH > 0 && (
                <div
                  style={{
                    height: `${(negativeH / barHeight) * 100}%`,
                    backgroundColor: "#ef4444",
                    minHeight: "1px",
                  }}
                />
              )}
            </div>
            {/* Date label (show selectively to avoid crowding) */}
            {(data.length <= 14 || data.indexOf(bucket) % Math.ceil(data.length / 7) === 0) && (
              <span className="mt-1 text-[9px] leading-none text-muted-foreground">
                {new Date(bucket.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrendIndicator({
  data,
}: {
  data: Array<{
    date: string;
    positive: number;
    negative: number;
    total: number;
  }>;
}) {
  const trend = useMemo(() => {
    if (data.length < 2) return null;

    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);

    const avgFirst =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, d) => sum + (d.total > 0 ? d.positive / d.total : 0), 0) /
          firstHalf.length
        : 0;
    const avgSecond =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, d) => sum + (d.total > 0 ? d.positive / d.total : 0), 0) /
          secondHalf.length
        : 0;

    const diff = avgSecond - avgFirst;
    if (Math.abs(diff) < 0.05) return "stable";
    return diff > 0 ? "improving" : "declining";
  }, [data]);

  if (!trend) return null;

  const config = {
    improving: {
      label: "Improving",
      color: "text-green-600",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      arrow: "\u2191",
    },
    declining: {
      label: "Declining",
      color: "text-red-600",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      arrow: "\u2193",
    },
    stable: {
      label: "Stable",
      color: "text-yellow-600",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      arrow: "\u2192",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color} ${config.bg} ${config.border}`}
    >
      <span>{config.arrow}</span>
      {config.label}
    </span>
  );
}

export function ReaderReactionsModal({
  open,
  onOpenChange,
  projectId,
  pageSlug,
  pageTitle,
}: ReaderReactionsModalProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const since = getSinceTimestamp(dateRange);

  const bucketSize = dateRange === "7d" ? "daily" as const : dateRange === "30d" ? "daily" as const : "weekly" as const;

  const stats = useQuery(
    api.pageFeedback.getStats,
    open ? { projectId, pageSlug, since } : "skip"
  );

  const timeSeries = useQuery(
    api.pageFeedback.getTimeSeries,
    open ? { projectId, pageSlug, since, bucketSize } : "skip"
  );

  const isLoading = stats === undefined || timeSeries === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reader Reactions
            {timeSeries && <TrendIndicator data={timeSeries} />}
          </DialogTitle>
          <DialogDescription>
            {pageTitle
              ? `How readers are responding to "${pageTitle}"`
              : "See how readers are responding to this page"}
          </DialogDescription>
        </DialogHeader>

        {/* Date range filter */}
        <div className="flex gap-1 rounded-lg border border-[var(--glass-divider)] bg-[var(--surface-active)] p-0.5">
          {DATE_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setDateRange(range.value)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                dateRange === range.value
                  ? "bg-[var(--glass-hover)] text-[var(--text-bright)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-bright)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats.total === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">
                No reactions yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reader reactions will appear here once visitors start responding
                to this page.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Reaction breakdown */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Breakdown
                </h3>
                <span className="text-xs text-muted-foreground">
                  {stats.total} total reactions
                </span>
              </div>
              <div className="space-y-3">
                <ReactionBar
                  label="Helpful"
                  count={stats.positive}
                  percent={stats.positivePercent}
                  color="#22c55e"
                  emoji="\ud83d\ude0a"
                />
                <ReactionBar
                  label="Neutral"
                  count={stats.neutral}
                  percent={stats.neutralPercent}
                  color="#eab308"
                  emoji="\ud83d\ude10"
                />
                <ReactionBar
                  label="Not helpful"
                  count={stats.negative}
                  percent={stats.negativePercent}
                  color="#ef4444"
                  emoji="\ud83d\ude1e"
                />
              </div>
            </div>

            {/* Time series chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Trend over time
              </h3>
              <div className="rounded-lg border bg-muted/30 p-4">
                <TrendChart data={timeSeries} />
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#22c55e" }}
                  />
                  Helpful
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#eab308" }}
                  />
                  Neutral
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#ef4444" }}
                  />
                  Not helpful
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
