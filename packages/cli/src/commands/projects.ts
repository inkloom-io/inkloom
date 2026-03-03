import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess, printWarning } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

/**
 * Register projects commands: list, create, get, delete, settings get/update.
 */
export function registerProjectsCommands(program: Command): void {
  const projects = program
    .command("projects")
    .description("Manage documentation projects");

  // --- projects list ---
  projects
    .command("list")
    .description("List projects accessible to the authenticated user/key")
    .action(
      handleAction(async (client: Client, opts: GlobalOpts) => {
        const params = new URLSearchParams();
        if (opts.org) params.set("orgId", opts.org);
        const qs = params.toString();
        const path = `/api/v1/projects${qs ? `?${qs}` : ""}`;

        const response = await client.get<unknown[]>(path);

        if (opts.json) {
          printData(response, opts);
          return;
        }

        const rows = (response.data as Record<string, unknown>[]).map((p) => ({
          id: p._id,
          name: p.name,
          slug: p.slug,
          plan: (p.plan as string) || "free",
          created: formatDate(p.createdAt),
        }));
        printData(rows, opts);
      })
    );

  // --- projects create ---
  projects
    .command("create")
    .description("Create a new project")
    .requiredOption("--name <name>", "Project name")
    .option("--description <text>", "Project description")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          localOpts: { name: string; description?: string }
        ) => {
          const body: Record<string, unknown> = {
            name: localOpts.name,
          };
          if (opts.org) body.orgId = opts.org;
          if (localOpts.description) body.description = localOpts.description;

          const response = await client.post<Record<string, unknown>>(
            "/api/v1/projects",
            body
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Project created: ${response.data.name} (${response.data._id})`);
        }
      )
    );

  // --- projects get ---
  projects
    .command("get")
    .description("Get project details")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<Record<string, unknown>>(
            `/api/v1/projects/${projectId}`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- projects delete ---
  projects
    .command("delete")
    .description("Delete a project and all related data")
    .argument("<projectId>", "Project ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Delete project ${projectId}? This cannot be undone.`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(`/api/v1/projects/${projectId}`);

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Project ${projectId} deleted.`);
        }
      )
    );

  // --- plan subcommand group ---
  const plan = projects
    .command("plan")
    .description("Manage project billing plan");

  // --- plan get ---
  plan
    .command("get")
    .description("Get the current plan for a project")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/plan`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- plan set ---
  plan
    .command("set")
    .description("Set the plan tier for a project")
    .argument("<projectId>", "Project ID")
    .requiredOption(
      "--tier <tier>",
      "Plan tier (free, pro, ultimate)"
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { tier: string }
        ) => {
          const validTiers = ["free", "pro", "ultimate"];
          if (!validTiers.includes(localOpts.tier)) {
            printWarning(
              `Invalid tier "${localOpts.tier}". Must be one of: ${validTiers.join(", ")}`
            );
            return;
          }

          const response = await client.patch<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/plan`,
            { plan: localOpts.tier }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Project plan set to "${localOpts.tier}".`);
        }
      )
    );

  // --- settings subcommand group ---
  const settings = projects
    .command("settings")
    .description("Manage project settings");

  // --- settings get ---
  settings
    .command("get")
    .description("Get project settings (theme, colors, navigation, etc.)")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/settings`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- settings update ---
  settings
    .command("update")
    .description("Update project settings")
    .argument("<projectId>", "Project ID")
    .option("--theme <name>", "Theme preset name")
    .option("--primary-color <hex>", "Primary brand color (hex format, e.g. #3b82f6)")
    .option("--logo <path>", "Path to logo file (not yet supported)")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { theme?: string; primaryColor?: string; logo?: string }
        ) => {
          if (localOpts.logo) {
            printWarning(
              "Logo upload via CLI is not yet supported. Use the dashboard to upload a logo."
            );
          }

          const body: Record<string, unknown> = {};
          if (localOpts.theme !== undefined) body.theme = localOpts.theme;
          if (localOpts.primaryColor !== undefined)
            body.primaryColor = localOpts.primaryColor;

          if (Object.keys(body).length === 0) {
            printWarning("No settings to update. Use --theme or --primary-color.");
            return;
          }

          const response = await client.patch<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/settings`,
            body
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess("Settings updated.");
          printData(response.data, opts);
        }
      )
    );
}

function formatDate(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    return value.split("T")[0];
  }
  return "—";
}
