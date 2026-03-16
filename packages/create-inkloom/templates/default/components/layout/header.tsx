import { Link } from "react-router";
import { useState, useEffect } from "react";
import { Menu, X, Search, Github, Youtube, ArrowRight, Sparkles } from "lucide-react";
import { useSiteData } from "@/src/data-provider";
import { SearchDialog } from "@/components/search/search-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSearch } from "@/src/search-provider";
import { useTheme } from "@/src/theme-provider";

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

export function Header() {
  const { config } = useSiteData();
  const { searchOpen, setSearchOpen } = useSearch();
  const { resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        <div className="mx-auto flex h-16 max-w-8xl items-center px-4 lg:px-0">
          {/* Logo area — matches sidebar width on desktop */}
          <div className="flex items-center gap-4 lg:w-64 lg:shrink-0 lg:px-4">
            <button
              className="lg:hidden p-2 -ml-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-accent)] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
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
          {config.search?.enabled && (
            <div className="hidden lg:flex flex-1 min-w-0 px-8">
              <button
                onClick={() => setSearchOpen(true)}
                className="search-trigger flex h-9 w-full max-w-sm items-center justify-start"
              >
                <Search className="h-4 w-4" />
                <span className="ml-2 text-sm">Search...</span>
                <kbd className="search-kbd ml-auto">⌘K</kbd>
              </button>
              {hasChatWidget && (
                <button
                  onClick={handleAskAI}
                  className="ask-ai-button ml-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ask AI</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto lg:ml-0 lg:shrink-0 lg:pr-4">
            {hasChatWidget && (
              <button
                onClick={handleAskAI}
                className="ask-ai-button lg:hidden"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask AI</span>
              </button>
            )}
            {hasChatWidget && (
              <div className="mx-1 h-5 w-px bg-[var(--color-border)] lg:hidden" />
            )}
            {config.search?.enabled && (
              <button
                onClick={() => setSearchOpen(true)}
                className="lg:hidden flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            {config.search?.enabled && socialLinks.length > 0 && (
              <div className="mx-1 h-5 w-px bg-[var(--color-border)] lg:hidden" />
            )}
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
            <ThemeToggle />
            {config.ctaButton && (
              <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            )}
            {config.ctaButton && (
              <a
                href={config.ctaButton.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-button group inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
              >
                {config.ctaButton.label}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--color-border)] bg-[var(--color-background)] animate-fade-in">
            <div className="px-4 py-4">
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-2 pb-3">
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
              )}
              {config.ctaButton && (
                <div className="pb-3">
                  <a
                    href={config.ctaButton.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cta-button group inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                  >
                    {config.ctaButton.label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-sm text-[var(--color-muted-foreground)]">Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </header>

      {config.search?.enabled && (
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      )}
    </>
  );
}
