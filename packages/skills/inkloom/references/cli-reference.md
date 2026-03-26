# InkLoom CLI Reference

Complete command reference for `@inkloom/cli`. Install with `npm install -g @inkloom/cli` or use `npx @inkloom/cli <command>`. Requires Node.js 20+.

## auth

Manage authentication credentials. API access requires **Pro plan** or above.

| Subcommand | Description |
|------------|-------------|
| `inkloom auth login` | Authenticate via browser or token |
| `inkloom auth logout` | Remove stored credentials |
| `inkloom auth status` | Show current authentication status |

**login flags:** `--no-browser` (skip browser; prompt for token), `--token <key>` (provide key directly for CI).

Credentials stored in OS keychain with config file fallback.

## projects

Manage documentation projects.

| Subcommand | Description |
|------------|-------------|
| `inkloom projects list` | List accessible projects |
| `inkloom projects create` | Create a new project |
| `inkloom projects get <projectId>` | Get project details |
| `inkloom projects delete <projectId>` | Delete a project permanently |
| `inkloom projects plan get <projectId>` | Get project's plan tier |
| `inkloom projects plan set <projectId>` | Set plan tier |
| `inkloom projects settings get <projectId>` | Get project settings |
| `inkloom projects settings update <projectId>` | Update project settings |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--name <name>` | create | Project name (required) | — |
| `--description <text>` | create | Project description | — |
| `--force` | delete | Skip confirmation prompt | `false` |
| `--tier <tier>` | plan set | Plan tier: free, pro, ultimate (required) | — |
| `--theme <name>` | settings update | Theme preset name | — |
| `--primary-color <hex>` | settings update | Primary brand color (e.g. #3b82f6) | — |

## pages

Manage documentation pages. `push` and `pull` are the primary sync commands.

| Subcommand | Description |
|------------|-------------|
| `inkloom pages list <projectId>` | List pages in a project |
| `inkloom pages create <projectId>` | Create a page from an MDX file |
| `inkloom pages get <projectId> <pageId>` | Get page metadata and content |
| `inkloom pages update <projectId> <pageId>` | Update page content from MDX |
| `inkloom pages publish <projectId> <pageId>` | Publish a page |
| `inkloom pages unpublish <projectId> <pageId>` | Unpublish a page |
| `inkloom pages delete <projectId> <pageId>` | Delete a page |
| `inkloom pages pull <projectId>` | Export pages as .mdx files |
| `inkloom pages push <projectId>` | Sync local .mdx files to project |

### pages push

Syncs a local directory of `.mdx` files to an InkLoom project. Subdirectories map to InkLoom folders automatically.

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Path to directory containing .mdx files (required) | — |
| `--branch <branchId>` | Target branch | project default |
| `--delete` | Delete remote pages/folders not present locally | `false` |
| `--dry-run` | Preview changes without applying them | `false` |
| `--publish` | Auto-publish all created/updated pages | `false` |
| `--no-config` | Skip docs.json processing | `false` |
| `--convex-url <url>` | Convex URL for self-hosted mode | `NEXT_PUBLIC_CONVEX_URL` |

```bash
inkloom pages push proj_abc --dir ./docs --dry-run
inkloom pages push proj_abc --dir ./docs --delete --publish
```

### pages pull

Exports all pages from a project as `.mdx` files with frontmatter.

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Output directory (required, created if missing) | — |
| `--branch <branchId>` | Source branch | project default |
| `--overwrite` | Overwrite existing files without prompting | `false` |
| `--published-only` | Only export published pages | `false` |
| `--convex-url <url>` | Convex URL for self-hosted mode | `NEXT_PUBLIC_CONVEX_URL` |

```bash
inkloom pages pull proj_abc --dir ./docs --overwrite
```

### Other pages flags

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--branch <branchId>` | list, create | Filter/target branch | — |
| `--folder <folderId>` | list, create | Filter/target folder | — |
| `--format <format>` | list, get | Content format: mdx or blocknote | blocknote |
| `--include-content` | list, get | Include page content in response | `false` |
| `--file <path>` | create, update | Path to .mdx file (required) | — |
| `--title <title>` | create, update | Page title | — |
| `--slug <slug>` | create | URL slug | auto from title |
| `--publish` | create | Publish immediately after creation | `false` |
| `--output <path>` | get | Write content to file instead of stdout | — |
| `--force` | delete | Skip confirmation prompt | `false` |

## folders

Manage documentation folder hierarchy.

| Subcommand | Description |
|------------|-------------|
| `inkloom folders list <projectId>` | List folders |
| `inkloom folders create <projectId>` | Create a folder |
| `inkloom folders delete <projectId> <folderId>` | Delete a folder recursively |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--name <name>` | create | Folder name (required) | — |
| `--parent <folderId>` | create | Parent folder ID for nesting | — |
| `--branch <branchId>` | list, create | Filter/target branch | — |
| `--force` | delete | Skip confirmation prompt | `false` |

## branches

Manage content branches.

| Subcommand | Description |
|------------|-------------|
| `inkloom branches list <projectId>` | List branches |
| `inkloom branches create <projectId>` | Create a branch (clones content from source) |
| `inkloom branches delete <projectId> <branchId>` | Delete a branch and its content |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--name <name>` | create | Branch name (required) | — |
| `--source <branchId>` | create | Source branch to clone from | project default |
| `--force` | delete | Skip confirmation prompt | `false` |

## deploy

Trigger a deployment to Cloudflare Pages. Requires **Pro plan**.

`inkloom deploy <projectId> [options]`

| Flag | Description | Default |
|------|-------------|---------|
| `--production` | Deploy to production (otherwise preview) | `false` |
| `--branch <branchId>` | Branch to deploy | project default |
| `--wait` | Poll until deployment completes | `false` |
| `--timeout <seconds>` | Max wait time (only with --wait) | `300` |

```bash
inkloom deploy proj_abc --production --wait
```

## deployments

List and manage deployments. Requires **Pro plan**.

| Subcommand | Description |
|------------|-------------|
| `inkloom deployments list <projectId>` | List deployments |
| `inkloom deployments status <projectId> <deploymentId>` | Get deployment status |
| `inkloom deployments rollback <projectId> <deploymentId>` | Rollback to a previous deployment |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--limit <n>` | list | Max deployments to return | — |
| `--target <target>` | list | Filter: production or preview | — |
| `--force` | rollback | Skip confirmation prompt | `false` |

Rollback creates a new deployment; the previous one remains in history.

## build

Generate a static site from Convex data. Requires `NEXT_PUBLIC_CONVEX_URL` or `--convex-url`.

`inkloom build <projectId> [options]`

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory | `dist` |
| `--branch <branchId>` | Branch to build | project default |
| `--clean` / `--no-clean` | Remove output directory before building | `true` |
| `--convex-url <url>` | Convex deployment URL | `NEXT_PUBLIC_CONVEX_URL` |

## export

Export project data to JSON. Requires `NEXT_PUBLIC_CONVEX_URL` or `--convex-url`.

`inkloom export [options]`

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <file>` | Output file path | `inkloom-export.json` |
| `--project <projectId>` | Export a single project (otherwise all) | — |
| `--convex-url <url>` | Convex deployment URL | `NEXT_PUBLIC_CONVEX_URL` |
| `--pretty` / `--no-pretty` | Pretty-print JSON output | `true` |

## migrate

Import a local export file into InkLoom Cloud.

`inkloom migrate --to-cloud [options]`

| Flag | Description | Default |
|------|-------------|---------|
| `--to-cloud` | Import local export into InkLoom Cloud | — |
| `--file <path>` | Path to export JSON file | `inkloom-export.json` |
| `--dry-run` | Validate without uploading | `false` |

## import

Import from external platforms. Auto-detects source format and uploads assets automatically.

`inkloom import --from <source> --path <dir> --project <name> [options]`

| Flag | Description | Default |
|------|-------------|---------|
| `--from <source>` | Source platform: mintlify or gitbook (required) | — |
| `--path <dir>` | Path to source docs directory (required) | — |
| `--project <name>` | Name for InkLoom project (required) | — |
| `--source-url <url>` | Current docs URL for redirect generation | — |
| `--dry-run` | Preview migration without creating project | `false` |

```bash
inkloom import --from mintlify --path ./docs --project "My Docs" --dry-run
```

## assets

Manage file assets (images, PDFs, etc.). Supported formats: PNG, JPG, GIF, SVG, WebP, ICO, PDF, JSON, YAML.

| Subcommand | Description |
|------------|-------------|
| `inkloom assets list <projectId>` | List assets |
| `inkloom assets upload <projectId>` | Upload a file asset |
| `inkloom assets delete <projectId> <assetId>` | Delete an asset |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--file <path>` | upload | Path to file (required) | — |
| `--force` | delete | Skip confirmation prompt | `false` |

## domains

Manage custom domains. Requires **Pro plan**. CNAME record required; DNS propagation up to 48h.

| Subcommand | Description |
|------------|-------------|
| `inkloom domains list <projectId>` | List custom domains |
| `inkloom domains add <projectId>` | Add a custom domain |
| `inkloom domains status <projectId> <hostname>` | Check verification and SSL status |
| `inkloom domains remove <projectId> <hostname>` | Remove a custom domain |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--hostname <hostname>` | add | Domain name, e.g. docs.example.com (required) | — |
| `--force` | remove | Skip confirmation prompt | `false` |

## openapi

Manage OpenAPI specification for auto-generated API reference pages.

| Subcommand | Description |
|------------|-------------|
| `inkloom openapi upload <projectId>` | Upload an OpenAPI spec |
| `inkloom openapi status <projectId>` | Get current OpenAPI configuration |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--file <path>` | upload | Path to spec file, .json or .yaml (required) | — |
| `--format <format>` | upload | Spec format (auto-detected from extension) | — |

## webhooks

Manage webhook subscriptions. Requires **Pro plan**. Secret shown once on creation.

| Subcommand | Description |
|------------|-------------|
| `inkloom webhooks list <projectId>` | List webhooks |
| `inkloom webhooks add <projectId>` | Register a webhook |
| `inkloom webhooks update <projectId> <webhookId>` | Activate or deactivate a webhook |
| `inkloom webhooks remove <projectId> <webhookId>` | Remove a webhook |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--url <url>` | add | Webhook URL, must use HTTPS (required) | — |
| `--events <events>` | add | Comma-separated: deployment.ready, deployment.error (required) | — |
| `--active` | update | Activate the webhook | — |
| `--inactive` | update | Deactivate the webhook | — |
| `--force` | remove | Skip confirmation prompt | `false` |

## llms-txt

Manage the llms.txt file for a project's published site. Auto-generated mode keeps llms.txt in sync with published pages.

| Subcommand | Description |
|------------|-------------|
| `inkloom llms-txt get <projectId>` | Get current llms.txt configuration |
| `inkloom llms-txt set <projectId>` | Set custom llms.txt or revert to auto-generation |

| Flag | Used by | Description | Default |
|------|---------|-------------|---------|
| `--file <path>` | set | Path to custom llms.txt file | — |
| `--clear` | set | Clear custom file; revert to auto-generation | `false` |

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--token <key>` | API key |
| `--org <orgId>` | Organization ID |
| `--api-url <url>` | API base URL |
| `-v, --verbose` | Debug logging to stderr |
| `--no-telemetry` | Disable telemetry for this invocation |
| `--version` | Print CLI version |
| `--help` | Show help for any command |

## Configuration

**Config file:** `~/.inkloom/config.json` — fields: `token`, `defaultOrgId`, `apiBaseUrl`, `telemetryEnabled`

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `INKLOOM_TOKEN` | API key |
| `INKLOOM_ORG_ID` | Organization ID |
| `INKLOOM_API_URL` | API base URL (default: `https://inkloom.io`) |
| `INKLOOM_TELEMETRY_DISABLED` | Set to `1` to disable telemetry |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (for build/export/push/pull) |
| `CONVEX_URL` | Alternative Convex URL variable |

**Credential resolution order:** CLI flags > environment variables > OS keychain > config file

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error or command failure |
| 2 | Invalid arguments or missing required options |
| 3 | Authentication failure (missing or invalid credentials) |
| 4 | Resource not found (project, page, deployment, etc.) |
| 5 | Permission denied or plan-gated feature |
