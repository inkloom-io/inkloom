import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";

export interface SearchDocument {
  id: string;
  title: string;
  headings: string;
  content: string;
  codeBlocks: string;
  path: string;
  excerpt: string;
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  score: number;
}

let miniSearch: MiniSearch<SearchDocument> | null = null;
let documentsLoaded = false;

async function initSearch(): Promise<MiniSearch<SearchDocument>> {
  if (miniSearch && documentsLoaded) {
    return miniSearch;
  }

  miniSearch = new MiniSearch<SearchDocument>({
    fields: ["title", "headings", "content", "codeBlocks"],
    storeFields: ["title", "path", "excerpt"],
    searchOptions: {
      boost: { title: 3, headings: 2, content: 1, codeBlocks: 0.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  try {
    const response = await fetch("/search-index.json");
    if (response.ok) {
      const data = await response.json();
      if (data.documents && Array.isArray(data.documents)) {
        miniSearch.addAll(data.documents);
        documentsLoaded = true;
      }
    }
  } catch (error) {
    console.error("Failed to load search index:", error);
  }

  return miniSearch;
}

export async function search(query: string): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const searchInstance = await initSearch();
  const results = searchInstance.search(query);

  return results.map((result: MiniSearchResult) => ({
    id: result.id as string,
    title: (result as unknown as Record<string, string>).title || "",
    path: (result as unknown as Record<string, string>).path || "",
    excerpt: (result as unknown as Record<string, string>).excerpt || "",
    score: result.score,
  }));
}
