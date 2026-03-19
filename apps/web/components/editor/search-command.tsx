"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@inkloom/ui/command";
import { FileText, Loader2 } from "lucide-react";

interface SearchCommandProps {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPage: (pageId: Id<"pages">) => void;
}

export function SearchCommand({
  projectId,
  open,
  onOpenChange,
  onSelectPage,
}: SearchCommandProps) {
  const t = useTranslations("editor.search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isRebuilding, setIsRebuilding] = useState(false);
  const hasRebuiltRef = useRef(false);

  const rebuildIndex = useMutation(api.search.rebuildProjectIndex);

  // Rebuild index on first open
  useEffect(() => {
    if (open && !hasRebuiltRef.current) {
      hasRebuiltRef.current = true;
      setIsRebuilding(true);
      rebuildIndex({ projectId })
        .then(() => setIsRebuilding(false))
        .catch(() => setIsRebuilding(false));
    }
  }, [open, projectId, rebuildIndex]);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery(
    api.search.searchProject,
    debouncedQuery.trim()
      ? { projectId, query: debouncedQuery, limit: 10 }
      : "skip"
  );

  // Keyboard shortcut to open (Cmd+K without shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond to Cmd+K without shift (Cmd+Shift+K is for Create Link)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = useCallback(
    (pageId: Id<"pages">) => {
      onSelectPage(pageId);
      onOpenChange(false);
      setQuery("");
    },
    [onSelectPage, onOpenChange]
  );

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t("placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isRebuilding && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("buildingIndex")}
          </div>
        )}
        {!isRebuilding && query && (!debouncedQuery || searchResults === undefined) && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("searching")}
          </div>
        )}
        {!isRebuilding && debouncedQuery && searchResults !== undefined && searchResults.length === 0 && (
          <div className="flex flex-col items-center py-4">
            <img
              src="/mascot-search.svg"
              alt=""
              className="mb-3 h-20 w-20 opacity-80"
            />
            <span className="text-sm text-muted-foreground">{t("noResults")}</span>
          </div>
        )}
        {!isRebuilding && searchResults && searchResults.length > 0 && (
          <CommandGroup heading={t("pagesGroup")}>
            {searchResults.map((result: any) => (
              <CommandItem
                key={result.id}
                value={result.title}
                onSelect={() => handleSelect(result.pageId)}
                className="flex items-start gap-3 py-3"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{result.title}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {result.excerpt}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!isRebuilding && !query && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("startTyping")}
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
