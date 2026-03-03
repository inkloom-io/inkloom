import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

/**
 * Register branches commands: list, create, delete.
 */
export function registerBranchesCommands(program: Command): void {
  const branches = program
    .command("branches")
    .description("Manage content branches");

  // --- branches list ---
  branches
    .command("list")
    .description("List branches for a project")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string
        ) => {
          const response = await client.get<unknown[]>(
            `/api/v1/projects/${projectId}/branches`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as Record<string, unknown>[]).map(
            (b) => ({
              id: b._id,
              name: `${b.name}${b.isDefault ? " (default)" : ""}`,
              default: b.isDefault ? "yes" : "no",
              created: b.createdAt
                ? new Date(b.createdAt as number).toLocaleDateString()
                : "—",
            })
          );
          printData(rows, opts);
        }
      )
    );

  // --- branches create ---
  branches
    .command("create")
    .description("Create a new branch with cloned content from a source branch")
    .argument("<projectId>", "Project ID")
    .requiredOption("--name <name>", "Branch name")
    .option("--source <branchId>", "Source branch to clone from (defaults to project's default branch)")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { name: string; source?: string }
        ) => {
          const body: Record<string, unknown> = {
            name: localOpts.name,
          };
          if (localOpts.source) body.sourceBranchId = localOpts.source;

          const response = await client.post<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/branches`,
            body
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const branch = response.data;
          printSuccess(
            `Branch created: ${branch.name} (${branch._id})`
          );
        }
      )
    );

  // --- branches delete ---
  branches
    .command("delete")
    .description("Delete a branch and all its content")
    .argument("<projectId>", "Project ID")
    .argument("<branchId>", "Branch ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          branchId: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Delete branch ${branchId} and all its content? This cannot be undone.`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/branches/${branchId}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Branch ${branchId} deleted.`);
        }
      )
    );
}
