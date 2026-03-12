#!/usr/bin/env tsx
/**
 * generate-convex-types.ts
 *
 * Generates the `convex/_generated/` directory for core/apps/web so that
 * `tsc --noEmit` can type-check without needing a live Convex deployment.
 *
 * Convex's `npx convex codegen` requires CONVEX_DEPLOYMENT to be set, which
 * isn't available in CI or fresh checkouts. This script produces the same
 * files that `npx convex codegen` would create, derived from the local
 * convex/ source files.
 *
 * Usage:
 *   tsx scripts/generate-convex-types.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const webDir = path.resolve(__dirname, "..");
const convexDir = path.join(webDir, "convex");
const generatedDir = path.join(convexDir, "_generated");

// ---------------------------------------------------------------------------
// Discover convex modules (excluding schema.ts, _generated, and __tests__)
// ---------------------------------------------------------------------------

function discoverModules(): string[] {
  const modules: string[] = [];

  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name === "__tests__") continue;

      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        const moduleName = `${prefix}${entry.name.replace(/\.ts$/, "")}`;
        // Skip schema.ts itself — it's imported by dataModel, not as a module
        if (moduleName === "schema") continue;
        modules.push(moduleName);
      }
    }
  }

  walk(convexDir, "");
  return modules.sort();
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateDataModelDts(): string {
  return `/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their \`Id\`, which is accessible
 * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using \`db.get(tableName, id)\` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like \`queryGeneric\` and
 * \`mutationGeneric\` to make them type-safe.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`;
}

function generateServerDts(): string {
  return `/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

export declare const query: QueryBuilder<DataModel, "public">;
export declare const internalQuery: QueryBuilder<DataModel, "internal">;
export declare const mutation: MutationBuilder<DataModel, "public">;
export declare const internalMutation: MutationBuilder<DataModel, "internal">;
export declare const action: ActionBuilder<DataModel, "public">;
export declare const internalAction: ActionBuilder<DataModel, "internal">;
export declare const httpAction: HttpActionBuilder;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`;
}

function generateServerJs(): string {
  return `/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";

export const query = queryGeneric;
export const internalQuery = internalQueryGeneric;
export const mutation = mutationGeneric;
export const internalMutation = internalMutationGeneric;
export const action = actionGeneric;
export const internalAction = internalActionGeneric;
export const httpAction = httpActionGeneric;
`;
}

function generateApiDts(modules: string[]): string {
  // Create import names: "schema/coreTables" → "schema_coreTables"
  const toVarName = (m: string) => m.replace(/[/-]/g, "_");

  const imports = modules
    .map((m) => `import type * as ${toVarName(m)} from "../${m}.js";`)
    .join("\n");

  const apiEntries = modules
    .map((m) => {
      const key = m.includes("/") || m.includes("-") ? `"${m}"` : m;
      return `  ${key}: typeof ${toVarName(m)};`;
    })
    .join("\n");

  return `/* eslint-disable */
/**
 * Generated \`api\` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

${imports}

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
${apiEntries}
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
`;
}

function generateApiJs(): string {
  return `/* eslint-disable */
/**
 * Generated \`api\` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

import { anyApi, componentsGeneric } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const modules = discoverModules();
  console.log(
    `Generating convex/_generated/ with ${modules.length} modules: ${modules.join(", ")}`
  );

  fs.mkdirSync(generatedDir, { recursive: true });

  const files: Record<string, string> = {
    "dataModel.d.ts": generateDataModelDts(),
    "server.d.ts": generateServerDts(),
    "server.js": generateServerJs(),
    "api.d.ts": generateApiDts(modules),
    "api.js": generateApiJs(),
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(generatedDir, filename);
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ ${filename}`);
  }

  console.log("Done.");
}

main();
