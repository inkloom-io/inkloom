"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { SidebarNav } from "@/components/editor/sidebar-nav";

/**
 * Extract plain text from BlockNote JSON blocks.
 */
function extractTextFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const lines: string[] = [];
  for (const block of blocks) {
    if (block && typeof block === "object" && "content" in block) {
      const content = block.content;
      if (Array.isArray(content)) {
        const text = content
          .filter(
            (item: unknown): item is { type: string; text: string } =>
              typeof item === "object" &&
              item !== null &&
              "type" in item &&
              (item as { type: string }).type === "text" &&
              "text" in item
          )
          .map((item) => item.text)
          .join("");
        lines.push(text);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Wrap plain text back into BlockNote JSON paragraph blocks.
 */
function wrapTextInBlocks(text: string): string {
  const lines = text.split("\n");
  const blocks = lines.map((line, i) => ({
    id: `block-${Date.now()}-${i}`,
    type: "paragraph",
    props: {},
    content: [
      {
        type: "text",
        text: line,
        styles: {},
      },
    ],
    children: [],
  }));
  return JSON.stringify(blocks);
}

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

  const [selectedPageId, setSelectedPageId] = useState<Id<"pages"> | null>(
    null
  );
  const [editorText, setEditorText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pageContent = useQuery(
    api.pages.getContent,
    selectedPageId ? { pageId: selectedPageId } : "skip"
  );
  const updateContent = useMutation(api.pages.updateContent);

  // Load content when a page is selected
  useEffect(() => {
    if (pageContent) {
      try {
        const blocks = JSON.parse(pageContent.content);
        setEditorText(extractTextFromBlocks(blocks));
      } catch {
        setEditorText(pageContent.content);
      }
    }
  }, [pageContent]);

  const handleSave = useCallback(async () => {
    if (!selectedPageId) return;
    setIsSaving(true);
    try {
      await updateContent({
        pageId: selectedPageId,
        content: wrapTextInBlocks(editorText),
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedPageId, editorText, updateContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  // Loading state
  if (project === undefined) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <p className="text-neutral-500">Loading project...</p>
      </main>
    );
  }

  // Project not found
  if (project === null) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-center">
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
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Dashboard</span>
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="font-semibold truncate">{project.name}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {branchId && (
          <SidebarNav
            projectId={projectId as Id<"projects">}
            branchId={branchId}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
          />
        )}

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPage ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 shrink-0">
                <h2 className="font-medium text-lg truncate">
                  {selectedPage.title}
                </h2>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
              <div className="flex-1 p-6 overflow-hidden">
                <textarea
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-neutral-100 placeholder-neutral-500 resize-none focus:outline-none focus:border-neutral-600 font-mono text-sm leading-relaxed"
                  placeholder="Start writing..."
                />
              </div>
            </>
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
      </div>
    </main>
  );
}
