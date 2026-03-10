import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for the core middleware module.
 *
 * Since `next-intl/middleware` requires Next.js server internals that aren't
 * available in a Vitest environment, we test via source-code analysis to
 * verify the structural contracts of the core middleware.
 */

const coreSource = readFileSync(
  resolve(__dirname, "../middleware.ts"),
  "utf-8"
);

describe("Core middleware: structural contracts", () => {
  it("imports next-intl middleware", () => {
    expect(coreSource).toContain('from "next-intl/middleware"');
  });

  it("imports NextResponse from next/server", () => {
    expect(coreSource).toContain('from "next/server"');
  });

  it("imports routing config", () => {
    expect(coreSource).toContain('from "@/i18n/routing"');
  });

  it("creates intlMiddleware with routing config", () => {
    expect(coreSource).toContain("createIntlMiddleware(routing)");
  });

  it("exports a default middleware function", () => {
    expect(coreSource).toMatch(/export default function middleware/);
  });

  it("exports a config with matcher", () => {
    expect(coreSource).toContain("export const config");
    expect(coreSource).toContain("matcher:");
  });

  it("skips API routes", () => {
    expect(coreSource).toContain('pathname.startsWith("/api/")');
  });

  it("calls intlMiddleware for non-API routes", () => {
    // May be wrapped (e.g. withCspHeaders(intlMiddleware(request)))
    expect(coreSource).toContain("intlMiddleware(request)");
  });
});

describe("Core middleware: no WorkOS references", () => {
  it("does not reference WorkOS cookie name", () => {
    expect(coreSource).not.toContain("WORKOS_COOKIE_NAME");
    expect(coreSource).not.toContain("wos-session");
  });

  it("does not reference WorkOS cookie password", () => {
    expect(coreSource).not.toContain("WORKOS_COOKIE_PASSWORD");
  });

  it("does not check for auth cookies", () => {
    expect(coreSource).not.toContain("cookies.has");
    expect(coreSource).not.toContain("request.cookies");
  });

  it("does not set Cache-Control headers", () => {
    expect(coreSource).not.toContain("Cache-Control");
    expect(coreSource).not.toContain("no-cache");
  });

  it("does not reference test auth bypass", () => {
    expect(coreSource).not.toContain("TEST_AUTH_BYPASS");
    expect(coreSource).not.toContain("isTestAuthBypassEnabled");
  });
});
