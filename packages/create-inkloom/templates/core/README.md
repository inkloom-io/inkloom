# InkLoom Documentation Platform

Create beautiful documentation with InkLoom's block-based editor.

## Features

- **Block-based WYSIWYG editor** with rich content types
- **Live preview panel** with MDX rendering
- **Custom blocks**: callouts, code blocks, tabs, steps, cards, columns
- **Project settings**: themes, colors, fonts, SEO, analytics
- **Static site generation**: build & publish your docs
- **Dark/light theme** support throughout

## Quick Start

### Option A: Convex Cloud (Fastest)

Free tier: 1M calls/month, 0.5 GB database + 1 GB file storage, no credit card required.

```bash
# 1. Install dependencies
pnpm install

# 2. Start the Convex backend (creates a free account if needed)
npx convex dev

# 3. In a new terminal, start the app
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

## Building Your Docs

1. Create pages and write content in the editor
2. Mark pages as "Published" (right-click → Toggle published)
3. Configure branding and SEO in project settings
4. Click "Build" in the editor toolbar
5. Serve the output: `npx serve dist/your-project-slug`

## Project Structure

```
app/              # Next.js app routes
  page.tsx        # Dashboard (project listing)
  projects/       # Editor and settings pages
  api/build/      # Static site build endpoint
components/       # React components
  editor/         # Block editor, toolbar, sidebar, preview panel
  settings/       # Project settings tabs
  docs-renderer/  # MDX rendering components
  ui/             # Shared UI components (button, card, dialog, etc.)
convex/           # Convex backend (schema, queries, mutations)
  schema/         # Table definitions
  users.ts        # Local user management
  projects.ts     # Project CRUD
  pages.ts        # Page content management
  folders.ts      # Folder management
  deployments.ts  # Deployment tracking
hooks/            # React hooks (auto-save, etc.)
lib/              # Utilities (build pipeline, theme presets, syntax highlighting)
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
