<p align="center">
  <strong>InkLoom</strong>
</p>

<h1 align="center">InkLoom</h1>

<h3 align="center">A local-first documentation editor with version control</h3>

<p align="center">
  Write docs in a rich block editor, manage branches and merge requests, then build a static site you can deploy anywhere.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black.svg" alt="Next.js 16" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.4-3178C6.svg" alt="TypeScript" /></a>
  <a href="https://www.convex.dev"><img src="https://img.shields.io/badge/Convex-Backend-FF6F00.svg" alt="Convex" /></a>
</p>

---

## What is InkLoom?

InkLoom is an open-source documentation platform with a visual block editor, Git-style version control (branches, merge requests, conflict resolution), and static site generation. No authentication required — it runs as a local single-tenant tool backed by [Convex](https://www.convex.dev/).

### Features

| Category | What you get |
|----------|-------------|
| **Editor** | BlockNote rich-text editor with MDX components: accordion, callout, card, code block, code group, steps, tabs |
| **Version control** | Branches, merge requests, diff viewer, conflict resolver, version history |
| **Comments** | Threaded comments with inline marks |
| **Theming** | 10 built-in theme presets, custom colors/fonts, logo and favicon |
| **SEO** | OG tags, sitemap.xml, robots.txt, llms.txt |
| **OpenAPI** | Validate OpenAPI specs and auto-generate API reference pages |
| **CLI** | `inkloom build`, `inkloom push`, `inkloom pull`, `inkloom export` |
| **Static output** | Generate a static `dist/` folder deployable to any host |
| **i18n** | Built-in internationalization with next-intl |

## Quick Start

### Option 1: Scaffold a new project

```bash
npx create-inkloom my-docs
cd my-docs
```

### Option 2: Clone this repository

```bash
git clone https://github.com/inkloom/inkloom.git
cd inkloom
pnpm install
```

### Start developing

```bash
# Start the Convex backend (requires a free Convex account)
npx convex dev

# In a separate terminal, start the Next.js dev server
cd apps/web
pnpm dev
```

Open **http://localhost:3000** — the dashboard loads immediately with no login required. Start creating projects and writing docs.

### Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
CONVEX_DEPLOYMENT=<your-convex-deployment>
```

That's it — no other API keys are needed.

## Build & Deploy

Generate a static site from your docs:

```bash
# Via CLI
inkloom build

# Output is in dist/ — deploy to any static host
```

Deploy the `dist/` folder to Vercel, Netlify, GitHub Pages, Cloudflare Pages, S3, or any static host.

## CLI Reference

| Command | Description |
|---------|-------------|
| `inkloom build` | Generate a static site to `dist/` |
| `inkloom push` | Push local MDX files to a Convex project |
| `inkloom pull` | Pull pages from Convex as local MDX files |
| `inkloom export` | Export all project data to `inkloom-export.json` |

Install the CLI:

```bash
pnpm add -g @inkloom/cli
```

## Project Structure

```
apps/web/                     # Next.js application
  app/[locale]/(dashboard)/   # Dashboard routes
  components/                 # Editor, settings, merge requests, dashboard
  convex/                     # Convex backend (schema, queries, mutations)
  lib/                        # Utilities, adapters, site generation
  hooks/                      # React hooks
  messages/en.json            # i18n translations

packages/
  ui/                         # Shared UI component library (@inkloom/ui)
  mdx-parser/                 # MDX <-> BlockNote conversion (@inkloom/mdx-parser)
  cli/                        # CLI tool (@inkloom/cli)
  create-inkloom/             # Project scaffolding (create-inkloom)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, BlockNote editor, Tailwind v4 |
| Backend | Convex (serverless functions + real-time database) |
| Build | Static site generation (HTML, CSS, JS) |
| Monorepo | pnpm workspaces |

## Data Portability

InkLoom stores data in Convex using a portable schema. Export your entire project at any time:

```bash
inkloom export --output inkloom-export.json
```

The export includes all projects, pages, folders, branches, and asset references.

### Upgrade to InkLoom Cloud

When you're ready for managed hosting, team collaboration, AI doc generation, GitHub sync, and custom domains:

```bash
inkloom migrate --to-cloud --file inkloom-export.json
```

Your data transfers seamlessly to [InkLoom Cloud](https://inkloom.dev) with zero data loss.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Commands

```bash
pnpm type-check    # Type-check all packages
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm lint          # Lint all packages
```

## License

InkLoom is licensed under the [Apache License 2.0](./LICENSE).
