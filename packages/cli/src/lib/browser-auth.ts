import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { execFile as execFileCb } from "node:child_process";
import { setToken } from "./credential-store.js";
import { readConfig, writeConfig, resolveConfig } from "./config.js";
import { CliError, EXIT_AUTH, EXIT_GENERAL } from "./errors.js";
import { printSuccess } from "./output.js";
import pc from "picocolors";

// ── Types ───────────────────────────────────────────────────────────────────

interface ExchangeResponse {
  apiKey: string;
  user: { email: string; name?: string };
  org?: { id: string; name: string };
}

// ── Constants ───────────────────────────────────────────────────────────────

const LOGIN_TIMEOUT_MS = 120_000; // 2 minutes
const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>InkLoom CLI — Authenticated</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
    .card { text-align: center; padding: 2rem 3rem; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .check { font-size: 3rem; margin-bottom: 0.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Authentication successful!</h1>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (message: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>InkLoom CLI — Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
    .card { text-align: center; padding: 2rem 3rem; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .icon { font-size: 3rem; margin-bottom: 0.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #c00; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✗</div>
    <h1>Authentication failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

// ── Browser opener ──────────────────────────────────────────────────────────

async function openBrowser(url: string): Promise<boolean> {
  const commands: Record<string, [string, string[]]> = {
    darwin: ["open", [url]],
    linux: ["xdg-open", [url]],
    win32: ["cmd", ["/c", "start", "", url]],
  };

  const entry = commands[process.platform];
  if (!entry) return false;

  const [cmd, args] = entry;
  return new Promise<boolean>((resolve) => {
    const child = execFileCb(cmd, args, (err) => {
      resolve(!err);
    });
    // Detach from child so it doesn't block the CLI
    child.unref?.();
  });
}

// ── Exchange code for API key ───────────────────────────────────────────────

async function exchangeCodeForApiKey(
  apiBaseUrl: string,
  code: string
): Promise<ExchangeResponse> {
  const url = `${apiBaseUrl}/api/cli/auth/exchange`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    let message = `Exchange failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new CliError(message, EXIT_AUTH);
  }

  return (await res.json()) as ExchangeResponse;
}

// ── Main flow ───────────────────────────────────────────────────────────────

/**
 * Run the browser-based login flow:
 * 1. Start a localhost HTTP server on a random port
 * 2. Open browser to the platform auth page
 * 3. Receive callback with a one-time exchange code
 * 4. Exchange the code for an API key
 * 5. Store the key in the credential store
 */
export async function browserLogin(opts?: {
  apiUrl?: string;
  org?: string;
}): Promise<void> {
  const config = await resolveConfig({
    apiUrl: opts?.apiUrl,
    org: opts?.org,
  });
  const apiBaseUrl = config.apiBaseUrl;

  // Generate a random state for CSRF protection
  const state = randomBytes(16).toString("hex");

  // Await the callback result
  const { code } = await startServerAndAwaitCallback(apiBaseUrl, state);

  // Exchange the one-time code for an API key
  process.stderr.write(pc.dim("Exchanging authorization code…") + "\n");
  const result = await exchangeCodeForApiKey(apiBaseUrl, code);

  // Store the API key in the credential store
  await setToken(result.apiKey);

  // Write non-sensitive config
  const fileConfig = readConfig();
  if (result.org) {
    fileConfig.defaultOrgId = result.org.id;
  }
  fileConfig.apiBaseUrl = apiBaseUrl;
  // Remove legacy plaintext token if present
  delete fileConfig.token;
  writeConfig(fileConfig);

  // Print success
  printSuccess(`Logged in as ${result.user.email}`);
  if (result.org) {
    process.stderr.write(`  Organization: ${result.org.name}\n`);
  }
}

// ── Localhost server ────────────────────────────────────────────────────────

function startServerAndAwaitCallback(
  apiBaseUrl: string,
  state: string
): Promise<{ code: string }> {
  return new Promise<{ code: string }>((resolve, reject) => {
    let settled = false;
    let server: Server | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function cleanup(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (server) {
        server.close();
        server = undefined;
      }
    }

    function settle(err: Error | null, result?: { code: string }): void {
      if (settled) return;
      settled = true;
      // Delay cleanup slightly to allow the HTTP response to flush
      setTimeout(cleanup, 200);
      if (err) {
        reject(err);
      } else {
        resolve(result!);
      }
    }

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Only handle GET /callback
      const parsed = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (req.method !== "GET" || parsed.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      const callbackState = parsed.searchParams.get("state");
      const code = parsed.searchParams.get("code");

      // Verify CSRF state
      if (callbackState !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ERROR_HTML("State mismatch. Please try logging in again."));
        settle(
          new CliError("State mismatch — possible CSRF attack. Login aborted.", EXIT_AUTH)
        );
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ERROR_HTML("No authorization code received."));
        settle(
          new CliError("No authorization code received from callback.", EXIT_AUTH)
        );
        return;
      }

      // Success — send response to browser, then resolve with the code
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SUCCESS_HTML);
      settle(null, { code });
    });

    server.listen(0, "127.0.0.1", async () => {
      const addr = server?.address();
      if (!addr || typeof addr === "string") {
        settle(new CliError("Failed to start local auth server.", EXIT_GENERAL));
        return;
      }

      const port = addr.port;
      const authUrl = `${apiBaseUrl}/api/cli/auth?port=${port}&state=${state}`;

      process.stderr.write(pc.dim("Opening browser for authentication…") + "\n");

      const opened = await openBrowser(authUrl);
      if (!opened) {
        process.stderr.write(
          "\n" +
            pc.yellow("Could not open browser automatically.") +
            "\n" +
            "Open this URL in your browser to continue:\n\n" +
            `  ${pc.cyan(authUrl)}\n\n`
        );
      } else {
        process.stderr.write(
          pc.dim("If the browser didn't open, visit:") +
            "\n" +
            `  ${pc.cyan(authUrl)}\n\n`
        );
      }

      process.stderr.write(pc.dim("Waiting for authentication…") + "\n");

      // Set timeout
      timeoutId = setTimeout(() => {
        settle(
          new CliError(
            "Login timed out. If you're having trouble, try: inkloom auth login --token <token>",
            EXIT_AUTH
          )
        );
      }, LOGIN_TIMEOUT_MS);
    });

    server.on("error", (err) => {
      settle(new CliError(`Local auth server error: ${err.message}`, EXIT_GENERAL));
    });
  });
}
