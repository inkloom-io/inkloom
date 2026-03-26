# InkLoom Platform Guide

Quick-reference guide for the InkLoom documentation platform — sign-up through advanced features.

## Sign-Up Flow

1. Go to [inkloom.io](https://inkloom.io) and click **Sign Up**.
2. Authenticate with **GitHub**, **Google**, or **email/password**.
3. If using email, verify your address via the confirmation link.
4. After sign-up you land on the **Projects dashboard** with a personal workspace auto-created.

The free plan includes unlimited projects and pages — no credit card required.

## Dashboard Overview

The dashboard home shows: **total projects**, **total pages**, **recent deployments** with status indicators, and **unpublished changes**. Each project card displays name, slug, plan tier, deployment status, and last update time.

Deployment statuses: **Live**, **Unpublished**, **Queued**, **Building**, **Error**, **Not deployed**.

## Project Templates

When creating a project, choose a starting point:

| Template | Description |
|----------|-------------|
| **Blank** | Empty site — build your structure from scratch |
| **Product Docs** | Pre-built pages for product documentation with guides and references |
| **SDK / API Docs** | Starter layout for API references, SDK guides, and OpenAPI playground |

You can also **import from GitHub**, **migrate from Mintlify**, or **migrate from GitBook**.

## Editor Overview

The block editor is a Notion-like visual environment with three areas:

- **Sidebar** — page/folder tree, branch switcher, search, project settings
- **Editor canvas** — write and format content; drag blocks to reorder
- **Preview panel** — live-rendered view with your selected theme applied

### Blocks

Every piece of content is a block. Type `/` to open the slash menu and insert components:

- **Text blocks** — paragraphs, headings (H1–H3), lists, checklists, block quotes
- **Component blocks** — callouts, tabs, steps, cards, accordions, code groups, columns, frames
- **Media blocks** — images, videos, iframes, syntax-highlighted code blocks
- **Inline elements** — icons, badges

Container blocks (e.g. Tabs, Steps) can nest other blocks inside them for rich layouts.

## Publishing Workflow

Pages have two states:

| State | Visibility |
|-------|-----------|
| **Draft** | Only visible to editors in the dashboard |
| **Published** | Included in the deployed documentation site |

To go live:

1. Mark pages as **Published** in the editor.
2. Click the **Publish** button in the toolbar.
3. InkLoom builds the site and deploys to Cloudflare's edge network.
4. Your site is live at `your-project.inkloom.dev` within seconds.

Preview deployments are available for non-default branches — they get a unique temporary URL without affecting production.

## Themes

InkLoom includes **10 built-in theme presets**, each with light and dark mode:

| Theme | Vibe |
|-------|------|
| **Ink** (default) | Refined, precise, distinguished |
| **Aurora** | Dynamic, energetic, cutting-edge |
| **Verdant** | Scholarly, lush, grounded |
| **Ember** | Warm, editorial, refined |
| **Midnight** | Deep, precise, luminous |
| **Dune** | Soft, refined, modern |
| **Fossil** | Cold, mineral, uncompromising |
| **Vapor** | Ethereal, luminous, fluid |
| **Aubergine** | Opulent, rich, distinguished |
| **Custom** | Your brand, your style |

To switch: **Project Settings → Branding** → select a theme → **Publish**.

Each theme controls colors (19 variables), typography (sans/mono/display fonts), border radii, shadows, and special background effects. Readers toggle light/dark mode via the site header.

## Custom Domains

> Requires **Pro plan** or above.

1. Go to **Project Settings → Domains** → **Add Domain**.
2. Enter your hostname (e.g. `docs.yourcompany.com`).
3. Add a **CNAME** record at your DNS provider pointing to `your-project.inkloom.dev`.
4. Wait for DNS verification (minutes to 48 hours).
5. SSL is provisioned and renewed automatically by Cloudflare.

Domain statuses: **Pending** → **Active** → (or **Error** if DNS is misconfigured).

Your default `*.inkloom.dev` subdomain continues to work after adding a custom domain.

## Branches & Merge Requests

> Requires **Pro plan** or above.

- **Branches** isolate changes from the live site. Create them in the editor sidebar or via CLI.
- Each branch has independent content and its own preview deployment URL.
- **Merge requests** provide a review workflow: view diffs, discuss changes, resolve conflicts, then merge to the default branch.
- After merging, publish from the default branch to deploy to production.

## Organizations

Organizations are workspaces that own projects and team members. A **personal workspace** is auto-created on sign-up. Create additional organizations via the organization switcher in the dashboard header.

### Roles

| Role | Scope |
|------|-------|
| **Admin** | Full control — members, settings, SSO, billing, delete org |
| **Owner** | Project-level — delete projects, manage GitHub connections |
| **Member** | Create projects, edit pages, manage branches, publish |
| **Viewer** | Read-only access |

### SSO

> Requires **Enterprise** organization plan.

Configure SAML SSO in **Organization Settings → SSO** to enforce identity-provider authentication for all members.

## Billing Plans

### Project Plans

| Feature | Free | Pro | Ultimate |
|---------|:----:|:---:|:--------:|
| Projects & pages | Unlimited | Unlimited | Unlimited |
| Custom domains | — | ✓ | ✓ |
| API & CLI access | — | ✓ | ✓ |
| GitHub integration | — | ✓ | ✓ |
| Branches & merge requests | — | ✓ | ✓ |
| Version history | — | ✓ | ✓ |
| Remove/advanced branding | — | ✓ | ✓ |
| AI generation credits | — | 20/mo | 100/mo |
| Realtime collaboration | — | — | ✓ |
| Authenticated access | — | — | ✓ |

### Organization Plans

| Feature | Basic | Enterprise |
|---------|:-----:|:----------:|
| SSO / SAML | — | ✓ |
| Uptime SLA | — | ✓ |
| Dedicated support | — | ✓ |

Enterprise org plan unlocks all project-level features for every project in the organization.

Billing is per project. Monthly and annual intervals available via Stripe.

## API Keys

Manage keys in the dashboard under the appropriate scope:

| Scope | Location | Access |
|-------|----------|--------|
| **User** | User Settings → API Keys | All orgs for your account |
| **Organization** | Org Settings → API Keys | All projects in the org |
| **Project** | Project Settings → Developer | Single project only |

Token format: `ik_live_user_...`. Set via `export INKLOOM_API_KEY=ik_live_user_...` for CLI/CI usage.

Keys are shown once at creation — copy immediately. Org and project keys require Pro plan.
