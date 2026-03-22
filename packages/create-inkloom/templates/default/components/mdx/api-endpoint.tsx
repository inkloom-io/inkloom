import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSiteData } from "../../src/data-provider";
import { getAuthConfig, setAuthConfig } from "../../lib/api-auth-store";
import type { AuthConfig } from "../../lib/api-auth-store";
import {
  generateCurl,
  generateJavaScript,
  generatePython,
} from "../../lib/code-samples";
import type { RequestConfig } from "../../lib/code-samples";

// --- Types matching api-playground.json ---

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

interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2";
  scheme?: string;
  name?: string;
  in?: "header" | "query" | "cookie";
  bearerFormat?: string;
}

interface PlaygroundData {
  servers: { url: string; description: string }[];
  auth: Record<string, SecurityScheme>;
  defaultAuth?: string[];
  endpoints: Record<string, PlaygroundEndpoint>;
}

// --- Data loading (singleton) ---

let cachedData: PlaygroundData | null = null;
let loadPromise: Promise<PlaygroundData | null> | null = null;

function loadPlaygroundData(): Promise<PlaygroundData | null> {
  if (cachedData) return Promise.resolve(cachedData);
  if (loadPromise) return loadPromise;
  loadPromise = fetch("/api-playground.json")
    .then((res) => {
      if (!res.ok) return null;
      return res.json() as Promise<PlaygroundData>;
    })
    .then((data) => {
      cachedData = data;
      return data;
    })
    .catch(() => null);
  return loadPromise;
}

// --- Helpers ---

function authConfigFromScheme(
  scheme: SecurityScheme,
  _name: string
): AuthConfig {
  if (scheme.type === "http" && scheme.scheme === "bearer") {
    return { type: "bearer" };
  }
  if (scheme.type === "http" && scheme.scheme === "basic") {
    return { type: "basic" };
  }
  if (scheme.type === "apiKey") {
    return {
      type: "apiKey",
      apiKeyName: scheme.name,
      apiKeyIn: scheme.in,
    };
  }
  if (scheme.type === "oauth2") {
    return { type: "bearer" };
  }
  return { type: "none" };
}

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// --- Sub-components ---

function RouteCard({
  method,
  path,
  deprecated,
}: {
  method: string;
  path: string;
  deprecated?: boolean;
}) {
  const methodUpper = method.toUpperCase();
  const badgeClass =
    ({
      GET: "api-method-get",
      POST: "api-method-post",
      PUT: "api-method-put",
      PATCH: "api-method-patch",
      DELETE: "api-method-delete",
    } as Record<string, string>)[methodUpper] || "api-method-get";

  return (
    <div className="api-dark-panel api-route-card">
      <span className={`api-method-badge ${badgeClass}`}>{methodUpper}</span>
      <code className="api-route-card-path">{path}</code>
      {deprecated && (
        <span className="api-deprecated-badge">Deprecated</span>
      )}
    </div>
  );
}

function CodeSamplesPanel({
  config,
}: {
  config: RequestConfig | null;
}) {
  const [activeTab, setActiveTab] = useState<"curl" | "javascript" | "python">(
    "curl"
  );
  const [copied, setCopied] = useState(false);

  const codeSample = (() => {
    if (!config) return "";
    switch (activeTab) {
      case "curl":
        return generateCurl(config);
      case "javascript":
        return generateJavaScript(config);
      case "python":
        return generatePython(config);
    }
  })();

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(codeSample).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [codeSample]);

  if (!config) return null;

  return (
    <div className="api-dark-panel api-code-samples">
      <div className="api-dark-panel-header">
        <div className="api-code-tabs">
          {(["curl", "javascript", "python"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`api-code-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "curl"
                ? "cURL"
                : tab === "javascript"
                  ? "JavaScript"
                  : "Python"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="api-dark-panel-copy"
          onClick={copyCode}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="api-dark-panel-code">
        <code>{codeSample}</code>
      </pre>
    </div>
  );
}

function ExamplePanel({
  title,
  example,
}: {
  title: string;
  example?: Record<string, unknown>;
}) {
  const [copied, setCopied] = useState(false);
  const formatted = example ? JSON.stringify(example, null, 2) : "";

  const copyCode = useCallback(() => {
    if (!formatted) return;
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [formatted]);

  if (!example) return null;

  return (
    <div className="api-dark-panel api-example-panel">
      <div className="api-dark-panel-header">
        <span className="api-dark-panel-title">{title}</span>
        <button
          type="button"
          className="api-dark-panel-copy"
          onClick={copyCode}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="api-dark-panel-code">
        <code>{formatted}</code>
      </pre>
    </div>
  );
}

function FieldDocItem({ field, depth = 0 }: { field: PlaygroundField; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = field.children && field.children.length > 0;

  return (
    <div className="api-field-doc">
      <div className="api-field-doc-header">
        <code className="api-param-name">{field.name}</code>
        <span className="api-param-type">{field.type}</span>
        {field.required && (
          <span className="api-param-required">required</span>
        )}
      </div>
      {field.description && (
        <div className="api-param-description">{field.description}</div>
      )}
      {hasChildren && (
        <>
          <button
            type="button"
            className="api-field-expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="api-field-expand-chevron">
              {expanded ? "▼" : "▶"}
            </span>
            {expanded ? "Hide" : "Show"} {field.children!.length} nested{" "}
            {field.children!.length === 1 ? "field" : "fields"}
          </button>
          {expanded && (
            <div className="api-field-doc-children">
              {field.children!.map((child) => (
                <FieldDocItem key={child.name} field={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FieldDocs({
  title,
  fields,
  paramLocation,
}: {
  title: string;
  fields: PlaygroundField[] | PlaygroundParam[];
  paramLocation?: boolean;
}) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="api-field-docs-section">
      <h3 className="api-field-docs-title">{title}</h3>
      <div className="api-field-docs-list">
        {fields.map((field) => (
          <div key={field.name} className="api-field-doc">
            <div className="api-field-doc-header">
              <code className="api-param-name">{field.name}</code>
              <span className="api-param-type">{field.type}</span>
              {paramLocation && "in" in field && (
                <span className="api-param-location">{field.in}</span>
              )}
              {field.required && (
                <span className="api-param-required">required</span>
              )}
            </div>
            {field.description && (
              <div className="api-param-description">{field.description}</div>
            )}
            {"children" in field &&
              field.children &&
              field.children.length > 0 && (
                <FieldDocItemNested fields={field.children} />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldDocItemNested({ fields }: { fields: PlaygroundField[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        className="api-field-expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="api-field-expand-chevron">
          {expanded ? "▼" : "▶"}
        </span>
        {expanded ? "Hide" : "Show"} {fields.length} nested{" "}
        {fields.length === 1 ? "field" : "fields"}
      </button>
      {expanded && (
        <div className="api-field-doc-children">
          {fields.map((child) => (
            <FieldDocItem key={child.name} field={child} depth={1} />
          ))}
        </div>
      )}
    </>
  );
}

function TryItSection({
  data,
  endpoint,
  selectedServer,
  setSelectedServer,
  authConfig,
  updateAuth,
  paramValues,
  updateParam,
  requestBody,
  setRequestBody,
  bodyFieldValues,
  setBodyFieldValues,
  sendRequest,
  loading,
  error,
  response,
}: {
  data: PlaygroundData;
  endpoint: PlaygroundEndpoint;
  selectedServer: number;
  setSelectedServer: (v: number) => void;
  authConfig: AuthConfig;
  updateAuth: (c: AuthConfig) => void;
  paramValues: Record<string, string>;
  updateParam: (name: string, value: string) => void;
  requestBody: string;
  setRequestBody: (v: string) => void;
  bodyFieldValues: Record<string, string>;
  setBodyFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sendRequest: () => void;
  loading: boolean;
  error: string | null;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    time: number;
  } | null;
}) {
  const hasServers = data.servers.length > 0;
  const hasAuth = Object.keys(data.auth).length > 0;
  const hasParams = endpoint.parameters.length > 0;
  const hasRequestBody =
    endpoint.requestBody &&
    !["GET", "HEAD"].includes(endpoint.method.toUpperCase());

  return (
    <div className="api-tryit-section">
      <h3 className="api-field-docs-title">Try It</h3>

      {/* Server selector */}
      {hasServers && data.servers.length > 1 && (
        <div className="api-tryit-field">
          <label className="api-tryit-label">Server</label>
          <select
            className="api-tryit-select"
            value={selectedServer}
            onChange={(e) => setSelectedServer(Number(e.target.value))}
          >
            {data.servers.map((s, i) => (
              <option key={i} value={i}>
                {s.url}
                {s.description ? ` \u2014 ${s.description}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Authentication */}
      {hasAuth && (
        <div className="api-tryit-field">
          <label className="api-tryit-label">Authentication</label>
          <div className="api-tryit-auth">
            <select
              className="api-tryit-select api-tryit-auth-type"
              value={authConfig.type}
              onChange={(e) => {
                const type = e.target.value as AuthConfig["type"];
                updateAuth({ ...authConfig, type });
              }}
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="apiKey">API Key</option>
              <option value="basic">Basic Auth</option>
            </select>

            {authConfig.type === "bearer" && (
              <input
                type="text"
                className="api-tryit-input"
                placeholder="Enter token..."
                value={authConfig.token || ""}
                onChange={(e) =>
                  updateAuth({ ...authConfig, token: e.target.value })
                }
              />
            )}

            {authConfig.type === "apiKey" && (
              <input
                type="text"
                className="api-tryit-input"
                placeholder="Enter API key..."
                value={authConfig.apiKey || ""}
                onChange={(e) =>
                  updateAuth({ ...authConfig, apiKey: e.target.value })
                }
              />
            )}

            {authConfig.type === "basic" && (
              <div className="api-tryit-basic-auth">
                <input
                  type="text"
                  className="api-tryit-input"
                  placeholder="Username"
                  value={authConfig.username || ""}
                  onChange={(e) =>
                    updateAuth({ ...authConfig, username: e.target.value })
                  }
                />
                <input
                  type="password"
                  className="api-tryit-input"
                  placeholder="Password"
                  value={authConfig.password || ""}
                  onChange={(e) =>
                    updateAuth({ ...authConfig, password: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parameters */}
      {hasParams && (
        <div className="api-tryit-field">
          <label className="api-tryit-label">Parameters</label>
          <div className="api-tryit-params">
            {endpoint.parameters.map((p) => (
              <div key={p.name} className="api-tryit-param">
                <div className="api-tryit-param-info">
                  <code className="api-tryit-param-name">{p.name}</code>
                  <span className="api-tryit-param-meta">
                    {p.in}
                    {p.required && (
                      <span className="api-tryit-param-required">*</span>
                    )}
                  </span>
                </div>
                <input
                  type="text"
                  className="api-tryit-input"
                  placeholder={
                    p.example !== undefined
                      ? String(p.example)
                      : p.description || p.name
                  }
                  value={paramValues[p.name] || ""}
                  onChange={(e) => updateParam(p.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {hasRequestBody && endpoint.requestBody && endpoint.requestBody.fields.length > 0 && (
        <div className="api-tryit-field">
          <label className="api-tryit-label">Request Body</label>
          <div className="api-tryit-params">
            {endpoint.requestBody.fields.map((f) => (
              <div key={f.name} className="api-tryit-param">
                <div className="api-tryit-param-info">
                  <code className="api-tryit-param-name">{f.name}</code>
                  <span className="api-tryit-param-meta">
                    {f.type}
                    {f.required && (
                      <span className="api-tryit-param-required">*</span>
                    )}
                  </span>
                </div>
                <input
                  type="text"
                  className="api-tryit-input"
                  placeholder={f.description || f.name}
                  value={bodyFieldValues[f.name] || ""}
                  onChange={(e) =>
                    setBodyFieldValues((prev) => ({
                      ...prev,
                      [f.name]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Fallback raw textarea for endpoints without structured fields */}
      {hasRequestBody && (!endpoint.requestBody || endpoint.requestBody.fields.length === 0) && (
        <div className="api-tryit-field">
          <label className="api-tryit-label">Request Body</label>
          <textarea
            className="api-tryit-textarea"
            rows={8}
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            placeholder='{ "key": "value" }'
            spellCheck={false}
          />
        </div>
      )}

      {/* Send button */}
      <button
        type="button"
        className="api-tryit-send-btn"
        onClick={sendRequest}
        disabled={loading}
      >
        {loading ? "Sending..." : "Send Request"}
      </button>

      {/* Error */}
      {error && <div className="api-tryit-error">{error}</div>}

      {/* Response */}
      {response && (
        <div className="api-tryit-response">
          <div className="api-tryit-response-header">
            <span
              className={`api-tryit-status api-tryit-status-${Math.floor(response.status / 100)}xx`}
            >
              {response.status} {response.statusText}
            </span>
            <span className="api-tryit-time">{response.time}ms</span>
          </div>
          <pre className="api-tryit-response-body">
            <code>{formatResponseBody(response.body)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

interface ApiEndpointProps {
  method: string;
  path: string;
  deprecated?: boolean;
  children?: React.ReactNode;
}

export function ApiEndpoint({
  method,
  path,
  deprecated,
  children,
}: ApiEndpointProps) {
  const { config: siteConfig } = useSiteData();
  const [data, setData] = useState<PlaygroundData | null>(null);
  const [endpoint, setEndpoint] = useState<PlaygroundEndpoint | null>(null);
  const [selectedServer, setSelectedServer] = useState(0);
  const [authConfig, setAuthState] = useState<AuthConfig>({ type: "none" });
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("");
  const [bodyFieldValues, setBodyFieldValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    time: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load playground data once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    loadPlaygroundData().then((pd) => {
      if (!pd) return;
      setData(pd);

      const key = `${method.toUpperCase()} ${path}`;
      const ep = pd.endpoints[key];
      if (!ep) return;
      setEndpoint(ep);

      // Pre-populate params
      const initial: Record<string, string> = {};
      for (const p of ep.parameters) {
        const val = p.example ?? p.default;
        if (val !== undefined) initial[p.name] = String(val);
      }
      setParamValues(initial);

      // Pre-populate request body
      if (ep.requestBody?.example) {
        setRequestBody(JSON.stringify(ep.requestBody.example, null, 2));
      }

      // Load auth from storage
      const stored = getAuthConfig();
      if (stored.type !== "none") {
        setAuthState(stored);
      } else {
        const securityNames = ep.security || pd.defaultAuth || [];
        if (securityNames.length > 0) {
          const schemeName = securityNames[0]!;
          const scheme = pd.auth[schemeName];
          if (scheme) {
            setAuthState(authConfigFromScheme(scheme, schemeName));
          }
        }
      }
    });
  }, [method, path]);

  const updateAuth = useCallback((config: AuthConfig) => {
    setAuthState(config);
    setAuthConfig(config);
  }, []);

  const updateParam = useCallback((name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Build request config for code samples and sending
  const buildRequestConfig = useCallback((): RequestConfig | null => {
    if (!data || !endpoint) return null;

    const server =
      data.servers[selectedServer]?.url || data.servers[0]?.url || "";
    let url = server.replace(/\/$/, "") + endpoint.path;

    for (const p of endpoint.parameters) {
      if (p.in === "path" && paramValues[p.name]) {
        url = url.replace(
          `{${p.name}}`,
          encodeURIComponent(paramValues[p.name])
        );
      }
    }

    const queryParams = endpoint.parameters.filter(
      (p) => p.in === "query" && paramValues[p.name]
    );
    if (queryParams.length > 0) {
      const qs = queryParams
        .map(
          (p) =>
            `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name]!)}`
        )
        .join("&");
      url += `?${qs}`;
    }

    const headers: Record<string, string> = {};

    if (authConfig.type === "bearer" && authConfig.token) {
      headers["Authorization"] = `Bearer ${authConfig.token}`;
    } else if (authConfig.type === "basic" && authConfig.username) {
      const encoded = btoa(
        `${authConfig.username}:${authConfig.password || ""}`
      );
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (authConfig.type === "apiKey" && authConfig.apiKey) {
      const keyName = authConfig.apiKeyName || "X-API-Key";
      if (authConfig.apiKeyIn === "query") {
        const sep = url.includes("?") ? "&" : "?";
        url += `${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(authConfig.apiKey)}`;
      } else {
        headers[keyName] = authConfig.apiKey;
      }
    }

    for (const p of endpoint.parameters) {
      if (p.in === "header" && paramValues[p.name]) {
        headers[p.name] = paramValues[p.name]!;
      }
    }

    // Build body from named fields or fallback to raw textarea
    let bodyString: string | undefined;
    const isBodyMethod = !["GET", "HEAD"].includes(endpoint.method.toUpperCase());

    if (isBodyMethod && endpoint.requestBody && endpoint.requestBody.fields.length > 0) {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(bodyFieldValues)) {
        if (value) {
          const field = endpoint.requestBody.fields.find((f) => f.name === key);
          if (field?.type === "integer" || field?.type === "number") {
            body[key] = Number(value);
          } else if (field?.type === "boolean") {
            body[key] = value === "true";
          } else {
            body[key] = value;
          }
        }
      }
      if (Object.keys(body).length > 0) {
        bodyString = JSON.stringify(body);
      }
    } else if (isBodyMethod && requestBody) {
      bodyString = requestBody;
    }

    if (bodyString) {
      headers["Content-Type"] =
        endpoint.requestBody?.contentType || "application/json";
    }

    return {
      url,
      method: endpoint.method,
      headers,
      body: bodyString,
    };
  }, [data, endpoint, selectedServer, paramValues, authConfig, requestBody, bodyFieldValues]);

  const sendRequest = useCallback(async () => {
    const config = buildRequestConfig();
    if (!config) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    const start = performance.now();
    const proxyUrl = siteConfig.proxyUrl;

    try {
      if (proxyUrl) {
        // Route through CORS proxy worker
        const proxyRes = await fetch(`${proxyUrl.replace(/\/$/, "")}/proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: config.url,
            method: config.method.toUpperCase(),
            headers: config.headers,
            body: config.body || undefined,
          }),
        });

        const time = Math.round(performance.now() - start);

        if (!proxyRes.ok) {
          const errBody = await proxyRes.json().catch(() => ({ error: "Proxy request failed" }));
          setError((errBody as { error?: string }).error || `Proxy error: ${proxyRes.status}`);
          return;
        }

        const envelope = await proxyRes.json() as {
          status: number;
          statusText: string;
          headers: Record<string, string>;
          body: string;
        };

        setResponse({
          status: envelope.status,
          statusText: envelope.statusText,
          headers: envelope.headers,
          body: envelope.body,
          time,
        });
      } else {
        // Direct fetch (may fail due to CORS on static sites)
        const fetchHeaders: Record<string, string> = { ...config.headers };
        const res = await fetch(config.url, {
          method: config.method.toUpperCase(),
          headers: fetchHeaders,
          body: config.body || undefined,
        });

        const time = Math.round(performance.now() - start);
        const body = await res.text();

        setResponse({
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          body,
          time,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [buildRequestConfig, siteConfig.proxyUrl]);

  const requestConfig = buildRequestConfig();

  // Gather data for right column
  const requestExample = endpoint?.requestBody?.example;

  // Build parameter example from individual param examples
  const hasAnyParamExample = endpoint
    ? endpoint.parameters.some(
        (p) => p.example !== undefined || p.default !== undefined
      )
    : false;
  const paramExample =
    endpoint && hasAnyParamExample
      ? Object.fromEntries(
          endpoint.parameters.map((p) => [
            p.name,
            p.example ?? p.default ?? `<${p.type}>`,
          ])
        )
      : undefined;

  // Collect all response examples
  const responseExamples = endpoint
    ? Object.entries(endpoint.responses)
        .filter(([, r]) => r.example)
        .map(([code, r]) => ({ code, example: r.example! }))
    : [];

  // Collect all response field docs
  const responseEntries = endpoint
    ? Object.entries(endpoint.responses).filter(
        ([, r]) => r.fields && r.fields.length > 0
      )
    : [];

  // Fallback: if no playground data, render children only (backward compat)
  if (!endpoint) {
    const methodUpper = method.toUpperCase();
    const badgeClass =
      ({
        GET: "api-method-get",
        POST: "api-method-post",
        PUT: "api-method-put",
        PATCH: "api-method-patch",
        DELETE: "api-method-delete",
      } as Record<string, string>)[methodUpper] || "api-method-get";

    return (
      <div className={`api-endpoint ${deprecated ? "api-deprecated" : ""}`}>
        <div className="api-endpoint-header-fallback">
          <span className={`api-method-badge ${badgeClass}`}>
            {methodUpper}
          </span>
          <code className="api-endpoint-path">{path}</code>
          {deprecated && (
            <span className="api-deprecated-badge">Deprecated</span>
          )}
        </div>
        <div className="api-endpoint-body-fallback">{children}</div>
      </div>
    );
  }

  const hasParams = endpoint.parameters.length > 0;
  const hasRequestBody =
    endpoint.requestBody && endpoint.requestBody.fields.length > 0;
  const hasResponses = responseEntries.length > 0;

  return (
    <div className={`api-endpoint-sections ${deprecated ? "api-deprecated" : ""}`}>
      {/* Section 1: Description + Route Card */}
      <div className="api-endpoint-2col">
        <div className="api-2col-primary">
          {children && (
            <div className="api-endpoint-description">{children}</div>
          )}
        </div>
        <div className="api-2col-secondary">
          <RouteCard method={method} path={path} deprecated={deprecated} />
        </div>
      </div>

      {/* Section 2: Try It + Code Samples */}
      {data && (
        <div className="api-endpoint-2col">
          <div className="api-2col-primary">
            <TryItSection
              data={data}
              endpoint={endpoint}
              selectedServer={selectedServer}
              setSelectedServer={setSelectedServer}
              authConfig={authConfig}
              updateAuth={updateAuth}
              paramValues={paramValues}
              updateParam={updateParam}
              requestBody={requestBody}
              setRequestBody={setRequestBody}
              bodyFieldValues={bodyFieldValues}
              setBodyFieldValues={setBodyFieldValues}
              sendRequest={sendRequest}
              loading={loading}
              error={error}
              response={response}
            />
          </div>
          <div className="api-2col-secondary">
            <CodeSamplesPanel config={requestConfig} />
          </div>
        </div>
      )}

      {/* Section 3: Parameters + Param Example */}
      {hasParams && (
        <div className="api-endpoint-2col">
          <div className="api-2col-primary">
            <FieldDocs
              title="Parameters"
              fields={endpoint.parameters}
              paramLocation
            />
          </div>
          <div className="api-2col-secondary">
            <ExamplePanel title="Parameter Example" example={paramExample} />
          </div>
        </div>
      )}

      {/* Section 4: Request Body + Request Example */}
      {hasRequestBody && endpoint.requestBody && (
        <div className="api-endpoint-2col">
          <div className="api-2col-primary">
            <FieldDocs
              title="Request Body"
              fields={endpoint.requestBody.fields}
            />
          </div>
          <div className="api-2col-secondary">
            <ExamplePanel title="Request Example" example={requestExample} />
          </div>
        </div>
      )}

      {/* Section 5: Responses + Response Examples */}
      {hasResponses && (
        <div className="api-endpoint-2col">
          <div className="api-2col-primary">
            {responseEntries.map(([code, r]) => (
              <FieldDocs
                key={code}
                title={`Response ${code}`}
                fields={r.fields}
              />
            ))}
          </div>
          <div className="api-2col-secondary">
            {responseExamples.map(({ code, example }) => (
              <ExamplePanel
                key={code}
                title={`Response ${code}`}
                example={example}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
