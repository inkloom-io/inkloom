import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ── Diff Computation Actions ─────────────────────────────────────────────
// Cast api/internal to break circular type inference: TypeScript can't
// infer action return types when they reference `api` (whose type includes
// this module's exports, creating a circular initializer chain).
const apiRef = api as any;
const internalRef = internal as any;

export const computeDiff = action({
  args: {
    mergeRequestId: v.id("mergeRequests"),
  },
  handler: async (ctx, args) => {
    const mr = await ctx.runQuery(internalRef.mergeRequests.getInternal, {
      mergeRequestId: args.mergeRequestId,
    });
    if (!mr) throw new Error("Merge request not found");

    // For merged/closed MRs, return the stored snapshot if available
    if (mr.status !== "open" && mr.diffSnapshot) {
      try {
        return JSON.parse(mr.diffSnapshot);
      } catch {
        // Fall through to recompute if snapshot is corrupted
      }
    }

    // Load pages for both branches
    const sourcePages = await ctx.runQuery(apiRef.pages.listByBranch, {
      branchId: mr.sourceBranchId,
    });
    const targetPages = await ctx.runQuery(apiRef.pages.listByBranch, {
      branchId: mr.targetBranchId,
    });

    // Load content for all pages
    const sourcePageInfos = await Promise.all(
      sourcePages.map(async (p: any) => {
        const content = await ctx.runQuery(apiRef.pages.getContent, {
          pageId: p._id,
        });
        return {
          id: p._id,
          path: p.path,
          title: p.title,
          description: p.description,
          content: content?.content ?? "[]",
        };
      })
    );

    const targetPageInfos = await Promise.all(
      targetPages.map(async (p: any) => {
        const content = await ctx.runQuery(apiRef.pages.getContent, {
          pageId: p._id,
        });
        return {
          id: p._id,
          path: p.path,
          title: p.title,
          description: p.description,
          content: content?.content ?? "[]",
        };
      })
    );

    // Load folders
    const sourceFolders = await ctx.runQuery(apiRef.folders.listByBranch, {
      branchId: mr.sourceBranchId,
    });
    const targetFolders = await ctx.runQuery(apiRef.folders.listByBranch, {
      branchId: mr.targetBranchId,
    });

    // Compute diff using the engine
    const { computeBranchDiff } = await import("../lib/diff-engine");

    const diff = computeBranchDiff(
      sourcePageInfos,
      targetPageInfos,
      sourceFolders.map((f: any) => ({ path: f.path })),
      targetFolders.map((f: any) => ({ path: f.path }))
    );

    // Cache summary and full snapshot on MR
    await ctx.runMutation(apiRef.mergeRequests.updateDiffSummary, {
      mergeRequestId: args.mergeRequestId,
      diffSummary: diff.summary,
      diffSnapshot: JSON.stringify(diff),
    });

    return diff;
  },
});

export const computePageDiffAction = action({
  args: {
    sourceBranchId: v.id("branches"),
    targetBranchId: v.id("branches"),
    pagePath: v.string(),
    mergeRequestId: v.optional(v.id("mergeRequests")),
  },
  handler: async (ctx, args) => {
    // For merged/closed MRs, extract page diff from the stored snapshot
    if (args.mergeRequestId) {
      const mr = await ctx.runQuery(internalRef.mergeRequests.getInternal, {
        mergeRequestId: args.mergeRequestId,
      });
      if (mr && mr.status !== "open" && mr.diffSnapshot) {
        try {
          const snapshot = JSON.parse(mr.diffSnapshot);
          const pageDiff = snapshot.pageDiffs?.find(
            (pd: { path: string }) => pd.path === args.pagePath
          );
          if (pageDiff) return pageDiff;
        } catch {
          // Fall through to recompute
        }
      }
    }

    // Load specific page on both branches by path
    const sourcePages = await ctx.runQuery(apiRef.pages.listByBranch, {
      branchId: args.sourceBranchId,
    });
    const targetPages = await ctx.runQuery(apiRef.pages.listByBranch, {
      branchId: args.targetBranchId,
    });

    const sourcePage = sourcePages.find((p: any) => p.path === args.pagePath);
    const targetPage = targetPages.find((p: any) => p.path === args.pagePath);

    if (!sourcePage && !targetPage) {
      throw new Error("Page not found on either branch");
    }

    const { computePageDiff } = await import("../lib/diff-engine");

    if (sourcePage && targetPage) {
      const sourceContent = await ctx.runQuery(apiRef.pages.getContent, {
        pageId: sourcePage._id,
      });
      const targetContent = await ctx.runQuery(apiRef.pages.getContent, {
        pageId: targetPage._id,
      });

      return computePageDiff(
        {
          id: sourcePage._id,
          path: sourcePage.path,
          title: sourcePage.title,
          description: sourcePage.description,
          content: sourceContent?.content ?? "[]",
        },
        {
          id: targetPage._id,
          path: targetPage.path,
          title: targetPage.title,
          description: targetPage.description,
          content: targetContent?.content ?? "[]",
        }
      );
    }

    // Page only on source (added)
    if (sourcePage) {
      const sourceContent = await ctx.runQuery(apiRef.pages.getContent, {
        pageId: sourcePage._id,
      });
      let sourceBlocks: unknown[] = [];
      try {
        sourceBlocks = JSON.parse(sourceContent?.content ?? "[]");
      } catch {
        sourceBlocks = [];
      }
      return {
        path: sourcePage.path,
        status: "added" as const,
        sourcePageId: sourcePage._id,
        blockDiffs: sourceBlocks.map((block, i) => ({
          status: "added" as const,
          sourceIndex: i,
          sourceBlock: block,
        })),
        titleChanged: false,
        descriptionChanged: false,
      };
    }

    // Page only on target (removed from source perspective)
    return {
      path: targetPage!.path,
      status: "removed" as const,
      targetPageId: targetPage!._id,
      blockDiffs: [],
      titleChanged: false,
      descriptionChanged: false,
    };
  },
});
