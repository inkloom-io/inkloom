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
  const hasChildren = item.children && item.children.length > 0;
  const linkHref = hasChildren
    ? getFirstLeafHref(item) || item.href
    : item.href;
  const isActive = hasChildren
    ? pathname.startsWith(item.href)
    : pathname === linkHref;

  if (hasChildren) {
    // Render as section header — always expanded, no toggle
    return (
      <li className={cn(!isFirst && "mt-6")}>
        <Link
          to={linkHref}
          className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)] flex items-center gap-2 py-1"
        >
          {item.icon && <IconDisplay icon={item.icon} />}
          <span>{item.title}</span>
        </Link>
        <ul className="ml-0 mt-1 space-y-1 pl-0">
          {item.children!.map((child) => (
            <NavLink key={child.href} item={child} depth={depth + 1} />
          ))}
        </ul>
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
      <nav className="flex-1 px-4 pt-4 pb-8">
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
            className="group flex items-start justify-center gap-2 text-[var(--color-muted-foreground)] transition-colors duration-200 hover:text-[var(--color-foreground)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 32 32"
              fill="none"
              className="shrink-0 transition-transform duration-300 group-hover:translate-y-[-1px]"
            >
              <path
                d="M22.5 4.5L8.5 24.5l-3 3 1-4L20.5 3.5a2.12 2.12 0 0 1 3 0l0 0a2.12 2.12 0 0 1 0 3l-1-2z"
                fill="currentColor"
                opacity="0.15"
              />
              <path
                d="M20.5 3.5a2.12 2.12 0 0 1 3 3L8.5 24.5l-3 3 1-4L20.5 3.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 27.5c1.5-.5 3-1 4-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
              <circle
                cx="6"
                cy="27"
                r="1"
                fill="var(--color-primary)"
                className="transition-opacity duration-300 opacity-0 group-hover:opacity-100"
              />
            </svg>
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
