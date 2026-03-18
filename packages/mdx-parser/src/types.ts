// MDAST node types
export interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  lang?: string | null;
  meta?: string | null;
  url?: string;
  alt?: string;
  title?: string;
  name?: string;
  attributes?: MdxAttribute[];
  align?: (string | null)[];
}

export interface MdxAttribute {
  type: string;
  name: string;
  value: string | { type: string; value: string } | boolean | null;
}

// BlockNote types
export interface BlockNoteInlineContent {
  type: string;
  text?: string;
  styles?: Record<string, boolean | string>;
  href?: string;
  content?: BlockNoteInlineContent[];
  props?: Record<string, string>;
}

export interface BlockNoteBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInlineContent[] | TableContent;
  children?: BlockNoteBlock[];
}

export interface TableContentCell {
  type: "tableCell";
  props?: {
    textAlignment?: "left" | "center" | "right" | "justify";
    [key: string]: unknown;
  };
  content: BlockNoteInlineContent[];
}

export interface TableContent {
  type: "tableContent";
  columnWidths?: (number | undefined)[];
  headerRows?: number;
  headerCols?: number;
  rows: {
    cells: BlockNoteInlineContent[][] | TableContentCell[];
  }[];
}
