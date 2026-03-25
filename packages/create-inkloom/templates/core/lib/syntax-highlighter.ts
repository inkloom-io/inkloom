import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from "shiki";

type SpecialLanguage = "text" | "plain" | "plaintext";

let highlighterPromise: Promise<Highlighter> | null = null;

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

  if (LANGUAGE_ALIASES[lower]) {
    return LANGUAGE_ALIASES[lower];
  }

  if (LOADED_LANGUAGES.includes(lower as BundledLanguage)) {
    return lower as BundledLanguage;
  }

  return "text";
}

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: LOADED_LANGUAGES,
    });
  }
  return highlighterPromise;
}

/**
 * Highlight code using shiki and return the HTML string.
 * This is the function passed to DocsRendererProvider.
 */
export async function highlightCode(
  code: string,
  language: string
): Promise<string> {
  const highlighter = await getHighlighter();
  const lang = normalizeLanguage(language);

  const html = highlighter.codeToHtml(code, {
    lang,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    defaultColor: "light",
  });

  return html;
}
