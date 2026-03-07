# InkLoom Core

A local-first documentation platform with a visual editor, version history, branches, and merge requests.

## Quick Start

### Option A: Convex Cloud (Fastest)

Free tier: 1M calls/month, 0.5 GB database + 1 GB file storage, no credit card required.

```bash
# 1. Start the Convex backend (creates a free account if needed)
npx convex dev

# 2. In a new terminal, start the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the InkLoom dashboard.

### Option B: Self-Hosted (No external dependencies)

Run the Convex backend locally with Docker — no account needed.

```bash
# 1. Start the Convex backend
docker compose up -d

# 2. Generate an admin key
docker compose exec backend ./generate_admin_key.sh

# 3. Deploy your Convex functions to the local backend
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
  CONVEX_SELF_HOSTED_ADMIN_KEY=<key-from-step-2> \
  npx convex dev

# 4. Create .env.local
echo 'NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210' > .env.local

# 5. Start the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The Convex dashboard is at [http://localhost:6791](http://localhost:6791).

## What's Included

- **Convex schema** with tables for projects, pages, branches, merge requests, comments, and more
- **Core Convex functions** for user management and project CRUD
- **Next.js app** with Convex integration and Tailwind CSS

## Project Structure

```
convex/           # Convex backend (schema, queries, mutations)
  schema/         # Table definitions
  users.ts        # Local user management
  projects.ts     # Project CRUD
app/              # Next.js app routes
components/       # React components
```

## Environment Variables

Only two environment variables are needed (set automatically by `npx convex dev`):

| Variable | Description |
|----------|-------------|
| `CONVEX_DEPLOYMENT` | Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | Convex HTTP URL for the client |

For self-hosted setups, set these instead:

| Variable | Description |
|----------|-------------|
| `CONVEX_SELF_HOSTED_URL` | URL of your local Convex backend (e.g. `http://127.0.0.1:3210`) |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Admin key from `generate_admin_key.sh` |
| `NEXT_PUBLIC_CONVEX_URL` | Same as `CONVEX_SELF_HOSTED_URL` |

## Learn More

- [InkLoom Documentation](https://github.com/inkloom/inkloom)
- [Convex Documentation](https://docs.convex.dev)
- [Convex Self-Hosting Guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Next.js Documentation](https://nextjs.org/docs)
