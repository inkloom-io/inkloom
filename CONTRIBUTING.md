# Contributing to InkLoom

Thank you for your interest in contributing to InkLoom! This guide will help you get started.

## Architecture Overview

InkLoom Core is the open-source foundation of the InkLoom documentation platform. It includes:

- **`apps/web/`** — Next.js application with the BlockNote editor, dashboard, and Convex backend
- **`packages/ui/`** — Shared UI component library (`@inkloom/ui`)
- **`packages/mdx-parser/`** — MDX to BlockNote conversion (`@inkloom/mdx-parser`)
- **`packages/cli/`** — CLI tool for building, pushing, and pulling docs (`@inkloom/cli`)
- **`packages/create-inkloom/`** — Project scaffolding tool

The core app is a single-tenant documentation editor that stores data in Convex and generates static sites via `inkloom build`.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- A free [Convex](https://www.convex.dev/) account

## Development Setup

```bash
# Clone the repository
git clone https://github.com/inkloom/inkloom.git
cd inkloom

# Install dependencies
pnpm install

# Start the Convex dev server (requires a Convex account)
npx convex dev

# In a separate terminal, start the Next.js dev server
cd apps/web
pnpm dev
```

Open http://localhost:3000 to see the dashboard. No authentication is required — InkLoom Core runs as a local single-tenant tool.

## Project Structure

```
apps/web/
  app/[locale]/(dashboard)/   # Dashboard routes
  components/                  # React components (editor, settings, merge-request)
  convex/                      # Convex backend functions
    schema/coreTables.ts      # Database table definitions
    schema.ts                  # Schema entry point
    projects.ts                # Project CRUD (workosOrgId: "local")
    users.ts                   # Local user management (ensureLocalUser)
    pages.ts, branches.ts, ... # Content CRUD
  lib/
    adapters/                  # Adapter interfaces and core implementations
    generate-site.ts           # Static site generation
    diff-engine.ts             # LCS-based block diff for merge requests
  hooks/                       # React hooks (use-auth, use-app-context, use-publish)
  messages/en.json             # i18n translations

packages/
  ui/                          # Shared UI components
  mdx-parser/                  # MDX <-> BlockNote conversion
  cli/                         # CLI tool
  create-inkloom/              # Scaffolding tool
```

## Making Changes

### Before You Start

1. Check existing [issues](https://github.com/inkloom/inkloom/issues) to avoid duplicate work
2. For significant changes, open an issue first to discuss your approach
3. Fork the repository and create a branch from `main`

### Code Guidelines

- **TypeScript** — all code must be TypeScript with strict mode
- **Formatting** — follow existing code style; run `pnpm lint` before submitting
- **Tests** — add tests for new functionality; run `pnpm test` to verify
- **i18n** — user-facing strings go in `apps/web/messages/en.json`; use `useTranslations()` in components
- **No platform imports** — core files must never import from platform-specific code. This is enforced by ESLint and CI.

### Building and Testing

```bash
# Type-check the entire project
pnpm type-check

# Build the project
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

### Adapter Pattern

InkLoom uses an adapter pattern to decouple core behavior from the proprietary SaaS platform. The three adapters are:

| Adapter | Interface | Core Implementation |
|---------|-----------|---------------------|
| **auth** | `getUser()`, `requireUser()`, `signOut()` | Static local user, no-op signout |
| **context** | `getTenantId()`, `getOrgName()`, `isMultiTenant()` | Fixed `tenantId: "local"` |
| **deploy** | `publish(projectId, opts)`, `getDeployUrl()` | Static build to `dist/` |

Adapter interfaces are defined in `apps/web/lib/adapters/types.ts`. Core implementations are in `apps/web/lib/adapters/*.core.ts`. Consumer code imports from the barrel at `apps/web/lib/adapters.ts`.

If your change involves authentication, tenant context, or deployment behavior, work through the adapter interfaces rather than implementing directly.

### Convex Functions

Core Convex functions use `workosOrgId: "local"` as a sentinel value for single-tenant mode. When adding new Convex functions:

- Add table definitions to `apps/web/convex/schema/coreTables.ts`
- Keep functions scoped by `projectId` or `branchId` (not org) where possible
- The `users.ensureLocalUser` mutation creates a fixed local user on first load

## Submitting a Pull Request

1. Ensure all checks pass: `pnpm type-check && pnpm build && pnpm test && pnpm lint`
2. Write a clear PR description explaining what changed and why
3. Keep PRs focused — one logical change per PR
4. Update documentation if your change affects user-facing behavior

### What We Accept

- Bug fixes
- Performance improvements
- New editor blocks or components
- CLI improvements
- Documentation improvements
- i18n translations
- Accessibility improvements

### What We Don't Accept

- Changes that introduce SaaS-specific dependencies (WorkOS, Stripe, Cloudflare, etc.)
- Features that require multi-tenant infrastructure
- Changes that break the single-tenant local-first model

## Contributor License Agreement

By submitting a pull request, you agree that your contributions are licensed under the [Apache License 2.0](./LICENSE) and that you have the right to submit them.

## Getting Help

- Open a [GitHub issue](https://github.com/inkloom/inkloom/issues) for bugs or feature requests
- Start a [GitHub Discussion](https://github.com/inkloom/inkloom/discussions) for questions

## Code of Conduct

Be respectful, constructive, and inclusive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) code of conduct.
