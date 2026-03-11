# create-inkloom

Scaffold a new [InkLoom](https://github.com/inkloom-io/inkloom) documentation project in seconds.

## Quick Start

```bash
npx create-inkloom my-docs
```

You'll be walked through setup interactively, or you can pass options directly:

```bash
npx create-inkloom my-docs --template core
```

## Templates

### `core` (default)

A full-featured documentation platform powered by **Next.js** and **Convex**. Includes a visual editor, version history, branches, and merge requests.

Best for teams that want a collaborative, local-first documentation editor with a real-time backend.

**What's included:**
- Next.js app with Tailwind CSS
- Convex schema and backend functions (projects, pages, branches, etc.)
- Two deployment options: Convex Cloud (free tier) or fully self-hosted with Docker
- Dark mode support via `next-themes`

### `default`

A lightweight static documentation site built with **Vite** and **React**. Renders Markdown content with syntax highlighting, full-text search, and a responsive sidebar.

Best for publishing read-only documentation sites with fast builds and zero backend dependencies.

**What's included:**
- Vite + React SPA with Tailwind CSS
- Markdown rendering with `react-markdown`, `remark-gfm`, and `shiki` syntax highlighting
- Client-side search powered by MiniSearch
- Responsive layout with sidebar navigation, breadcrumbs, and theme toggle

## Options

| Flag | Description |
|------|-------------|
| `-t, --template <name>` | Template to use: `core` or `default` (default: `core`) |
| `--use-npm` | Use npm as the package manager |
| `--use-yarn` | Use yarn as the package manager |
| `--use-pnpm` | Use pnpm as the package manager (default) |
| `--skip-install` | Skip installing dependencies after scaffolding |

If no project name is provided, you'll be prompted to enter one interactively.

## After Scaffolding

### Core template

```bash
cd my-docs

# Option A: Convex Cloud (free, fastest)
npx convex dev     # sets up backend
pnpm dev           # starts Next.js

# Option B: Self-hosted with Docker
docker compose up -d
# See the project README for full self-hosted setup steps
```

Open [http://localhost:3000](http://localhost:3000) to start writing docs.

### Default template

```bash
cd my-docs
pnpm dev       # starts Vite dev server
pnpm build     # builds for production
```

## Links

- [InkLoom GitHub](https://github.com/inkloom-io/inkloom)
- [Report an issue](https://github.com/inkloom-io/inkloom/issues)

## License

MIT
