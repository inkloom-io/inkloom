import { readFileSync } from "fs";
import { extname } from "path";
import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { CliError } from "../lib/errors.js";

interface OpenApiSummary {
  title: string;
  version: string;
  endpointCount: number;
  tagGroups: string[];
}

interface OpenApiUploadResponse {
  assetId: string;
  summary: OpenApiSummary;
}

interface OpenApiStatus {
  specUrl: string;
  specFormat: string;
  title: string;
  version: string;
  endpointCount: number;
  tagGroups: string[];
  updatedAt: number;
}

/**
 * Detect spec format from file extension.
 * Returns "json" or "yaml". Throws if extension is unrecognized.
 */
function detectFormat(filePath: string): "json" | "yaml" {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".json") return "json";
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  throw new CliError(
    `Cannot detect format from extension "${ext}". Use --format json or --format yaml.`
  );
}

/**
 * Register openapi commands: upload, status.
 */
export function registerOpenApiCommands(program: Command): void {
  const openapi = program
    .command("openapi")
    .description("Manage OpenAPI specification for auto-generated API reference");

  // --- openapi upload ---
  openapi
    .command("upload")
    .description("Upload an OpenAPI spec file")
    .argument("<projectId>", "Project ID")
    .requiredOption("--file <path>", "Path to OpenAPI spec file (.json or .yaml)")
    .option("--format <format>", "Spec format (auto-detected from extension if omitted)")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { file: string; format?: string }
        ) => {
          const filePath = localOpts.file;

          // Read the spec file
          let fileContent: string;
          try {
            fileContent = readFileSync(filePath, "utf-8");
          } catch {
            throw new CliError(`File not found: ${filePath}`);
          }

          // Determine format
          let format: "json" | "yaml";
          if (localOpts.format) {
            if (localOpts.format !== "json" && localOpts.format !== "yaml") {
              throw new CliError(
                `Invalid format "${localOpts.format}". Must be "json" or "yaml".`
              );
            }
            format = localOpts.format;
          } else {
            format = detectFormat(filePath);
          }

          // Upload spec
          const response = await client.post<OpenApiUploadResponse>(
            `/api/v1/projects/${projectId}/openapi`,
            { content: fileContent, format }
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const { summary } = response.data;
          printSuccess("OpenAPI spec uploaded successfully");
          process.stderr.write(`  Title:     ${summary.title}\n`);
          process.stderr.write(`  Version:   ${summary.version}\n`);
          process.stderr.write(`  Endpoints: ${summary.endpointCount}\n`);
          if (summary.tagGroups.length > 0) {
            process.stderr.write(
              `  Tags:      ${summary.tagGroups.join(", ")}\n`
            );
          }
        }
      )
    );

  // --- openapi status ---
  openapi
    .command("status")
    .description("Get the current OpenAPI configuration")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<OpenApiStatus | null>(
            `/api/v1/projects/${projectId}/openapi`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const data = response.data;
          if (!data) {
            process.stderr.write("No OpenAPI spec configured\n");
            return;
          }

          process.stdout.write(`  Title:     ${data.title}\n`);
          process.stdout.write(`  Version:   ${data.version}\n`);
          process.stdout.write(`  Format:    ${data.specFormat}\n`);
          process.stdout.write(`  Endpoints: ${data.endpointCount}\n`);
          if (data.tagGroups.length > 0) {
            process.stdout.write(
              `  Tags:      ${data.tagGroups.join(", ")}\n`
            );
          }
          if (data.updatedAt) {
            process.stdout.write(
              `  Updated:   ${new Date(data.updatedAt).toISOString().split("T")[0]}\n`
            );
          }
        }
      )
    );
}
