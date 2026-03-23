import { describe, it, expect } from "vitest";
import {
  djb2Hash,
  fingerprintBlock,
  myersDiff,
  computeInlineDiff,
  computeBlockDiff,
  computeBranchDiff,
  generateBlockId,
  type BlockData,
  type InlineContent,
  type PageInfo,
  type FolderInfo,
} from "../diff-engine";

// ---------------------------------------------------------------------------
// DJB2 Hash
// ---------------------------------------------------------------------------

describe("djb2Hash", () => {
  it("returns a hex string", () => {
    const hash = djb2Hash("hello");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    const h1 = djb2Hash("test string");
    const h2 = djb2Hash("test string");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = djb2Hash("hello");
    const h2 = djb2Hash("world");
    expect(h1).not.toBe(h2);
  });

  it("handles empty string", () => {
    const hash = djb2Hash("");
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toBe(djb2Hash("")); // deterministic
  });

  it("handles special characters", () => {
    const hash = djb2Hash("héllo wörld 🌍");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is sensitive to character order", () => {
    const h1 = djb2Hash("ab");
    const h2 = djb2Hash("ba");
    expect(h1).not.toBe(h2);
  });

  it("handles very long strings", () => {
    const longStr = "a".repeat(100000);
    const hash = djb2Hash(longStr);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  // Property: hash should be consistent across multiple calls
  it("is consistent across 100 random-like inputs", () => {
    for (let i = 0; i < 100; i++) {
      const input = `test-${i}-${String.fromCharCode(65 + (i % 26))}`;
      expect(djb2Hash(input)).toBe(djb2Hash(input));
    }
  });
});

// ---------------------------------------------------------------------------
// Block Fingerprinting
// ---------------------------------------------------------------------------

describe("fingerprintBlock", () => {
  it("returns a BlockFingerprint with all fields", () => {
    const block: BlockData = {
      type: "paragraph",
      content: [{ type: "text", text: "Hello" }],
    };
    const fp = fingerprintBlock(block);
    expect(fp.type).toBe("paragraph");
    expect(fp.propsHash).toMatch(/^[0-9a-f]+$/);
    expect(fp.contentHash).toMatch(/^[0-9a-f]+$/);
    expect(fp.fullHash).toMatch(/^[0-9a-f]+$/);
  });

  it("same block produces same fingerprint", () => {
    const block: BlockData = {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "Title" }],
    };
    const fp1 = fingerprintBlock(block);
    const fp2 = fingerprintBlock(block);
    expect(fp1.fullHash).toBe(fp2.fullHash);
  });

  it("different text produces different fingerprint", () => {
    const block1: BlockData = {
      type: "paragraph",
      content: [{ type: "text", text: "Hello" }],
    };
    const block2: BlockData = {
      type: "paragraph",
      content: [{ type: "text", text: "World" }],
    };
    expect(fingerprintBlock(block1).fullHash).not.toBe(
      fingerprintBlock(block2).fullHash
    );
  });

  it("different types produce different fingerprints", () => {
    const block1: BlockData = {
      type: "paragraph",
      content: [{ type: "text", text: "Same" }],
    };
    const block2: BlockData = {
      type: "heading",
      content: [{ type: "text", text: "Same" }],
    };
    expect(fingerprintBlock(block1).fullHash).not.toBe(
      fingerprintBlock(block2).fullHash
    );
  });

  it("handles blocks with no content", () => {
    const block: BlockData = { type: "divider" };
    const fp = fingerprintBlock(block);
    expect(fp.type).toBe("divider");
    expect(fp.fullHash).toMatch(/^[0-9a-f]+$/);
  });

  it("handles blocks with children", () => {
    const block: BlockData = {
      type: "bulletListItem",
      content: [{ type: "text", text: "Parent" }],
      children: [
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "Child" }],
        },
      ],
    };
    const fp = fingerprintBlock(block);
    expect(fp.fullHash).toMatch(/^[0-9a-f]+$/);
  });

  it("children affect the content hash", () => {
    const blockNoChildren: BlockData = {
      type: "bulletListItem",
      content: [{ type: "text", text: "Parent" }],
    };
    const blockWithChildren: BlockData = {
      type: "bulletListItem",
      content: [{ type: "text", text: "Parent" }],
      children: [
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "Child" }],
        },
      ],
    };
    expect(fingerprintBlock(blockNoChildren).contentHash).not.toBe(
      fingerprintBlock(blockWithChildren).contentHash
    );
  });

  it("ignores block id in fingerprint", () => {
    const block1: BlockData = {
      id: "abc123",
      type: "paragraph",
      content: [{ type: "text", text: "Same" }],
    };
    const block2: BlockData = {
      id: "xyz789",
      type: "paragraph",
      content: [{ type: "text", text: "Same" }],
    };
    // The id field should not affect the fingerprint
    expect(fingerprintBlock(block1).fullHash).toBe(
      fingerprintBlock(block2).fullHash
    );
  });

  it("handles nested inline content (links)", () => {
    const block: BlockData = {
      type: "paragraph",
      content: [
        { type: "text", text: "Click " },
        {
          type: "link",
          href: "https://example.com",
          content: [{ type: "text", text: "here" }],
        },
      ],
    };
    const fp = fingerprintBlock(block);
    expect(fp.type).toBe("paragraph");
    expect(fp.fullHash).toMatch(/^[0-9a-f]+$/);
  });
});

// ---------------------------------------------------------------------------
// Myers Diff
// ---------------------------------------------------------------------------

describe("myersDiff", () => {
  it("returns empty for two empty strings", () => {
    const result = myersDiff("", "");
    expect(result).toEqual([]);
  });

  it("returns equal for identical strings", () => {
    const result = myersDiff("hello", "hello");
    expect(result).toEqual([{ type: "equal", text: "hello" }]);
  });

  it("returns insert for empty-to-non-empty", () => {
    const result = myersDiff("", "hello");
    expect(result).toEqual([{ type: "insert", text: "hello" }]);
  });

  it("returns delete for non-empty-to-empty", () => {
    const result = myersDiff("hello", "");
    expect(result).toEqual([{ type: "delete", text: "hello" }]);
  });

  it("detects character-level changes", () => {
    const result = myersDiff("abc", "axc");
    // Should have some equal, delete, insert operations
    const types = result.map((op) => op.type);
    expect(types).toContain("equal");
    // Either delete+insert or replacement pattern
    expect(types.length).toBeGreaterThan(1);
  });

  it("reconstructs old string from equal+delete ops", () => {
    const oldStr = "the quick brown fox";
    const newStr = "the slow brown cat";
    const diff = myersDiff(oldStr, newStr);

    const reconstructed = diff
      .filter((op) => op.type !== "insert")
      .map((op) => op.text)
      .join("");
    expect(reconstructed).toBe(oldStr);
  });

  it("produces diff ops for modified strings", () => {
    const diff = myersDiff("abc", "axc");
    // Should detect changes between the strings
    expect(diff.length).toBeGreaterThan(0);
    // At minimum, should have some equal parts and some changes
    const hasEqual = diff.some((op) => op.type === "equal");
    const hasChanges = diff.some((op) => op.type !== "equal");
    expect(hasEqual).toBe(true);
    expect(hasChanges).toBe(true);
  });

  // Property: old string reconstruction works for simple cases
  it("old string reconstruction property holds", () => {
    const pairs: [string, string][] = [
      ["abc", "def"],
      ["same", "same"],
      ["", "add me"],
      ["remove me", ""],
    ];

    for (const [oldStr, newStr] of pairs) {
      const diff = myersDiff(oldStr, newStr);
      const reconstructedOld = diff
        .filter((op) => op.type !== "insert")
        .map((op) => op.text)
        .join("");
      expect(reconstructedOld).toBe(oldStr);
    }
  });
});

// ---------------------------------------------------------------------------
// Compute Block Diff
// ---------------------------------------------------------------------------

describe("computeBlockDiff", () => {
  it("returns no diffs for identical block arrays", () => {
    const blocks: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "World" }] },
    ];
    const diffs = computeBlockDiff(blocks, blocks);
    expect(diffs.every((d) => d.status === "unchanged")).toBe(true);
  });

  it("detects new blocks in target", () => {
    const source: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ];
    const target: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "heading", content: [{ type: "text", text: "World" }] },
    ];
    const diffs = computeBlockDiff(source, target);
    // The new block should be detected as "added"
    const nonUnchanged = diffs.filter((d) => d.status !== "unchanged");
    expect(nonUnchanged.length).toBeGreaterThan(0);
  });

  it("detects blocks removed from source", () => {
    const source: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "heading", content: [{ type: "text", text: "World" }] },
    ];
    const target: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ];
    const diffs = computeBlockDiff(source, target);
    const nonUnchanged = diffs.filter((d) => d.status !== "unchanged");
    expect(nonUnchanged.length).toBeGreaterThan(0);
  });

  it("detects modified blocks (same type, different content)", () => {
    const source: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ];
    const target: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "World" }] },
    ];
    const diffs = computeBlockDiff(source, target);
    const modifiedDiffs = diffs.filter((d) => d.status === "modified");
    expect(modifiedDiffs.length).toBe(1);
  });

  it("handles empty source (all blocks are added)", () => {
    const target: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "New" }] },
    ];
    const diffs = computeBlockDiff([], target);
    expect(diffs.length).toBeGreaterThan(0);
    // All diffs should be additions (either "added" or equivalent)
    expect(diffs.every((d) => d.status !== "unchanged")).toBe(true);
  });

  it("handles empty target (all blocks are removed)", () => {
    const source: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Old" }] },
    ];
    const diffs = computeBlockDiff(source, []);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.status !== "unchanged")).toBe(true);
  });

  it("handles both empty", () => {
    const diffs = computeBlockDiff([], []);
    expect(diffs).toEqual([]);
  });

  it("returns diffs with source/target indices", () => {
    const source: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ];
    const target: BlockData[] = [
      { type: "paragraph", content: [{ type: "text", text: "World" }] },
    ];
    const diffs = computeBlockDiff(source, target);
    for (const diff of diffs) {
      // Each diff should reference source and/or target blocks
      expect(
        diff.sourceIndex !== undefined || diff.targetIndex !== undefined
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Compute Branch Diff
// ---------------------------------------------------------------------------

describe("computeBranchDiff", () => {
  // computeBranchDiff(sourcePages, targetPages, sourceFolders, targetFolders)
  // "source" is the feature branch, "target" is the base branch
  // Pages in source but not target → "added"
  // Pages in target but not source → "removed"

  it("returns zero-change summary for identical branches", () => {
    const pages: PageInfo[] = [
      {
        id: "p1",
        title: "Home",
        path: "home",
        content: JSON.stringify([
          { type: "paragraph", content: [{ type: "text", text: "Welcome" }] },
        ]),
      },
    ];
    const folders: FolderInfo[] = [];
    const diff = computeBranchDiff(pages, pages, folders, folders);
    expect(diff.summary.pagesModified).toBe(0);
    // Unchanged pages don't appear in pageDiffs
    expect(diff.pageDiffs.length).toBe(0);
  });

  it("detects pages added in source (not in target)", () => {
    const sourcePages: PageInfo[] = [
      {
        id: "p1",
        title: "New Page",
        path: "new-page",
        content: JSON.stringify([]),
      },
    ];
    const diff = computeBranchDiff(sourcePages, [], [], []);
    expect(diff.summary.pagesAdded).toBe(1);
  });

  it("detects pages removed (in target, not in source)", () => {
    const targetPages: PageInfo[] = [
      {
        id: "p1",
        title: "Old Page",
        path: "old-page",
        content: JSON.stringify([]),
      },
    ];
    const diff = computeBranchDiff([], targetPages, [], []);
    expect(diff.summary.pagesRemoved).toBe(1);
  });

  it("detects folders added in source (not in target)", () => {
    const sourceFolders: FolderInfo[] = [{ path: "new-folder" }];
    const diff = computeBranchDiff([], [], sourceFolders, []);
    expect(diff.summary.foldersAdded).toBe(1);
  });

  it("detects folders removed (in target, not in source)", () => {
    const targetFolders: FolderInfo[] = [{ path: "old-folder" }];
    const diff = computeBranchDiff([], [], [], targetFolders);
    expect(diff.summary.foldersRemoved).toBe(1);
  });

  it("summary counts are consistent with diff arrays", () => {
    const sourcePages: PageInfo[] = [
      {
        id: "p1",
        title: "Keep",
        path: "keep",
        content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "old" }] }]),
      },
      {
        id: "p2",
        title: "Added",
        path: "added",
        content: JSON.stringify([]),
      },
    ];
    const targetPages: PageInfo[] = [
      {
        id: "p1",
        title: "Keep",
        path: "keep",
        content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "new" }] }]),
      },
      {
        id: "p3",
        title: "Removed",
        path: "removed",
        content: JSON.stringify([]),
      },
    ];
    const diff = computeBranchDiff(sourcePages, targetPages, [], []);

    // Count from pageDiffs
    const addedCount = diff.pageDiffs.filter((d) => d.status === "added").length;
    const removedCount = diff.pageDiffs.filter((d) => d.status === "removed").length;
    const modifiedCount = diff.pageDiffs.filter((d) => d.status === "modified").length;

    expect(diff.summary.pagesAdded).toBe(addedCount);
    expect(diff.summary.pagesRemoved).toBe(removedCount);
    expect(diff.summary.pagesModified).toBe(modifiedCount);
  });
});

// ---------------------------------------------------------------------------
// Generate Block ID
// ---------------------------------------------------------------------------

describe("generateBlockId", () => {
  it("returns a UUID-like string", () => {
    const id = generateBlockId();
    // Format: 8-4-4-4-12 hex chars
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateBlockId());
    }
    // All 1000 IDs should be unique
    expect(ids.size).toBe(1000);
  });

  it("returns a string of length 36", () => {
    const id = generateBlockId();
    expect(id.length).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// Compute Inline Diff
// ---------------------------------------------------------------------------

describe("computeInlineDiff", () => {
  it("returns equal segments for identical content", () => {
    const content: InlineContent[] = [{ type: "text", text: "Hello" }];
    const result = computeInlineDiff(content, content);
    expect(result.every((seg) => seg.status === "equal")).toBe(true);
  });

  it("detects inserted text", () => {
    // source = feature branch (new), target = main (old)
    // "Hello" → "Hello World" means "World" was inserted in the feature branch
    const source: InlineContent[] = [{ type: "text", text: "Hello World" }];
    const target: InlineContent[] = [{ type: "text", text: "Hello" }];
    const result = computeInlineDiff(source, target);
    expect(result.some((seg) => seg.status === "insert")).toBe(true);
  });

  it("detects deleted text", () => {
    // source = feature branch (new), target = main (old)
    // "Hello World" → "Hello" means "World" was deleted in the feature branch
    const source: InlineContent[] = [{ type: "text", text: "Hello" }];
    const target: InlineContent[] = [{ type: "text", text: "Hello World" }];
    const result = computeInlineDiff(source, target);
    expect(result.some((seg) => seg.status === "delete")).toBe(true);
  });

  it("handles empty source", () => {
    const target: InlineContent[] = [{ type: "text", text: "New" }];
    const result = computeInlineDiff([], target);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles empty target", () => {
    const source: InlineContent[] = [{ type: "text", text: "Old" }];
    const result = computeInlineDiff(source, []);
    expect(result.length).toBeGreaterThan(0);
  });
});
