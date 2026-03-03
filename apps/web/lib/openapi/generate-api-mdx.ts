import type {
  ParsedEndpoint,
  ParsedSchemaField,
  ParsedSecurityScheme,
  ParsedServer,
  ParsedSpec,
} from "./parse-spec";

interface GeneratedFile {
  file: string;
  data: string;
}

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

interface SearchDocument {
  id: string;
  title: string;
  headings: string;
  content: string;
  codeBlocks: string;
  path: string;
  excerpt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function endpointSlug(method: string, path: string): string {
  const pathPart = path
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${method.toLowerCase()}-${pathPart}`;
}

function generateEndpointMdx(endpoint: ParsedEndpoint): string {
  const lines: string[] = [];

  // Frontmatter
  const title = endpoint.summary || `${endpoint.method} ${endpoint.path}`;
  lines.push(`---`);
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  lines.push(`---`);
  lines.push("");

  // ApiEndpoint wrapper — all param/response/playground data comes from playground JSON
  const deprecatedAttr = endpoint.deprecated ? " deprecated" : "";
  lines.push(
    `<ApiEndpoint method="${endpoint.method}" path="${endpoint.path}"${deprecatedAttr}>`
  );
  lines.push("");

  if (endpoint.description) {
    lines.push(endpoint.description);
    lines.push("");
  }

  lines.push("</ApiEndpoint>");

  return lines.join("\n");
}

function generateTagIndexMdx(
  tag: string,
  endpoints: ParsedEndpoint[]
): string {
  const lines: string[] = [];

  lines.push(`---`);
  lines.push(`title: "${tag.replace(/"/g, '\\"')}"`);
  lines.push(`---`);
  lines.push("");
  lines.push(`# ${tag}`);
  lines.push("");
  lines.push(`This section contains ${endpoints.length} endpoint${endpoints.length !== 1 ? "s" : ""}.`);
  lines.push("");

  // List endpoints as cards
  lines.push(`<CardGroup cols={2}>`);
  for (const ep of endpoints) {
    const title = ep.summary || `${ep.method} ${ep.path}`;
    const slug = endpointSlug(ep.method, ep.path);
    lines.push(
      `<Card title="${title.replace(/"/g, '\\"')}" href="/docs/${slugify(tag)}/${slug}">`
    );
    lines.push(
      `\`${ep.method}\` ${ep.path}${ep.deprecated ? " *(deprecated)*" : ""}`
    );
    lines.push(`</Card>`);
  }
  lines.push(`</CardGroup>`);

  return lines.join("\n");
}

export function generateApiReferenceMdx(
  spec: ParsedSpec,
  basePath: string = "/api-reference"
): {
  files: GeneratedFile[];
  navigation: NavItem[];
  searchDocuments: SearchDocument[];
} {
  const files: GeneratedFile[] = [];
  const navigation: NavItem[] = [];
  const searchDocuments: SearchDocument[] = [];

  // Normalize basePath: strip leading slash for file paths
  const basePathClean = basePath.replace(/^\//, "");

  // Group endpoints by tag
  const endpointsByTag: Record<string, ParsedEndpoint[]> = {};
  for (const endpoint of spec.endpoints) {
    const tag = endpoint.tag;
    if (!endpointsByTag[tag]) {
      endpointsByTag[tag] = [];
    }
    endpointsByTag[tag].push(endpoint);
  }

  // Generate API reference index page
  const indexLines: string[] = [];
  indexLines.push(`---`);
  indexLines.push(`title: "API Reference"`);
  indexLines.push(`---`);
  indexLines.push("");
  indexLines.push(`# ${spec.title} - API Reference`);
  indexLines.push("");
  if (spec.description) {
    indexLines.push(spec.description);
    indexLines.push("");
  }
  indexLines.push(`**Version:** ${spec.version}`);
  indexLines.push("");

  // Show tag overview
  indexLines.push(`<CardGroup cols={2}>`);
  for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
    const tagSlug = slugify(tag);
    indexLines.push(
      `<Card title="${tag.replace(/"/g, '\\"')}" href="/docs/${basePathClean}/${tagSlug}">`
    );
    indexLines.push(`${endpoints.length} endpoint${endpoints.length !== 1 ? "s" : ""}`);
    indexLines.push(`</Card>`);
  }
  indexLines.push(`</CardGroup>`);

  files.push({
    file: `docs/${basePathClean}/index.mdx`,
    data: indexLines.join("\n"),
  });

  // _meta.json for the api-reference directory
  const metaEntries: Record<string, string> = {
    index: "Overview",
  };

  // Generate per-tag groups
  for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
    const tagSlug = slugify(tag);
    metaEntries[tagSlug] = tag;

    // Tag index page
    files.push({
      file: `docs/${basePathClean}/${tagSlug}.mdx`,
      data: generateTagIndexMdx(tag, endpoints),
    });

    // Per-tag _meta.json
    const tagMeta: Record<string, string> = {};

    // Navigation items for this tag
    const tagNavChildren: NavItem[] = [];

    // Generate endpoint pages
    for (const endpoint of endpoints) {
      const epSlug = endpointSlug(endpoint.method, endpoint.path);
      tagMeta[epSlug] =
        endpoint.summary || `${endpoint.method} ${endpoint.path}`;

      const mdx = generateEndpointMdx(endpoint);
      files.push({
        file: `docs/${basePathClean}/${tagSlug}/${epSlug}.mdx`,
        data: mdx,
      });

      tagNavChildren.push({
        title:
          endpoint.summary || `${endpoint.method} ${endpoint.path}`,
        href: `/docs/${basePathClean}/${tagSlug}/${epSlug}`,
      });

      // Search document for this endpoint
      const searchTitle =
        endpoint.summary || `${endpoint.method} ${endpoint.path}`;
      searchDocuments.push({
        id: `/docs/${basePathClean}/${tagSlug}/${epSlug}`,
        title: searchTitle,
        headings: [
          searchTitle,
          ...(endpoint.parameters.length > 0 ? ["Parameters"] : []),
          ...(endpoint.requestBody ? ["Request Body"] : []),
          ...endpoint.responses.map((r) => `Response ${r.statusCode}`),
        ].join(" | "),
        content: [
          endpoint.description,
          endpoint.method,
          endpoint.path,
          ...endpoint.parameters.map((p) => `${p.name} ${p.description}`),
          ...(endpoint.requestBody?.fields.map((f) => f.name) || []),
        ]
          .filter(Boolean)
          .join(" "),
        codeBlocks: `${endpoint.method} ${endpoint.path}`,
        path: `/docs/${basePathClean}/${tagSlug}/${epSlug}`,
        excerpt: endpoint.description?.slice(0, 200) || `${endpoint.method} ${endpoint.path}`,
      });
    }

    // Tag _meta.json
    files.push({
      file: `docs/${basePathClean}/${tagSlug}/_meta.json`,
      data: JSON.stringify(tagMeta, null, 2),
    });

    // Navigation entry for tag
    navigation.push({
      title: tag,
      href: `/docs/${basePathClean}/${tagSlug}`,
      children: tagNavChildren,
    });
  }

  // Root _meta.json for api-reference dir
  files.push({
    file: `docs/${basePathClean}/_meta.json`,
    data: JSON.stringify(metaEntries, null, 2),
  });

  // Search document for index page
  searchDocuments.push({
    id: `/docs/${basePathClean}`,
    title: `${spec.title} - API Reference`,
    headings: "API Reference",
    content: `${spec.title} API Reference ${spec.description || ""} Version ${spec.version}`,
    codeBlocks: "",
    path: `/docs/${basePathClean}`,
    excerpt: spec.description?.slice(0, 200) || `API Reference for ${spec.title}`,
  });

  return { files, navigation, searchDocuments };
}

// --- Playground Data Generation ---

interface PlaygroundField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  children?: PlaygroundField[];
}

interface PlaygroundParam {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  type: string;
  required: boolean;
  description: string;
  example?: unknown;
  default?: unknown;
}

interface PlaygroundEndpoint {
  operationId: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  deprecated: boolean;
  security?: string[];
  parameters: PlaygroundParam[];
  requestBody?: {
    contentType: string;
    schema?: Record<string, unknown>;
    example?: Record<string, unknown>;
    fields: PlaygroundField[];
  };
  responses: Record<
    string,
    {
      description: string;
      example?: Record<string, unknown>;
      fields: PlaygroundField[];
    }
  >;
}

interface PlaygroundData {
  servers: ParsedServer[];
  auth: Record<string, ParsedSecurityScheme>;
  defaultAuth?: string[];
  endpoints: Record<string, PlaygroundEndpoint>;
}

function toPlaygroundField(field: ParsedSchemaField): PlaygroundField {
  const pf: PlaygroundField = {
    name: field.name,
    type: field.type,
    required: field.required,
    description: field.description,
  };
  if (field.children && field.children.length > 0) {
    pf.children = field.children.map(toPlaygroundField);
  }
  return pf;
}

export function generatePlaygroundData(spec: ParsedSpec): string {
  const endpoints: Record<string, PlaygroundEndpoint> = {};

  for (const ep of spec.endpoints) {
    const key = `${ep.method} ${ep.path}`;

    const params: PlaygroundParam[] = ep.parameters.map((p) => {
      const param: PlaygroundParam = {
        name: p.name,
        in: p.in,
        type: p.type,
        required: p.required,
        description: p.description,
      };
      if (p.example !== undefined) param.example = p.example;
      if (p.default !== undefined) param.default = p.default;
      return param;
    });

    const responses: Record<
      string,
      { description: string; example?: Record<string, unknown>; fields: PlaygroundField[] }
    > = {};
    for (const r of ep.responses) {
      const entry: { description: string; example?: Record<string, unknown>; fields: PlaygroundField[] } =
        { description: r.description, fields: r.fields.map(toPlaygroundField) };
      if (r.example !== undefined) entry.example = r.example;
      responses[r.statusCode] = entry;
    }

    const endpoint: PlaygroundEndpoint = {
      operationId: ep.operationId,
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
      deprecated: ep.deprecated,
      parameters: params,
      responses,
    };

    if (ep.security) endpoint.security = ep.security;

    if (ep.requestBody) {
      endpoint.requestBody = {
        contentType: ep.requestBody.contentType,
        fields: ep.requestBody.fields.map(toPlaygroundField),
      };
      if (ep.requestBody.schema)
        endpoint.requestBody.schema = ep.requestBody.schema;
      if (ep.requestBody.example)
        endpoint.requestBody.example = ep.requestBody.example;
    }

    endpoints[key] = endpoint;
  }

  const data: PlaygroundData = {
    servers: spec.servers,
    auth: spec.securitySchemes,
    endpoints,
  };
  if (spec.security) data.defaultAuth = spec.security;

  return JSON.stringify(data, null, 2);
}
