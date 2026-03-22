import { Link } from "react-router";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useSiteData } from "@/src/data-provider";
import { IconDisplay } from "../shared/icon-display";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "../shared/social-links";

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  method?: string;
  children?: NavItem[];
}

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

function NavLink({
  item,
  depth = 0,
  isFirst = false,
}: {
  item: NavItem;
  depth?: number;
  isFirst?: boolean;
}) {
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";
  // Treat items with a `children` property as section headers (folders),
  // even if children is empty. This prevents empty folders from rendering
  // as flat links that lead to "Page not found".
  const isFolder = Array.isArray(item.children);
  const hasChildren = isFolder && item.children.length > 0;
  const linkHref = hasChildren
    ? getFirstLeafHref(item) || item.href
    : item.href;
  const isActive = isFolder
    ? pathname.startsWith(item.href)
    : pathname === linkHref;

  if (isFolder) {
    // Render as section header — always expanded, no toggle.
    // Uses isFolder (checks Array.isArray) rather than hasChildren
    // so that folders with empty children arrays still render as
    // section headers instead of flat links that show "Page not found".
    return (
      <li className={cn(!isFirst && "mt-6")}>
        {hasChildren ? (
          <Link
            to={linkHref}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)] flex items-center gap-2 py-1"
          >
            {item.icon && <IconDisplay icon={item.icon} />}
            <span>{item.title}</span>
          </Link>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] flex items-center gap-2 py-1">
            {item.icon && <IconDisplay icon={item.icon} />}
            <span>{item.title}</span>
          </span>
        )}
        {hasChildren && (
          <ul className="ml-0 mt-1 space-y-1 pl-0">
            {item.children!.map((child) => (
              <NavLink key={child.href} item={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={linkHref}
        className={cn(
          "sidebar-link flex-1 px-3 py-2 text-sm flex items-center gap-2",
          isActive && "sidebar-link-active"
        )}
      >
        {item.method && (
          <span className={`sidebar-method-badge sidebar-method-${item.method.toLowerCase()}`}>
            {item.method === "DELETE" ? "DEL" : item.method}
          </span>
        )}
        {item.icon && <IconDisplay icon={item.icon} />}
        <span>{item.title}</span>
      </Link>
    </li>
  );
}

interface SidebarContentProps {
  hideSocialLinks?: boolean;
}

export function SidebarContent(
  { hideSocialLinks }: SidebarContentProps = {
    hideSocialLinks: false,
  }
) {
  const { navigation, tabs, config } = useSiteData();
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";

  // Determine active tab from pathname
  const activeTab = tabs.find((tab) => pathname.startsWith(`/${tab.slug}`));

  // Get appropriate navigation for the current tab
  const navItems = activeTab ? activeTab.navigation || [] : navigation;

  const socialLinks = config.socialLinks?.filter((l) => l.url) ?? [];

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {!hideSocialLinks && socialLinks.length > 0 && (
          <div className="mb-6">
            <div className="space-y-1">
              {socialLinks.map((link) => {
                const Icon = SOCIAL_ICONS[link.platform];
                if (!Icon) return null;
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border-subtle)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{SOCIAL_LABELS[link.platform] || link.platform}</span>
                  </a>
                );
              })}
            </div>
            <div
              className="mt-3 h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-sidebar-border) 0%, hsl(240 4% 8%) 100%)",
              }}
            />
          </div>
        )}
        <ul className="space-y-1">
          {navItems.map((item, index) => (
            <NavLink key={item.href} item={item} isFirst={index === 0} />
          ))}
        </ul>
      </nav>
      {config.showBranding && (
        <div className="shrink-0 px-4 pt-4 pb-6">
          <div
            className="h-px w-full mb-3"
            style={{
              background:
                "linear-gradient(90deg, var(--color-sidebar-border) 0%, hsl(240 4% 8%) 100%)",
            }}
          />
          <a
            href="https://inkloom.io"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center text-[var(--color-muted-foreground)] transition-colors duration-200 hover:text-[var(--color-foreground)]"
          >
            <span className="text-[0.6875rem] tracking-wide">
              Built with{" "}
              <span
                className="font-semibold tracking-normal text-[#2dd4ac]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                InkLoom
              </span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
