"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  FileText,
  Eye,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Hammer,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Page {
  _id: Id<"pages">;
  title: string;
  path: string;
  isPublished: boolean;
}

type BuildState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "success"; pageCount: number; fileCount: number; outDir: string }
  | { status: "error"; message: string };

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: Page[] | undefined;
  projectId: string;
}

// ---------------------------------------------------------------------------
// PublishModal
// ---------------------------------------------------------------------------

export function PublishModal({
  open,
  onOpenChange,
  pages,
  projectId,
}: PublishModalProps) {
  const updateMeta = useMutation(api.pages.updateMeta);
  const [publishingPageIds, setPublishingPageIds] = useState<Set<string>>(
    new Set()
  );
  const [buildState, setBuildState] = useState<BuildState>({ status: "idle" });

  const allPages = pages ?? [];
  const unpublishedPages = allPages.filter((p) => !p.isPublished);
  const publishedCount = allPages.length - unpublishedPages.length;

  // ---- Publish a single page ----
  const handlePublishPage = useCallback(
    async (pageId: Id<"pages">) => {
      setPublishingPageIds((prev) => new Set(prev).add(pageId));
      try {
        await updateMeta({ pageId, isPublished: true });
      } finally {
        setPublishingPageIds((prev) => {
          const next = new Set(prev);
          next.delete(pageId);
          return next;
        });
      }
    },
    [updateMeta]
  );

  // ---- Publish all unpublished pages ----
  const handlePublishAll = useCallback(async () => {
    const ids = unpublishedPages.map((p) => p._id);
    setPublishingPageIds(new Set(ids));
    try {
      await Promise.all(
        ids.map((id) => updateMeta({ pageId: id, isPublished: true }))
      );
    } finally {
      setPublishingPageIds(new Set());
    }
  }, [unpublishedPages, updateMeta]);

  // ---- Trigger build ----
  const handleBuild = useCallback(async () => {
    setBuildState({ status: "building" });
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Build failed");
      }
      setBuildState({
        status: "success",
        pageCount: json.data.pageCount,
        fileCount: json.data.fileCount,
        outDir: json.data.outDir,
      });
    } catch (err) {
      setBuildState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [projectId]);

  // ---- Reset state when dialog closes ----
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // Allow closing only if not mid-build
        if (buildState.status === "building") return;
        setBuildState({ status: "idle" });
      }
      onOpenChange(nextOpen);
    },
    [buildState.status, onOpenChange]
  );

  // ---- Render helpers ----

  const renderIdleContent = () => (
    <>
      <DialogHeader>
        <DialogTitle>Publish your docs</DialogTitle>
        <DialogDescription>
          Build and publish your documentation site.
        </DialogDescription>
      </DialogHeader>

      {/* Unpublished pages warning */}
      {unpublishedPages.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5">
          {/* Header with count and Publish All */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm font-medium">
                {unpublishedPages.length} draft{" "}
                {unpublishedPages.length === 1 ? "page" : "pages"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handlePublishAll}
              disabled={publishingPageIds.size > 0}
            >
              {publishingPageIds.size > 0 ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              Publish All
            </Button>
          </div>

          {/* Warning text */}
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            These pages won&apos;t be included in your published site.
          </p>

          {/* Scrollable list of draft pages */}
          <div className="max-h-48 overflow-y-auto border-t border-amber-500/10">
            {unpublishedPages.map((page) => (
              <div
                key={page._id}
                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-amber-500/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{page.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {page.path}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => handlePublishPage(page._id)}
                  disabled={publishingPageIds.has(page._id)}
                >
                  {publishingPageIds.has(page._id) ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="mr-1 h-3 w-3" />
                  )}
                  Publish
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready summary when all pages are published */}
      {unpublishedPages.length === 0 && allPages.length > 0 && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-sm">
              Ready to build. {publishedCount}{" "}
              {publishedCount === 1 ? "page" : "pages"} will be published.
            </p>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleBuild}>
          <Hammer className="mr-1.5 h-4 w-4" />
          Build Now
        </Button>
      </DialogFooter>
    </>
  );

  const renderBuildingContent = () => (
    <>
      <DialogHeader>
        <DialogTitle>Building your site</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          Building your site&hellip;
        </p>
      </div>
    </>
  );

  const renderSuccessContent = () => {
    if (buildState.status !== "success") return null;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Build complete!</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-sm text-center">
            {buildState.pageCount} {buildState.pageCount === 1 ? "page" : "pages"},{" "}
            {buildState.fileCount} {buildState.fileCount === 1 ? "file" : "files"}{" "}
            &rarr; {buildState.outDir}/
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </>
    );
  };

  const renderErrorContent = () => {
    if (buildState.status !== "error") return null;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Build failed</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm text-center text-destructive">
            {buildState.message}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleBuild}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {buildState.status === "idle" && renderIdleContent()}
        {buildState.status === "building" && renderBuildingContent()}
        {buildState.status === "success" && renderSuccessContent()}
        {buildState.status === "error" && renderErrorContent()}
      </DialogContent>
    </Dialog>
  );
}
