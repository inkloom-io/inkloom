# create-inkloom

Scaffold an InkLoom documentation project.

```bash
npx create-inkloom my-docs
cd my-docs
pnpm data:migrate:local
pnpm dev
```

The default `core` template includes Next.js, the visual editor, branches and
reviews, a typed Hono data API, Drizzle schema and D1 migration, React Query,
and local static-site generation. Wrangler runs D1 locally without an account.

For production, create a Cloudflare D1 database, update `wrangler.jsonc`, apply
remote migrations, deploy the Worker, and set `DATA_API_URL` on the Next.js
service.

The lightweight `default` template is the static documentation viewer used by
generated builds.

## Options

```bash
npx create-inkloom [project-name] --template core --package-manager pnpm
```

Supported package managers are npm, pnpm, yarn, and Bun.
