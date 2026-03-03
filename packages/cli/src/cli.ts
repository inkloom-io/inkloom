#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerProjectsCommands } from "./commands/projects.js";
import { registerPagesCommands } from "./commands/pages.js";
import { registerFoldersCommands } from "./commands/folders.js";
import { registerBranchesCommands } from "./commands/branches.js";
import { registerDeployCommand } from "./commands/deploy.js";
import { registerDeploymentsCommands } from "./commands/deployments.js";
import { registerDomainsCommands } from "./commands/domains.js";
import { registerAssetsCommands } from "./commands/assets.js";
import { registerOpenApiCommands } from "./commands/openapi.js";
import { registerWebhooksCommands } from "./commands/webhooks.js";
import { registerLlmsTxtCommands } from "./commands/llms-txt.js";

const program = new Command();
program
  .name("inkloom")
  .description("InkLoom CLI — manage documentation sites from the command line")
  .version("0.1.0")
  .showHelpAfterError(true)
  .option("--json", "Output machine-readable JSON")
  .option("--token <key>", "API key (overrides config/env)")
  .option("--org <orgId>", "Organization ID (overrides config/env)")
  .option("--api-url <url>", "API base URL (overrides config/env)")
  .option("-v, --verbose", "Enable debug logging to stderr")
  .addHelpText(
    "after",
    `
Documentation: https://docs.inkloom.dev/cli
API Reference: https://docs.inkloom.dev/api`
  )
  .action(() => {
    program.outputHelp();
  });

registerAuthCommands(program);
registerProjectsCommands(program);
registerPagesCommands(program);
registerFoldersCommands(program);
registerBranchesCommands(program);
registerDeployCommand(program);
registerDeploymentsCommands(program);
registerDomainsCommands(program);
registerAssetsCommands(program);
registerOpenApiCommands(program);
registerWebhooksCommands(program);
registerLlmsTxtCommands(program);

program.parse();
