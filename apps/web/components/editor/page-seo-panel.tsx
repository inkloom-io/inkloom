"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { Textarea } from "@inkloom/ui/textarea";
import { Button } from "@inkloom/ui/button";
import { X, Search, Check, Loader2 } from "lucide-react";

interface PageSeoData {
  seoTitle?: string;
  seoDescription?: string;
  ogImageAssetId?: Id<"assets">;
  noindex?: boolean;
}

interface PageSeoPanelProps {
  pageId: Id<"pages">;
  initialData: PageSeoData;
  pageTitle: string;
  onClose: () => void;
}

export function PageSeoPanel({
  pageId,
  initialData,
  pageTitle,
  onClose,
}: PageSeoPanelProps) {
  const t = useTranslations("editor.pageSeo");
  const updatePage = useMutation(api.pages.update);

  const [seoTitle, setSeoTitle] = useState(initialData.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initialData.seoDescription || "");
  const [noindex, setNoindex] = useState(initialData.noindex || false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const debounceRef = useRef<NodeJS.Timeout>();
  const savedRef = useRef<NodeJS.Timeout>();

  const save = useCallback(
    async (data: { seoTitle: string; seoDescription: string; noindex: boolean }) => {
      setSaveStatus("saving");
      try {
        await updatePage({
          pageId,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          noindex: data.noindex,
        });
        setSaveStatus("saved");
        if (savedRef.current) clearTimeout(savedRef.current);
        savedRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save SEO data:", err);
        setSaveStatus("idle");
      }
    },
    [updatePage, pageId]
  );

  // Debounced auto-save
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save({ seoTitle, seoDescription, noindex });
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [seoTitle, seoDescription, noindex, save]);

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {saveStatus === "saved" && (
            <Check className="h-3 w-3 text-green-500" />
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="seoTitle" className="text-xs">{t("seoTitle")}</Label>
          <Input
            id="seoTitle"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder={pageTitle}
          />
          <p className="text-[10px] text-muted-foreground">
            {t("seoTitleDescription")}
            {seoTitle.length > 0 && (
              <span className={seoTitle.length > 60 ? " text-amber-500" : ""}>
                {" "}{seoTitle.length}/60
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seoDescription" className="text-xs">{t("metaDescription")}</Label>
          <Textarea
            id="seoDescription"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            placeholder={t("metaDescriptionPlaceholder")}
            rows={3}
          />
          <p className="text-[10px] text-muted-foreground">
            {t("metaDescriptionHint")}
            {seoDescription.length > 0 && (
              <span className={seoDescription.length > 160 ? " text-amber-500" : ""}>
                {" "}{seoDescription.length}/160
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="noindex"
              checked={noindex}
              onChange={(e) => setNoindex(e.target.checked)}
              className="rounded border-muted-foreground/50 accent-primary"
            />
            <Label htmlFor="noindex" className="text-xs cursor-pointer">
              {t("excludeFromSearchEngines")}
            </Label>
          </div>
          <p className="text-[10px] text-muted-foreground pl-5">
            {t("noindexDescription")}
          </p>
        </div>

        {/* Search preview */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("searchPreview")}</p>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
              {seoTitle || pageTitle || t("pageTitle")}
            </p>
            <p className="text-[11px] text-green-700 dark:text-green-400 truncate">
              docs.example.com &rsaquo; ...
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {seoDescription || t("noDescriptionSet")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
