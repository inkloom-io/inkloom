import { Link } from "react-router";
import { useLocation } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { useSiteData } from "@/src/data-provider";

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

interface BreadcrumbItem {
  title: string;
  href: string;
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

// Build breadcrumb trail from navigation and current path
function buildBreadcrumbs(
  items: NavItem[],
  pathname: string,
  trail: BreadcrumbItem[] = []
): BreadcrumbItem[] | null {
  for (const item of items) {
    // Check if current item matches the pathname
    if (item.href === pathname) {
      return [...trail, { title: item.title, href: item.href }];
    }

    // Check children recursively
    if (item.children && item.children.length > 0) {
      // Check if pathname starts with this item's href (it's a parent folder)
      if (pathname.startsWith(item.href + "/") || pathname === item.href) {
        // For folders, link to the first leaf page, not the folder path
        const folderHref = getFirstLeafHref(item) || item.href;
        const childTrail = buildBreadcrumbs(item.children, pathname, [
          ...trail,
          { title: item.title, href: folderHref },
        ]);
        if (childTrail) {
          return childTrail;
        }
      }
    }
  }
  return null;
}

export function Breadcrumb() {
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";
  const { navigation, tabs } = useSiteData();

  // Don't show breadcrumb on root docs page
  if (!pathname || pathname === "/") {
    return null;
  }

  // Determine active tab from pathname
  const activeTab = tabs.find((tab) => pathname.startsWith(`/${tab.slug}`));

  // Get appropriate navigation for the current tab
  const navItems = activeTab ? activeTab.navigation || [] : navigation;

  const breadcrumbs = buildBreadcrumbs(navItems, pathname);

  // Build full breadcrumb trail including tab
  let fullBreadcrumbs: BreadcrumbItem[] = [];
  if (activeTab && breadcrumbs) {
    // For tab breadcrumb, link to the first leaf page in the tab's navigation
    const tabNavigation = activeTab.navigation || [];
    let tabFirstHref = `/${activeTab.slug}`;
    for (const navItem of tabNavigation) {
      const leafHref = getFirstLeafHref(navItem);
      if (leafHref) {
        tabFirstHref = leafHref;
        break;
      }
    }
    fullBreadcrumbs = [
      { title: activeTab.name, href: tabFirstHref },
      ...breadcrumbs,
    ];
  } else {
    fullBreadcrumbs = breadcrumbs || [];
  }

  // Don't show if no breadcrumbs or only one item (the current page)
  if (fullBreadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="breadcrumb flex items-center gap-1 text-sm text-[var(--color-muted-foreground)]">
        <li className="flex items-center">
          <Link
            to="/"
            className="flex items-center hover:text-[var(--color-foreground)] transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {fullBreadcrumbs.map((item, index) => {
          const isLast = index === fullBreadcrumbs.length - 1;
          return (
            <li key={item.href} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1" />
              {isLast ? (
                <span className="text-[var(--color-muted-foreground)] font-medium">
                  {item.title}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="hover:text-[var(--color-foreground)] transition-colors"
                >
                  {item.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
