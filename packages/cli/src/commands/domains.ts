import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

interface DomainData {
  hostname: string;
  status: string;
  sslStatus: string | null;
  verificationErrors: string | null;
  dnsInstructions?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Register domains commands: list, add, status, remove.
 */
export function registerDomainsCommands(program: Command): void {
  const domains = program
    .command("domains")
    .description("Manage custom domains for published documentation");

  // --- domains list ---
  domains
    .command("list")
    .description("List custom domains")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<DomainData[]>(
            `/api/v1/projects/${projectId}/domains`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as DomainData[]).map((d) => ({
            hostname: d.hostname,
            status: d.status,
            ssl: d.sslStatus ?? "—",
            created: formatDate(d.createdAt),
          }));
          printData(rows, opts);
        }
      )
    );

  // --- domains add ---
  domains
    .command("add")
    .description("Add a custom domain")
    .argument("<projectId>", "Project ID")
    .requiredOption(
      "--hostname <hostname>",
      "Domain name (e.g., docs.example.com)"
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { hostname: string }
        ) => {
          const response = await client.post<DomainData>(
            `/api/v1/projects/${projectId}/domains`,
            { hostname: localOpts.hostname }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Domain ${response.data.hostname} added (status: ${response.data.status})`);
          if (response.data.dnsInstructions) {
            process.stderr.write(`\n  DNS: ${response.data.dnsInstructions}\n`);
          }
        }
      )
    );

  // --- domains status ---
  domains
    .command("status")
    .description("Check domain verification and SSL status")
    .argument("<projectId>", "Project ID")
    .argument("<hostname>", "Domain hostname")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          hostname: string
        ) => {
          const response = await client.get<DomainData>(
            `/api/v1/projects/${projectId}/domains/${encodeURIComponent(hostname)}`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printData(response.data, opts);
        }
      )
    );

  // --- domains remove ---
  domains
    .command("remove")
    .description("Remove a custom domain")
    .argument("<projectId>", "Project ID")
    .argument("<hostname>", "Domain hostname")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          hostname: string,
          localOpts: { force?: boolean }
        ) => {
          const confirmed = await confirm(
            `Remove domain ${hostname} from project ${projectId}?`,
            { force: localOpts.force }
          );

          if (!confirmed) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/domains/${encodeURIComponent(hostname)}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Domain ${hostname} removed`);
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
