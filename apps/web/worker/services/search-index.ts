import type {
  D1DatabaseBinding,
  D1PreparedStatementBinding,
} from "@/worker/env";

interface BlockNoteInlineContent {
  type: string;
  text?: string;
  content?: BlockNoteInlineContent[];
}

interface BlockNoteTableCell {
  type: "tableCell";
  content?: BlockNoteInlineContent[];
}

interface BlockNoteTableContent {
  type: "tableContent";
  rows?: Array<{
    cells?: Array<BlockNoteInlineContent[] | BlockNoteTableCell>;
  }>;
}

interface BlockNoteBlock {
  type: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInlineContent[] | BlockNoteTableContent;
  children?: BlockNoteBlock[];
}

export interface ExtractedSearchText {
  title: string;
  headings: string;
  content: string;
  codeBlocks: string;
  excerpt: string;
}

interface PageSearchSource {
  page_id: string;
  project_id: string;
  title: string;
  path: string;
  content: string;
  branch_id: string;
  default_branch_id: string | null;
}

function isInlineContent(
  content: BlockNoteBlock["content"]
): content is BlockNoteInlineContent[] {
  return Array.isArray(content);
}

function inlineText(content: BlockNoteInlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "text") return item.text ?? "";
      return item.content ? inlineText(item.content) : "";
    })
    .join("");
}

function extractBlock(
  block: BlockNoteBlock,
  result: {
    headings: string[];
    content: string[];
    codeBlocks: string[];
  }
) {
  const text = isInlineContent(block.content) ? inlineText(block.content) : "";

  if (block.type === "heading") {
    if (text) result.headings.push(text);
  } else if (block.type === "codeBlock") {
    const code = String(block.props?.code ?? "") || text;
    if (code) result.codeBlocks.push(code);
  } else if (
    block.type === "table" &&
    block.content &&
    !isInlineContent(block.content)
  ) {
    for (const row of block.content.rows ?? []) {
      for (const cell of row.cells ?? []) {
        const cellContent = Array.isArray(cell) ? cell : (cell.content ?? []);
        const cellText = inlineText(cellContent);
        if (cellText) result.content.push(cellText);
      }
    }
  } else {
    const title = block.props?.title;
    if (
      (block.type === "callout" ||
        block.type === "card" ||
        block.type === "tab") &&
      typeof title === "string" &&
      title
    ) {
      result.content.push(title);
    }
    if (text) result.content.push(text);
  }

  for (const child of block.children ?? []) extractBlock(child, result);
}

export function extractSearchableText(
  serializedBlocks: string,
  pageTitle: string
): ExtractedSearchText {
  let blocks: BlockNoteBlock[] = [];
  try {
    const parsed: unknown = JSON.parse(serializedBlocks);
    if (Array.isArray(parsed)) blocks = parsed as BlockNoteBlock[];
  } catch {
    // Invalid editor JSON should not prevent a page write.
  }

  const result = {
    headings: [] as string[],
    content: [] as string[],
    codeBlocks: [] as string[],
  };
  for (const block of blocks) extractBlock(block, result);

  const headings = result.headings.join(" ");
  const content = result.content.join(" ");
  const codeBlocks = result.codeBlocks.join(" ");
  const allText = [content, headings].filter(Boolean).join(" ");
  const excerpt =
    allText.length > 150 ? `${allText.slice(0, 150).trim()}...` : allText;

  return {
    title: pageTitle,
    headings,
    content,
    codeBlocks,
    excerpt: excerpt || pageTitle,
  };
}

function upsertStatement(
  binding: D1DatabaseBinding,
  source: PageSearchSource
): D1PreparedStatementBinding {
  const extracted = extractSearchableText(source.content, source.title);
  return binding
    .prepare(
      `INSERT INTO search_index (
         id, page_id, project_id, title, headings, content, code_blocks,
         path, excerpt, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(page_id) DO UPDATE SET
         project_id = excluded.project_id,
         title = excluded.title,
         headings = excluded.headings,
         content = excluded.content,
         code_blocks = excluded.code_blocks,
         path = excluded.path,
         excerpt = excluded.excerpt,
         updated_at = excluded.updated_at`
    )
    .bind(
      crypto.randomUUID(),
      source.page_id,
      source.project_id,
      extracted.title,
      extracted.headings,
      extracted.content,
      extracted.codeBlocks,
      source.path,
      extracted.excerpt,
      Date.now()
    );
}

async function pageSource(
  binding: D1DatabaseBinding,
  pageId: string
): Promise<PageSearchSource | null> {
  return binding
    .prepare(
      `SELECT
         p.id AS page_id,
         b.project_id AS project_id,
         p.title,
         p.path,
         pc.content,
         p.branch_id,
         pr.default_branch_id
       FROM pages p
       JOIN branches b ON b.id = p.branch_id
       JOIN projects pr ON pr.id = b.project_id
       JOIN page_contents pc ON pc.page_id = p.id
       WHERE p.id = ?`
    )
    .bind(pageId)
    .first<PageSearchSource>();
}

export async function syncPageSearchIndex(
  binding: D1DatabaseBinding,
  pageId: string
) {
  const source = await pageSource(binding, pageId);
  if (!source || source.branch_id !== source.default_branch_id) {
    await binding
      .prepare("DELETE FROM search_index WHERE page_id = ?")
      .bind(pageId)
      .run();
    return false;
  }
  await upsertStatement(binding, source).run();
  return true;
}

export async function rebuildProjectSearchIndex(
  binding: D1DatabaseBinding,
  projectId: string
) {
  const { results } = await binding
    .prepare(
      `SELECT
         p.id AS page_id,
         b.project_id AS project_id,
         p.title,
         p.path,
         pc.content,
         p.branch_id,
         pr.default_branch_id
       FROM projects pr
       JOIN branches b ON b.id = pr.default_branch_id
       JOIN pages p ON p.branch_id = b.id
       JOIN page_contents pc ON pc.page_id = p.id
       WHERE pr.id = ? AND COALESCE(p.ai_pending_review, 0) = 0`
    )
    .bind(projectId)
    .all<PageSearchSource>();

  await binding
    .prepare("DELETE FROM search_index WHERE project_id = ?")
    .bind(projectId)
    .run();

  for (let index = 0; index < results.length; index += 100) {
    await binding.batch(
      results
        .slice(index, index + 100)
        .map((source) => upsertStatement(binding, source))
    );
  }
  return results.length;
}

export function toFtsQuery(value: string): string | null {
  const terms = value.match(/[\p{L}\p{N}_-]+/gu);
  if (!terms?.length) return null;
  return terms
    .slice(0, 12)
    .map((term) => `"${term.replaceAll('"', '""')}"*`)
    .join(" AND ");
}
