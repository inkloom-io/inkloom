/**
 * Block-level diff engine for InkLoom merge requests.
 * Pure TypeScript — no Convex dependencies.
 *
 * Provides block fingerprinting, LCS-based diff, inline text diffing,
 * and merge application for BlockNote JSON content.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface BlockFingerprint {
  type: string;
  propsHash: string;
  contentHash: string;
  fullHash: string;
}

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface InlineDiffSegment {
  text: string;
  status: "equal" | "insert" | "delete";
  styles?: Record<string, unknown>;
}

export interface DiffResult {
  status: DiffStatus;
  sourceIndex?: number;
  targetIndex?: number;
  sourceBlock?: BlockData;
  targetBlock?: BlockData;
  inlineDiff?: InlineDiffSegment[];
  /** True only when both branches modified this block (three-way conflict) */
  isConflict?: boolean;
}

export type PageDiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface PageDiff {
  path: string;
  status: PageDiffStatus;
  sourcePageId?: string;
  targetPageId?: string;
  blockDiffs: DiffResult[];
  titleChanged: boolean;
  descriptionChanged: boolean;
}

export interface FolderDiff {
  path: string;
  status: "added" | "removed" | "unchanged";
}

export interface DiffSummary {
  pagesAdded: number;
  pagesRemoved: number;
  pagesModified: number;
  foldersAdded: number;
  foldersRemoved: number;
}

export interface BranchDiff {
  pageDiffs: PageDiff[];
  folderDiffs: FolderDiff[];
  summary: DiffSummary;
}

// BlockNote block shape (simplified for diffing)
export interface BlockData {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: InlineContent[];
  children?: BlockData[];
}

export interface InlineContent {
  type: string;
  text?: string;
  content?: InlineContent[];
  styles?: Record<string, unknown>;
  href?: string;
  [key: string]: unknown;
}

// ── DJB2 Hash ────────────────────────────────────────────────────────────

export function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ── Block Fingerprinting ─────────────────────────────────────────────────

function extractPlainText(content: InlineContent[] | undefined): string {
  if (!content || !Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (item.type === "text") return item.text ?? "";
      if (item.type === "link") return extractPlainText(item.content);
      if (item.content) return extractPlainText(item.content);
      return item.text ?? "";
    })
    .join("");
}

export function fingerprintBlock(block: BlockData): BlockFingerprint {
  const type = block.type || "unknown";

  // Hash props without the id field
  const { ...propsWithoutId } = block.props ?? {};
  const propsHash = djb2Hash(JSON.stringify(propsWithoutId));

  // Hash text content
  const plainText = extractPlainText(block.content);
  // Include children hashes in content hash for structural awareness
  let childrenSignature = "";
  if (block.children && block.children.length > 0) {
    childrenSignature = block.children
      .map((child) => fingerprintBlock(child).fullHash)
      .join("|");
  }
  const contentHash = djb2Hash(plainText + childrenSignature);

  const fullHash = djb2Hash(`${type}:${propsHash}:${contentHash}`);

  return { type, propsHash, contentHash, fullHash };
}

// ── Longest Common Subsequence ───────────────────────────────────────────

function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number, number][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (eq(a[i - 1]!, b[j - 1]!)) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to find pairs
  const pairs: [number, number][] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (eq(a[i - 1]!, b[j - 1]!)) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return pairs;
}

// ── Myers Diff (character-level) ─────────────────────────────────────────

interface MyersDiffOp {
  type: "equal" | "insert" | "delete";
  text: string;
}

export function myersDiff(oldStr: string, newStr: string): MyersDiffOp[] {
  const oldLen = oldStr.length;
  const newLen = newStr.length;
  const max = oldLen + newLen;

  if (max === 0) return [];
  if (oldStr === newStr) return [{ type: "equal", text: oldStr }];
  if (oldLen === 0) return [{ type: "insert", text: newStr }];
  if (newLen === 0) return [{ type: "delete", text: oldStr }];

  // For very long strings, fall back to simple diff to avoid perf issues
  if (max > 10000) {
    return simpleDiff(oldStr, newStr);
  }

  const vSize = 2 * max + 1;
  const v: number[] = new Array(vSize).fill(-1);
  const trace: number[][] = [];

  v[max + 1] = 0;

  for (let d = 0; d <= max; d++) {
    const snapshot = v.slice();
    trace.push(snapshot);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[max + k - 1]! < v[max + k + 1]!)) {
        x = v[max + k + 1]!;
      } else {
        x = v[max + k - 1]! + 1;
      }
      let y = x - k;

      while (x < oldLen && y < newLen && oldStr[x] === newStr[y]) {
        x++;
        y++;
      }

      v[max + k] = x;

      if (x >= oldLen && y >= newLen) {
        return backtrackMyers(trace, max, oldStr, newStr);
      }
    }
  }

  return simpleDiff(oldStr, newStr);
}

function backtrackMyers(
  trace: number[][],
  max: number,
  oldStr: string,
  newStr: string
): MyersDiffOp[] {
  let x = oldStr.length;
  let y = newStr.length;
  const edits: MyersDiffOp[] = [];

  for (let d = trace.length - 1; d > 0; d--) {
    const v = trace[d - 1]!;
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && v[max + k - 1]! < v[max + k + 1]!)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[max + prevK]!;
    const prevY = prevX - prevK;

    // Diagonal (equal) moves
    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: "equal", text: oldStr[x]! });
    }

    if (x === prevX && y > prevY) {
      y--;
      edits.unshift({ type: "insert", text: newStr[y]! });
    } else if (y === prevY && x > prevX) {
      x--;
      edits.unshift({ type: "delete", text: oldStr[x]! });
    }
  }

  // Any remaining diagonal from start
  while (x > 0 && y > 0) {
    x--;
    y--;
    edits.unshift({ type: "equal", text: oldStr[x]! });
  }

  // Merge consecutive ops of same type
  return mergeOps(edits);
}

function simpleDiff(oldStr: string, newStr: string): MyersDiffOp[] {
  // Find common prefix
  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < oldStr.length - prefixLen &&
    suffixLen < newStr.length - prefixLen &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const ops: MyersDiffOp[] = [];
  if (prefixLen > 0) ops.push({ type: "equal", text: oldStr.slice(0, prefixLen) });

  const oldMiddle = oldStr.slice(prefixLen, oldStr.length - suffixLen);
  const newMiddle = newStr.slice(prefixLen, newStr.length - suffixLen);

  if (oldMiddle.length > 0) ops.push({ type: "delete", text: oldMiddle });
  if (newMiddle.length > 0) ops.push({ type: "insert", text: newMiddle });

  if (suffixLen > 0) ops.push({ type: "equal", text: oldStr.slice(oldStr.length - suffixLen) });

  return ops;
}

function mergeOps(ops: MyersDiffOp[]): MyersDiffOp[] {
  if (ops.length === 0) return [];
  const merged: MyersDiffOp[] = [ops[0]!];
  for (let i = 1; i < ops.length; i++) {
    const last = merged[merged.length - 1]!;
    const curr = ops[i]!;
    if (last.type === curr.type) {
      last.text += curr.text;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

// ── Inline Content Diffing ───────────────────────────────────────────────

/**
 * Tokenize text into words and whitespace runs, preserving all characters.
 * E.g. "hello  world" → ["hello", "  ", "world"]
 */
function tokenizeWords(text: string): string[] {
  const tokens: string[] = [];
  const re = /(\S+|\s+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0]!);
  }
  return tokens;
}

/**
 * Word-level diff using LCS on word tokens.
 * Produces much more readable output for prose than character-level Myers diff.
 */
function wordDiff(oldStr: string, newStr: string): MyersDiffOp[] {
  if (oldStr === newStr) return [{ type: "equal", text: oldStr }];
  if (oldStr.length === 0) return [{ type: "insert", text: newStr }];
  if (newStr.length === 0) return [{ type: "delete", text: oldStr }];

  const oldTokens = tokenizeWords(oldStr);
  const newTokens = tokenizeWords(newStr);

  const pairs = lcs(oldTokens, newTokens, (a, b) => a === b);

  const ops: MyersDiffOp[] = [];
  let oi = 0;
  let ni = 0;

  for (const [matchOi, matchNi] of pairs) {
    // Tokens before this match in old → deleted
    if (oi < matchOi) {
      ops.push({ type: "delete", text: oldTokens.slice(oi, matchOi).join("") });
    }
    // Tokens before this match in new → inserted
    if (ni < matchNi) {
      ops.push({ type: "insert", text: newTokens.slice(ni, matchNi).join("") });
    }
    // The matched token
    ops.push({ type: "equal", text: oldTokens[matchOi]! });
    oi = matchOi + 1;
    ni = matchNi + 1;
  }

  // Remaining tokens after last match
  if (oi < oldTokens.length) {
    ops.push({ type: "delete", text: oldTokens.slice(oi).join("") });
  }
  if (ni < newTokens.length) {
    ops.push({ type: "insert", text: newTokens.slice(ni).join("") });
  }

  return mergeOps(ops);
}

export function computeInlineDiff(
  sourceContent: InlineContent[] | undefined,
  targetContent: InlineContent[] | undefined
): InlineDiffSegment[] {
  const sourceText = extractPlainText(sourceContent);
  const targetText = extractPlainText(targetContent);

  if (sourceText === targetText) {
    return [{ text: sourceText, status: "equal" }];
  }

  const ops = wordDiff(sourceText, targetText);
  return ops.map((op) => ({
    text: op.text,
    status: op.type,
  }));
}

// ── Block-Level Diff ─────────────────────────────────────────────────────

export function computeBlockDiff(
  sourceBlocks: BlockData[],
  targetBlocks: BlockData[]
): DiffResult[] {
  const sourceFingerprints = sourceBlocks.map(fingerprintBlock);
  const targetFingerprints = targetBlocks.map(fingerprintBlock);

  // LCS on fullHash to find unchanged blocks
  const lcsPairs = lcs(
    sourceFingerprints,
    targetFingerprints,
    (a, b) => a.fullHash === b.fullHash
  );

  const lcsSourceSet = new Set(lcsPairs.map(([s]) => s));
  const lcsTargetSet = new Set(lcsPairs.map(([, t]) => t));

  const results: DiffResult[] = [];

  // Build a map of matched target indices
  const targetMatchedBySource = new Map<number, number>();
  for (const [s, t] of lcsPairs) {
    targetMatchedBySource.set(s, t);
  }

  // Find modified blocks: same type, same position relative to LCS, but different content
  // We'll try to match unmatched source blocks to unmatched target blocks by type
  const unmatchedSource: number[] = [];
  const unmatchedTarget: number[] = [];

  for (let i = 0; i < sourceBlocks.length; i++) {
    if (!lcsSourceSet.has(i)) unmatchedSource.push(i);
  }
  for (let j = 0; j < targetBlocks.length; j++) {
    if (!lcsTargetSet.has(j)) unmatchedTarget.push(j);
  }

  // Try to pair unmatched blocks by type for "modified" detection
  const modifiedPairs: [number, number][] = [];
  const usedTargetIndices = new Set<number>();

  for (const si of unmatchedSource) {
    const sType = sourceFingerprints[si]!.type;
    for (const ti of unmatchedTarget) {
      if (usedTargetIndices.has(ti)) continue;
      if (targetFingerprints[ti]!.type === sType) {
        modifiedPairs.push([si, ti]);
        usedTargetIndices.add(ti);
        break;
      }
    }
  }

  const modifiedSourceSet = new Set(modifiedPairs.map(([s]) => s));
  const modifiedTargetSet = new Set(modifiedPairs.map(([, t]) => t));

  // Process all blocks in order (interleave source and target positions)
  // We'll walk through blocks producing a unified diff output

  let si = 0;
  let ti = 0;

  while (si < sourceBlocks.length || ti < targetBlocks.length) {
    // Check if current source is in LCS
    if (si < sourceBlocks.length && lcsSourceSet.has(si)) {
      const matchedTi = targetMatchedBySource.get(si)!;
      // Emit "removed" for target-only blocks between current ti and the LCS match
      while (ti < matchedTi) {
        if (!lcsTargetSet.has(ti) && !modifiedTargetSet.has(ti)) {
          results.push({
            status: "removed",
            targetIndex: ti,
            targetBlock: targetBlocks[ti],
          });
        }
        ti++;
      }
      results.push({
        status: "unchanged",
        sourceIndex: si,
        targetIndex: matchedTi,
        sourceBlock: sourceBlocks[si],
        targetBlock: targetBlocks[matchedTi],
      });
      si++;
      ti = matchedTi + 1;
      continue;
    }

    // Check if current source is modified
    if (si < sourceBlocks.length && modifiedSourceSet.has(si)) {
      const pair = modifiedPairs.find(([s]) => s === si)!;
      const pairedTi = pair[1];
      results.push({
        status: "modified",
        sourceIndex: si,
        targetIndex: pairedTi,
        sourceBlock: sourceBlocks[si],
        targetBlock: targetBlocks[pairedTi],
        inlineDiff: computeInlineDiff(
          sourceBlocks[si]!.content,
          targetBlocks[pairedTi]!.content
        ),
      });
      si++;
      continue;
    }

    // Source-only block: added (in source, to be merged to target)
    if (si < sourceBlocks.length && !lcsSourceSet.has(si) && !modifiedSourceSet.has(si)) {
      results.push({
        status: "added",
        sourceIndex: si,
        sourceBlock: sourceBlocks[si],
      });
      si++;
      continue;
    }

    // Target-only blocks remaining
    if (ti < targetBlocks.length) {
      if (!lcsTargetSet.has(ti) && !modifiedTargetSet.has(ti)) {
        results.push({
          status: "removed",
          targetIndex: ti,
          targetBlock: targetBlocks[ti],
        });
      }
      ti++;
      continue;
    }

    break;
  }

  return results;
}

// ── Page Matching & Diffing ──────────────────────────────────────────────

export interface PageInfo {
  id: string;
  path: string;
  title: string;
  description?: string;
  content: string; // JSON string of BlockData[]
}

export interface FolderInfo {
  path: string;
}

export function computePageDiff(
  sourcePage: PageInfo,
  targetPage: PageInfo
): PageDiff {
  let sourceBlocks: BlockData[];
  let targetBlocks: BlockData[];

  try {
    sourceBlocks = JSON.parse(sourcePage.content);
  } catch {
    sourceBlocks = [];
  }

  try {
    targetBlocks = JSON.parse(targetPage.content);
  } catch {
    targetBlocks = [];
  }

  const blockDiffs = computeBlockDiff(sourceBlocks, targetBlocks);
  const hasChanges = blockDiffs.some((d) => d.status !== "unchanged");
  const titleChanged = sourcePage.title !== targetPage.title;
  const descriptionChanged = (sourcePage.description ?? "") !== (targetPage.description ?? "");

  return {
    path: sourcePage.path,
    status: hasChanges || titleChanged || descriptionChanged ? "modified" : "unchanged",
    sourcePageId: sourcePage.id,
    targetPageId: targetPage.id,
    blockDiffs,
    titleChanged,
    descriptionChanged,
  };
}

export function computeBranchDiff(
  sourcePages: PageInfo[],
  targetPages: PageInfo[],
  sourceFolders: FolderInfo[],
  targetFolders: FolderInfo[]
): BranchDiff {
  const targetPageMap = new Map(targetPages.map((p) => [p.path, p]));
  const sourcePageMap = new Map(sourcePages.map((p) => [p.path, p]));
  const targetFolderSet = new Set(targetFolders.map((f) => f.path));
  const sourceFolderSet = new Set(sourceFolders.map((f) => f.path));

  const pageDiffs: PageDiff[] = [];

  // Pages on source — matched or added
  for (const sp of sourcePages) {
    const tp = targetPageMap.get(sp.path);
    if (tp) {
      const diff = computePageDiff(sp, tp);
      if (diff.status !== "unchanged") {
        pageDiffs.push(diff);
      }
    } else {
      // Source-only: added page
      let sourceBlocks: BlockData[];
      try {
        sourceBlocks = JSON.parse(sp.content);
      } catch {
        sourceBlocks = [];
      }
      pageDiffs.push({
        path: sp.path,
        status: "added",
        sourcePageId: sp.id,
        blockDiffs: sourceBlocks.map((block, i) => ({
          status: "added" as DiffStatus,
          sourceIndex: i,
          sourceBlock: block,
        })),
        titleChanged: false,
        descriptionChanged: false,
      });
    }
  }

  // Pages only on target — removed from source perspective
  for (const tp of targetPages) {
    if (!sourcePageMap.has(tp.path)) {
      pageDiffs.push({
        path: tp.path,
        status: "removed",
        targetPageId: tp.id,
        blockDiffs: [],
        titleChanged: false,
        descriptionChanged: false,
      });
    }
  }

  // Folder diffs
  const folderDiffs: FolderDiff[] = [];
  for (const sf of sourceFolders) {
    if (!targetFolderSet.has(sf.path)) {
      folderDiffs.push({ path: sf.path, status: "added" });
    } else {
      folderDiffs.push({ path: sf.path, status: "unchanged" });
    }
  }
  for (const tf of targetFolders) {
    if (!sourceFolderSet.has(tf.path)) {
      folderDiffs.push({ path: tf.path, status: "removed" });
    }
  }

  const summary: DiffSummary = {
    pagesAdded: pageDiffs.filter((d) => d.status === "added").length,
    pagesRemoved: pageDiffs.filter((d) => d.status === "removed").length,
    pagesModified: pageDiffs.filter((d) => d.status === "modified").length,
    foldersAdded: folderDiffs.filter((d) => d.status === "added").length,
    foldersRemoved: folderDiffs.filter((d) => d.status === "removed").length,
  };

  return { pageDiffs, folderDiffs, summary };
}

// ── Merge Application ────────────────────────────────────────────────────

export function generateBlockId(): string {
  const chars = "0123456789abcdef";
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      return s;
    })
    .join("-");
}

function regenerateIds(block: BlockData): BlockData {
  const result: BlockData = { ...block, id: generateBlockId() };
  if (block.children && block.children.length > 0) {
    result.children = block.children.map(regenerateIds);
  }
  return result;
}

/**
 * Apply merge using diff results and resolution map.
 * Resolutions: Record<blockIndex, "source"|"target"> — for modified blocks.
 * Default for unresolved modified blocks: use source.
 */
export function applyMerge(
  sourceBlocks: BlockData[],
  targetBlocks: BlockData[],
  resolutions: Record<number, "source" | "target"> = {}
): BlockData[] {
  const diffs = computeBlockDiff(sourceBlocks, targetBlocks);
  const merged: BlockData[] = [];

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i]!;

    switch (diff.status) {
      case "unchanged":
        // Keep the target version (it's the same)
        merged.push(regenerateIds(diff.targetBlock ?? diff.sourceBlock!));
        break;

      case "added":
        // New block from source — include it
        merged.push(regenerateIds(diff.sourceBlock!));
        break;

      case "removed":
        // Block only on target, not on source — skip it (source doesn't have it)
        // Actually, "removed" means it exists in target but not source,
        // so we keep it in target unless explicitly removing
        merged.push(regenerateIds(diff.targetBlock!));
        break;

      case "modified": {
        const resolution = resolutions[i] ?? "source";
        const chosenBlock = resolution === "source" ? diff.sourceBlock! : diff.targetBlock!;
        merged.push(regenerateIds(chosenBlock));
        break;
      }
    }
  }

  return merged;
}
