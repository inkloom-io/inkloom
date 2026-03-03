import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";

interface WebhookData {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt?: number;
}

/**
 * Register webhooks commands: list, add, remove.
 */
export function registerWebhooksCommands(program: Command): void {
  const webhooks = program
    .command("webhooks")
    .description("Manage webhook subscriptions for deployment events");

  // --- webhooks list ---
  webhooks
    .command("list")
    .description("List webhooks for a project")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<WebhookData[]>(
            `/api/v1/projects/${projectId}/webhooks`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as WebhookData[]).map((w) => ({
            id: w.id,
            url: w.url,
            events: w.events.join(", "),
            active: w.isActive ? "yes" : "no",
          }));
          printData(rows, opts);
        }
      )
    );

  // --- webhooks add ---
  webhooks
    .command("add")
    .description("Register a webhook")
    .argument("<projectId>", "Project ID")
    .requiredOption("--url <url>", "Webhook URL (must use HTTPS)")
    .requiredOption(
      "--events <events>",
      "Comma-separated event types: deployment.ready, deployment.error"
    )
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { url: string; events: string }
        ) => {
          const events = localOpts.events
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);

          const response = await client.post<WebhookData>(
            `/api/v1/projects/${projectId}/webhooks`,
            { url: localOpts.url, events }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(`Webhook registered`);
          process.stderr.write(`  ID:     ${response.data.id}\n`);
          process.stderr.write(`  URL:    ${response.data.url}\n`);
          process.stderr.write(
            `  Events: ${response.data.events.join(", ")}\n`
          );
          process.stderr.write(`  Secret: ${response.data.secret}\n`);
          process.stderr.write(
            `\n  ⚠ Save the secret — it will not be shown again.\n`
          );
        }
      )
    );

  // --- webhooks update ---
  webhooks
    .command("update")
    .description("Update a webhook (activate or deactivate)")
    .argument("<projectId>", "Project ID")
    .argument("<webhookId>", "Webhook ID")
    .option("--active", "Activate the webhook")
    .option("--inactive", "Deactivate the webhook")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          webhookId: string,
          localOpts: { active?: boolean; inactive?: boolean }
        ) => {
          if (localOpts.active && localOpts.inactive) {
            process.stderr.write(
              "Error: --active and --inactive are mutually exclusive\n"
            );
            process.exit(1);
          }

          if (!localOpts.active && !localOpts.inactive) {
            process.stderr.write(
              "Error: specify --active or --inactive\n"
            );
            process.exit(1);
          }

          const isActive = !!localOpts.active;

          const response = await client.patch<WebhookData>(
            `/api/v1/projects/${projectId}/webhooks/${webhookId}`,
            { isActive }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          printSuccess(
            `Webhook ${webhookId} ${isActive ? "activated" : "deactivated"}`
          );
        }
      )
    );

  // --- webhooks remove ---
  webhooks
    .command("remove")
    .description("Remove a webhook")
    .argument("<projectId>", "Project ID")
    .argument("<webhookId>", "Webhook ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          webhookId: string,
          localOpts: { force?: boolean }
        ) => {
          const ok = await confirm(
            `Remove webhook ${webhookId} from project ${projectId}?`,
            { force: localOpts.force }
          );

          if (!ok) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/webhooks/${webhookId}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Webhook ${webhookId} removed`);
        }
      )
    );
}
