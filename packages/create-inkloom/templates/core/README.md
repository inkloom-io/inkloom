# InkLoom Documentation Platform

Create and publish documentation with InkLoom's block-based editor. This
standalone template stores application data in Cloudflare D1 through a Hono
Worker and can run locally without an account.

## Features

- Block-based WYSIWYG editing and live MDX preview
- Pages, folders, branches, comments, reviews, search, and version history
- Project branding, SEO, analytics, and static-site generation
- A typed data client shared by React and server routes
- SQLite-compatible local development through Wrangler

## Quick start

```bash
pnpm install
pnpm data:migrate:local
pnpm dev
```

The web app runs at [http://localhost:3000](http://localhost:3000) and the
local data Worker runs at [http://localhost:8787](http://localhost:8787).
`pnpm dev` starts both processes. Local D1 state is stored under `.wrangler/`.

## Building your docs

1. Create pages and write content in the editor.
2. Mark pages as published.
3. Configure branding and SEO in project settings.
4. Click **Build** in the editor toolbar.
5. Serve the generated `dist/` directory with any static host.

## Project structure

```text
app/                 Next.js routes and same-origin data proxy
components/          Editor, settings, renderer, and shared UI
data/                Typed data client, operations, hooks, and provider
db/schema/           Drizzle table definitions
db/migrations/       Versioned D1 migrations
worker/              Cloudflare Worker HTTP API and domain services
hooks/               React hooks such as autosave
lib/                 Build pipeline and utilities
wrangler.jsonc       Local and production Worker configuration
```

## Data commands

| Command | Purpose |
| --- | --- |
| `pnpm data:dev` | Run only the data Worker |
| `pnpm data:migrate:local` | Apply migrations to local D1 |
| `pnpm data:deploy` | Deploy the Worker to Cloudflare |
| `pnpm data:migrate:remote` | Apply migrations to production D1 |
| `pnpm db:generate` | Generate a migration after schema changes |

For a production deployment, create a D1 database with
`wrangler d1 create inkloom-local`, replace the placeholder `database_id` in
`wrangler.jsonc`, apply the remote migrations, and deploy the Worker. Point
the Next.js service at it with `DATA_API_URL`. Set the same
`DATA_API_TOKEN` secret on both services when the Worker is internet-facing.
The browser uses the same-origin `/api/data` proxy by default.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATA_API_URL` | Server-side Worker URL; defaults to `http://127.0.0.1:8787` |
| `DATA_API_TOKEN` | Optional shared secret for a remote Worker |
| `NEXT_PUBLIC_DATA_API_URL` | Optional direct browser Worker URL |

## Learn more

- [InkLoom](https://github.com/inkloom-io/inkloom)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Next.js](https://nextjs.org/docs)
