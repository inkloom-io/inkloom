# create-inkloom

## 0.6.0

### Minor Changes

- [`524f4f1`](https://github.com/inkloom-io/inkloom-private/commit/524f4f17b7c48ff4dba8bb7109bb153193779b69) Thanks [@notadamking](https://github.com/notadamking)! - Add publish confirmation modal that shows unpublished pages before building, with options to publish individual or all pages.

### Patch Changes

- [`8ee993e`](https://github.com/inkloom-io/inkloom-private/commit/8ee993e3e1b7b4e51e7f4200a7beac3b383d8925) Thanks [@notadamking](https://github.com/notadamking)! - Add build warning when no published pages are found and UI feedback via warning toast. Pages remain unpublished by default; a separate publish modal will guide users.

## 0.5.2

### Patch Changes

- [`a5166c5`](https://github.com/inkloom-io/inkloom-private/commit/a5166c5bba899a822c7c1feff3511a9bd381401b) Thanks [@notadamking](https://github.com/notadamking)! - Fix auto-save race condition where Convex query overwrites local editor content after save. The useEffect that syncs server data to local state now only runs on initial load, preventing content loss during editing.

## 0.5.1

### Patch Changes

- [`86980cc`](https://github.com/inkloom-io/inkloom-private/commit/86980ccfbd8cd9e250b246dcc6cb934c78b0b5f7) Thanks [@notadamking](https://github.com/notadamking)! - Fix static site routing: index.html now correctly redirects to the first leaf page (not a folder path), and all generated HTML links use relative paths for file:// protocol compatibility.

## 0.5.0

### Minor Changes

- [`56976bf`](https://github.com/inkloom-io/inkloom-private/commit/56976bfe0154fb86c871a2f2dbd6077ce49b87e0) Thanks [@notadamking](https://github.com/notadamking)! - Add bun support and interactive package manager/template selection. When no `--use-*` or `--template` flag is provided, the CLI now prompts users with an interactive arrow-key selector to choose their package manager and template. CLI flags remain as non-interactive overrides for CI/scripting use cases.

- [`a4c87cb`](https://github.com/inkloom-io/inkloom-private/commit/a4c87cbae755f67e9912cbb958245f7af88df2a2) Thanks [@notadamking](https://github.com/notadamking)! - Replace template sidebar with react-arborist page tree supporting drag-and-drop reordering, nested folders, and context menus.

### Patch Changes

- [`87e76be`](https://github.com/inkloom-io/inkloom-private/commit/87e76be039f5c0dd51570a8349019151f95256ce) Thanks [@notadamking](https://github.com/notadamking)! - Fix blank published HTML output by removing hydration gate for static builds and rendering full page layout with sidebar navigation, header, and styled content.

## 0.4.1

### Patch Changes

- [`63fa1c9`](https://github.com/inkloom-io/inkloom-private/commit/63fa1c9cdcafd0654a2ccf69cc14919743942a24) Thanks [@notadamking](https://github.com/notadamking)! - Add missing @source directives to core template globals.css so Tailwind v4 scans app, components, hooks, and lib directories for utility classes.

## 0.4.0

### Minor Changes

- [`712e352`](https://github.com/inkloom-io/inkloom-private/commit/712e352f4138fd2ad121ab4f3b393e43ed77857e) Thanks [@notadamking](https://github.com/notadamking)! - Add static site build/publish pipeline to the core template with build API route, site generator, HTML generator, theme CSS, search index, and editor Build button.

- [`7ddc807`](https://github.com/inkloom-io/inkloom-private/commit/7ddc807eb12b11742d43a312f5bd3824d040b92f) Thanks [@notadamking](https://github.com/notadamking)! - Add Convex functions for folders, deployments, page metadata, and project settings to the core template.

- [`044fbea`](https://github.com/inkloom-io/inkloom-private/commit/044fbeabe18886589f1d5b010a5d20b996751ef9) Thanks [@notadamking](https://github.com/notadamking)! - Add preview panel with live MDX rendering to the template editor. Includes inline docs-renderer components, syntax highlighting via shiki, and a 50/50 split editor/preview layout.

- [`bf4e6bd`](https://github.com/inkloom-io/inkloom-private/commit/bf4e6bd76546023cc2c58d87ccd6c7bbee1cac53) Thanks [@notadamking](https://github.com/notadamking)! - Add project settings page with General, Branding, SEO, and Analytics tabs to the core template.

- [`b613cd0`](https://github.com/inkloom-io/inkloom-private/commit/b613cd01ad8fdc3ab5791c03ef2ccc0929d5463f) Thanks [@notadamking](https://github.com/notadamking)! - Add sidebar page navigation component with folder groups, inline rename, publish toggle, and context menus to the editor template.

- [`232fc9e`](https://github.com/inkloom-io/inkloom-private/commit/232fc9edde1f3244fda253f66792f288077a4699) Thanks [@notadamking](https://github.com/notadamking)! - Add UI primitives library with 15 Radix components (button, input, label, dialog, tabs, select, card, separator, tooltip, popover, dropdown-menu, textarea, scroll-area, badge, alert-dialog) and cn() utility to the core template.

- [`04630ad`](https://github.com/inkloom-io/inkloom-private/commit/04630ad275159291a3522733f89cb41d0ef6fa56) Thanks [@notadamking](https://github.com/notadamking)! - Polish dashboard with project cards showing metadata (page count, last updated, slug), delete confirmation dialog, empty state, theme toggle, responsive grid layout, and staggered card animations.

- [`49c18c8`](https://github.com/inkloom-io/inkloom-private/commit/49c18c839032542c6a59e8afc03673c212952bf8) Thanks [@notadamking](https://github.com/notadamking)! - Replace textarea editor with full BlockEditor layout featuring sidebar navigation, auto-save with status indicator, and header with preview/build/settings controls.

- [`96c03fc`](https://github.com/inkloom-io/inkloom-private/commit/96c03fc7277b208944a0220c3fffb8e746816987) Thanks [@notadamking](https://github.com/notadamking)! - Add block editor, preview panel, project settings, and static site build pipeline to core template

## 0.3.0

### Minor Changes

- [`61cb4b8`](https://github.com/inkloom-io/inkloom-private/commit/61cb4b80f0d83859c9d1bb8842d93bbc624ab7f2) Thanks [@notadamking](https://github.com/notadamking)! - Add project editor page with page sidebar and content editing to core template. Project cards on the dashboard are now clickable and navigate to the editor. Adds Convex queries and mutations for pages and page content.

## 0.2.0

### Minor Changes

- [`1b0d912`](https://github.com/inkloom-io/inkloom-private/commit/1b0d9128b4d14da999fe68f5d3d19faa3e489555) Thanks [@notadamking](https://github.com/notadamking)! - Add subtle dot grid background pattern and top gradient to published docs pages for a polished, professional feel. Uses theme-aware colors that adapt to light and dark modes.

- [`5d5cbc1`](https://github.com/inkloom-io/inkloom-private/commit/5d5cbc1cd49680302983f425e9ed93a5ad6a9d3f) Thanks [@notadamking](https://github.com/notadamking)! - Add code block title display to published documentation sites. Code blocks with titles show the title in the label instead of the language name.

- [`deaa1aa`](https://github.com/inkloom-io/inkloom-private/commit/deaa1aa38444aa7e754b5076ea5cdc8b4fd3e610) Thanks [@notadamking](https://github.com/notadamking)! - Add Columns and Column component rendering support in the default template for multi-column layouts on published documentation sites.

- [`22bfb08`](https://github.com/inkloom-io/inkloom-private/commit/22bfb085f3c23ba616abeb867f6c2941178816e9) Thanks [@notadamking](https://github.com/notadamking)! - Add Frame component to docs renderer for displaying framed content with optional hints and captions.

- [`ed34c3e`](https://github.com/inkloom-io/inkloom-private/commit/ed34c3eb852fc8dbec6bf69de46ec1da7979b271) Thanks [@notadamking](https://github.com/notadamking)! - Add configurable CTA button to published docs header. Users can set a button label and URL in project settings, which renders as a prominent pill button with an arrow icon in the site header.

- [`03fcd81`](https://github.com/inkloom-io/inkloom-private/commit/03fcd81803040126be77de835140829176556e1c) Thanks [@notadamking](https://github.com/notadamking)! - Add inline badge and icon rendering support on published documentation sites. Badges render as colored pills via the Badge component, and icons render Lucide icons inline within text.

- [`d53b49f`](https://github.com/inkloom-io/inkloom-private/commit/d53b49fb5bc9bc9bc74c177fb5279b43a1d464df) Thanks [@notadamking](https://github.com/notadamking)! - Add KaTeX-powered LaTeX rendering for published documentation sites. LaTeX blocks are rendered server-side using `katex.renderToString()` with graceful error handling for invalid expressions.

- [`5f0c36f`](https://github.com/inkloom-io/inkloom-private/commit/5f0c36f638b0f3f34bc85b2a39435fd4513f35ec) Thanks [@notadamking](https://github.com/notadamking)! - Add MermaidDiagram component that renders fenced mermaid code blocks as interactive SVG diagrams in published documentation sites. Includes lazy-loaded mermaid.js, dark/light theme support, ElkJS renderer support, and error fallback for malformed diagrams.

- [`496a42b`](https://github.com/inkloom-io/inkloom-private/commit/496a42b9645ccbf02bdcb54a786f2703c0b1f288) Thanks [@notadamking](https://github.com/notadamking)! - Add "Was this helpful?" page feedback widget with emoji reactions to published docs. Reactions are stored in Convex via a new pageFeedback table and API route.

- [`fba339d`](https://github.com/inkloom-io/inkloom-private/commit/fba339d569a85871b156937ffa533dd2974af67c) Thanks [@notadamking](https://github.com/notadamking)! - Add previous/next page navigation links at the bottom of docs pages, following sidebar ordering with hover effects and responsive layout.

- [`1a47f3c`](https://github.com/inkloom-io/inkloom-private/commit/1a47f3ca99dc1df02903bd23142704253960f444) Thanks [@notadamking](https://github.com/notadamking)! - Add colored HTTP method badges (GET, POST, PUT, PATCH, DEL) to API Reference sidebar navigation items.

- [`142a87c`](https://github.com/inkloom-io/inkloom-private/commit/142a87c852018723712dd1289683e1dcdb312636) Thanks [@notadamking](https://github.com/notadamking)! - Add video and iframe block rendering support for published documentation sites.

- [`823e8da`](https://github.com/inkloom-io/inkloom-private/commit/823e8daac5cf5b1cb014e8499843b173421adf14) Thanks [@notadamking](https://github.com/notadamking)! - Replace raw JSON textarea with named field inputs for request body in API playground. When an endpoint has structured field metadata, individual labeled inputs are rendered with name, type, and required indicators instead of a freeform JSON textarea. The textarea is kept as a fallback for endpoints without structured fields.

- [`dae1d0b`](https://github.com/inkloom-io/inkloom-private/commit/dae1d0b694701dfff2aa1875af8859caa395ab79) Thanks [@notadamking](https://github.com/notadamking)! - Switch IconDisplay and PageIcon to dynamic lucide-react icon lookup, supporting all lucide icons instead of a static whitelist of ~27.

- [`3855b9a`](https://github.com/inkloom-io/inkloom-private/commit/3855b9aa387b57c8ca9a0265483d87d47b3ad2a4) Thanks [@notadamking](https://github.com/notadamking)! - Replace cycling theme toggle with segmented toggle showing light, dark, and system options simultaneously.

- [`a7c8c1b`](https://github.com/inkloom-io/inkloom-private/commit/a7c8c1b60401868ab470f6fb934cb8430063d6be) Thanks [@notadamking](https://github.com/notadamking)! - Code blocks now use light backgrounds with dark text in light mode and dark backgrounds with light text in dark mode. Syntax highlighting adapts via Shiki dual-theme support (github-light + github-dark).

- [`7b9bae6`](https://github.com/inkloom-io/inkloom-private/commit/7b9bae6b2b02fbaac3d253d5a182c45a2b9a4938) Thanks [@notadamking](https://github.com/notadamking)! - Redesign page content header: replace breadcrumbs with folder label, remove full-width HR divider, add Copy page dropdown button.

- [`e151e63`](https://github.com/inkloom-io/inkloom-private/commit/e151e63f002505286bb542e66af6e47c77dd76e1) Thanks [@notadamking](https://github.com/notadamking)! - Published docs design polish: tab alignment with sidebar, Quicksand font, social icon bordered containers, Ask AI repositioned next to search, CTA button moved to far-right, lucide-react feedback icons, TOC first-item highlight and ListStart icon, reduced article-sidebar gap, removed TOC left border.

- [`c284cfd`](https://github.com/inkloom-io/inkloom-private/commit/c284cfd65b142e45ea258ce6c153112b149ffbb1) Thanks [@notadamking](https://github.com/notadamking)! - Remove ParamField, ResponseField, Expandable, and MermaidDiagram components from the published site template — these are now built into docs-renderer. Pass resolvedTheme to DocsRendererProvider for optimal theme-aware rendering.

- [`6e2296e`](https://github.com/inkloom-io/inkloom-private/commit/6e2296e90cc012fc8c3065b86b1702ce6d3224b1) Thanks [@notadamking](https://github.com/notadamking)! - Redesign published docs sidebar: remove right border, add social links section, restyle folders as bold uppercase section headers (always expanded), and replace active page background with left accent border.

- [`cae80b2`](https://github.com/inkloom-io/inkloom-private/commit/cae80b20d7c511d64404aa5db0cb6bb9e058cf22) Thanks [@notadamking](https://github.com/notadamking)! - Replace local MDX component copies in the published template with imports from the shared `@inkloom/docs-renderer` package, reducing duplication and ensuring component consistency.

- [`b5836eb`](https://github.com/inkloom-io/inkloom-private/commit/b5836eb4f4b84b2629c9ec309658acb1f7ce44a7) Thanks [@notadamking](https://github.com/notadamking)! - Increase prose max-width from 65ch to 75ch and article container from max-w-3xl to max-w-4xl, giving more horizontal space for code blocks and tables in published docs.

### Patch Changes

- [`2c03582`](https://github.com/inkloom-io/inkloom-private/commit/2c03582bd38e739d7c9381f09c34a3d49b8cdc3e) Thanks [@notadamking](https://github.com/notadamking)! - Use theme-aware colors for info callouts instead of hardcoded blue, so the info callout matches the site's primary color.

- [`4c84bd1`](https://github.com/inkloom-io/inkloom-private/commit/4c84bd11ab2f7ad9bb3db2fb027c965e2c4bc48b) Thanks [@notadamking](https://github.com/notadamking)! - Fix API endpoint right-column sticky scroll overlap by wrapping each section pair in its own grid container, scoping sticky positioning per section.

- [`e8e4962`](https://github.com/inkloom-io/inkloom-private/commit/e8e49624c6bf88478d3e97c7648509020de30d6f) Thanks [@notadamking](https://github.com/notadamking)! - Fix API reference page two-column layout being squished by adding `!important` to CSS `:has()` overrides, and hide ToC sidebar on API pages to free horizontal space for code examples.

- [`82cd91b`](https://github.com/inkloom-io/inkloom-private/commit/82cd91b0ff221f89f9d9a7f7e0679c78aae84147) Thanks [@notadamking](https://github.com/notadamking)! - Fix Callout and Card components on published sites to properly render nested block-level content (code blocks, images, tables) by processing children through MDXContent.

- [`c3cbc8e`](https://github.com/inkloom-io/inkloom-private/commit/c3cbc8e55a933d0744c35f6feea7c5c1e8a1f4bd) Thanks [@notadamking](https://github.com/notadamking)! - Fix CTA button text contrast: use `--color-primary-foreground` CSS variable instead of hardcoded white text, ensuring readability on light primary backgrounds.

- [`39d50e1`](https://github.com/inkloom-io/inkloom-private/commit/39d50e1f79ed5f3dbf7e6ae113228cba4273bf76) Thanks [@notadamking](https://github.com/notadamking)! - Fix duplicate search elements in header by using mutually exclusive xl breakpoint for search bar and search icon button.

- [`4cc4664`](https://github.com/inkloom-io/inkloom-private/commit/4cc4664ece898fd871b185de0152dc6050f20b56) Thanks [@notadamking](https://github.com/notadamking)! - Fix duplicate Ask AI button on desktop and move vertical divider to separate social icons from theme toggle.

- [`4106ff3`](https://github.com/inkloom-io/inkloom-private/commit/4106ff3b9d972dbce55651a2a8aa129314b6b5e7) Thanks [@notadamking](https://github.com/notadamking)! - Fix search bar and icon button toggling at xl breakpoint so they are mutually exclusive — never both visible simultaneously.

- [`0ff9cb2`](https://github.com/inkloom-io/inkloom-private/commit/0ff9cb2b81df9a79e0194d7ec60f03cdedbe9ae7) Thanks [@notadamking](https://github.com/notadamking)! - Fix header/sidebar layout styles: adjust sidebar and ToC sticky positions for full header height, remove theme background overrides from header CSS, and add backdrop-blur to header element.

- [`8f21a1f`](https://github.com/inkloom-io/inkloom-private/commit/8f21a1fdafb053728bcfc9b40da9a21c9ee4a59a) Thanks [@notadamking](https://github.com/notadamking)! - Fix header responsive layout for tablet screens by hiding social links, CTA button, and Ask AI button below the `lg` breakpoint. These elements are accessible in the mobile menu.

- [`2a5fdad`](https://github.com/inkloom-io/inkloom-private/commit/2a5fdad08c02140fd7160a314633ad2291f6d626) Thanks [@notadamking](https://github.com/notadamking)! - Fix inline LaTeX rendering as block-level on published sites. Inline LaTeX now renders inline with paragraph text using KaTeX inline mode.

- [`d646e65`](https://github.com/inkloom-io/inkloom-private/commit/d646e659e816a4d9f85c7bef73454bd542f60ebd) Thanks [@notadamking](https://github.com/notadamking)! - Move katex dependency from CLI package.json to template package.json so Vite can resolve the katex CSS import during template builds.

- [`ee812b1`](https://github.com/inkloom-io/inkloom-private/commit/ee812b12b5b5e583139a492b93f3ecb22e93eb3c) Thanks [@notadamking](https://github.com/notadamking)! - Fix LaTeX double-rendering by importing KaTeX CSS from docs-renderer styles instead of directly in the template globals.css, ensuring both preview panel and published sites hide the KaTeX MathML accessibility layer.

- [`6c62eed`](https://github.com/inkloom-io/inkloom-private/commit/6c62eed90ca25d73ba0aab1854083e06c30308cd) Thanks [@notadamking](https://github.com/notadamking)! - Fix LaTeX rendering on published docs sites: stub web-worker module to prevent browser import errors, and extract LaTeX expression from children when not passed as a prop.

- [`5bf4703`](https://github.com/inkloom-io/inkloom-private/commit/5bf470362cc6fff2971879547c5ecbe1fb9d12aa) Thanks [@notadamking](https://github.com/notadamking)! - Fix code block text visibility in light mode for published docs. Strip per-token Shiki background colors in all modes and use transparent backgrounds in dark mode Shiki switching.

- [`16fa19a`](https://github.com/inkloom-io/inkloom-private/commit/16fa19a64dbc900a748b95313f59abfcf5cb8c2d) Thanks [@notadamking](https://github.com/notadamking)! - Fix 'Link is not defined' crash on published docs sites by adding missing lucide-react Link icon import in docs-page.tsx.

- [`99e84df`](https://github.com/inkloom-io/inkloom-private/commit/99e84dfe15d2fdeed55827b48aeb1d5be0137a82) Thanks [@notadamking](https://github.com/notadamking)! - Fix nested ResponseField and Expandable rendering by using balanced tag matching instead of non-greedy regex, and rendering ResponseField children as recursive MDX content.

- [`0282dd1`](https://github.com/inkloom-io/inkloom-private/commit/0282dd1b4f9dfad5801e6d67b049cc0b1c199613) Thanks [@notadamking](https://github.com/notadamking)! - Fix unnecessary gap between navigation bar and sidebars by using a consistent `top-16` sticky position instead of `top-[7.5rem]` when tabs exist.

- [`daaf70b`](https://github.com/inkloom-io/inkloom-private/commit/daaf70bcb5199760a7a1e460e002f0c41a85dc3c) Thanks [@notadamking](https://github.com/notadamking)! - Increase step-content horizontal padding from 0.75rem to 1.25rem for consistent spacing with tabs and accordion containers.

- [`7634d50`](https://github.com/inkloom-io/inkloom-private/commit/7634d50fe6ca3ca01b52c0c9eaf80e0e2bf5b423) Thanks [@notadamking](https://github.com/notadamking)! - Fix missing left padding on step-content in docs-renderer. The previous fix set padding to `0 0.75rem 1.5rem 0`, leaving left padding at 0. Now both left and right are 0.75rem.

- [`04678f0`](https://github.com/inkloom-io/inkloom-private/commit/04678f07352ce05b5ec8acbdff3807653615e35d) Thanks [@notadamking](https://github.com/notadamking)! - Fix TOC sidebar overflow so the heading list scrolls independently while PageFeedback stays pinned at the bottom.

- [`efbe8bf`](https://github.com/inkloom-io/inkloom-private/commit/efbe8bfe5cea720db38642f8774e005eae871211) Thanks [@notadamking](https://github.com/notadamking)! - Force dark text color on light mode code blocks to ensure readability regardless of Shiki inline styles.

- [`e815ee7`](https://github.com/inkloom-io/inkloom-private/commit/e815ee706d968f6f6501f653f110e96e54bbe3fe) Thanks [@notadamking](https://github.com/notadamking)! - Rebuild template dist/ with latest design overhaul changes so published docs sites reflect updated sidebar, TOC, breadcrumbs, and other UI improvements.

- [`ecac834`](https://github.com/inkloom-io/inkloom-private/commit/ecac834a9c63acf1111f98048e1a40ffcea4690d) Thanks [@notadamking](https://github.com/notadamking)! - Rebuild template dist to include icon rendering fix (strip lucide: prefix) and badge rendering fix (hex color inline styles).

- [`1867a07`](https://github.com/inkloom-io/inkloom-private/commit/1867a07dc2e8ed784b04b154270436cfe138631e) Thanks [@notadamking](https://github.com/notadamking)! - Rebuild template bundle to include the `&quot;` → `"` decoding fix from docs-renderer, fixing published sites showing literal `&quot;` in component attributes like accordion titles.

- [`dee4d65`](https://github.com/inkloom-io/inkloom-private/commit/dee4d653d979235038b79c6fa4f9889c52b1d60e) Thanks [@notadamking](https://github.com/notadamking)! - Refine header tablet layout: move search bar and Ask AI to xl breakpoint, restore CTA at all sizes with responsive sizing, and increase action item spacing.

- [`523ddff`](https://github.com/inkloom-io/inkloom-private/commit/523ddff9077937cb6e3c74e7b1303075a1b11c30) Thanks [@notadamking](https://github.com/notadamking)! - Sync template coreTables.ts with source schema: add missing indexes, fields, and settings.

- [`a4b74c7`](https://github.com/inkloom-io/inkloom-private/commit/a4b74c75488656b2dea2647bbefdf1866ea266bf) Thanks [@notadamking](https://github.com/notadamking)! - Switch default body font from Plus Jakarta Sans to Inter and remove h2 bottom border for cleaner heading styles.

- [`cb8c05c`](https://github.com/inkloom-io/inkloom-private/commit/cb8c05c5b456a9e90c80c0d0dff755ab1d48c650) Thanks [@notadamking](https://github.com/notadamking)! - Unify layout spacing, tab alignment, and background colors in docs template. Adds 4rem gap between sidebars and article, aligns tab borders to text width, and makes header/sidebar backgrounds seamless with the main content area.

## 0.1.1

### Patch Changes

- [`2bb75bd`](https://github.com/inkloom-io/inkloom-private/commit/2bb75bd29e3449e770ee2f15b34035dac8ce0dd8) Thanks [@notadamking](https://github.com/notadamking)! - Add process.cwd() fallback for template path resolution in monorepo workspaces.

- [`1c75287`](https://github.com/inkloom-io/inkloom-private/commit/1c75287c3a259c3246016412851d8fb4eaa4358d) Thanks [@notadamking](https://github.com/notadamking)! - Fix Convex deployment error caused by hyphenated schema filenames. Renamed `schema/core-tables.ts` to `schema/coreTables.ts` in the scaffolded template, since Convex rejects hyphens in module paths.

- [`02f28a7`](https://github.com/inkloom-io/inkloom-private/commit/02f28a79702efde5c544baf8a556eceac6cb2008) Thanks [@notadamking](https://github.com/notadamking)! - Fix template path resolution when code is bundled by Next.js. Template functions now accept an optional `templateDir` parameter for callers running inside bundlers where `import.meta.url` points to the wrong location.
