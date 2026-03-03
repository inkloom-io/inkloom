import { useLayoutEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { Header } from "@/components/layout/header";
import { ReadingProgress } from "@/components/layout/reading-progress";
import { DocsLayout } from "./layouts/docs-layout";
import { DocsPage } from "./pages/docs-page";
import { NotFoundPage } from "./pages/not-found-page";
import { useSiteData } from "./data-provider";

interface NavLike {
  href: string;
  children?: NavLike[];
}

function getFirstDocHref(items: NavLike[]): string | null {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      const child = getFirstDocHref(item.children);
      if (child) return child;
    } else if (item.href && item.href !== "/") {
      return item.href;
    }
  }
  return null;
}

export function App() {
  const { navigation, tabs } = useSiteData();

  // Reveal content after React has mounted (prevents FOUC from pre-rendered HTML)
  useLayoutEffect(() => {
    document.getElementById("root")?.classList.add("hydrated");
  }, []);

  let firstDocHref = getFirstDocHref(navigation);
  if (!firstDocHref && tabs.length > 0) {
    for (const tab of tabs) {
      if (tab.navigation && tab.navigation.length > 0) {
        firstDocHref = getFirstDocHref(tab.navigation);
        if (firstDocHref) break;
      }
    }
  }

  return (
    <>
      <ReadingProgress />
      <Header />
      <Routes>
        <Route path="/" element={<DocsLayout />}>
          <Route
            index
            element={
              firstDocHref ? (
                <Navigate to={firstDocHref} replace />
              ) : (
                <NotFoundPage />
              )
            }
          />
          <Route path="*" element={<DocsPage />} />
        </Route>
      </Routes>
    </>
  );
}
