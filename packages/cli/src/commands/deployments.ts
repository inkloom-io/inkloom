import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

interface DeploymentData {
  id: string;
  projectId: string;
  branchId?: string;
  externalDeploymentId?: string;
  url?: string;
  status: string;
  target?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface RollbackResponse {
  deploymentId: string;
  url?: string;
}

/**
 * Register deployments commands: list, status, rollback.
 */
export function registerDeploymentsCommands(program: Command): void {
  const deployments = program
    .command("deployments")
    .description("List and manage deployments");

  // --- deployments list ---
  deployments
    .command("list")
    .description("List deployments for a project")
    .argument("<projectId>", "Project ID")
    .option("--limit <n>", "Maximum number of deployments to return")
    .option(
      "--target <target>",
      "Filter by target (production or preview)"
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { limit?: string; target?: string }
        ) => {
          const params = new URLSearchParams();
          if (localOpts.limit) params.set("limit", localOpts.limit);
          if (localOpts.target) params.set("target", localOpts.target);
          const qs = params.toString();
          const path = `/api/v1/projects/${projectId}/deployments${qs ? `?${qs}` : ""}`;

          const response = await client.get<DeploymentData[]>(path);

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as DeploymentData[]).map((d) => ({
            id: d.id,
            status: d.status,
            target: d.target ?? "—",
            url: d.url ?? "—",
            created: formatDate(d.createdAt),
          }));
          printData(rows, opts);
        }
      )
    );

  // --- deployments status ---
  deployments
    .command("status")
    .description("Get deployment status")
    .argument("<projectId>", "Project ID")
    .argument("<deploymentId>", "Deployment ID")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          deploymentId: string
        ) => {
          const response = await client.get<DeploymentData>(
            `/api/v1/projects/${projectId}/deployments/${deploymentId}`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- deployments rollback ---
  deployments
    .command("rollback")
    .description("Rollback to a previous deployment")
    .argument("<projectId>", "Project ID")
    .argument("<deploymentId>", "Deployment ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          deploymentId: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Rollback project ${projectId} to deployment ${deploymentId}?`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          const response = await client.post<RollbackResponse>(
            `/api/v1/projects/${projectId}/deployments/${deploymentId}/rollback`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(
            `Rollback initiated. New deployment: ${response.data.deploymentId}`
          );
          if (response.data.url) {
            process.stderr.write(`  URL: ${response.data.url}\n`);
          }
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
