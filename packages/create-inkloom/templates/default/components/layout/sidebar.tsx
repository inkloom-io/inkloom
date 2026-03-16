import { Link } from "react-router";
import { useLocation } from "react-router";
import { Github, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteData } from "@/src/data-provider";
import { IconDisplay } from "../shared/icon-display";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  github: Github,
  x: XIcon,
  discord: DiscordIcon,
  linkedin: LinkedInIcon,
  youtube: Youtube,
};

const SOCIAL_LABELS: Record<string, string> = {
  github: "GitHub",
  x: "X (Twitter)",
  discord: "Discord",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

interface NavItem {
  title: string;
  href: string;
  icon?: string;
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

function NavLink({ item, depth = 0, isFirst = false }: { item: NavItem; depth?: number; isFirst?: boolean }) {
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";
  const hasChildren = item.children && item.children.length > 0;
  const linkHref = hasChildren ? (getFirstLeafHref(item) || item.href) : item.href;
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
        {item.icon && <IconDisplay icon={item.icon} />}
        <span>{item.title}</span>
      </Link>
    </li>
  );
}

export function Sidebar() {
  const { navigation, tabs, config } = useSiteData();
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";

  // Determine active tab from pathname
  const activeTab = tabs.find((tab) =>
    pathname.startsWith(`/${tab.slug}`)
  );

  // Get appropriate navigation for the current tab
  const navItems = activeTab
    ? (activeTab.navigation || [])
    : navigation;

  const stickyTop = "top-16";
  const sidebarHeight = "h-[calc(100vh-4rem)]";

  const socialLinks = config.socialLinks?.filter((l) => l.url) ?? [];

  return (
    <aside className={cn(
      "site-sidebar sticky hidden w-64 shrink-0 overflow-y-auto lg:block",
      stickyTop,
      sidebarHeight
    )}>
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-4 pt-4 pb-8">
          {socialLinks.length > 0 && (
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
                  background: "linear-gradient(90deg, var(--color-sidebar-border) 0%, transparent 100%)",
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
          <div className="shrink-0 px-4 py-3">
            <div
              className="h-px w-full mb-3"
              style={{
                background: "linear-gradient(90deg, var(--color-sidebar-border) 0%, transparent 100%)",
              }}
            />
            <a
              href="https://inkloom.io"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 text-[var(--color-muted-foreground)] transition-colors duration-200 hover:text-[var(--color-foreground)]"
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
    </aside>
  );
}
