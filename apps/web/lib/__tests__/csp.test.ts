import { describe, it, expect } from "vitest";
import { buildCspDirectives, CSP_HEADER } from "../csp";

describe("buildCspDirectives", () => {
  it("returns a valid CSP string with default directives", () => {
    const csp = buildCspDirectives();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("font-src");
    expect(csp).toContain("img-src");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows self-hosted scripts and styles", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).toMatch(/style-src[^;]*'self'/);
  });

  it("allows unsafe-inline for styles (BlockNote/Mantine requirement)", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("does NOT allow unsafe-inline for scripts by default", () => {
    const csp = buildCspDirectives();
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("allows Convex domains in connect-src", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.convex\.cloud/);
    expect(csp).toMatch(/connect-src[^;]*wss:\/\/\*\.convex\.cloud/);
  });

  it("allows PostHog domains", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/connect-src[^;]*https:\/\/us\.i\.posthog\.com/);
    expect(csp).toMatch(/script-src[^;]*https:\/\/us\.i\.posthog\.com/);
  });

  it("allows Google Fonts in style-src and font-src", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    expect(csp).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  it("allows Stripe in script-src and frame-src", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/script-src[^;]*https:\/\/js\.stripe\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/js\.stripe\.com/);
  });

  it("allows PartyKit WebSocket connections", () => {
    const csp = buildCspDirectives();
    expect(csp).toMatch(/connect-src[^;]*wss:\/\/\*\.partykit\.dev/);
  });

  it("blocks object embeds", () => {
    const csp = buildCspDirectives();
    expect(csp).toContain("object-src 'none'");
  });

  it("includes nonce when provided", () => {
    const csp = buildCspDirectives({ nonce: "abc123" });
    expect(csp).toMatch(/script-src[^;]*'nonce-abc123'/);
  });

  it("does not include nonce when not provided", () => {
    const csp = buildCspDirectives();
    expect(csp).not.toContain("nonce-");
  });

  it("includes extra connect-src domains", () => {
    const csp = buildCspDirectives({
      extraConnectSrc: ["https://custom-api.example.com"],
    });
    expect(csp).toMatch(
      /connect-src[^;]*https:\/\/custom-api\.example\.com/,
    );
  });

  it("includes extra script-src domains", () => {
    const csp = buildCspDirectives({
      extraScriptSrc: ["https://cdn.example.com"],
    });
    expect(csp).toMatch(/script-src[^;]*https:\/\/cdn\.example\.com/);
  });

  it("separates directives with semicolons", () => {
    const csp = buildCspDirectives();
    const directives = csp.split("; ");
    expect(directives.length).toBeGreaterThanOrEqual(10);
  });
});

describe("CSP_HEADER", () => {
  it("uses report-only mode", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only");
  });
});
