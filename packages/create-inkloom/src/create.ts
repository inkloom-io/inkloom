import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import prompts from "prompts";
import pc from "picocolors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CreateOptions {
  template: string;
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  skipInstall?: boolean;
}

const VALID_TEMPLATES = ["core", "default"] as const;

export async function create(
  projectName: string | undefined,
  options: CreateOptions
) {
  // Validate template name
  if (!VALID_TEMPLATES.includes(options.template as (typeof VALID_TEMPLATES)[number])) {
    console.log(
      pc.red(`Unknown template "${options.template}".`),
      `Available templates: ${VALID_TEMPLATES.join(", ")}`
    );
    process.exit(1);
  }

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

  // Resolve template path — check both ../templates and ../../templates
  // to handle dev (src/) and production (dist/) contexts
  let templatePath = path.join(__dirname, "..", "templates", options.template);
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(__dirname, "..", "..", "templates", options.template);
  }

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

  // Rename gitignore → .gitignore (npm strips .gitignore from published packages)
  const gitignorePath = path.join(projectPath, "gitignore");
  if (fs.existsSync(gitignorePath)) {
    await fs.rename(gitignorePath, path.join(projectPath, ".gitignore"));
  }

  // Rename env.example → .env.example
  const envExamplePath = path.join(projectPath, "env.example");
  if (fs.existsSync(envExamplePath)) {
    await fs.rename(envExamplePath, path.join(projectPath, ".env.example"));
  }

  // Install dependencies
  if (!options.skipInstall) {
    console.log(pc.cyan("Installing dependencies..."));
    console.log();

    const installCommand = {
      npm: "npm install",
      yarn: "yarn",
      pnpm: "pnpm install",
      bun: "bun install",
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

  if (options.template === "core") {
    printCoreInstructions(projectName, options.packageManager);
  } else {
    printDefaultInstructions(projectName, options.packageManager);
  }
}

function getRunCommand(packageManager: string, script: string): string {
  // yarn and bun don't need "run" for scripts
  if (packageManager === "yarn" || packageManager === "bun") {
    return `${packageManager} ${script}`;
  }
  return `${packageManager} run ${script}`;
}

function getExecCommand(packageManager: string): string {
  if (packageManager === "bun") return "bunx";
  if (packageManager === "pnpm") return "pnpm dlx";
  if (packageManager === "yarn") return "yarn dlx";
  return "npx";
}

function printCoreInstructions(
  projectName: string,
  packageManager: string
) {
  const execCmd = getExecCommand(packageManager);
  const devCmd = getRunCommand(packageManager, "dev");

  console.log("Get started:");
  console.log();
  console.log(pc.cyan(`  cd ${projectName}`));
  console.log();
  console.log(pc.bold("  Option A: Convex Cloud (free, fastest setup)"));
  console.log(`  ${pc.bold("1.")} ${execCmd} convex dev`);
  console.log(`  ${pc.bold("2.")} ${devCmd}`);
  console.log();
  console.log(pc.bold("  Option B: Self-hosted (no external dependencies)"));
  console.log(`  ${pc.bold("1.")} docker compose up -d`);
  console.log(`  ${pc.bold("2.")} See README.md for setup steps`);
  console.log();
  console.log(pc.dim("  Open http://localhost:3000 to start writing docs."));
  console.log();
}

function printDefaultInstructions(
  projectName: string,
  packageManager: string
) {
  const devCmd = getRunCommand(packageManager, "dev");
  const buildCmd = getRunCommand(packageManager, "build");

  console.log("Inside that directory, you can run:");
  console.log();
  console.log(pc.cyan(`  ${devCmd}`));
  console.log("    Starts the development server");
  console.log();
  console.log(pc.cyan(`  ${buildCmd}`));
  console.log("    Builds the production application");
  console.log();
  console.log("Get started by running:");
  console.log();
  console.log(pc.cyan(`  cd ${projectName}`));
  console.log(pc.cyan(`  ${devCmd}`));
  console.log();
}
