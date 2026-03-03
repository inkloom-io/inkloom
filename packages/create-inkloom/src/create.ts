import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import prompts from "prompts";
import pc from "picocolors";

interface CreateOptions {
  template: string;
  packageManager: "npm" | "yarn" | "pnpm";
  skipInstall?: boolean;
}

export async function create(
  projectName: string | undefined,
  options: CreateOptions
) {
  // Prompt for project name if not provided
  if (!projectName) {
    const response = await prompts({
      type: "text",
      name: "projectName",
      message: "What is your project named?",
      initial: "my-docs",
    });
    projectName = response.projectName;
  }

  if (!projectName) {
    console.log(pc.red("Project name is required"));
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), projectName);

  // Check if directory exists
  if (fs.existsSync(projectPath)) {
    const response = await prompts({
      type: "confirm",
      name: "overwrite",
      message: `Directory ${projectName} already exists. Overwrite?`,
      initial: false,
    });

    if (!response.overwrite) {
      console.log(pc.yellow("Cancelled"));
      process.exit(0);
    }

    await fs.remove(projectPath);
  }

  console.log();
  console.log(`Creating a new InkLoom project in ${pc.green(projectPath)}`);
  console.log();

  // Copy template
  const templatePath = path.join(__dirname, "..", "templates", options.template);

  if (!fs.existsSync(templatePath)) {
    console.log(pc.red(`Template "${options.template}" not found`));
    process.exit(1);
  }

  await fs.copy(templatePath, projectPath);

  // Update package.json with project name
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  // Rename gitignore
  const gitignorePath = path.join(projectPath, "gitignore");
  if (fs.existsSync(gitignorePath)) {
    await fs.rename(gitignorePath, path.join(projectPath, ".gitignore"));
  }

  // Install dependencies
  if (!options.skipInstall) {
    console.log(pc.cyan("Installing dependencies..."));
    console.log();

    const installCommand = {
      npm: "npm install",
      yarn: "yarn",
      pnpm: "pnpm install",
    }[options.packageManager];

    try {
      execSync(installCommand, {
        cwd: projectPath,
        stdio: "inherit",
      });
    } catch {
      console.log(pc.yellow("Failed to install dependencies. You can install them manually."));
    }
  }

  // Success message
  console.log();
  console.log(pc.green("Success!"), `Created ${projectName} at ${projectPath}`);
  console.log();
  console.log("Inside that directory, you can run:");
  console.log();
  console.log(pc.cyan(`  ${options.packageManager} run dev`));
  console.log("    Starts the development server");
  console.log();
  console.log(pc.cyan(`  ${options.packageManager} run build`));
  console.log("    Builds the production application");
  console.log();
  console.log("Get started by running:");
  console.log();
  console.log(pc.cyan(`  cd ${projectName}`));
  console.log(pc.cyan(`  ${options.packageManager} run dev`));
  console.log();
}
