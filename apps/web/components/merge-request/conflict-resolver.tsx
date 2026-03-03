"use client";

import type { BlockData, InlineContent } from "@/lib/diff-engine";
import { useTranslations } from "next-intl";
import { cn } from "@inkloom/ui/lib/utils";

interface ConflictResolverProps {
  sourceBlock: BlockData;
  targetBlock: BlockData;
  resolution: "source" | "target" | undefined;
  onResolve: (resolution: "source" | "target") => void;
}

// Extract plain text from BlockNote inline content
function extractText(content: InlineContent[] | undefined): string {
  if (!content || !Array.isArray(content)) return "";
  return content
    .map((item: any) => {
      if (item.type === "text") return item.text ?? "";
      if (item.type === "link") return extractText(item.content);
      if (item.content) return extractText(item.content);
      return item.text ?? "";
    })
    .join("");
}

// Render a compact block preview
function BlockPreview({ block, label }: { block: BlockData; label: string; }) {
  const text = extractText(block.content);
  const displayText = text || `[${block.type}]`;

  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <div className="rounded-md bg-[var(--surface-bg)] px-2.5 py-2 text-xs leading-relaxed text-[var(--text-medium)]">
        <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)] mr-1.5">
          {block.type}
        </span>
        <span className={cn(!text && "italic text-[var(--text-dim)]")}>
          {displayText}
        </span>
      </div>
    </div>
  );
}

export function ConflictResolver({
  sourceBlock,
  targetBlock,
  resolution,
  onResolve,
}: ConflictResolverProps) {
  const t = useTranslations("mergeRequests.conflictResolver");

  return (
    <div className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-hover)] p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {t("resolveConflict")}
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Source version */}
        <button
          onClick={() => onResolve("source")}
          className={cn(
            "rounded-lg border-2 p-2.5 text-left transition-colors",
            resolution === "source"
              ? "border-blue-500 bg-blue-500/5"
              : "border-[var(--glass-border)] hover:border-blue-500/50"
          )}
        >
          <BlockPreview block={sourceBlock} label={t("source")} />
          <div className="mt-2 flex items-center gap-2">
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                resolution === "source"
                  ? "border-blue-500 bg-blue-500"
                  : "border-[var(--text-dim)]"
              )}
            >
              {resolution === "source" && (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                resolution === "source"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-[var(--text-dim)]"
              )}
            >
              {t("useSource")}
            </span>
          </div>
        </button>

        {/* Target version */}
        <button
          onClick={() => onResolve("target")}
          className={cn(
            "rounded-lg border-2 p-2.5 text-left transition-colors",
            resolution === "target"
              ? "border-purple-500 bg-purple-500/5"
              : "border-[var(--glass-border)] hover:border-purple-500/50"
          )}
        >
          <BlockPreview block={targetBlock} label={t("target")} />
          <div className="mt-2 flex items-center gap-2">
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                resolution === "target"
                  ? "border-purple-500 bg-purple-500"
                  : "border-[var(--text-dim)]"
              )}
            >
              {resolution === "target" && (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                resolution === "target"
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-[var(--text-dim)]"
              )}
            >
              {t("useTarget")}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
