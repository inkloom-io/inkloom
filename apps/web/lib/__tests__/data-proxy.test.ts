import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/adapters", () => ({
  authAdapter: {
    requireUser: vi.fn(async () => ({
      id: "user_test",
      email: "test@inkloom.invalid",
    })),
  },
}));

import { proxyDataRequest } from "../data-proxy";

describe("proxyDataRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prevents Cloudflare from returning zstd-compressed upstream data", async () => {
    vi.stubEnv("DATA_API_URL", "https://data.example.com");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ id: "project_test" }), {
        headers: {
          "content-encoding": "zstd",
          "content-length": "123",
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = {
      arrayBuffer: vi.fn(),
      headers: new Headers({
        "accept-encoding": "gzip, deflate, br, zstd",
      }),
      method: "GET",
      nextUrl: new URL("https://app.example.com/api/data/v1/projects/project_test"),
    };

    const response = await proxyDataRequest(
      request as never,
      { params: Promise.resolve({ path: ["v1", "projects", "project_test"] }) },
    );

    const upstreamHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(upstreamHeaders.get("accept-encoding")).toBe("identity");
    expect(response.headers.has("content-encoding")).toBe(false);
    expect(response.headers.has("content-length")).toBe(false);
    await expect(response.json()).resolves.toEqual({ id: "project_test" });
  });
});
