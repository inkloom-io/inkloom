import pc from "picocolors";
import { CliError } from "./errors.js";

export interface OutputOptions {
  json?: boolean;
}

/**
 * Print data to stdout.
 * - JSON mode: JSON.stringify the full value
 * - Normal mode: arrays → aligned table, objects → key-value pairs, primitives → string
 */
export function printData(data: unknown, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return;
  }

  if (Array.isArray(data)) {
    printTable(data);
    return;
  }

  if (data !== null && typeof data === "object") {
    printKeyValue(data as Record<string, unknown>);
    return;
  }

  process.stdout.write(String(data) + "\n");
}

/**
 * Print a success message (green checkmark) to stderr.
 */
export function printSuccess(message: string): void {
  process.stderr.write(pc.green("✓ ") + message + "\n");
}

/**
 * Print an error to stderr.
 * - JSON mode: { "error": { code, message } }
 * - Normal mode: "Error: message" in red
 */
export function printError(error: Error, opts: OutputOptions): void {
  if (opts.json) {
    const jsonError: { code?: string; message: string; details?: Record<string, unknown> } = {
      message: error.message,
    };
    if (error instanceof CliError && error.apiError) {
      jsonError.code = error.apiError.code;
      if (error.apiError.details) {
        jsonError.details = error.apiError.details;
      }
    }
    process.stderr.write(JSON.stringify({ error: jsonError }, null, 2) + "\n");
    return;
  }

  process.stderr.write(pc.red("Error: ") + error.message + "\n");
}

/**
 * Print a warning message (yellow "Warning: ") to stderr.
 */
export function printWarning(message: string): void {
  process.stderr.write(pc.yellow("Warning: ") + message + "\n");
}

/**
 * Print an array of objects as an aligned table.
 * Columns are derived from the keys of the first element.
 * Header row is dimmed and uppercased.
 */
function printTable(rows: unknown[]): void {
  if (rows.length === 0) {
    process.stdout.write(pc.dim("No results") + "\n");
    return;
  }

  // Extract columns from first row
  const firstRow = rows[0];
  if (firstRow === null || typeof firstRow !== "object") {
    // Array of primitives — print one per line
    for (const item of rows) {
      process.stdout.write(String(item) + "\n");
    }
    return;
  }

  const columns = Object.keys(firstRow as Record<string, unknown>);
  if (columns.length === 0) {
    process.stdout.write(pc.dim("No results") + "\n");
    return;
  }

  // Compute column widths (min = header length)
  const widths = columns.map((col) => col.length);
  const stringRows: string[][] = [];

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const stringRow: string[] = [];
    for (let i = 0; i < columns.length; i++) {
      const val = formatCellValue(record[columns[i]]);
      stringRow.push(val);
      if (val.length > widths[i]) {
        widths[i] = val.length;
      }
    }
    stringRows.push(stringRow);
  }

  // Print header
  const header = columns
    .map((col, i) => col.toUpperCase().padEnd(widths[i]))
    .join("  ");
  process.stdout.write("  " + pc.dim(header) + "\n");

  // Print rows
  for (const row of stringRows) {
    const line = row.map((val, i) => val.padEnd(widths[i])).join("  ");
    process.stdout.write("  " + line + "\n");
  }
}

/**
 * Print an object as key-value pairs.
 */
function printKeyValue(obj: Record<string, unknown>): void {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    process.stdout.write(pc.dim("No data") + "\n");
    return;
  }

  // Compute max key length for alignment
  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));

  for (const [key, value] of entries) {
    const label = key.padEnd(maxKeyLen);
    process.stdout.write("  " + pc.dim(label) + "  " + formatCellValue(value) + "\n");
  }
}

/**
 * Format a value for display in a table cell or key-value pair.
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return pc.dim("—");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
