/**
 * Gitbook block syntax pre-processor.
 *
 * Converts Gitbook-specific {% %} block syntax and HTML blocks into
 * valid MDX JSX components that can be parsed by remarkMdx.
 *
 * This is a string-based pre-processor (NOT AST-based) because the
 * {% %} syntax is not valid markdown/MDX and cannot be parsed by remark.
 */

import { transformLatex } from "../latex.js";

/**
 * Result of transforming Gitbook block syntax.
 */
export interface TransformResult {
  /** The transformed MDX content. */
  content: string;
  /** Whether the content contains JSX components (determines .md vs .mdx extension). */
  hasJsx: boolean;
  /** Whether an OpenAPI/swagger block was found (flags for OpenAPI import). */
  hasOpenApi: boolean;
}

/**
 * Pre-process raw Gitbook markdown content, converting block syntax to MDX JSX.
 *
 * Handles nesting by iteratively converting innermost blocks first,
 * repeating until no more conversions are possible.
 */
export function transformGitbookBlocks(input: string): TransformResult {
  let content = input;
  let hasJsx = false;
  let hasOpenApi = false;

  // Process iteratively to handle nesting (innermost blocks first each pass)
  let changed = true;
  while (changed) {
    changed = false;
    const prev = content;

    // Transform embed blocks (self-closing, no nesting)
    content = transformEmbeds(content);

    // Transform swagger blocks
    const swaggerResult = transformSwagger(content);
    content = swaggerResult.content;
    if (swaggerResult.found) {
      hasOpenApi = true;
    }

    // Transform code blocks ({% code %} wrappers)
    content = transformCodeBlocks(content);

    // Transform hint blocks (innermost first via negative lookahead)
    content = transformHints(content);

    // Transform tab blocks (individual tabs first, then tabs container)
    content = transformTabBlocks(content);
    content = transformTabsContainer(content);

    // Transform step blocks (individual steps first, then stepper container)
    content = transformStepBlocks(content);
    content = transformStepperContainer(content);

    // Transform column blocks (individual columns first, then columns container)
    content = transformColumnBlocks(content);
    content = transformColumnsContainer(content);

    // Transform content-ref blocks to Card components
    content = transformContentRefs(content);

    // Transform HTML details/summary to Accordion
    content = transformDetails(content);

    if (content !== prev) {
      changed = true;
      hasJsx = true;
    }
  }

  // Transform LaTeX delimiters to <Latex> components (after all other transforms)
  const latexTransformed = transformLatex(content);
  if (latexTransformed !== content) {
    hasJsx = true;
  }

  return { content: latexTransformed.trim() + "\n", hasJsx, hasOpenApi };
}

/**
 * Convert {% hint style="X" %}...{% endhint %} to <Callout type="X">...</Callout>
 *
 * Uses negative lookahead to match innermost hints first, supporting nesting
 * across multiple iterations.
 */
function transformHints(content: string): string {
  // Match hint blocks whose content doesn't contain another {% hint
  const hintRe =
    /\{%\s*hint\s+style=["']([^"']+)["']\s*%\}((?:(?!\{%\s*hint\s)[\s\S])*?)\{%\s*endhint\s*%\}/g;

  return content.replace(hintRe, (_match, style: string, inner: string) => {
    const trimmed = inner.trim();
    return `<Callout type="${style}">\n${trimmed}\n</Callout>`;
  });
}

/**
 * Convert individual {% tab title="X" %}...{% endtab %} to <Tab title="X">...</Tab>
 *
 * Uses negative lookahead to match innermost tabs first.
 */
function transformTabBlocks(content: string): string {
  const tabRe =
    /\{%\s*tab\s+title=["']([^"']+)["']\s*%\}((?:(?!\{%\s*tab\s)[\s\S])*?)\{%\s*endtab\s*%\}/g;

  return content.replace(tabRe, (_match, title: string, inner: string) => {
    const trimmed = inner.trim();
    return `<Tab title="${title}">\n${trimmed}\n</Tab>`;
  });
}

/**
 * Convert {% tabs %}...{% endtabs %} container to <Tabs>...</Tabs>
 *
 * Should run after transformTabBlocks so inner <Tab> elements are already converted.
 */
function transformTabsContainer(content: string): string {
  const tabsRe =
    /\{%\s*tabs\s*%\}((?:(?!\{%\s*tabs\s*%\})[\s\S])*?)\{%\s*endtabs\s*%\}/g;

  return content.replace(tabsRe, (_match, inner: string) => {
    const trimmed = inner.trim();
    return `<Tabs>\n${trimmed}\n</Tabs>`;
  });
}

/**
 * Convert individual {% step %}...{% endstep %} to <Step title="...">...</Step>
 *
 * Extracts the title from the first heading inside the step content and removes
 * that heading from the body.
 * Uses negative lookahead to match innermost steps first.
 */
function transformStepBlocks(content: string): string {
  const stepRe =
    /\{%\s*step\s*%\}((?:(?!\{%\s*step\s)[\s\S])*?)\{%\s*endstep\s*%\}/g;

  return content.replace(stepRe, (_match, inner: string) => {
    const trimmed = inner.trim();

    // Extract title from the first heading (any level)
    const headingRe = /^(#{1,6})\s+(.+)$/m;
    const headingMatch = trimmed.match(headingRe);

    let title = "Step";
    let body = trimmed;

    if (headingMatch) {
      title = headingMatch[2].trim();
      // Remove the heading line from the body
      body = trimmed.replace(headingRe, "").trim();
    }

    // Escape double quotes in title for JSX attribute
    const escapedTitle = title.replace(/"/g, "&quot;");
    return `<Step title="${escapedTitle}">\n${body}\n</Step>`;
  });
}

/**
 * Convert {% stepper %}...{% endstepper %} container to <Steps>...</Steps>
 *
 * Should run after transformStepBlocks so inner <Step> elements are already converted.
 */
function transformStepperContainer(content: string): string {
  const stepperRe =
    /\{%\s*stepper\s*%\}((?:(?!\{%\s*stepper\s*%\})[\s\S])*?)\{%\s*endstepper\s*%\}/g;

  return content.replace(stepperRe, (_match, inner: string) => {
    const trimmed = inner.trim();
    return `<Steps>\n${trimmed}\n</Steps>`;
  });
}

/**
 * Convert individual {% column %}...{% endcolumn %} to <Column>...</Column>
 *
 * Uses negative lookahead to match innermost columns first.
 */
function transformColumnBlocks(content: string): string {
  const columnRe =
    /\{%\s*column\s*%\}((?:(?!\{%\s*column\s)[\s\S])*?)\{%\s*endcolumn\s*%\}/g;

  return content.replace(columnRe, (_match, inner: string) => {
    const trimmed = inner.trim();
    return `<Column>\n${trimmed}\n</Column>`;
  });
}

/**
 * Convert {% columns %}...{% endcolumns %} container to <Columns>...</Columns>
 *
 * Should run after transformColumnBlocks so inner <Column> elements are already converted.
 */
function transformColumnsContainer(content: string): string {
  const columnsRe =
    /\{%\s*columns\s*%\}((?:(?!\{%\s*columns\s*%\})[\s\S])*?)\{%\s*endcolumns\s*%\}/g;

  return content.replace(columnsRe, (_match, inner: string) => {
    const trimmed = inner.trim();
    return `<Columns>\n${trimmed}\n</Columns>`;
  });
}

/**
 * Convert {% content-ref url="..." %}...{% endcontent-ref %} to <Card title="..." href="..."></Card>
 *
 * Extracts URL from the block attribute and title from the markdown link inside.
 * If no readable title is found, derives one from the URL path.
 */
function transformContentRefs(content: string): string {
  const contentRefRe =
    /\{%\s*content-ref\s+url=["']([^"']+)["']\s*%\}([\s\S]*?)\{%\s*endcontent-ref\s*%\}/g;

  return content.replace(
    contentRefRe,
    (_match, url: string, inner: string) => {
      const trimmed = inner.trim();

      // Try to extract title from markdown link [title](url)
      const linkRe = /\[([^\]]*)\]\([^)]*\)/;
      const linkMatch = trimmed.match(linkRe);

      let title = url;
      if (linkMatch && linkMatch[1]) {
        const linkText = linkMatch[1].trim();
        // Check if the link text is useful (not just "." or empty)
        if (linkText && linkText !== ".") {
          title = linkText;
        } else {
          // Derive title from the URL path
          title = deriveTitleFromUrl(url);
        }
      }

      // Escape double quotes in title for JSX attribute
      const escapedTitle = title.replace(/"/g, "&quot;");
      return `<Card title="${escapedTitle}" href="${url}">\n</Card>`;
    },
  );
}

/**
 * Derive a human-readable title from a URL path.
 *
 * @example deriveTitleFromUrl("path/to/my-page") => "My Page"
 * @example deriveTitleFromUrl("./") => "./"
 */
function deriveTitleFromUrl(url: string): string {
  // Remove leading ./ and trailing /
  const cleaned = url.replace(/^\.\//, "").replace(/\/$/, "");
  if (!cleaned) return url;

  // Get the last path segment
  const segments = cleaned.split("/");
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return url;

  // Remove file extension
  const withoutExt = lastSegment.replace(/\.\w+$/, "");
  if (!withoutExt) return url;

  // Convert kebab-case/snake_case to Title Case
  return withoutExt
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert <details><summary>Title</summary>...</details> to
 * <Accordion title="Title">...</Accordion>
 *
 * Handles multiline content and various whitespace patterns.
 */
function transformDetails(content: string): string {
  // Match details blocks whose content doesn't contain nested <details>
  const detailsRe =
    /<details>\s*<summary>((?:(?!<\/summary>)[\s\S])*?)<\/summary>((?:(?!<details>)[\s\S])*?)<\/details>/g;

  return content.replace(
    detailsRe,
    (_match, title: string, inner: string) => {
      const trimmedTitle = title.trim();
      const trimmedInner = inner.trim();
      // Escape double quotes in title for JSX attribute
      const escapedTitle = trimmedTitle.replace(/"/g, "&quot;");
      return `<Accordion title="${escapedTitle}">\n${trimmedInner}\n</Accordion>`;
    },
  );
}

/**
 * Convert {% embed url="..." %} to a markdown link [url](url)
 */
function transformEmbeds(content: string): string {
  const embedRe = /\{%\s*embed\s+url=["']([^"']+)["']\s*%\}/g;

  return content.replace(embedRe, (_match, url: string) => {
    return `[${url}](${url})`;
  });
}

/**
 * Convert {% code title="file.js" %}...{% endcode %} to a fenced code block
 * with title metadata.
 *
 * If the content already contains a fenced code block, adds the title attribute
 * to the existing fence. Otherwise wraps content in a new fenced code block.
 */
function transformCodeBlocks(content: string): string {
  const codeRe =
    /\{%\s*code\s+((?:(?!%\})[\s\S])*?)\s*%\}((?:(?!\{%\s*code\s)[\s\S])*?)\{%\s*endcode\s*%\}/g;

  return content.replace(codeRe, (_match, attrsStr: string, inner: string) => {
    const title = extractAttr(attrsStr, "title");
    const overflow = extractAttr(attrsStr, "overflow");
    const lineNumbers = extractAttr(attrsStr, "lineNumbers");

    const trimmed = inner.trim();

    // Build metadata string
    const metaParts: string[] = [];
    if (title) metaParts.push(`title="${title}"`);
    if (overflow) metaParts.push(`overflow="${overflow}"`);
    if (lineNumbers === "true") metaParts.push("showLineNumbers");
    const metaStr = metaParts.length > 0 ? " " + metaParts.join(" ") : "";

    // Check if inner content already has a fenced code block
    const fencedRe = /^(`{3,})(\w*)(.*)\n([\s\S]*?)\n\1\s*$/;
    const fencedMatch = trimmed.match(fencedRe);

    if (fencedMatch) {
      const fence = fencedMatch[1];
      const lang = fencedMatch[2] || "";
      // Existing meta on the fence line (after language)
      const existingMeta = fencedMatch[3] ? fencedMatch[3].trim() : "";
      const code = fencedMatch[4];

      // Combine existing meta with our new meta
      const combinedMeta = existingMeta
        ? existingMeta + metaStr
        : metaStr.trimStart();

      const langAndMeta =
        lang + (combinedMeta ? " " + combinedMeta : "");
      return `${fence}${langAndMeta}\n${code}\n${fence}`;
    }

    // No fenced code block inside — wrap content
    return `\`\`\`${metaStr.trimStart()}\n${trimmed}\n\`\`\``;
  });
}

/**
 * Convert {% swagger ... %}...{% endswagger %} to a placeholder note
 * with the API details preserved.
 */
function transformSwagger(content: string): {
  content: string;
  found: boolean;
} {
  const swaggerRe =
    /\{%\s*swagger\s+((?:(?!%\})[\s\S])*?)\s*%\}[\s\S]*?\{%\s*endswagger\s*%\}/g;

  let found = false;

  const result = content.replace(swaggerRe, (_match, attrsStr: string) => {
    found = true;

    const method = extractAttr(attrsStr, "method") || "GET";
    const path = extractAttr(attrsStr, "path") || "/";
    const summary = extractAttr(attrsStr, "summary") || "";

    const desc = summary ? `: ${summary}` : "";
    return `<Callout type="info">\n**API Endpoint**: \`${method.toUpperCase()} ${path}\`${desc}\n\nThis endpoint is documented via OpenAPI. Import your OpenAPI spec into InkLoom for full API reference documentation.\n</Callout>`;
  });

  return { content: result, found };
}

/**
 * Extract an attribute value from a Gitbook block attribute string.
 * Handles both quoted and unquoted values.
 *
 * @example extractAttr('title="file.js" overflow="wrap"', 'title') => 'file.js'
 */
function extractAttr(attrsStr: string, name: string): string | undefined {
  // Match name="value" or name='value'
  const quotedRe = new RegExp(`${name}=["']([^"']*?)["']`);
  const quotedMatch = attrsStr.match(quotedRe);
  if (quotedMatch) return quotedMatch[1];

  // Match name=value (unquoted, word characters)
  const unquotedRe = new RegExp(`${name}=(\\S+)`);
  const unquotedMatch = attrsStr.match(unquotedRe);
  if (unquotedMatch) return unquotedMatch[1];

  return undefined;
}
