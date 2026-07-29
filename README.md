<p align="center">
  <strong>InkLoom</strong>
</p>

<h1 align="center">InkLoom</h1>

<h3 align="center">A local-first documentation platform — write, review, and publish docs that stay current as your product evolves.</h3>

<p align="center">
  Create, review, and publish documentation with a rich block editor, Git-style version control, and static output you can deploy anywhere.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black.svg" alt="Next.js 16" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.4-3178C6.svg" alt="TypeScript" /></a>
  <a href="https://developers.cloudflare.com/d1/"><img src="https://img.shields.io/badge/Cloudflare-D1-F38020.svg" alt="Cloudflare D1" /></a>
</p>

<p align="center">
  <a href="https://inkloom.dev">Website</a> &middot;
  <a href="https://docs.inkloom.dev">Docs</a> &middot;
  <a href="https://inkloom.dev">Cloud</a> &middot;
  <a href="https://discord.gg/inkloom">Discord</a>
</p>

---

<p align="center">
  <img src=".github/assets/editor-screenshot.png" alt="InkLoom Editor" width="800" />
</p>

## Why InkLoom exists

Documentation drifts. Products evolve, APIs change, features get reworked — and the docs quietly fall behind.

Most documentation tools focus on making docs look good. InkLoom focuses on making them stay good — with Git-style version control, structured review workflows, and a build pipeline that treats docs like code you can maintain over time.

## What is InkLoom?

InkLoom is an open-source, local-first documentation platform with a visual block editor, Git-style version control, and static site generation.

It's designed for teams that want real control over their documentation workflow — drafting, review, conflict resolution, and publishing — without being locked into a hosted platform.

No authentication is required. InkLoom runs as a single-tenant tool backed by
Cloudflare D1, Workers, and R2.

### Features

| Category            | What you get                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**          | BlockNote rich-text editor with 15 custom block types: accordion, callout, card, code block, code group, columns, expandable, frame, iframe, image, LaTeX, response field, steps, tabs, video |
| **Version control** | Branches, merge requests, diff viewer, conflict resolver, version history                                                                                                                     |
| **Comments**        | Threaded comments with inline marks                                                                                                                                                           |
| **Theming**         | 10 built-in theme presets (Ink, Aurora, Verdant, Ember, Midnight, Dune, Fossil, Vapor, Aubergine, Custom), custom colors/fonts, logo and favicon                                              |
| **SEO**             | OG tags, sitemap.xml, robots.txt, llms.txt                                                                                                                                                    |
| **OpenAPI**         | Validate OpenAPI specs and auto-generate API reference pages                                                                                                                                  |
| **CLI**             | `inkloom build`, `inkloom push`, `inkloom pull`, `inkloom export`                                                                                                                             |
| **Static output**   | Generate a static `dist/` folder deployable to any host                                                                                                                                       |
| **i18n**            | Built-in internationalization with next-intl                                                                                                                                                  |

## Status

InkLoom is under active development. Core documentation workflows, version control, static site generation, and theming are stable and in use.

## Quick Start

```bash
npx create-inkloom my-docs && cd my-docs
```

Or clone the repo directly:

```bash
git clone https://github.com/inkloom/inkloom.git && cd inkloom && pnpm install
```

**1. Create and migrate the local D1 database:**

```bash
cd apps/web
pnpm data:migrate:local
```

**2. Start the data Worker:**

```bash
pnpm data:dev
```

**3. In another terminal, start Next.js:**

```bash
cd apps/web
pnpm dev
```

Open **http://localhost:3000**. Wrangler persists the development database in
`.wrangler/`; no Cloudflare account or login is needed for local development.

## Build & Deploy

Generate a static site from your docs:

```bash
# Via CLI
inkloom build

# Output is in dist/ — deploy to any static host
```

Deploy the `dist/` folder to Vercel, Netlify, GitHub Pages, Cloudflare Pages, S3, or any static host.

## Hosting the Backend

Production uses a Cloudflare Worker with D1 and R2 bindings. Apply migrations
with `pnpm data:migrate:remote`, deploy with `pnpm data:deploy`, and configure
the Next.js service with the resulting `DATA_API_URL`. The browser talks to the
Worker through the authenticated `/api/data/*` same-origin proxy.

## CLI Reference

| Command          | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `inkloom build`  | Generate a static site to `dist/`                         |
| `inkloom push`   | Push local MDX files to an InkLoom data Worker            |
| `inkloom pull`   | Pull pages from an InkLoom data Worker as local MDX files |
| `inkloom export` | Export all project data to `inkloom-export.json`          |

Install the CLI:

```bash
pnpm add -g @inkloom/cli
```

## Project Structure

```
apps/web/                     # Next.js application
  app/[locale]/(dashboard)/   # Dashboard routes
  components/                 # Editor, settings, merge requests, dashboard
  db/                         # Drizzle schema and D1 migrations
  data/                       # Typed browser client and React Query hooks
  worker/                     # Cloudflare Worker data API
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

| Layer    | Technology                                          |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 16, React 19, BlockNote editor, Tailwind v4 |
| Backend  | Cloudflare Workers + D1 + R2 (Drizzle and Hono)     |
| Build    | Static site generation (HTML, CSS, JS)              |
| Monorepo | pnpm workspaces                                     |

## Data Portability

InkLoom stores relational data in D1 and objects in R2 using a portable schema.
Export your entire project at any time:

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

We welcome contributions! InkLoom is maintained by a small team. We review every PR.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Commands

```bash
pnpm type-check    # Type-check all packages
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm verify:retired-backend # Reject retired backend code and dependencies
```

## License

InkLoom is licensed under the [Apache License 2.0](./LICENSE).
