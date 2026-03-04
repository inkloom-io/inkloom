#!/usr/bin/env node

import { Command } from "commander";
import { create } from "./create";
import pc from "picocolors";

const program = new Command();

program
  .name("create-inkloom")
  .description("Create a new InkLoom documentation project")
  .version("0.1.0")
  .argument("[project-name]", "Name of the project directory")
  .option(
    "-t, --template <name>",
    'Template to use: "core" (Next.js + Convex editor) or "default" (static site viewer)',
    "core"
  )
  .option("--use-npm", "Use npm as package manager")
  .option("--use-yarn", "Use yarn as package manager")
  .option("--use-pnpm", "Use pnpm as package manager")
  .option("--skip-install", "Skip installing dependencies")
  .action(async (projectName: string | undefined, options) => {
    console.log();
    console.log(pc.bold(pc.cyan("  InkLoom")));
    console.log(pc.dim("  Create beautiful documentation sites"));
    console.log();

    try {
      let packageManager: "npm" | "yarn" | "pnpm" = "pnpm";
      if (options.useNpm) packageManager = "npm";
      if (options.useYarn) packageManager = "yarn";
      if (options.usePnpm) packageManager = "pnpm";

      await create(projectName, {
        template: options.template,
        packageManager,
        skipInstall: options.skipInstall,
      });
    } catch (error) {
      console.error(pc.red("Error:"), error);
      process.exit(1);
    }
  });

program.parse();
