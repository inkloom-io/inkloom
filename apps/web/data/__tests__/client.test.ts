import { afterEach, describe, expect, it, vi } from "vitest";

import { createDataClient } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataClient extension requests", () => {
  it("resolves a browser-relative data proxy URL without dropping its path", async () => {
    vi.stubGlobal("location", { origin: "https://app.inkloom.test" });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ completed: true })
    );
    const client = createDataClient({
      baseUrl: "/api/data",
      fetch: fetchMock as typeof fetch,
    });

    await client.request("/v1/users/complete-onboarding", {
      method: "POST",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://app.inkloom.test/api/data/v1/users/complete-onboarding"
    );
  });

  it("preserves a path prefix on an absolute data service URL", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ ok: true })
    );
    const client = createDataClient({
      baseUrl: "https://data.inkloom.test/service",
      fetch: fetchMock as typeof fetch,
    });

    await client.request("/v1/health");

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://data.inkloom.test/service/v1/health"
    );
  });
});
