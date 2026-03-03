import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for the core dashboard layout.
 *
 * Since React components and Next.js server-side code (requireAuth, fonts)
 * can't be imported in a Vitest node environment, we test via source analysis
 * for structural contracts and verify pure logic separately.
 */

const coreSource = readFileSync(
  resolve(__dirname, "../layout.core.tsx"),
  "utf-8"
);

describe("Core dashboard layout: structural contracts", () => {
  it("exports a default function named CoreDashboardLayout", () => {
    expect(coreSource).toMatch(
      /export default function CoreDashboardLayout/
    );
  });

  it("imports DashboardNav", () => {
    expect(coreSource).toContain("DashboardNav");
  });

  it("imports DashboardHeader", () => {
    expect(coreSource).toContain("DashboardHeader");
  });

  it("imports font definitions", () => {
    expect(coreSource).toContain("Space_Grotesk");
    expect(coreSource).toContain("Plus_Jakarta_Sans");
  });

  it("uses LOCAL_USER constant for nav and header", () => {
    expect(coreSource).toContain("LOCAL_USER");
    expect(coreSource).toContain("<DashboardNav user={LOCAL_USER}");
    expect(coreSource).toContain("<DashboardHeader user={LOCAL_USER}");
  });
});

describe("Core layout: no auth/billing/onboarding", () => {
  it("does not import requireAuth", () => {
    expect(coreSource).not.toMatch(/import\s.*requireAuth/);
  });

  it("does not import BillingBanner", () => {
    expect(coreSource).not.toMatch(/import\s.*BillingBanner/);
  });

  it("does not import OnboardingRedirect", () => {
    expect(coreSource).not.toMatch(/import\s.*OnboardingRedirect/);
  });

  it("does not render BillingBanner or OnboardingRedirect", () => {
    expect(coreSource).not.toMatch(/<BillingBanner/);
    expect(coreSource).not.toMatch(/<OnboardingRedirect/);
  });

  it("is a synchronous function (not async)", () => {
    expect(coreSource).not.toMatch(/export default async function/);
  });
});

describe("Core layout: visual elements", () => {
  it("has dot matrix background", () => {
    expect(coreSource).toContain("Dot matrix background");
  });

  it("has ambient glow", () => {
    expect(coreSource).toContain("Ambient glow");
  });

  it("uses font variables", () => {
    expect(coreSource).toContain("--font-heading");
    expect(coreSource).toContain("--font-body");
  });

  it("uses same base CSS classes", () => {
    const baseClass = "flex min-h-screen bg-background text-foreground";
    expect(coreSource).toContain(baseClass);
  });
});

describe("LOCAL_USER constant shape", () => {
  it("defines LOCAL_USER with all required fields", () => {
    expect(coreSource).toContain('id: "local_user"');
    expect(coreSource).toContain('email: "local@inkloom.dev"');
    expect(coreSource).toContain('firstName: "Local"');
    expect(coreSource).toContain('lastName: "User"');
    expect(coreSource).toContain("profilePictureUrl: null");
  });

  it("LOCAL_USER id matches auth.core.ts local user id", () => {
    const authCoreSource = readFileSync(
      resolve(__dirname, "../../../../lib/adapters/auth.core.ts"),
      "utf-8"
    );
    expect(coreSource).toContain('id: "local_user"');
    expect(authCoreSource).toContain('id: "local_user"');
  });

  it("LOCAL_USER email matches auth.core.ts local user email", () => {
    const authCoreSource = readFileSync(
      resolve(__dirname, "../../../../lib/adapters/auth.core.ts"),
      "utf-8"
    );
    expect(coreSource).toContain('email: "local@inkloom.dev"');
    expect(authCoreSource).toContain('email: "local@inkloom.dev"');
  });
});
