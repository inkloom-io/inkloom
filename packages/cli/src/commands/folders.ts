import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

/**
 * Register folders commands: list, create, delete.
 */
export function registerFoldersCommands(program: Command): void {
  const folders = program
    .command("folders")
    .description("Manage documentation folder hierarchy");

  // --- folders list ---
  folders
    .command("list")
    .description("List folders in a project")
    .argument("<projectId>", "Project ID")
    .option("--branch <branchId>", "Filter by branch ID")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { branch?: string }
        ) => {
          const params = new URLSearchParams();
          if (localOpts.branch) params.set("branchId", localOpts.branch);
          const qs = params.toString();
          const path = `/api/v1/projects/${projectId}/folders${qs ? `?${qs}` : ""}`;

          const response = await client.get<unknown[]>(path);

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as Record<string, unknown>[]).map(
            (f) => ({
              id: f._id,
              name: f.name,
              slug: f.slug,
              parent: f.parentId || "—",
              position: f.position ?? "—",
            })
          );
          printData(rows, opts);
        }
      )
    );

  // --- folders create ---
  folders
    .command("create")
    .description("Create a folder")
    .argument("<projectId>", "Project ID")
    .requiredOption("--name <name>", "Folder name")
    .option("--parent <folderId>", "Parent folder ID (for nesting)")
    .option("--branch <branchId>", "Target branch")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { name: string; parent?: string; branch?: string }
        ) => {
          const body: Record<string, unknown> = {
            name: localOpts.name,
          };
          if (localOpts.parent) body.parentId = localOpts.parent;
          if (localOpts.branch) body.branchId = localOpts.branch;

          const response = await client.post<Record<string, unknown>>(
            `/api/v1/projects/${projectId}/folders`,
            body
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const folder = response.data;
          printSuccess(
            `Folder created: ${folder.name} (${folder._id})`
          );
        }
      )
    );

  // --- folders delete ---
  folders
    .command("delete")
    .description("Delete a folder and all its contents recursively")
    .argument("<projectId>", "Project ID")
    .argument("<folderId>", "Folder ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          folderId: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Delete folder ${folderId} and all its contents? This cannot be undone.`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/folders/${folderId}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Folder ${folderId} deleted.`);
        }
      )
    );
}
