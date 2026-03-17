import { Link } from "react-router";
import { useState, useEffect } from "react";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import { useSiteData } from "@/src/data-provider";
import { SearchDialog } from "@/components/search/search-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSearch } from "@/src/search-provider";
import { useTheme } from "@/src/theme-provider";
import { SOCIAL_ICONS, SOCIAL_LABELS } from "../shared/social-links";

export function Header() {
  const { config } = useSiteData();
  const { searchOpen, setSearchOpen } = useSearch();
  const { resolvedTheme } = useTheme();
  const [hasChatWidget, setHasChatWidget] = useState(false);

  useEffect(() => {
    // Check if the chat widget script is present (injected for Pro users)
    const check = () => {
      if (document.querySelector("script[data-project-id]")) {
        setHasChatWidget(true);
      }
    };
    check();
    // Re-check after a short delay in case the script loads after the header
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAskAI = () => {
    window.dispatchEvent(new CustomEvent("inkloom:open-chat"));
  };

  const socialLinks = config.socialLinks?.filter((l) => l.url) ?? [];

  // Theme-aware logo: prefer light/dark variants when available
  const logoSrc =
    config.lightLogo && config.darkLogo
      ? resolvedTheme === "dark"
        ? config.darkLogo
        : config.lightLogo
      : config.logo;

  return (
    <>
      <header className="site-header sticky top-0 z-50 w-full border-b border-[var(--color-header-border)] backdrop-blur-[var(--header-blur)]">
        <div className="mx-auto flex h-16 max-w-8xl items-center justify-between lg:justify-start px-4 lg:px-0">
          {/* Logo area — matches sidebar width on desktop */}
          <div className="flex items-center gap-4 lg:w-64 lg:shrink-0 lg:px-4">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold text-[var(--color-foreground)] hover:opacity-80 transition-opacity"
            >
              {logoSrc ? (
                <>
                  <img
                    src={logoSrc}
                    alt={config.title}
                    className="h-8 w-auto"
                  />
                  <span className="sr-only">{config.title}</span>
                </>
              ) : (
                <span className="font-display text-lg">{config.title}</span>
              )}
            </Link>
          </div>

          {/* Search — on desktop, px-16 matches main content padding so left edges align */}
          <div className="hidden lg:flex lg:flex-1 lg:min-w-0 lg:px-8">
            {config.search?.enabled && (
              <button
                onClick={() => setSearchOpen(true)}
                className="search-trigger flex h-9 w-full max-w-sm items-center justify-start"
              >
                <Search className="h-4 w-4" />
                <span className="ml-2 text-sm">Search...</span>
                <kbd className="search-kbd ml-auto">⌘K</kbd>
              </button>
            )}
            {/* {hasChatWidget && ( */}
            <button onClick={handleAskAI} className="ask-ai-button flex ml-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI</span>
            </button>
            {/* )} */}
          </div>

          <div className="flex items-center gap-2 lg:shrink-0 lg:pr-4">
            {config.search?.enabled && (
              <button
                onClick={() => setSearchOpen(true)}
                className="xl:hidden flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            {/* {hasChatWidget && ( */}
            <button
              onClick={handleAskAI}
              className="ask-ai-button inline-flex lg:hidden"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI</span>
            </button>
            {/* )} */}
            {socialLinks.length > 0 && (
              <div className="mx-1 h-5 w-px bg-[var(--color-border)] hidden md:block lg:hidden" />
            )}
            <div className="hidden md:flex items-center gap-1">
              {socialLinks.map((link) => {
                const Icon = SOCIAL_ICONS[link.platform];
                if (!Icon) return null;
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
                    aria-label={SOCIAL_LABELS[link.platform] || link.platform}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
            {socialLinks.length > 0 && (
              <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            )}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {config.ctaButton && (
              <a
                href={config.ctaButton.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-button group inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs lg:px-4 lg:py-1.5 lg:text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
              >
                {config.ctaButton.label}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {config.search?.enabled && (
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      )}
    </>
  );
}
