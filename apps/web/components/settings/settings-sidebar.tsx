"use client";

import { cn } from "@inkloom/ui/lib/utils";
import { Settings, Palette, Search, Layers, Plug, Sparkles, Terminal, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppContext } from "@/hooks/use-app-context";

export type SettingsTab =
  | "general"
  | "branding"
  | "content"
  | "seo"
  | "ai"
  | "integrations"
  | "developer"
  | "access-control";

interface TabDef {
  id: SettingsTab;
  labelKey: string;
  icon: typeof Settings;
  platformOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "general", labelKey: "general", icon: Settings },
  { id: "branding", labelKey: "branding", icon: Palette },
  { id: "content", labelKey: "content", icon: Layers },
  { id: "seo", labelKey: "seo", icon: Search },
  { id: "ai", labelKey: "ai", icon: Sparkles, platformOnly: true },
  { id: "integrations", labelKey: "integrations", icon: Plug, platformOnly: true },
  { id: "developer", labelKey: "developer", icon: Terminal, platformOnly: true },
  { id: "access-control", labelKey: "accessControl", icon: Shield, platformOnly: true },
];

/** Returns the tabs visible in the current mode (core vs platform). */
export function getVisibleTabs(isMultiTenant: boolean): TabDef[] {
  if (isMultiTenant) return TABS;
  return TABS.filter((tab) => !tab.platformOnly);
}

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const t = useTranslations("settings.sidebar");
  const { isMultiTenant } = useAppContext();
  const visibleTabs = getVisibleTabs(isMultiTenant);

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:flex md:w-48 md:shrink-0 md:flex-col md:gap-1 md:sticky md:top-4 md:self-start">
        {visibleTabs.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              activeTab === id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {/* Mobile: horizontal scrollable pills */}
      <nav className="flex md:hidden gap-1 overflow-x-auto pb-2 -mx-1 px-1">
        {visibleTabs.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(labelKey)}
          </button>
        ))}
      </nav>
    </>
  );
}
