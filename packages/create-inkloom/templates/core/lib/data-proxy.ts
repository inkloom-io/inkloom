import type { NextRequest } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export async function proxyDataRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const baseUrl = process.env.DATA_API_URL ?? "http://127.0.0.1:8787";
  const target = new URL(path.map(encodeURIComponent).join("/"), `${baseUrl}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Cloudflare may choose zstd when we forward a modern browser's
  // Accept-Encoding header. The server-side fetch runtime does not decode
  // zstd, so forwarding those bytes after removing Content-Encoding corrupts
  // JSON responses. Keep the service-to-service hop uncompressed.
  headers.set("Accept-Encoding", "identity");
  headers.set("X-Inkloom-WorkOS-User-Id", "local");
  headers.set("X-Inkloom-User-Email", "local@inkloom.local");

  const token = process.env.DATA_API_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const method = request.method.toUpperCase();
  const upstream = await fetch(target, {
    method,
    headers,
    body:
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    cache: "no-store",
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
