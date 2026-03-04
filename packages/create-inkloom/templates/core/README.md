# InkLoom Core

A local-first documentation platform with a visual editor, version history, branches, and merge requests.

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Convex

Create a free Convex account and start the development server:

```bash
npx convex dev
```

This will:
- Prompt you to create a Convex project (free tier)
- Generate a `.env.local` file with your Convex URL
- Start the Convex dev server and sync your schema

### 3. Start the app

In a separate terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the InkLoom dashboard.

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

## Learn More

- [InkLoom Documentation](https://github.com/inkloom/inkloom)
- [Convex Documentation](https://docs.convex.dev)
- [Next.js Documentation](https://nextjs.org/docs)
