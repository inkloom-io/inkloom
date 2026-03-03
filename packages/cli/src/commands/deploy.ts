import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { CliError, EXIT_GENERAL } from "../lib/errors.js";

interface DeploymentResponse {
  deploymentId: string;
  externalDeploymentId?: string;
  url?: string;
  status: string;
}

interface DeploymentStatus {
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

/**
 * Poll a deployment until it reaches a terminal state.
 * Prints status transitions to stderr.
 */
async function pollDeployment(
  client: Client,
  projectId: string,
  deploymentId: string,
  timeoutSecs: number
): Promise<DeploymentStatus> {
  const deadline = Date.now() + timeoutSecs * 1000;
  let lastStatus = "";

  while (Date.now() < deadline) {
    const { data } = await client.get<DeploymentStatus>(
      `/api/v1/projects/${projectId}/deployments/${deploymentId}`
    );

    if (data.status !== lastStatus) {
      if (lastStatus) {
        process.stderr.write(`  Status: ${lastStatus} → ${data.status}\n`);
      } else {
        process.stderr.write(`  Status: ${data.status}\n`);
      }
      lastStatus = data.status;
    }

    if (["ready", "error", "canceled"].includes(data.status)) {
      return data;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new CliError(`Deployment timed out after ${timeoutSecs}s`);
}

/**
 * Register the top-level `deploy` command.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description("Trigger a deployment to Cloudflare Pages")
    .argument("<projectId>", "Project ID")
    .option("--production", "Deploy to production (default is preview)")
    .option("--branch <branchId>", "Branch to deploy")
    .option("--wait", "Poll until deployment completes")
    .option(
      "--timeout <seconds>",
      "Maximum time to wait in seconds (default: 300, only with --wait)",
      "300"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ inkloom deploy proj_abc --production --wait    Deploy to production and wait
  $ inkloom deploy proj_abc --branch br_xyz        Deploy a specific branch as preview
  $ inkloom deploy proj_abc --wait --timeout 600   Wait up to 10 minutes`
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: {
            production?: boolean;
            branch?: string;
            wait?: boolean;
            timeout?: string;
          }
        ) => {
          const body: Record<string, unknown> = {};
          if (localOpts.production) body.target = "production";
          if (localOpts.branch) body.branchId = localOpts.branch;

          const target = localOpts.production ? "production" : "preview";
          if (!opts.json) {
            process.stderr.write(
              `Deploying ${projectId} to ${target}...\n`
            );
          }

          const response = await client.post<DeploymentResponse>(
            `/api/v1/projects/${projectId}/deployments`,
            body
          );

          const deployment = response.data;

          if (localOpts.wait) {
            const timeoutSecs = parseInt(localOpts.timeout ?? "300", 10);
            const result = await pollDeployment(
              client,
              projectId,
              deployment.deploymentId,
              timeoutSecs
            );

            if (opts.json) {
              printData({ data: result }, opts);
              return;
            }

            if (result.status === "ready") {
              if (result.url) {
                process.stderr.write(`  URL: ${result.url}\n`);
              }
              process.stderr.write(
                `  Deployment ID: ${deployment.deploymentId}\n`
              );
              printSuccess("Deployment complete.");
            } else {
              // error or canceled
              throw new CliError(
                `Deployment ${result.status}${result.error ? `: ${result.error}` : ""}`,
                EXIT_GENERAL
              );
            }
            return;
          }

          // Without --wait: just print the initial result
          if (opts.json) {
            printData(response, opts);
            return;
          }

          process.stderr.write(
            `  Deployment ID: ${deployment.deploymentId}\n`
          );
          process.stderr.write(`  Status: ${deployment.status}\n`);
          if (deployment.url) {
            process.stderr.write(`  URL: ${deployment.url}\n`);
          }
          printSuccess(
            "Deployment triggered. Use --wait to poll until complete."
          );
        }
      )
    );
}
