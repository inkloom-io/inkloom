# @inkloom/cli

Command-line tool for managing [InkLoom](https://inkloom.io) documentation sites. Authenticate, push and pull pages, deploy, manage branches, configure domains, and more.

## Installation

```bash
npm install -g @inkloom/cli
```

Or run commands without installing:

```bash
npx @inkloom/cli <command>
```

Requires **Node.js 20** or later.

## Authentication

### Log in with an API key

Create an API key in the InkLoom dashboard (**Settings > API Keys**), then:

```bash
inkloom auth login --token ik_live_user_...
```

Without `--token`, the CLI prompts for the token interactively.

### Verify authentication

```bash
inkloom auth status
```

### Log out

```bash
inkloom auth logout
```

### CI/CD usage

Set environment variables instead of running `login`:

```bash
export INKLOOM_TOKEN=ik_live_user_...
export INKLOOM_ORG_ID=org_01ABC   # optional — override default org
inkloom projects list
```

## Command Reference

### Auth

| Command | Description |
|---------|-------------|
| `inkloom auth login` | Authenticate with an API key |
| `inkloom auth logout` | Remove stored credentials |
| `inkloom auth status` | Show current authentication status |

### Projects

| Command | Description |
|---------|-------------|
| `inkloom projects list` | List accessible projects |
| `inkloom projects create --name <name>` | Create a new project |
| `inkloom projects get <id>` | Get project details |
| `inkloom projects delete <id>` | Delete a project |
| `inkloom projects plan get <id>` | Get the project's plan tier |
| `inkloom projects plan set <id> --plan <tier>` | Set plan tier (free, pro, ultimate) |
| `inkloom projects settings get <id>` | Get project settings |
| `inkloom projects settings update <id>` | Update project settings |

### Pages

| Command | Description |
|---------|-------------|
| `inkloom pages list --project <id>` | List pages in a project |
| `inkloom pages create --project <id> --file <path>` | Create a page from an MDX file |
| `inkloom pages get <pageId>` | Get page metadata and content |
| `inkloom pages update <pageId> --file <path>` | Update page content from MDX |
| `inkloom pages publish <pageId>` | Publish a page |
| `inkloom pages unpublish <pageId>` | Unpublish a page |
| `inkloom pages delete <pageId>` | Delete a page |
| `inkloom pages pull --project <id> --out <dir>` | Export all pages as `.mdx` files |
| `inkloom pages push --project <id> <dir>` | Sync local `.mdx` files to a project |

### Folders

| Command | Description |
|---------|-------------|
| `inkloom folders list --project <id>` | List folders |
| `inkloom folders create --project <id> --name <name>` | Create a folder |
| `inkloom folders delete <folderId>` | Delete a folder recursively |

### Branches

| Command | Description |
|---------|-------------|
| `inkloom branches list --project <id>` | List branches |
| `inkloom branches create --project <id> --name <name>` | Create a branch |
| `inkloom branches delete <branchId>` | Delete a branch |

### Deploy

| Command | Description |
|---------|-------------|
| `inkloom deploy <projectId>` | Trigger a deployment to Cloudflare Pages |

Options: `--production`, `--branch <id>`, `--wait`, `--timeout <ms>`

### Deployments

| Command | Description |
|---------|-------------|
| `inkloom deployments list --project <id>` | List deployments |
| `inkloom deployments status <deploymentId>` | Get deployment status |
| `inkloom deployments rollback <deploymentId>` | Rollback to a previous deployment |

### Domains

| Command | Description |
|---------|-------------|
| `inkloom domains list --project <id>` | List custom domains |
| `inkloom domains add --project <id> --domain <host>` | Add a custom domain |
| `inkloom domains status <domainId>` | Check domain verification and SSL status |
| `inkloom domains remove <domainId>` | Remove a custom domain |

### Assets

| Command | Description |
|---------|-------------|
| `inkloom assets list --project <id>` | List file assets |
| `inkloom assets upload --project <id> --file <path>` | Upload an asset |
| `inkloom assets delete <assetId>` | Delete an asset |

### OpenAPI

| Command | Description |
|---------|-------------|
| `inkloom openapi upload --project <id> --file <path>` | Upload an OpenAPI spec |
| `inkloom openapi status --project <id>` | Get OpenAPI configuration status |

### Webhooks

| Command | Description |
|---------|-------------|
| `inkloom webhooks list --project <id>` | List webhooks |
| `inkloom webhooks add --project <id> --url <url> --events <events>` | Register a webhook |
| `inkloom webhooks update <webhookId>` | Update a webhook |
| `inkloom webhooks remove <webhookId>` | Remove a webhook |

### LLMs.txt

| Command | Description |
|---------|-------------|
| `inkloom llms-txt get --project <id>` | Get current llms.txt config |
| `inkloom llms-txt set --project <id>` | Set custom llms.txt (`--file` or `--clear`) |

### Build

| Command | Description |
|---------|-------------|
| `inkloom build <projectId>` | Generate a static site from Convex data |

Options: `--output <dir>`, `--branch <id>`, `--clean`, `--convex-url <url>`

### Export

| Command | Description |
|---------|-------------|
| `inkloom export` | Export all project data to a JSON file |

Options: `--output <file>`, `--project <id>`, `--convex-url <url>`, `--pretty`

### Migrate

| Command | Description |
|---------|-------------|
| `inkloom migrate --to-cloud --file <path>` | Import a local export into InkLoom Cloud |

Options: `--dry-run`

## Common Workflows

### Push local MDX files to a project

```bash
# Organize docs as .mdx files — subdirectories map to InkLoom folders
docs/
  getting-started/
    quickstart.mdx
    installation.mdx
  api-reference/
    endpoints.mdx

# Dry-run first to see what will change
inkloom pages push --project proj_abc --dry-run docs/

# Push for real
inkloom pages push --project proj_abc docs/
```

### Pull pages from a project

```bash
inkloom pages pull --project proj_abc --out ./docs
```

### Deploy to production

```bash
inkloom deploy proj_abc --production --wait
```

### Connect a GitHub repository

Use the InkLoom dashboard to install the GitHub App, then push/pull and deploy via CI:

```bash
export INKLOOM_TOKEN=ik_live_user_...
inkloom pages push --project proj_abc ./docs
inkloom deploy proj_abc --production --wait
```

## Configuration

### Config file

Credentials and preferences are stored in `~/.inkloom/config.json`:

```json
{
  "token": "ik_live_user_...",
  "defaultOrgId": "org_01ABC",
  "apiBaseUrl": "https://app.inkloom.io",
  "telemetryEnabled": false
}
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `INKLOOM_TOKEN` | API key (overrides config file) |
| `INKLOOM_ORG_ID` | Organization ID (overrides config file) |
| `INKLOOM_API_URL` | API base URL (default: `https://app.inkloom.io`) |
| `INKLOOM_TELEMETRY_DISABLED` | Set to `1` to disable telemetry |

### CLI flags

Flags override both environment variables and config file:

- `--token <key>` — API key
- `--org <orgId>` — Organization ID
- `--api-url <url>` — API base URL
- `--json` — Machine-readable JSON output
- `-v, --verbose` — Debug logging to stderr
- `--no-telemetry` — Disable telemetry for this invocation

Precedence: CLI flags > environment variables > config file.

## Telemetry

The CLI includes **opt-in** anonymous telemetry to help improve InkLoom. It is **disabled by default** and can be disabled at any time:

- Pass `--no-telemetry` on any command
- Set `INKLOOM_TELEMETRY_DISABLED=1`
- Set `telemetryEnabled: false` in `~/.inkloom/config.json`

No personally identifiable information is ever collected.

## Links

- [InkLoom Documentation](https://docs.inkloom.io)
- [CLI Reference](https://docs.inkloom.io/cli)
- [GitHub Repository](https://github.com/inkloom-io/inkloom)
- [Report an Issue](https://github.com/inkloom-io/inkloom/issues)

## License

MIT
