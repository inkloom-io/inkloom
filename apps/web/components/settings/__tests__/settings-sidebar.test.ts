import { describe, it, expect } from "vitest";
import { getVisibleTabs } from "@/components/settings/settings-sidebar";

describe("getVisibleTabs", () => {
  describe("platform mode (isMultiTenant=true)", () => {
    const tabs = getVisibleTabs(true);

    it("returns all 8 tabs", () => {
      expect(tabs).toHaveLength(8);
    });

    it("includes core tabs", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).toContain("general");
      expect(ids).toContain("branding");
      expect(ids).toContain("content");
      expect(ids).toContain("seo");
    });

    it("includes platform-only tabs", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).toContain("ai");
      expect(ids).toContain("integrations");
      expect(ids).toContain("developer");
      expect(ids).toContain("access-control");
    });

    it("preserves tab order", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).toEqual([
        "general",
        "branding",
        "content",
        "seo",
        "ai",
        "integrations",
        "developer",
        "access-control",
      ]);
    });
  });

  describe("core mode (isMultiTenant=false)", () => {
    const tabs = getVisibleTabs(false);

    it("returns only 4 core tabs", () => {
      expect(tabs).toHaveLength(4);
    });

    it("includes general, branding, content, seo", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).toEqual(["general", "branding", "content", "seo"]);
    });

    it("excludes ai tab", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).not.toContain("ai");
    });

    it("excludes integrations tab", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).not.toContain("integrations");
    });

    it("excludes developer tab", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).not.toContain("developer");
    });

    it("excludes access-control tab", () => {
      const ids = tabs.map((t) => t.id);
      expect(ids).not.toContain("access-control");
    });
  });

  describe("tab definitions", () => {
    const allTabs = getVisibleTabs(true);

    it("every tab has an id", () => {
      for (const tab of allTabs) {
        expect(tab.id).toBeTruthy();
      }
    });

    it("every tab has a labelKey", () => {
      for (const tab of allTabs) {
        expect(tab.labelKey).toBeTruthy();
      }
    });

    it("every tab has an icon", () => {
      for (const tab of allTabs) {
        expect(tab.icon).toBeTruthy();
      }
    });

    it("platform-only tabs are marked with platformOnly=true", () => {
      const platformTabs = allTabs.filter((t) => t.platformOnly);
      const ids = platformTabs.map((t) => t.id);
      expect(ids).toEqual(["ai", "integrations", "developer", "access-control"]);
    });

    it("core tabs do not have platformOnly set", () => {
      const coreTabs = allTabs.filter((t) => !t.platformOnly);
      const ids = coreTabs.map((t) => t.id);
      expect(ids).toEqual(["general", "branding", "content", "seo"]);
    });
  });
});

describe("SettingsSidebar module", () => {
  it("exports SettingsSidebar function", async () => {
    const mod = await import("@/components/settings/settings-sidebar");
    expect(typeof mod.SettingsSidebar).toBe("function");
  });

  it("exports getVisibleTabs function", async () => {
    const mod = await import("@/components/settings/settings-sidebar");
    expect(typeof mod.getVisibleTabs).toBe("function");
  });

  it("exports SettingsTab type (via typeof check on tab ids)", () => {
    // SettingsTab is a type, so we verify through the tab definitions
    const tabs = getVisibleTabs(true);
    const validIds = [
      "general",
      "branding",
      "content",
      "seo",
      "ai",
      "integrations",
      "developer",
      "access-control",
    ];
    for (const tab of tabs) {
      expect(validIds).toContain(tab.id);
    }
  });
});
