# Contributing to InkLoom

InkLoom Core contains the Next.js editor, typed data client, Cloudflare Worker,
D1 schema/migrations, shared UI, CLI, parser, and project generator.

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer

Local development uses Wrangler's local D1 implementation and does not require
a Cloudflare account.

```bash
pnpm install
cd apps/web
pnpm data:migrate:local
```

Run `pnpm data:dev` and `pnpm dev` in separate terminals, then open
http://localhost:3000.

## Structure

```text
apps/web/
  app/             Next.js routes
  components/      Editor, settings, reviews, dashboard
  data/            Typed client, operations, React Query hooks
  db/              Drizzle schema and D1 migrations
  worker/          Hono data API
  lib/             Utilities and adapters
packages/
  ui/              Shared UI
  mdx-parser/      MDX and BlockNote conversion
  cli/             Command-line client
  create-inkloom/  Starter generator
```

## Data changes

Add tables under `apps/web/db/schema/`, generate and review a migration, add a
validated route under `apps/web/worker/routes/`, then expose it through
`apps/web/data/client.ts` and `apps/web/data/operations.ts`.

Core uses the sentinel tenant/user values documented in `AGENTS.md`. Keep
operations scoped by project or branch. Use D1 batches for transactional
multi-row changes and update the FTS index whenever searchable content
changes.

## Pull requests

```bash
pnpm type-check
pnpm test
pnpm build
```

Include tests for behavior changes and migrations for schema changes. Never
commit secrets or local `.wrangler/` state.
