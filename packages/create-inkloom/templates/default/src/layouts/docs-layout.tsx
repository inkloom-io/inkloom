import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { TableOfContents } from "@/components/layout/toc";
import { TabBar } from "@/components/layout/tab-bar";
import { useSiteData } from "../data-provider";

export function DocsLayout() {
  const { tabs } = useSiteData();
  const { pathname, hash } = useLocation();
  const scrollMap = useRef<Map<string, number>>(new Map());
  const prevPathname = useRef(pathname);
  const pendingScroll = useRef<number | null>(null);

  // Save scroll on navigation, scroll to top or defer restore
  useEffect(() => {
    const prev = prevPathname.current;

    // Save scroll position of the page we're leaving
    if (prev !== pathname) {
      scrollMap.current.set(prev, window.scrollY);
      prevPathname.current = pathname;
    }

    // If there's a hash, let the browser handle scrolling to the anchor
    if (hash) return;

    // Check if we have a saved scroll position for this page
    const saved = scrollMap.current.get(pathname);
    if (saved !== undefined && saved > 0) {
      // Defer restore until content actually renders (MutationObserver below)
      pendingScroll.current = saved;
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  // Watch article for content changes to apply deferred scroll restore
  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) return;

    const observer = new MutationObserver(() => {
      if (pendingScroll.current === null) return;
      // Skip if DocsPage is still loading (spinner present, content not yet rendered)
      if (article.querySelector(".animate-spin")) return;

      const pos = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => window.scrollTo(0, pos));
    });

    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {tabs.length > 0 && <TabBar tabs={tabs} />}
      <div className="mx-auto flex max-w-8xl">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-8 lg:px-16">
          <article className="prose prose-slate dark:prose-invert max-w-4xl">
            <Outlet />
          </article>
        </main>
        <TableOfContents />
      </div>
    </>
  );
}
