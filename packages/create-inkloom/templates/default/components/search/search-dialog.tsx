import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Search, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { search, type SearchResult } from "@/lib/search";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const searchResults = await search(query);
      setResults(searchResults);
      setSelectedIndex(0);
      setIsLoading(false);
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.path);
      onOpenChange(false);
      setQuery("");
    },
    [navigate, onOpenChange]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, handleSelect, onOpenChange]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)" }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2 overflow-hidden"
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center px-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--color-muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            style={{
              color: "var(--color-foreground)",
              fontFamily: "var(--font-sans)",
            }}
            autoFocus
          />
          {isLoading ? (
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--color-muted-foreground)", borderTopColor: "transparent" }}
            />
          ) : (
            <button
              onClick={() => onOpenChange(false)}
              className="rounded p-1 transition-colors"
              style={{ color: "var(--color-muted-foreground)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--color-accent)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors"
                  style={{
                    background: index === selectedIndex ? "var(--color-accent)" : "transparent",
                    color: index === selectedIndex ? "var(--color-accent-foreground)" : "var(--color-foreground)",
                  }}
                  onMouseOver={(e) => {
                    if (index !== selectedIndex) e.currentTarget.style.background = "var(--color-accent)";
                  }}
                  onMouseOut={(e) => {
                    if (index !== selectedIndex) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "var(--color-muted-foreground)" }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div
                      className="truncate text-xs"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      {result.excerpt}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : query && !isLoading ? (
          <div
            className="p-8 text-center text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            No results found for &quot;{query}&quot;
          </div>
        ) : (
          <div
            className="p-8 text-center text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Start typing to search...
          </div>
        )}

        <div
          className="flex items-center justify-end gap-4 px-4 py-2 text-xs"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-muted-foreground)",
          }}
        >
          <span>
            <kbd
              className="rounded px-1"
              style={{
                background: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
              }}
            >
              ↑
            </kbd>
            <kbd
              className="ml-1 rounded px-1"
              style={{
                background: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
              }}
            >
              ↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd
              className="rounded px-1"
              style={{
                background: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
              }}
            >
              ↵
            </kbd>{" "}
            select
          </span>
          <span>
            <kbd
              className="rounded px-1"
              style={{
                background: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
              }}
            >
              esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
