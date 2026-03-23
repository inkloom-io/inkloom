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
  <a href="https://www.convex.dev"><img src="https://img.shields.io/badge/Convex-Backend-FF6F00.svg" alt="Convex" /></a>
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

No authentication required. InkLoom runs as a single-tenant tool backed by [Convex](https://www.convex.dev/).

### Features

| Category | What you get |
|----------|-------------|
| **Editor** | BlockNote rich-text editor with 15 custom block types: accordion, callout, card, code block, code group, columns, expandable, frame, iframe, image, LaTeX, response field, steps, tabs, video |
| **Version control** | Branches, merge requests, diff viewer, conflict resolver, version history |
| **Comments** | Threaded comments with inline marks |
| **Theming** | 10 built-in theme presets (Ink, Aurora, Verdant, Ember, Midnight, Dune, Fossil, Vapor, Aubergine, Custom), custom colors/fonts, logo and favicon |
| **SEO** | OG tags, sitemap.xml, robots.txt, llms.txt |
| **OpenAPI** | Validate OpenAPI specs and auto-generate API reference pages |
| **CLI** | `inkloom build`, `inkloom push`, `inkloom pull`, `inkloom export` |
| **Static output** | Generate a static `dist/` folder deployable to any host |
| **i18n** | Built-in internationalization with next-intl |

## Status

InkLoom is under active development. Core documentation workflows, version control, static site generation, and theming are stable and in use.

## Quick Start

### Option A: Convex Cloud (Fastest setup)

```bash
npx create-inkloom my-docs && cd my-docs
```

Or clone the repo directly:

```bash
git clone https://github.com/inkloom/inkloom.git && cd inkloom && pnpm install
```

<details>
<summary>Convex offers a generous free tier — more than enough for any documentation project.</summary>

- **1M** function calls/month
- **0.5 GB** database + **1 GB** file storage
- Up to **6 developers** — no credit card required

</details>

**1. Start the Convex backend** (creates a free account if needed):

```bash
npx convex dev
```

**2. In a new terminal, start the app:**

```bash
pnpm dev
```

Open **http://localhost:3000** — no login required.

### Option B: Self-Hosted (Zero external dependencies)

Run everything on your own infrastructure. No account needed, no data leaves your machine.

**1. Scaffold or clone** (same as above).

**2. Start the Convex backend locally:**

```bash
docker compose up -d
```

**3. Generate an admin key:**

```bash
docker compose exec backend ./generate_admin_key.sh
```

**4. Deploy your Convex functions to the local backend:**

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
  CONVEX_SELF_HOSTED_ADMIN_KEY=<key-from-step-3> \
  npx convex dev
```

**5. Create `.env.local`:**

```env
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
```

**6. Start the app:**

```bash
pnpm dev
```

Open **http://localhost:3000**. The Convex dashboard is available at **http://localhost:6791**.

## Build & Deploy

Generate a static site from your docs:

```bash
# Via CLI
inkloom build

# Output is in dist/ — deploy to any static host
```

Deploy the `dist/` folder to Vercel, Netlify, GitHub Pages, Cloudflare Pages, S3, or any static host.

## Hosting the Backend

InkLoom's backend runs on Convex. You have two options:

| | Convex Cloud | Self-Hosted |
|--|-------------|------------|
| Setup | `npx convex dev` (2 min) | `docker compose up` (5 min) |
| Cost | Free tier (generous) | Your infrastructure |
| Scaling | Automatic | Manual (single-machine default) |
| Backups | Automatic | You manage |
| Dashboard | cloud.convex.dev | localhost:6791 |

For production self-hosting, Convex supports PostgreSQL as a storage backend
(instead of the default SQLite) for better durability and scalability.
See the [Convex self-hosting guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) for details.

### Docker: Full-Stack Deployment

To run both the Convex backend and the InkLoom app in containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d
```

This requires a `standalone` Next.js build. Add `output: "standalone"` to your `next.config.ts`, then build the Docker image with `docker build -t inkloom .`.

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

We welcome contributions! InkLoom is maintained by a small team. We review every PR.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Commands

```bash
pnpm type-check    # Type-check all packages
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm lint          # Lint all packages
```

## License

InkLoom is licensed under the [Apache License 2.0](./LICENSE).
