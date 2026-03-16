import { Link } from "react-router";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { IconDisplay } from "../shared/icon-display";

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
function getTabFirstPageHref(tabNavigation: NavItem[], basePath: string, tabSlug: string): string {
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

  if (!tabs || tabs.length === 0) {
    return null;
  }

  // Determine the active tab based on pathname
  const activeTab = tabs.find((tab) =>
    pathname.startsWith(`${basePath}/${tab.slug}`)
  );

  return (
    <nav className="sticky top-16 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]">
      <div className="mx-auto flex max-w-8xl px-4 lg:px-0">
        <div className="hidden lg:block lg:w-64 lg:shrink-0 bg-[var(--color-sidebar-background)]" />
        <div className="-mb-px flex gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab?.id === tab.id;
            // Link to first actual page in the tab's navigation, not just the tab slug
            const href = getTabFirstPageHref(tab.navigation || [], basePath, tab.slug);

            return (
              <Link
                key={tab.id}
                to={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
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
    </nav>
  );
}
