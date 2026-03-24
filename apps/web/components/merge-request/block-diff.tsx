"use client";

import { useState, Fragment } from "react";
import type {
  DiffResult,
  InlineDiffSegment,
  BlockData,
  InlineContent,
} from "@/lib/diff-engine";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConflictResolver } from "./conflict-resolver";

interface BlockDiffProps {
  blockDiffs: DiffResult[];
  resolutions: Record<number, "source" | "target">;
  onResolutionChange: (
    blockIndex: number,
    resolution: "source" | "target"
  ) => void;
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

// Render a block type label
function BlockTypeLabel({ type, t }: { type: string; t: (key: string) => string }) {
  const KEY_MAP: Record<string, string> = {
    paragraph: "blockTypes.paragraph",
    heading: "blockTypes.heading",
    bulletListItem: "blockTypes.bulletListItem",
    numberedListItem: "blockTypes.numberedListItem",
    checkListItem: "blockTypes.checkListItem",
    codeBlock: "blockTypes.codeBlock",
    image: "blockTypes.image",
    table: "blockTypes.table",
    callout: "blockTypes.callout",
    accordion: "blockTypes.accordion",
    card: "blockTypes.card",
    tabs: "blockTypes.tabs",
    steps: "blockTypes.steps",
  };

  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--glass-hover)] text-[var(--text-dim)]">
      {KEY_MAP[type] ? t(KEY_MAP[type]) : type}
    </span>
  );
}

// Render the "removed" half of a modified block's inline diff (equal + delete segments)
function RemovedLineDiffDisplay({
  segments,
}: {
  segments: InlineDiffSegment[];
}) {
  return (
    <span>
      {segments
        .filter((s) => s.status === "equal" || s.status === "delete")
        .map((segment, i) => {
          if (segment.status === "delete") {
            return (
              <span
                key={i}
                className="bg-red-500/25 text-red-900 dark:text-red-100 rounded-sm px-0.5"
              >
                {segment.text}
              </span>
            );
          }
          return (
            <span key={i} className="text-red-800/70 dark:text-red-200/70">
              {segment.text}
            </span>
          );
        })}
    </span>
  );
}

// Render the "added" half of a modified block's inline diff (equal + insert segments)
function AddedLineDiffDisplay({
  segments,
}: {
  segments: InlineDiffSegment[];
}) {
  return (
    <span>
      {segments
        .filter((s) => s.status === "equal" || s.status === "insert")
        .map((segment, i) => {
          if (segment.status === "insert") {
            return (
              <span
                key={i}
                className="bg-emerald-500/25 text-emerald-900 dark:text-emerald-100 rounded-sm px-0.5"
              >
                {segment.text}
              </span>
            );
          }
          return (
            <span key={i} className="text-emerald-800/70 dark:text-emerald-200/70">
              {segment.text}
            </span>
          );
        })}
    </span>
  );
}

// Render simple block content
function BlockContent({ block }: { block: BlockData }) {
  const t = useTranslations("mergeRequests.blockDiff");
  const text = extractText(block.content);
  if (!text && block.type === "image") {
    const src = block.props?.url ?? block.props?.src;
    return (
      <span className="text-[var(--text-dim)] italic">
        [{t("image")}{src ? `: ${String(src)}` : ""}]
      </span>
    );
  }
  if (!text) {
    return (
      <span className="text-[var(--text-dim)] italic">[{t("emptyBlock")}]</span>
    );
  }
  return <span>{text}</span>;
}

// Collapsed unchanged blocks separator
function UnchangedSeparator({
  count,
  expanded,
  onToggle,
  t,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-medium)]"
    >
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      <span className="border-b border-dashed border-[var(--glass-border)] flex-1 text-left">
        {expanded
          ? t("hideUnchanged", { count })
          : t("showUnchanged", { count })}
      </span>
    </button>
  );
}

export function BlockDiff({
  blockDiffs,
  resolutions,
  onResolutionChange,
}: BlockDiffProps) {
  const t = useTranslations("mergeRequests.blockDiff");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group consecutive unchanged blocks into collapsible sections
  const elements: React.ReactNode[] = [];
  let unchangedBuffer: DiffResult[] = [];
  let unchangedStartIndex = 0;

  const flushUnchanged = () => {
    if (unchangedBuffer.length === 0) return;

    const sectionKey = `unchanged-${unchangedStartIndex}`;
    const isExpanded = expandedSections[sectionKey] ?? false;

    elements.push(
      <Fragment key={sectionKey}>
        <UnchangedSeparator
          count={unchangedBuffer.length}
          expanded={isExpanded}
          onToggle={() => toggleSection(sectionKey)}
          t={t as any}
        />
        {isExpanded &&
          unchangedBuffer.map((diff: any, j: number) => {
            const block = diff.targetBlock ?? diff.sourceBlock;
            if (!block) return null;
            return (
              <div
                key={`${sectionKey}-${j}`}
                className="rounded-md border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-dim)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BlockTypeLabel type={block.type} t={t} />
                </div>
                <BlockContent block={block} />
              </div>
            );
          })}
      </Fragment>
    );

    unchangedBuffer = [];
  };

  for (let i = 0; i < blockDiffs.length; i++) {
    const diff = blockDiffs[i]!;

    if (diff.status === "unchanged") {
      if (unchangedBuffer.length === 0) {
        unchangedStartIndex = i;
      }
      unchangedBuffer.push(diff);
      continue;
    }

    // Flush any accumulated unchanged blocks before a changed block
    flushUnchanged();

    if (diff.status === "added") {
      const block = diff.sourceBlock;
      if (!block) continue;

      elements.push(
        <div
          key={`added-${i}`}
          className="rounded-md border-l-4 border-l-emerald-500 border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <BlockTypeLabel type={block.type} t={t} />
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t("added")}
            </span>
          </div>
          <div className="text-emerald-800 dark:text-emerald-200">
            <BlockContent block={block} />
          </div>
        </div>
      );
    } else if (diff.status === "removed") {
      const block = diff.targetBlock;
      if (!block) continue;

      elements.push(
        <div
          key={`removed-${i}`}
          className="rounded-md border-l-4 border-l-red-500 border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <BlockTypeLabel type={block.type} t={t} />
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
              {t("removed")}
            </span>
          </div>
          <div className="text-red-800 dark:text-red-200 line-through">
            <BlockContent block={block} />
          </div>
        </div>
      );
    } else if (diff.status === "modified") {
      const sourceBlock = diff.sourceBlock;
      const targetBlock = diff.targetBlock;
      if (!sourceBlock || !targetBlock) continue;

      // True conflicts only exist in three-way merges where both branches
      // modified the same block. For now, all modifications are non-conflicting
      // (only the source branch changed the block).
      const isConflict = diff.isConflict === true;

      const typeChanged = sourceBlock.type !== targetBlock.type;

      elements.push(
        <div key={`modified-${i}`} className="space-y-1">
          {/* MODIFIED badge row */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {t("modified")}
            </span>
          </div>

          {/* Removed line (old/target content) */}
          <div className="rounded-md border-l-4 border-l-red-500 border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <BlockTypeLabel type={targetBlock.type} t={t} />
            </div>
            <div className="leading-relaxed">
              {diff.inlineDiff ? (
                <RemovedLineDiffDisplay segments={diff.inlineDiff} />
              ) : (
                <div className="text-red-800 dark:text-red-200">
                  <BlockContent block={targetBlock} />
                </div>
              )}
            </div>
          </div>

          {/* Added line (new/source content) */}
          <div className="rounded-md border-l-4 border-l-emerald-500 border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 mb-1">
              {typeChanged && <BlockTypeLabel type={sourceBlock.type} t={t} />}
            </div>
            <div className="leading-relaxed">
              {diff.inlineDiff ? (
                <AddedLineDiffDisplay segments={diff.inlineDiff} />
              ) : (
                <div className="text-emerald-800 dark:text-emerald-200">
                  <BlockContent block={sourceBlock} />
                </div>
              )}
            </div>
          </div>

          {/* Conflict resolution UI — only shown for true three-way conflicts */}
          {isConflict && (
            <div className="mt-2">
              <ConflictResolver
                sourceBlock={sourceBlock}
                targetBlock={targetBlock}
                resolution={resolutions[i]}
                onResolve={(resolution) => onResolutionChange(i, resolution)}
              />
            </div>
          )}
        </div>
      );
    }
  }

  // Flush any remaining unchanged blocks at the end
  flushUnchanged();

  return <div className="space-y-2">{elements}</div>;
}
