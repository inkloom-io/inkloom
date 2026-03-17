import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { ListStart } from "lucide-react";

import { PageFeedback } from "./page-feedback";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract visible heading text, excluding the anchor-link element injected by Heading */
function getHeadingText(el: Element): string {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      // Skip the hidden anchor link added by the Heading component
      if (
        elem.tagName === "A" &&
        elem.getAttribute("aria-label")?.startsWith("Link to ")
      ) {
        continue;
      }
      text += getHeadingText(elem);
    }
  }
  return text;
}

/** Heading classes that belong to MDX components, not content sections */
const EXCLUDED_HEADING_CLASSES = [
  "card-title",
  "step-title",
  "api-field-docs-title",
];

export function TableOfContents() {
  const { pathname } = useLocation();

  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const extractHeadings = useCallback(() => {
    const elements = document.querySelectorAll("article h2, article h3");
    const items: TocItem[] = [];

    elements.forEach((el) => {
      // Skip headings that belong to MDX components (cards, steps, etc.)
      if (EXCLUDED_HEADING_CLASSES.some((cls) => el.classList.contains(cls))) {
        return;
      }

      const text = getHeadingText(el).trim();
      if (!text) return;

      const id = el.id || slugify(text);
      if (!el.id) el.id = id;

      items.push({
        id,
        title: text,
        level: parseInt(el.tagName[1]),
      });
    });

    setHeadings((prev) => {
      // Only update if headings actually changed to avoid unnecessary re-renders
      if (prev.length !== items.length) return items;
      const changed = items.some(
        (item, i) => item.id !== prev[i]!.id || item.title !== prev[i]!.title
      );
      return changed ? items : prev;
    });
  }, []);

  // Extract headings when content changes via MutationObserver
  useEffect(() => {
    setActiveId("");
    // Try initial extraction (content may already be in the DOM)
    extractHeadings();

    const article = document.querySelector("article");
    if (!article) return;

    let rafId: number | null = null;

    const observer = new MutationObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        extractHeadings();
        rafId = null;
      });
    });

    observer.observe(article, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [pathname, extractHeadings]);

  // Track active heading via scroll position
  useEffect(() => {
    if (headings.length === 0) return;

    const offset = 82; // Just past scroll-padding-top (5rem = 80px)
    let ticking = false;

    const updateActiveHeading = () => {
      let currentId = "";
      for (const { id } of headings) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= offset) {
            currentId = id;
          }
        }
      }
      if (!currentId && headings.length > 0) {
        currentId = headings[0].id;
      }
      setActiveId(currentId);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateActiveHeading);
        ticking = true;
      }
    };

    // Initial check
    updateActiveHeading();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside
      className={cn(
        "toc sticky hidden w-64 xl:w-72 shrink-0 px-4 pt-8 pb-4 xl:block",
        "top-28 h-[calc(100vh-7rem)]"
      )}
    >
      <div className="flex flex-col h-full">
        <div className="px-4 flex-1 min-h-0 overflow-y-auto">
          <h4 className="toc-title flex items-center gap-1.5">
            <ListStart className="h-4 w-4" />
            On This Page
          </h4>
          <nav>
            <ul className="space-y-1">
              {headings.map((heading) => (
                <li
                  key={heading.id}
                  style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}
                >
                  <a
                    href={`#${heading.id}`}
                    className={cn(
                      "toc-link",
                      activeId === heading.id && "toc-link-active"
                    )}
                  >
                    {heading.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="px-4 shrink-0">
          <PageFeedback />
        </div>
      </div>
    </aside>
  );
}
