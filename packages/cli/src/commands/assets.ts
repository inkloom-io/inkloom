import { readFileSync, statSync } from "fs";
import { basename, extname } from "path";
import { Command } from "commander";
import { handleAction, type GlobalOpts } from "../lib/handler.js";
import type { Client } from "../lib/client.js";
import { printData, printSuccess } from "../lib/output.js";
import { confirm } from "../lib/prompt.js";
import { CliError } from "../lib/errors.js";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
};

interface AssetData {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt?: number;
}

interface PresignResponse {
  presignedUrl: string;
  r2Key: string;
  publicUrl: string;
}

interface ConfirmResponse {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

/**
 * Detect MIME type from file extension.
 * Falls back to "application/octet-stream" for unknown types.
 */
export function detectMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Register assets commands: list, upload, delete.
 */
export function registerAssetsCommands(program: Command): void {
  const assets = program
    .command("assets")
    .description("Manage file assets (images, PDFs, etc.)");

  // --- assets list ---
  assets
    .command("list")
    .description("List assets for a project")
    .argument("<projectId>", "Project ID")
    .action(
      handleAction(
        async (client: Client, opts: GlobalOpts, projectId: string) => {
          const response = await client.get<AssetData[]>(
            `/api/v1/projects/${projectId}/assets`
          );

          if (opts.json) {
            printData(response, opts);
            return;
          }

          const rows = (response.data as AssetData[]).map((a) => ({
            id: a.id,
            filename: a.filename,
            type: a.mimeType,
            size: formatSize(a.size),
            url: a.url,
          }));
          printData(rows, opts);
        }
      )
    );

  // --- assets upload ---
  assets
    .command("upload")
    .description("Upload a file asset (presign → upload → confirm)")
    .argument("<projectId>", "Project ID")
    .requiredOption("--file <path>", "Path to file to upload")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          localOpts: { file: string }
        ) => {
          const filePath = localOpts.file;

          // Validate file exists and is readable
          let fileSize: number;
          try {
            const stat = statSync(filePath);
            fileSize = stat.size;
          } catch {
            throw new CliError(`File not found: ${filePath}`);
          }

          const filename = basename(filePath);
          const mimeType = detectMimeType(filePath);
          const fileBuffer = readFileSync(filePath);

          // Step 1: Get presigned URL
          const presign = await client.post<PresignResponse>(
            `/api/v1/projects/${projectId}/assets`,
            { filename, mimeType }
          );

          // Step 2: Upload to R2 via presigned URL (raw fetch, not API client)
          const uploadResponse = await fetch(presign.data.presignedUrl, {
            method: "PUT",
            body: fileBuffer,
            headers: {
              "Content-Type": mimeType,
            },
          });

          if (!uploadResponse.ok) {
            throw new CliError(
              `Upload to storage failed with status ${uploadResponse.status}`
            );
          }

          // Step 3: Confirm upload
          const confirmed = await client.post<ConfirmResponse>(
            `/api/v1/projects/${projectId}/assets/confirm`,
            {
              r2Key: presign.data.r2Key,
              filename,
              mimeType,
              size: fileSize,
            }
          );

          if (opts.json) {
            printData(confirmed, opts);
            return;
          }

          printSuccess(`Uploaded ${filename} (${formatSize(fileSize)})`);
          process.stderr.write(`  ID:  ${confirmed.data.id}\n`);
          process.stderr.write(`  URL: ${confirmed.data.url}\n`);
        }
      )
    );

  // --- assets delete ---
  assets
    .command("delete")
    .description("Delete an asset")
    .argument("<projectId>", "Project ID")
    .argument("<assetId>", "Asset ID")
    .option("--force", "Skip confirmation prompt")
    .action(
      handleAction(
        async (
          client: Client,
          opts: GlobalOpts,
          projectId: string,
          assetId: string,
          localOpts: { force?: boolean }
        ) => {
          const ok = await confirm(
            `Delete asset ${assetId} from project ${projectId}?`,
            { force: localOpts.force }
          );

          if (!ok) {
            process.stderr.write("Aborted.\n");
            return;
          }

          await client.delete(
            `/api/v1/projects/${projectId}/assets/${assetId}`
          );

          if (opts.json) {
            printData({ data: { success: true } }, opts);
            return;
          }

          printSuccess(`Asset ${assetId} deleted`);
        }
      )
    );
}
