"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useCallback, useRef } from "react";
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
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SidebarNav } from "@/components/editor/sidebar-nav";
import { BlockEditor } from "@/components/editor/block-editor";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { TitleSection } from "@/components/editor/title-section";
import { PublishModal } from "@/components/editor/publish-modal";
import { useAutoSave } from "@/hooks/use-auto-save";
import type { ThemePreset } from "@/lib/theme-presets";

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
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
  themePreset,
  customPrimaryColor,
  customFonts,
  icon,
  subtitle,
  titleSectionHidden,
  titleIconHidden,
}: {
  pageId: Id<"pages">;
  pageTitle: string;
  showPreview: boolean;
  themePreset: string;
  customPrimaryColor?: string;
  customFonts?: { heading?: string; body?: string; code?: string };
  icon?: string;
  subtitle?: string;
  titleSectionHidden?: boolean;
  titleIconHidden?: boolean;
}) {
  const pageContent = useQuery(api.pages.getContent, { pageId });
  const updateContent = useMutation(api.pages.updateContent);

  const [content, setContent] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const initialLoadRef = useRef(false);

  // Load content from server only on initial load — never overwrite local
  // edits when the Convex query re-fires after a mutation.
  useEffect(() => {
    if (pageContent !== undefined && !initialLoadRef.current) {
      setContent(pageContent?.content ?? null);
      setInitialized(true);
      initialLoadRef.current = true;
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
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <h2 className="font-medium text-lg truncate">{pageTitle}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Loading content...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <h2 className="font-medium text-lg truncate">{pageTitle}</h2>
        <SaveStatusIndicator status={saveStatus} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className={`${showPreview ? "w-1/2" : "w-full"} overflow-auto`}>
          <TitleSection
            pageId={pageId}
            title={pageTitle}
            icon={icon}
            subtitle={subtitle}
            titleSectionHidden={titleSectionHidden}
            titleIconHidden={titleIconHidden}
            themePreset={(themePreset as ThemePreset) ?? "default"}
            customFonts={customFonts}
          />
          <BlockEditor
            content={content}
            onChange={handleChange}
            themePreset={themePreset as import("@/lib/theme-presets").ThemePreset}
            customPrimaryColor={customPrimaryColor}
            customFonts={customFonts}
          />
        </div>
        {showPreview && (
          <div className="w-1/2 border-l border-border overflow-hidden">
            <PreviewPanel
              content={content}
              pageTitle={pageTitle}
              themePreset={themePreset as import("@/lib/theme-presets").ThemePreset}
              customPrimaryColor={customPrimaryColor}
              icon={icon}
              subtitle={subtitle}
              titleSectionHidden={titleSectionHidden}
              titleIconHidden={titleIconHidden}
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
  const { theme, setTheme } = useTheme();
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

  // Publish modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);

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
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </main>
    );
  }

  // Project not found
  if (project === null) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Link
            href="/"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const selectedPage = pages?.find((p) => p._id === selectedPageId);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold truncate">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              showPreview
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Toggle preview"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          {/* Build button — opens publish confirmation modal */}
          <button
            onClick={() => setPublishModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Build project"
          >
            <Hammer className="w-4 h-4" />
            <span className="hidden sm:inline">Build</span>
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </button>
          {/* Settings */}
          <Link
            href={`/projects/${projectId}/settings`}
            className="flex items-center p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
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
            themePreset={(project.settings as Record<string, unknown> | undefined)?.theme as string || "default"}
            customPrimaryColor={(project.settings as Record<string, unknown> | undefined)?.primaryColor as string | undefined}
            customFonts={(project.settings as Record<string, unknown> | undefined)?.fonts as { heading?: string; body?: string; code?: string } | undefined}
            icon={selectedPage.icon}
            subtitle={selectedPage.subtitle}
            titleSectionHidden={selectedPage.titleSectionHidden}
            titleIconHidden={selectedPage.titleIconHidden}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {pages && pages.length > 0
                  ? "Select a page to start editing"
                  : "Create a page to get started"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Publish confirmation modal */}
      <PublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        pages={pages}
        projectId={projectId}
      />
    </main>
  );
}
