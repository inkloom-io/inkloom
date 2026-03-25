import "./ensure-build.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../dist/cli.js");

function runCli(args: string[]): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf-8",
    timeout: 5000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("root help text", () => {
  it("should show all command groups", () => {
    const { stdout } = runCli(["--help"]);
    const expectedGroups = [
      "auth",
      "projects",
      "pages",
      "folders",
      "branches",
      "deploy",
      "deployments",
      "domains",
      "assets",
      "openapi",
      "webhooks",
    ];
    for (const group of expectedGroups) {
      assert.ok(
        stdout.includes(group),
        `Root help should list '${group}' command`
      );
    }
  });

  it("should show documentation links at the bottom", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(
      stdout.includes("Documentation: https://docs.inkloom.io/cli"),
      "Should show docs link"
    );
    assert.ok(
      stdout.includes("API Reference: https://docs.inkloom.io/api"),
      "Should show API reference link"
    );
  });

  it("should show all global flags", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(stdout.includes("--json"), "Should show --json flag");
    assert.ok(stdout.includes("--token <key>"), "Should show --token flag");
    assert.ok(stdout.includes("--org <orgId>"), "Should show --org flag");
    assert.ok(stdout.includes("--api-url <url>"), "Should show --api-url flag");
    assert.ok(stdout.includes("-v, --verbose"), "Should show --verbose flag");
    assert.ok(stdout.includes("-V, --version"), "Should show --version flag");
  });

  it("should show correct descriptions for command groups", () => {
    const { stdout } = runCli(["--help"]);
    assert.ok(
      stdout.includes("Manage authentication credentials"),
      "auth description"
    );
    assert.ok(
      stdout.includes("Manage documentation projects"),
      "projects description"
    );
    assert.ok(
      stdout.includes("Manage documentation pages within a project"),
      "pages description"
    );
    assert.ok(
      stdout.includes("Manage documentation folder hierarchy"),
      "folders description"
    );
    assert.ok(stdout.includes("Manage content branches"), "branches description");
    assert.ok(
      stdout.includes("Trigger a deployment to Cloudflare Pages"),
      "deploy description"
    );
    assert.ok(
      stdout.includes("List and manage deployments"),
      "deployments description"
    );
    assert.ok(
      stdout.includes("Manage custom domains for published"),
      "domains description"
    );
    assert.ok(
      stdout.includes("Manage file assets"),
      "assets description"
    );
    assert.ok(
      stdout.includes("Manage OpenAPI specification"),
      "openapi description"
    );
    assert.ok(
      stdout.includes("Manage webhook subscriptions"),
      "webhooks description"
    );
  });
});

describe("auth login help examples", () => {
  it("should show usage examples", () => {
    const { stdout } = runCli(["auth", "login", "--help"]);
    assert.ok(stdout.includes("Examples:"), "Should have Examples section");
    assert.ok(
      stdout.includes("inkloom auth login"),
      "Should show interactive example"
    );
    assert.ok(
      stdout.includes("--token ik_live_user_"),
      "Should show CI example with --token"
    );
    assert.ok(
      stdout.includes("INKLOOM_TOKEN"),
      "Should show env var example"
    );
  });

  it("should show correct description", () => {
    const { stdout } = runCli(["auth", "login", "--help"]);
    assert.ok(
      stdout.includes("Authenticate with InkLoom"),
      "Should show correct description"
    );
  });
});

describe("pages push help examples", () => {
  it("should show usage examples", () => {
    const { stdout } = runCli(["pages", "push", "--help"]);
    assert.ok(stdout.includes("Examples:"), "Should have Examples section");
    assert.ok(
      stdout.includes("--dry-run"),
      "Should show dry-run example"
    );
    assert.ok(
      stdout.includes("--publish --delete"),
      "Should show full sync example"
    );
    assert.ok(
      stdout.includes("INKLOOM_TOKEN"),
      "Should show CI usage example"
    );
  });

  it("should show correct description", () => {
    const { stdout } = runCli(["pages", "push", "--help"]);
    assert.ok(
      stdout.includes("Sync a local directory of .mdx files to an InkLoom project"),
      "Should show correct description"
    );
  });

  it("should show all options", () => {
    const { stdout } = runCli(["pages", "push", "--help"]);
    assert.ok(stdout.includes("--dir <path>"), "Should show --dir option");
    assert.ok(
      stdout.includes("--branch <branchId>"),
      "Should show --branch option"
    );
    assert.ok(stdout.includes("--delete"), "Should show --delete option");
    assert.ok(stdout.includes("--dry-run"), "Should show --dry-run option");
    assert.ok(stdout.includes("--publish"), "Should show --publish option");
  });
});

describe("pages pull help examples", () => {
  it("should show usage examples", () => {
    const { stdout } = runCli(["pages", "pull", "--help"]);
    assert.ok(stdout.includes("Examples:"), "Should have Examples section");
    assert.ok(
      stdout.includes("--overwrite"),
      "Should show overwrite example"
    );
    assert.ok(
      stdout.includes("--published-only"),
      "Should show published-only example"
    );
  });

  it("should show correct description", () => {
    const { stdout } = runCli(["pages", "pull", "--help"]);
    assert.ok(
      stdout.includes(
        "Export all pages from a project as .mdx files with frontmatter"
      ),
      "Should show correct description"
    );
  });
});

describe("deploy help examples", () => {
  it("should show usage examples", () => {
    const { stdout } = runCli(["deploy", "--help"]);
    assert.ok(stdout.includes("Examples:"), "Should have Examples section");
    assert.ok(
      stdout.includes("--production --wait"),
      "Should show production + wait example"
    );
    assert.ok(
      stdout.includes("--branch br_xyz"),
      "Should show branch example"
    );
    assert.ok(
      stdout.includes("--timeout 600"),
      "Should show timeout example"
    );
  });

  it("should show correct description", () => {
    const { stdout } = runCli(["deploy", "--help"]);
    assert.ok(
      stdout.includes("Trigger a deployment to Cloudflare Pages"),
      "Should show correct description"
    );
  });

  it("should show all options", () => {
    const { stdout } = runCli(["deploy", "--help"]);
    assert.ok(stdout.includes("--production"), "Should show --production option");
    assert.ok(
      stdout.includes("--branch <branchId>"),
      "Should show --branch option"
    );
    assert.ok(stdout.includes("--wait"), "Should show --wait option");
    assert.ok(
      stdout.includes("--timeout <seconds>"),
      "Should show --timeout option"
    );
  });
});

describe("command descriptions match CLI spec", () => {
  it("auth subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["auth", "--help"]);
    assert.ok(
      stdout.includes("Authenticate with InkLoom"),
      "login description"
    );
    assert.ok(
      stdout.includes("Remove stored credentials"),
      "logout description"
    );
    assert.ok(
      stdout.includes("Show current authentication status"),
      "status description"
    );
  });

  it("projects subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["projects", "--help"]);
    // Commander may wrap long descriptions across lines, so check for a key substring
    assert.ok(
      stdout.includes("List projects accessible to the authenticated"),
      "list description"
    );
    assert.ok(stdout.includes("Create a new project"), "create description");
    assert.ok(stdout.includes("Get project details"), "get description");
    assert.ok(
      stdout.includes("Delete a project and all related data"),
      "delete description"
    );
    assert.ok(
      stdout.includes("Manage project settings"),
      "settings description"
    );
  });

  it("pages subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["pages", "--help"]);
    assert.ok(
      stdout.includes("List pages in a project"),
      "list description"
    );
    assert.ok(
      stdout.includes("Create a new page from a local MDX file"),
      "create description"
    );
    assert.ok(
      stdout.includes("Get a page's metadata and optionally its content"),
      "get description"
    );
    assert.ok(
      stdout.includes("Update a page's content from a local MDX file"),
      "update description"
    );
    assert.ok(
      stdout.includes("Publish a page (make it visible in deployments)"),
      "publish description"
    );
    assert.ok(
      stdout.includes("Unpublish a page (hide it from deployments)"),
      "unpublish description"
    );
    assert.ok(stdout.includes("Delete a page"), "delete description");
    assert.ok(
      stdout.includes("Export all pages from a project as .mdx files"),
      "pull description"
    );
    assert.ok(
      stdout.includes("Sync a local directory of .mdx files"),
      "push description"
    );
  });

  it("folders subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["folders", "--help"]);
    assert.ok(
      stdout.includes("List folders in a project"),
      "list description"
    );
    assert.ok(stdout.includes("Create a folder"), "create description");
    assert.ok(
      stdout.includes("Delete a folder and all its contents recursively"),
      "delete description"
    );
  });

  it("branches subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["branches", "--help"]);
    assert.ok(
      stdout.includes("List branches for a project"),
      "list description"
    );
    assert.ok(
      stdout.includes("Create a new branch with cloned content"),
      "create description"
    );
    assert.ok(
      stdout.includes("Delete a branch and all its content"),
      "delete description"
    );
  });

  it("deployments subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["deployments", "--help"]);
    assert.ok(
      stdout.includes("List deployments for a project"),
      "list description"
    );
    assert.ok(
      stdout.includes("Get deployment status"),
      "status description"
    );
    assert.ok(
      stdout.includes("Rollback to a previous deployment"),
      "rollback description"
    );
  });

  it("domains subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["domains", "--help"]);
    assert.ok(stdout.includes("List custom domains"), "list description");
    assert.ok(stdout.includes("Add a custom domain"), "add description");
    assert.ok(
      stdout.includes("Check domain verification and SSL status"),
      "status description"
    );
    assert.ok(stdout.includes("Remove a custom domain"), "remove description");
  });

  it("assets subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["assets", "--help"]);
    assert.ok(
      stdout.includes("List assets for a project"),
      "list description"
    );
    assert.ok(
      stdout.includes("Upload a file asset"),
      "upload description"
    );
    assert.ok(stdout.includes("Delete an asset"), "delete description");
  });

  it("openapi subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["openapi", "--help"]);
    assert.ok(
      stdout.includes("Upload an OpenAPI spec file"),
      "upload description"
    );
    assert.ok(
      stdout.includes("Get the current OpenAPI configuration"),
      "status description"
    );
  });

  it("webhooks subcommands should have correct descriptions", () => {
    const { stdout } = runCli(["webhooks", "--help"]);
    assert.ok(
      stdout.includes("List webhooks for a project"),
      "list description"
    );
    assert.ok(stdout.includes("Register a webhook"), "add description");
    assert.ok(stdout.includes("Remove a webhook"), "remove description");
  });
});

describe("version output", () => {
  it("should print version number", () => {
    const { stdout, exitCode } = runCli(["--version"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.trim() === "0.1.0", "Should print version 0.1.0");
  });
});

describe("unknown commands show help after error", () => {
  it("should show help when unknown subcommand is used", () => {
    const result = runCli(["nonexistent"]);
    assert.ok(
      result.stderr.includes("error") || result.stdout.includes("Usage:"),
      "Should show error or usage for unknown command"
    );
  });
});
