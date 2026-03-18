import { useEffect, useState } from "react";
import { useLocation, Link as RouterLink } from "react-router";
import { MDXContent } from "@/components/mdx/mdx-content";
import { CopyPageDropdown } from "@/components/layout/copy-page-dropdown";
import { useSiteData } from "@/src/data-provider";
import {
  Book,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code,
  Cog,
  FileText,
  Folder,
  Home,
  Lightbulb,
  Link,
  List,
  Lock,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
  Terminal,
  Users,
  Wrench,
  Zap,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

/** Walk the navigation tree and collect ancestor folder titles for a given pathname. */
function buildFolderTrail(
  items: NavItem[],
  pathname: string,
  trail: string[] = []
): string[] | null {
  for (const item of items) {
    if (item.href === pathname) {
      return trail;
    }
    if (item.children && item.children.length > 0) {
      if (pathname.startsWith(item.href + "/") || pathname === item.href) {
        const result = buildFolderTrail(item.children, pathname, [
          ...trail,
          item.title,
        ]);
        if (result) return result;
      }
    }
  }
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  book: Book,
  "book-open": BookOpen,
  code: Code,
  cog: Cog,
  "file-text": FileText,
  folder: Folder,
  home: Home,
  lightbulb: Lightbulb,
  link: Link,
  list: List,
  lock: Lock,
  "message-square": MessageSquare,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  terminal: Terminal,
  users: Users,
  wrench: Wrench,
  zap: Zap,
};

interface PageData {
  title: string;
  description?: string;
  content: string;
  icon?: string;
  subtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
}

function loadEmbeddedPageData(): PageData | null {
  try {
    const el = document.getElementById("__PAGE_DATA__");
    if (el?.textContent) {
      const data = JSON.parse(el.textContent) as PageData;
      el.remove();
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

function PageIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon.startsWith("lucide:")) {
    const name = icon.replace("lucide:", "");
    const LucideIcon = LUCIDE_ICON_MAP[name];
    if (LucideIcon) return <LucideIcon className={className} />;
    return <CircleHelp className={className} />;
  }
  // Bare lucide name (backward compat)
  if (LUCIDE_ICON_MAP[icon]) {
    const LucideIcon = LUCIDE_ICON_MAP[icon];
    return <LucideIcon className={className} />;
  }
  // ASCII-only name but not found
  if (/^[a-z][a-z0-9-]*$/.test(icon)) {
    return <CircleHelp className={className} />;
  }
  // Emoji
  return <span className={className}>{icon}</span>;
}

/** Flatten the navigation tree into a sequential list of leaf pages (no folders). */
function flattenNavItems(items: NavItem[]): { title: string; href: string }[] {
  const result: { title: string; href: string }[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      result.push(...flattenNavItems(item.children));
    } else {
      result.push({ title: item.title, href: item.href });
    }
  }
  return result;
}

export function DocsPage() {
  const location = useLocation();
  const { config, navigation, tabs } = useSiteData();
  const [pageData, setPageData] = useState<PageData | null>(() =>
    loadEmbeddedPageData()
  );
  const [loading, setLoading] = useState(!pageData);

  useEffect(() => {
    const slug =
      location.pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "index";

    setLoading(true);
    fetch(`/_content/${slug}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPageData(data as PageData | null))
      .catch(() => setPageData(null))
      .finally(() => setLoading(false));
  }, [location.pathname]);

  // Update document.title based on current page and folder hierarchy
  useEffect(() => {
    if (!pageData?.title) {
      document.title = `${config.title} Documentation`;
      return;
    }
    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    const activeTab = tabs.find((tab) => pathname.startsWith(`/${tab.slug}`));
    const navItems = activeTab ? activeTab.navigation || [] : navigation;
    const folderTrail = buildFolderTrail(navItems, pathname) || [];
    // Title format: pageTitle | innerFolder | ... | outerFolder | projectName Documentation
    const parts = [
      pageData.title,
      ...folderTrail.reverse(),
      `${config.title} Documentation`,
    ];
    document.title = parts.join(" | ");
  }, [pageData, location.pathname, config.title, navigation, tabs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          The page you are looking for does not exist.
        </p>
      </div>
    );
  }

  const titleId = pageData.title ? slugify(pageData.title) : undefined;

  // Build folder label from navigation hierarchy
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const activeTab = tabs.find((tab) => pathname.startsWith(`/${tab.slug}`));
  const navItems = activeTab ? activeTab.navigation || [] : navigation;
  const folderTrail = buildFolderTrail(navItems, pathname);
  const folderName =
    folderTrail && folderTrail.length > 0
      ? folderTrail[folderTrail.length - 1]
      : null;

  // Build flat page list for prev/next navigation
  const flatPages = flattenNavItems(navItems);
  const currentIndex = flatPages.findIndex((p) => p.href === pathname);
  const prevPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
  const nextPage =
    currentIndex >= 0 && currentIndex < flatPages.length - 1
      ? flatPages[currentIndex + 1]
      : null;

  return (
    <div>
      {pageData.title && !pageData.titleSectionHidden && (
        <div className="not-prose mb-8">
          {folderName && (
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--color-primary)]">
              {folderName}
            </span>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                {pageData.icon && !pageData.titleIconHidden && (
                  <div className="mt-0.5 shrink-0">
                    <PageIcon
                      icon={pageData.icon}
                      className="h-7 w-7 text-[1.5rem]"
                    />
                  </div>
                )}
                <h1
                  id={titleId}
                  className="group relative text-3xl font-bold tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    marginBottom: 0,
                  }}
                >
                  {pageData.title}
                  {titleId && (
                    <a
                      href={`#${titleId}`}
                      className="ml-2 inline-block opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Link to ${pageData.title}`}
                    >
                      <Link className="h-5 w-5 text-[var(--color-muted-foreground)]" />
                    </a>
                  )}
                </h1>
              </div>
              {pageData.subtitle && (
                <p
                  className="mt-2 text-base text-[var(--color-muted-foreground)]"
                  style={{ marginBottom: 0 }}
                >
                  {pageData.subtitle}
                </p>
              )}
            </div>
            {!pageData.content.trimStart().startsWith("<ApiEndpoint") && (
              <div className="mt-1 shrink-0">
                <CopyPageDropdown mdxContent={pageData.content} />
              </div>
            )}
          </div>
        </div>
      )}
      <MDXContent source={pageData.content} />
      {(prevPage || nextPage) && (
        <>
          <div
            className="mt-12 h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-border) 0%, hsl(240 4% 8%) 100%)",
            }}
          />

          <nav
            aria-label="Page navigation"
            className="not-prose docs-prev-next"
          >
            {prevPage ? (
              <RouterLink to={prevPage.href} className="docs-prev-next-card">
                <span className="docs-prev-next-label">Previous</span>
                <span className="docs-prev-next-title">
                  <ChevronLeft className="docs-prev-next-arrow" />
                  {prevPage.title}
                </span>
              </RouterLink>
            ) : (
              <span />
            )}
            {nextPage ? (
              <RouterLink
                to={nextPage.href}
                className="docs-prev-next-card docs-prev-next-card-next"
              >
                <span className="docs-prev-next-label">Next</span>
                <span className="docs-prev-next-title">
                  {nextPage.title}
                  <ChevronRight className="docs-prev-next-arrow" />
                </span>
              </RouterLink>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
