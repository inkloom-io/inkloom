import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV3 } from "openapi-types";

export interface ParsedServer {
  url: string;
  description: string;
}

export interface ParsedSecurityScheme {
  type: "apiKey" | "http" | "oauth2";
  scheme?: string;
  name?: string;
  in?: "header" | "query" | "cookie";
  bearerFormat?: string;
}

export interface ParsedParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  type: string;
  required: boolean;
  description: string;
  example?: unknown;
  default?: unknown;
}

export interface ParsedSchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  children?: ParsedSchemaField[];
}

export interface ParsedRequestBody {
  contentType: string;
  fields: ParsedSchemaField[];
  schema?: Record<string, unknown>;
  example?: Record<string, unknown>;
}

export interface ParsedResponse {
  statusCode: string;
  description: string;
  fields: ParsedSchemaField[];
  example?: Record<string, unknown>;
}

export interface ParsedEndpoint {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  tag: string;
  deprecated: boolean;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  security?: string[];
}

export interface ParsedSpec {
  title: string;
  version: string;
  description: string;
  endpoints: ParsedEndpoint[];
  tagGroups: { tag: string; endpointCount: number }[];
  servers: ParsedServer[];
  securitySchemes: Record<string, ParsedSecurityScheme>;
  security?: string[];
  /** Non-blocking schema validation warnings (empty if spec is fully valid). */
  warnings?: string[];
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

function getSchemaType(schema: OpenAPIV3.SchemaObject | undefined): string {
  if (!schema) return "unknown";
  if (schema.type === "array" && schema.items) {
    const itemType = getSchemaType(schema.items as OpenAPIV3.SchemaObject);
    return `${itemType}[]`;
  }
  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }
  return schema.type || (schema.properties ? "object" : "unknown");
}

function flattenSchemaFields(
  schema: OpenAPIV3.SchemaObject | undefined,
  requiredFields: string[] = [],
  depth: number = 0
): ParsedSchemaField[] {
  if (!schema || depth > 3) return [];

  const fields: ParsedSchemaField[] = [];

  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as OpenAPIV3.SchemaObject;
      const field: ParsedSchemaField = {
        name,
        type: getSchemaType(prop),
        required: requiredFields.includes(name),
        description: prop.description || "",
      };

      // Recurse into nested objects
      if (prop.type === "object" && prop.properties && depth < 3) {
        field.children = flattenSchemaFields(
          prop,
          prop.required || [],
          depth + 1
        );
      }

      // Recurse into array items if they are objects
      if (prop.type === "array" && prop.items) {
        const items = prop.items as OpenAPIV3.SchemaObject;
        if (items.type === "object" && items.properties && depth < 3) {
          field.children = flattenSchemaFields(
            items,
            items.required || [],
            depth + 1
          );
        }
      }

      fields.push(field);
    }
  }

  return fields;
}

function extractParameters(
  params: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] | undefined
): ParsedParameter[] {
  if (!params) return [];

  return params
    .filter((p): p is OpenAPIV3.ParameterObject => !("$ref" in p))
    .map((param) => {
      const schema = param.schema as OpenAPIV3.SchemaObject | undefined;
      const result: ParsedParameter = {
        name: param.name,
        in: param.in as ParsedParameter["in"],
        type: getSchemaType(schema),
        required: param.required ?? false,
        description: param.description || "",
      };
      const example = param.example ?? schema?.example;
      if (example !== undefined) result.example = example;
      const defaultVal = schema?.default;
      if (defaultVal !== undefined) result.default = defaultVal;
      return result;
    });
}

function synthesizeExample(
  schema: OpenAPIV3.SchemaObject | undefined,
  depth: number = 0
): Record<string, unknown> | unknown[] | undefined {
  if (!schema || depth > 3) return undefined;

  if (schema.type === "array" && schema.items) {
    const items = schema.items as OpenAPIV3.SchemaObject;
    const itemExample = items.example ?? synthesizeExample(items, depth + 1);
    if (itemExample !== undefined) return [itemExample];
    return undefined;
  }

  if (!schema.properties) return undefined;

  const obj: Record<string, unknown> = {};
  let hasAny = false;

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as OpenAPIV3.SchemaObject;
    if (prop.example !== undefined) {
      obj[name] = prop.example;
      hasAny = true;
    } else if (prop.default !== undefined) {
      obj[name] = prop.default;
      hasAny = true;
    } else if (prop.type === "object" && prop.properties && depth < 3) {
      const nested = synthesizeExample(prop, depth + 1);
      if (nested !== undefined) {
        obj[name] = nested;
        hasAny = true;
      }
    } else if (prop.type === "array" && prop.items && depth < 3) {
      const items = prop.items as OpenAPIV3.SchemaObject;
      const itemEx = items.example ?? synthesizeExample(items, depth + 1);
      if (itemEx !== undefined) {
        obj[name] = [itemEx];
        hasAny = true;
      }
    }
  }

  return hasAny ? obj : undefined;
}

function extractExampleFromMediaType(
  mediaType: OpenAPIV3.MediaTypeObject | undefined,
  schema: OpenAPIV3.SchemaObject | undefined
): Record<string, unknown> | undefined {
  if (!mediaType) return undefined;

  // 1. Direct example (singular)
  if (mediaType.example !== undefined) {
    return normalizeExample(mediaType.example);
  }

  // 2. Examples (plural) — OpenAPI 3.0 named examples map
  if (mediaType.examples) {
    const firstKey = Object.keys(mediaType.examples)[0];
    if (firstKey) {
      const entry = mediaType.examples[firstKey];
      if (entry && !("$ref" in entry) && entry.value !== undefined) {
        return normalizeExample(entry.value);
      }
    }
  }

  // 3. Schema-level example
  if (schema?.example !== undefined) {
    return normalizeExample(schema.example);
  }

  // 4. Synthesize from property-level examples
  return synthesizeExample(schema) as Record<string, unknown> | undefined;
}

function normalizeExample(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;

  // If it's already an object, use it directly
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  // If it's a JSON string, try to parse it
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not valid JSON
    }
  }

  return undefined;
}

function extractRequestBody(
  body: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined
): ParsedRequestBody | undefined {
  if (!body || "$ref" in body) return undefined;

  const content = body.content;
  const contentType =
    Object.keys(content).find((ct) => ct.includes("json")) ||
    Object.keys(content)[0];

  if (!contentType) return undefined;

  const mediaType = content[contentType];
  const schema = mediaType?.schema as OpenAPIV3.SchemaObject | undefined;

  const result: ParsedRequestBody = {
    contentType,
    fields: flattenSchemaFields(schema, schema?.required || []),
  };

  if (schema) {
    result.schema = schema as unknown as Record<string, unknown>;
  }
  const example = extractExampleFromMediaType(mediaType, schema);
  if (example !== undefined) {
    result.example = example;
  }

  return result;
}

function extractResponses(
  responses: OpenAPIV3.ResponsesObject | undefined
): ParsedResponse[] {
  if (!responses) return [];

  const result: ParsedResponse[] = [];

  for (const [statusCode, responseOrRef] of Object.entries(responses)) {
    if ("$ref" in responseOrRef) continue;
    const response = responseOrRef as OpenAPIV3.ResponseObject;

    let fields: ParsedSchemaField[] = [];
    let example: Record<string, unknown> | undefined;
    if (response.content) {
      const contentType =
        Object.keys(response.content).find((ct) => ct.includes("json")) ||
        Object.keys(response.content)[0];
      if (contentType) {
        const mediaType = response.content[contentType];
        const schema = mediaType?.schema as
          | OpenAPIV3.SchemaObject
          | undefined;
        fields = flattenSchemaFields(schema, schema?.required || []);
        const ex = extractExampleFromMediaType(mediaType, schema);
        if (ex !== undefined) example = ex;
      }
    }

    const parsed: ParsedResponse = {
      statusCode,
      description: response.description || "",
      fields,
    };
    if (example !== undefined) parsed.example = example;
    result.push(parsed);
  }

  return result;
}

export async function parseOpenApiSpec(
  specContent: string
): Promise<ParsedSpec> {
  // Parse the content (SwaggerParser.validate handles JSON and parsed objects)
  let specObj: OpenAPI.Document;
  try {
    specObj = JSON.parse(specContent);
  } catch {
    // Try YAML
    const yaml = await import("yaml");
    specObj = yaml.parse(specContent);
  }

  // Always dereference $refs — this resolves references without enforcing
  // strict schema compliance, so functional specs with minor metadata issues
  // (e.g. missing optional license fields) are never blocked.
  const api = (await SwaggerParser.dereference(
    specObj as OpenAPIV3.Document
  )) as OpenAPIV3.Document;

  // Collect non-blocking validation warnings by running strict validate in a
  // try/catch on a fresh copy of the parsed object. Validation failure must
  // never prevent the spec from being imported.
  const warnings: string[] = [];
  try {
    // Re-parse to get a fresh object (validate mutates in-place)
    let freshObj: OpenAPI.Document;
    try {
      freshObj = JSON.parse(specContent);
    } catch {
      const yaml = await import("yaml");
      freshObj = yaml.parse(specContent);
    }
    await SwaggerParser.validate(freshObj as OpenAPIV3.Document);
  } catch (err) {
    if (err instanceof Error && err.message) {
      warnings.push(err.message);
    }
  }

  // Extract servers
  const servers: ParsedServer[] = (api.servers || []).map((s) => ({
    url: s.url,
    description: s.description || "",
  }));

  // Extract security schemes
  const securitySchemes: Record<string, ParsedSecurityScheme> = {};
  const components = api.components as OpenAPIV3.ComponentsObject | undefined;
  if (components?.securitySchemes) {
    for (const [name, schemeOrRef] of Object.entries(
      components.securitySchemes
    )) {
      if ("$ref" in schemeOrRef) continue;
      const scheme = schemeOrRef as OpenAPIV3.SecuritySchemeObject;
      if (
        scheme.type === "apiKey" ||
        scheme.type === "http" ||
        scheme.type === "oauth2"
      ) {
        const parsed: ParsedSecurityScheme = { type: scheme.type };
        if (scheme.type === "http") {
          parsed.scheme = scheme.scheme;
          if ("bearerFormat" in scheme)
            parsed.bearerFormat = scheme.bearerFormat;
        }
        if (scheme.type === "apiKey") {
          parsed.name = (scheme as OpenAPIV3.ApiKeySecurityScheme).name;
          parsed.in = (scheme as OpenAPIV3.ApiKeySecurityScheme).in as
            | "header"
            | "query"
            | "cookie";
        }
        securitySchemes[name] = parsed;
      }
    }
  }

  // Extract global security requirements
  const globalSecurity = api.security
    ? api.security.flatMap((req) => Object.keys(req))
    : undefined;

  const endpoints: ParsedEndpoint[] = [];
  const tagCounts: Record<string, number> = {};

  for (const [path, pathItem] of Object.entries(api.paths || {})) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tag = operation.tags?.[0] || "Default";
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;

      // Merge path-level and operation-level parameters
      const allParams = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
      ];

      // Per-endpoint security
      const endpointSecurity = operation.security
        ? operation.security.flatMap((req) => Object.keys(req))
        : undefined;

      const endpoint: ParsedEndpoint = {
        operationId:
          operation.operationId ||
          `${method}_${path.replace(/[/{}/]/g, "_")}`,
        method: method.toUpperCase() as ParsedEndpoint["method"],
        path,
        summary: operation.summary || "",
        description: operation.description || "",
        tag,
        deprecated: operation.deprecated || false,
        parameters: extractParameters(allParams),
        requestBody: extractRequestBody(operation.requestBody),
        responses: extractResponses(operation.responses),
      };
      if (endpointSecurity) endpoint.security = endpointSecurity;

      endpoints.push(endpoint);
    }
  }

  const tagGroups = Object.entries(tagCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, count]) => ({ tag, endpointCount: count }));

  const result: ParsedSpec = {
    title: api.info?.title || "API Reference",
    version: api.info?.version || "1.0.0",
    description: api.info?.description || "",
    endpoints,
    tagGroups,
    servers,
    securitySchemes,
  };
  if (globalSecurity) result.security = globalSecurity;
  if (warnings.length > 0) result.warnings = warnings;

  return result;
}
