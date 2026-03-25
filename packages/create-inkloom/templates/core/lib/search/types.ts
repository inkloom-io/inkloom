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

export interface ExtractedText {
  title: string;
  headings: string;
  content: string;
  codeBlocks: string;
  excerpt: string;
}
