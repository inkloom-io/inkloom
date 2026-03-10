import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

interface ExtractedText {
  title: string;
  headings: string;
  content: string;
  codeBlocks: string;
  excerpt: string;
}

interface BlockNoteBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInlineContent[] | TableContent;
  children?: BlockNoteBlock[];
}

interface BlockNoteInlineContent {
  type: string;
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: BlockNoteInlineContent[];
}

interface TableContentCell {
  type: "tableCell";
  content: BlockNoteInlineContent[];
}

interface TableContent {
  type: "tableContent";
  rows: {
    cells: BlockNoteInlineContent[][] | TableContentCell[];
  }[];
}

function isInlineContentArray(
  content: BlockNoteInlineContent[] | TableContent
): content is BlockNoteInlineContent[] {
  return Array.isArray(content);
}

function extractInlineText(content: BlockNoteInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "text") {
        return item.text || "";
      }
      if (item.type === "link" && item.content) {
        return extractInlineText(item.content);
      }
      return "";
    })
    .join("");
}

function extractFromBlock(
  block: BlockNoteBlock,
  result: {
    headings: string[];
    content: string[];
    codeBlocks: string[];
  }
): void {
  switch (block.type) {
    case "heading": {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.headings.push(text);
      }
      break;
    }

    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem":
    case "quote": {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "codeBlock": {
      const codeFromProps = (block.props?.code as string) || "";
      const codeFromContent = block.content && isInlineContentArray(block.content)
        ? extractInlineText(block.content)
        : "";
      const code = codeFromProps || codeFromContent;
      if (code) {
        result.codeBlocks.push(code);
      }
      break;
    }

    case "table": {
      if (block.content && !isInlineContentArray(block.content) && block.content.type === "tableContent") {
        for (const row of block.content.rows) {
          for (const cell of row.cells) {
            let cellContent: BlockNoteInlineContent[];
            if (Array.isArray(cell) && (cell.length === 0 || cell[0] === undefined || !("type" in cell[0]) || cell[0].type !== "tableCell")) {
              cellContent = cell as BlockNoteInlineContent[];
            } else if (!Array.isArray(cell)) {
              cellContent = [];
            } else {
              const tableCell = cell as unknown as TableContentCell;
              cellContent = tableCell.type === "tableCell" ? tableCell.content || [] : cell as BlockNoteInlineContent[];
            }
            const text = extractInlineText(cellContent);
            if (text) {
              result.content.push(text);
            }
          }
        }
      }
      break;
    }

    case "callout": {
      const title = block.props?.title as string;
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "card": {
      const title = (block.props?.title as string) || "";
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    case "tab": {
      const title = (block.props?.title as string) || "";
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (title) {
        result.content.push(title);
      }
      if (text) {
        result.content.push(text);
      }
      break;
    }

    default: {
      const text = block.content && isInlineContentArray(block.content) ? extractInlineText(block.content) : "";
      if (text) {
        result.content.push(text);
      }
    }
  }

  if (block.children && block.children.length > 0) {
    for (const child of block.children) {
      extractFromBlock(child, result);
    }
  }
}

function extractSearchableText(
  blocks: BlockNoteBlock[],
  pageTitle: string
): ExtractedText {
  const result = {
    headings: [] as string[],
    content: [] as string[],
    codeBlocks: [] as string[],
  };

  for (const block of blocks) {
    extractFromBlock(block, result);
  }

  const headingsText = result.headings.join(" ");
  const contentText = result.content.join(" ");
  const codeBlocksText = result.codeBlocks.join(" ");

  const allText = [contentText, headingsText].filter(Boolean).join(" ");
  const excerpt = allText.slice(0, 150).trim() + (allText.length > 150 ? "..." : "");

  return {
    title: pageTitle,
    headings: headingsText,
    content: contentText,
    codeBlocks: codeBlocksText,
    excerpt: excerpt || pageTitle,
  };
}

function parseBlockNoteContent(content: string): BlockNoteBlock[] {
  try {
    return JSON.parse(content) as BlockNoteBlock[];
  } catch {
    return [];
  }
}

export const upsertSearchIndex = internalMutation({
  args: {
    pageId: v.id("pages"),
    projectId: v.id("projects"),
    title: v.string(),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const blocks = parseBlockNoteContent(args.content);
    const extracted = extractSearchableText(blocks, args.title);

    const existing = await ctx.db
      .query("searchIndex")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: extracted.title,
        headings: extracted.headings,
        content: extracted.content,
        codeBlocks: extracted.codeBlocks,
        path: args.path,
        excerpt: extracted.excerpt,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("searchIndex", {
      pageId: args.pageId,
      projectId: args.projectId,
      title: extracted.title,
      headings: extracted.headings,
      content: extracted.content,
      codeBlocks: extracted.codeBlocks,
      path: args.path,
      excerpt: extracted.excerpt,
      updatedAt: Date.now(),
    });
  },
});

export const deleteSearchIndex = internalMutation({
  args: {
    pageId: v.id("pages"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("searchIndex")
      .withIndex("by_page", (q: any) => q.eq("pageId", args.pageId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const rebuildProjectIndex = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project?.defaultBranchId) {
      return { indexed: 0 };
    }

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_branch", (q: any) => q.eq("branchId", project.defaultBranchId!))
      .collect();

    let indexed = 0;
    for (const page of pages) {
      const content = await ctx.db
        .query("pageContents")
        .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
        .unique();

      if (content) {
        const blocks = parseBlockNoteContent(content.content);
        const extracted = extractSearchableText(blocks, page.title);

        const existing = await ctx.db
          .query("searchIndex")
          .withIndex("by_page", (q: any) => q.eq("pageId", page._id))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            title: extracted.title,
            headings: extracted.headings,
            content: extracted.content,
            codeBlocks: extracted.codeBlocks,
            path: page.path,
            excerpt: extracted.excerpt,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("searchIndex", {
            pageId: page._id,
            projectId: args.projectId,
            title: extracted.title,
            headings: extracted.headings,
            content: extracted.content,
            codeBlocks: extracted.codeBlocks,
            path: page.path,
            excerpt: extracted.excerpt,
            updatedAt: Date.now(),
          });
        }
        indexed++;
      }
    }

    return { indexed };
  },
});

export const searchProject = query({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const maxResults = args.limit || 10;

    // Search across different fields and merge results
    const [titleResults, headingResults, contentResults] = await Promise.all([
      ctx.db
        .query("searchIndex")
        .withSearchIndex("search_titles", (q: any) =>
          q.search("title", args.query).eq("projectId", args.projectId)
        )
        .take(maxResults),
      ctx.db
        .query("searchIndex")
        .withSearchIndex("search_headings", (q: any) =>
          q.search("headings", args.query).eq("projectId", args.projectId)
        )
        .take(maxResults),
      ctx.db
        .query("searchIndex")
        .withSearchIndex("search_content", (q: any) =>
          q.search("content", args.query).eq("projectId", args.projectId)
        )
        .take(maxResults),
    ]);

    // Merge and deduplicate with weighted scoring
    const scoreMap = new Map<
      Id<"searchIndex">,
      { doc: typeof titleResults[0]; score: number }
    >();

    // Title matches get highest weight (3x)
    for (let i = 0; i < titleResults.length; i++) {
      const doc = titleResults[i];
      if (!doc) continue;
      const positionScore = (maxResults - i) / maxResults;
      scoreMap.set(doc._id, {
        doc,
        score: 3 * positionScore,
      });
    }

    // Heading matches get medium weight (2x)
    for (let i = 0; i < headingResults.length; i++) {
      const doc = headingResults[i];
      if (!doc) continue;
      const positionScore = (maxResults - i) / maxResults;
      const existing = scoreMap.get(doc._id);
      if (existing) {
        existing.score += 2 * positionScore;
      } else {
        scoreMap.set(doc._id, {
          doc,
          score: 2 * positionScore,
        });
      }
    }

    // Content matches get base weight (1x)
    for (let i = 0; i < contentResults.length; i++) {
      const doc = contentResults[i];
      if (!doc) continue;
      const positionScore = (maxResults - i) / maxResults;
      const existing = scoreMap.get(doc._id);
      if (existing) {
        existing.score += positionScore;
      } else {
        scoreMap.set(doc._id, {
          doc,
          score: positionScore,
        });
      }
    }

    // Sort by score and return top results
    const sorted = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return sorted.map(({ doc, score }) => ({
      id: doc._id,
      pageId: doc.pageId,
      title: doc.title,
      path: doc.path,
      excerpt: doc.excerpt,
      score,
    }));
  },
});
