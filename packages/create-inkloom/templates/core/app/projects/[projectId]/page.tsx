"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft,
  FileText,
  Eye,
  Hammer,
  Settings,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { SidebarNav } from "@/components/editor/sidebar-nav";
import { BlockEditor } from "@/components/editor/block-editor";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Session storage helpers for persisting selected page
// ---------------------------------------------------------------------------

function getStorageKey(projectId: string) {
  return `inkloom-selected-page-${projectId}`;
}

function getPersistedPageId(projectId: string): Id<"pages"> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(getStorageKey(projectId));
    return stored ? (stored as Id<"pages">) : null;
  } catch {
    return null;
  }
}

function persistPageId(projectId: string, pageId: Id<"pages"> | null) {
  if (typeof window === "undefined") return;
  try {
    if (pageId) {
      sessionStorage.setItem(getStorageKey(projectId), pageId);
    } else {
      sessionStorage.removeItem(getStorageKey(projectId));
    }
  } catch {
    // sessionStorage may be unavailable
  }
}

// ---------------------------------------------------------------------------
// Save status indicator
// ---------------------------------------------------------------------------

function SaveStatusIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved";
}) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-400">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          Saved
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Editor content wrapper — loads content and renders BlockEditor with auto-save
// ---------------------------------------------------------------------------

function EditorContent({
  pageId,
  pageTitle,
  showPreview,
}: {
  pageId: Id<"pages">;
  pageTitle: string;
  showPreview: boolean;
}) {
  const pageContent = useQuery(api.pages.getContent, { pageId });
  const updateContent = useMutation(api.pages.updateContent);

  const [content, setContent] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load content from server when page content arrives
  useEffect(() => {
    if (pageContent !== undefined) {
      setContent(pageContent?.content ?? null);
      setInitialized(true);
    }
  }, [pageContent]);

  const handleSave = useCallback(
    async (value: string | null) => {
      if (value === null) return;
      await updateContent({
        pageId,
        content: value,
      });
    },
    [pageId, updateContent]
  );

  const saveStatus = useAutoSave(content, handleSave, 500, initialized);

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  // Loading state
  if (pageContent === undefined) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 shrink-0">
          <h2 className="font-medium text-lg truncate">{pageTitle}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
            <p className="text-sm text-neutral-500">Loading content...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 shrink-0">
        <h2 className="font-medium text-lg truncate">{pageTitle}</h2>
        <SaveStatusIndicator status={saveStatus} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className={`${showPreview ? "w-1/2" : "w-full"} overflow-auto`}>
          <BlockEditor content={content} onChange={handleChange} />
        </div>
        {showPreview && (
          <div className="w-1/2 border-l border-neutral-800 overflow-hidden">
            <PreviewPanel
              content={content}
              pageTitle={pageTitle}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const project = useQuery(api.projects.get, {
    id: projectId as Id<"projects">,
  });

  const branchId = project?.defaultBranchId;
  const pages = useQuery(
    api.pages.listByBranch,
    branchId ? { branchId } : "skip"
  );

  // State: selected page — initialize from sessionStorage
  const [selectedPageId, setSelectedPageId] = useState<Id<"pages"> | null>(
    () => getPersistedPageId(projectId)
  );

  // Preview toggle state
  const [showPreview, setShowPreview] = useState(false);

  // Build state
  const [buildStatus, setBuildStatus] = useState<"idle" | "building">("idle");
  const { toast } = useToast();

  const handleBuild = useCallback(async () => {
    if (buildStatus === "building") return;
    setBuildStatus("building");
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
      toast({
        type: "success",
        title: "Build complete",
        description: `${json.data.pageCount} pages, ${json.data.fileCount} files written to ${json.data.outDir}/`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Build failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBuildStatus("idle");
    }
  }, [buildStatus, projectId, toast]);

  // Persist selected page to sessionStorage
  const handleSelectPage = useCallback(
    (pageId: Id<"pages">) => {
      setSelectedPageId(pageId);
      persistPageId(projectId, pageId);
    },
    [projectId]
  );

  // Validate persisted page ID — clear if page no longer exists
  useEffect(() => {
    if (pages && selectedPageId) {
      const exists = pages.some((p) => p._id === selectedPageId);
      if (!exists) {
        setSelectedPageId(null);
        persistPageId(projectId, null);
      }
    }
  }, [pages, selectedPageId, projectId]);

  // Loading state
  if (project === undefined) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          <p className="text-neutral-500">Loading project...</p>
        </div>
      </main>
    );
  }

  // Project not found
  if (project === null) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400 mb-4">Project not found</p>
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const selectedPage = pages?.find((p) => p._id === selectedPageId);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-neutral-700">/</span>
          <h1 className="font-semibold truncate">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              showPreview
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
            title="Toggle preview"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          {/* Build button */}
          <button
            onClick={handleBuild}
            disabled={buildStatus === "building"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              buildStatus === "building"
                ? "text-neutral-500 cursor-not-allowed"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
            title="Build project"
          >
            {buildStatus === "building" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Hammer className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {buildStatus === "building" ? "Building..." : "Build"}
            </span>
          </button>
          {/* Settings */}
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex items-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
            title="Project settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (260px) */}
        {branchId && (
          <SidebarNav
            projectId={projectId as Id<"projects">}
            branchId={branchId}
            selectedPageId={selectedPageId}
            onSelectPage={handleSelectPage}
          />
        )}

        {/* Editor area (flex-1) */}
        {selectedPage ? (
          <EditorContent
            key={selectedPage._id}
            pageId={selectedPage._id}
            pageTitle={selectedPage.title}
            showPreview={showPreview}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500">
                {pages && pages.length > 0
                  ? "Select a page to start editing"
                  : "Create a page to get started"}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
