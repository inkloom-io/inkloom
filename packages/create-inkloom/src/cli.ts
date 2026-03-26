#!/usr/bin/env node

import { Command } from "commander";
import prompts from "prompts";
import { create } from "./create";
import pc from "picocolors";

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

const program = new Command();

program
  .name("create-inkloom")
  .description("Create a new InkLoom documentation project")
  .version("0.1.0")
  .argument("[project-name]", "Name of the project directory")
  .option(
    "-t, --template <name>",
    'Template to use: "core" (Next.js + Convex editor) or "default" (static site viewer)'
  )
  .option("--use-npm", "Use npm as package manager")
  .option("--use-yarn", "Use yarn as package manager")
  .option("--use-pnpm", "Use pnpm as package manager")
  .option("--use-bun", "Use bun as package manager")
  .option("--skip-install", "Skip installing dependencies")
  .action(async (projectName: string | undefined, options) => {
    console.log();
    console.log(pc.bold(pc.cyan("  InkLoom")));
    console.log(pc.dim("  Create beautiful documentation sites"));
    console.log();

    try {
      // Determine template: use flag if provided, otherwise prompt interactively
      let template: string = options.template;
      if (!template) {
        const response = await prompts({
          type: "select",
          name: "template",
          message: "Which template do you want to use?",
          choices: [
            { title: "Core (Next.js + Convex editor)", value: "core" },
            { title: "Default (Static Vite viewer)", value: "default" },
          ],
          initial: 0,
        });

        if (!response.template) {
          console.log(pc.yellow("Cancelled"));
          process.exit(0);
        }

        template = response.template;
      }

      // Determine package manager: use flag if provided, otherwise prompt interactively
      let packageManager: PackageManager | undefined;
      if (options.useNpm) packageManager = "npm";
      if (options.useYarn) packageManager = "yarn";
      if (options.usePnpm) packageManager = "pnpm";
      if (options.useBun) packageManager = "bun";

      if (!packageManager) {
        const response = await prompts({
          type: "select",
          name: "packageManager",
          message: "Which package manager do you want to use?",
          choices: [
            { title: "npm", value: "npm" },
            { title: "pnpm", value: "pnpm" },
            { title: "yarn", value: "yarn" },
            { title: "bun", value: "bun" },
          ],
          initial: 0,
        });

        if (!response.packageManager) {
          console.log(pc.yellow("Cancelled"));
          process.exit(0);
        }

        packageManager = response.packageManager as PackageManager;
      }

      await create(projectName, {
        template,
        packageManager,
        skipInstall: options.skipInstall,
      });
    } catch (error) {
      console.error(pc.red("Error:"), error);
      process.exit(1);
    }
  });

program.parse();
