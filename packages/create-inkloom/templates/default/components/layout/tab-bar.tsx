import { Link } from "react-router";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { IconDisplay } from "../shared/icon-display";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useSiteData } from "@/src/data-provider";
import { SidebarContent } from "./sidebar-content";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "../shared/social-links";

interface Tab {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  navigation?: NavItem[];
}

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

// Get the first leaf (actual page) href from a nav item
function getFirstLeafHref(item: NavItem): string | null {
  // If it has children, it's a folder - search for first actual page
  if (item.children) {
    for (const child of item.children) {
      const leafHref = getFirstLeafHref(child);
      if (leafHref) return leafHref;
    }
    // No pages found in this folder
    return null;
  }
  // This is a page
  return item.href;
}

// Get the first page href for a tab
function getTabFirstPageHref(
  tabNavigation: NavItem[],
  basePath: string,
  tabSlug: string
): string {
  for (const navItem of tabNavigation) {
    const leafHref = getFirstLeafHref(navItem);
    if (leafHref) return leafHref;
  }
  return `${basePath}/${tabSlug}`;
}

interface TabBarProps {
  tabs: Tab[];
  basePath?: string;
}

export function TabBar({ tabs, basePath = "" }: TabBarProps) {
  const { pathname } = useLocation();
  const { config } = useSiteData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  // Determine the active tab based on pathname
  const activeTab = tabs.find((tab) =>
    pathname.startsWith(`${basePath}/${tab.slug}`)
  );

  const socialLinks = config.socialLinks?.filter((l) => l.url) ?? [];

  return (
    <nav className="sticky top-16 z-40 border-b border-[var(--color-border)] backdrop-blur-[var(--header-blur)]">
      <div className="flex mx-auto max-w-8xl px-4">
        <button
          className="lg:hidden p-2 -ml-2 mr-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-accent)] transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        <div className="-mb-px flex gap-6 overflow-scroll text-center whitespace-nowrap">
          {tabs.map((tab) => {
            const isActive = activeTab?.id === tab.id;
            // Link to first actual page in the tab's navigation, not just the tab slug
            const href = getTabFirstPageHref(
              tab.navigation || [],
              basePath,
              tab.slug
            );

            return (
              <Link
                key={tab.id}
                to={href}
                className={cn(
                  "flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]"
                )}
              >
                {tab.icon && <IconDisplay icon={tab.icon} />}
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="flex lg:hidden flex-col py-4 h-[calc(100vh-7rem)] overflow-y-scroll border-t border-[var(--color-border)] bg-[var(--color-background)] animate-fade-in">
          <div className="w-full flex px-6 items-center justify-between">
            {socialLinks.length > 0 && (
              <div className="flex">
                {socialLinks.map((link) => {
                  const Icon = SOCIAL_ICONS[link.platform];
                  if (!Icon) return null;
                  return (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center pr-6 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                      aria-label={SOCIAL_LABELS[link.platform] || link.platform}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border-subtle)]">
                        <Icon className="h-4 w-4" />
                      </span>
                    </a>
                  );
                })}
              </div>
            )}

            <ThemeToggle />
          </div>

          <div
            className="my-4 h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-sidebar-border) 0%, hsl(240 4% 8%) 100%)",
            }}
          />

          <SidebarContent hideSocialLinks />
        </div>
      )}
    </nav>
  );
}
