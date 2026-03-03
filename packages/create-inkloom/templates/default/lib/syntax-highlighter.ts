import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
  type SpecialLanguage,
} from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

// Languages we load into the highlighter
const LOADED_LANGUAGES: BundledLanguage[] = [
  "javascript",
  "typescript",
  "python",
  "bash",
  "shellscript",
  "json",
  "html",
  "css",
  "sql",
  "go",
  "rust",
  "java",
  "csharp",
  "cpp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "yaml",
  "markdown",
];

type SupportedLanguage = BundledLanguage | SpecialLanguage;

// Map common language aliases to Shiki language names
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "shellscript",
  yml: "yaml",
  md: "markdown",
  text: "text",
  txt: "text",
  plain: "text",
  plaintext: "text",
  "c++": "cpp",
  "c#": "csharp",
};

function normalizeLanguage(lang: string): SupportedLanguage {
  const lower = lang.toLowerCase();

  // Check aliases first
  if (LANGUAGE_ALIASES[lower]) {
    return LANGUAGE_ALIASES[lower];
  }

  // Check if it's a loaded language
  if (LOADED_LANGUAGES.includes(lower as BundledLanguage)) {
    return lower as BundledLanguage;
  }

  // Default to plain text for unknown languages
  return "text";
}

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: LOADED_LANGUAGES,
    });
  }
  return highlighterPromise;
}

export interface HighlightResult {
  html: string;
}

export async function highlightCode(
  code: string,
  language: string
): Promise<HighlightResult> {
  const highlighter = await getHighlighter();
  const lang = normalizeLanguage(language);

  const html = highlighter.codeToHtml(code, {
    lang,
    theme: "github-dark",
  });

  return { html };
}
