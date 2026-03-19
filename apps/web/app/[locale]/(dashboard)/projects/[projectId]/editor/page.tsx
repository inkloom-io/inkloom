"use client";

import { use, useState, useCallback, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { BlockNoteEditor } from "@blocknote/core";
import { EditorSidebar } from "@/components/editor/sidebar-nav";
import { EditorToolbar } from "@/components/editor/toolbar";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { SearchCommand } from "@/components/editor/search-command";
import { Sheet, SheetContent } from "@inkloom/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@inkloom/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import type { ThemePreset } from "@/lib/theme-presets";
import {
  useCollaboration,
  useBlockNoteCollaboration,
} from "@/hooks/use-collaboration";
import { useAuth } from "@/hooks/use-auth";
import { CommentsPanel } from "@/components/editor/comments";
import { VersionHistoryPanel } from "@/components/editor/version-history";
import { VersionDiff } from "@/components/editor/version-diff";
import { usePermissions } from "@/components/dashboard/permission-guard";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { useEditLock } from "@/hooks/use-edit-lock";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { EditLockBanner } from "@/components/edit-lock-banner";
import { AiGenerationBanner } from "@/components/editor/ai-generation-banner";
import { TitleSection } from "@/components/editor/title-section";
import { PageSeoPanel } from "@/components/editor/page-seo-panel";
import { trackEvent } from "@/lib/analytics";

// Dynamic import to avoid BlockNote SSR issues with React
const BlockEditor = dynamic(
  () =>
    import("@/components/editor/block-editor").then((mod) => mod.BlockEditor),
  { ssr: false }
);

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default function EditorPage({ params }: EditorPageProps) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("editor.page");
  const project = useQuery(api.projects.get, {
    projectId: projectId as Id<"projects">,
  });

  // Resolve ?branch= param to a branch record (skipped when absent)
  const branchNameParam = searchParams.get("branch");
  const branchFromUrl = useQuery(
    api.branches.getByName,
    branchNameParam
      ? { projectId: projectId as Id<"projects">, name: branchNameParam }
      : "skip"
  );

  // Persisted branch: remember last viewed branch per project in localStorage
  const branchStorageKey = `inkloom:branch:${projectId}`;
  const savedBranchId = useRef<string | null>(
    typeof window !== "undefined"
      ? localStorage.getItem(branchStorageKey)
      : null
  );
  const savedBranch = useQuery(
    api.branches.get,
    savedBranchId.current
      ? { branchId: savedBranchId.current as Id<"branches"> }
      : "skip"
  );

  // Branch state: starts with project's default branch
  const [currentBranchId, setCurrentBranchId] = useState<Id<"branches"> | null>(
    null
  );

  // Track whether we've completed initial branch resolution
  const initialBranchResolved = useRef(false);

  // Initialize branch from URL param, localStorage, or project default
  useEffect(() => {
    if (initialBranchResolved.current) return;
    if (!project?.defaultBranchId) return;

    // If there's a branch name in the URL, wait for the query to resolve
    if (branchNameParam) {
      // Still loading
      if (branchFromUrl === undefined) return;
      // Resolved successfully — use it
      if (branchFromUrl) {
        initialBranchResolved.current = true;
        setCurrentBranchId(branchFromUrl._id);
        localStorage.setItem(branchStorageKey, branchFromUrl._id);
        return;
      }
      // Branch not found — clear the stale param and let effect re-run
      const params = new URLSearchParams(searchParams.toString());
      params.delete("branch");
      router.replace(`?${params.toString()}`, { scroll: false });
      return;
    }

    // Check localStorage for last viewed branch
    if (savedBranchId.current) {
      // Still loading
      if (savedBranch === undefined) return;
      // Branch exists and isn't soft-deleted — use it
      if (
        savedBranch &&
        !savedBranch.deletedAt &&
        savedBranch.projectId === (projectId as Id<"projects">)
      ) {
        initialBranchResolved.current = true;
        setCurrentBranchId(savedBranch._id);
        // Update URL if non-default
        if (savedBranch._id !== project.defaultBranchId) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("branch", savedBranch.name);
          router.replace(`?${params.toString()}`, { scroll: false });
        }
        return;
      }
      // Stale — clear it
      localStorage.removeItem(branchStorageKey);
    }

    // Fallback to default branch
    initialBranchResolved.current = true;
    setCurrentBranchId(project.defaultBranchId);
  }, [
    project?.defaultBranchId,
    branchNameParam,
    branchFromUrl,
    savedBranch,
    branchStorageKey,
    projectId,
    searchParams,
    router,
  ]);

  const currentBranch = useQuery(
    api.branches.get,
    currentBranchId ? { branchId: currentBranchId } : "skip"
  );

  const pages = useQuery(
    api.pages.listByBranch,
    currentBranchId ? { branchId: currentBranchId } : "skip"
  );
  const folders = useQuery(
    api.folders.listByBranch,
    currentBranchId ? { branchId: currentBranchId } : "skip"
  );

  const [selectedPageId, setSelectedPageId] = useState<Id<"pages"> | null>(
    null
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isPageSeoOpen, setIsPageSeoOpen] = useState(false);
  const [comparingVersion, setComparingVersion] = useState<number | null>(null);
  const versionHistoryGate = useFeatureGate(
    "version_history",
    projectId as Id<"projects">
  );
  const [restoreCounter, setRestoreCounter] = useState(0);
  const [collaborationDisabled, setCollaborationDisabled] = useState(false);
  const [showDisableCollabWarning, setShowDisableCollabWarning] =
    useState(false);
  // Once collaboration mode is established for a page, keep the "-collab"
  // editor key suffix even during brief disconnections (token refresh, network
  // blips) to avoid unnecessary BlockEditor remounts that reset cursor/undo.
  const [collaborationEstablished, setCollaborationEstablished] =
    useState(false);
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);
  const [newCommentSelection, setNewCommentSelection] = useState<{
    blockId: string;
    quotedText?: string;
    inlineStart?: number;
    inlineEnd?: number;
  } | null>(null);

  // Get current Convex user for comments and edit lock
  const { userId: currentUserId, user } = useAuth();

  // Get user permissions (admins can delete any comment)
  const { role } = usePermissions();
  const isAdmin = role === "admin" || role === "owner";

  // Ref for pending restore content — always set before remounting the editor
  const pendingRestoreRef = useRef<string | null>(null);

  const handleEditorReady = useCallback((editorInstance: BlockNoteEditor) => {
    setEditor(editorInstance);
    // Apply pending restore content after a frame to ensure the editor is
    // fully initialized (DOM mounted, ProseMirror view created)
    if (pendingRestoreRef.current) {
      const content = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      requestAnimationFrame(() => {
        try {
          const blocks = JSON.parse(content);
          editorInstance.replaceBlocks(editorInstance.document, blocks);
        } catch (e) {
          console.error("Failed to apply pending restore:", e);
        }
      });
    }
  }, []);

  // Handle adding a comment from the formatting toolbar
  const handleAddComment = useCallback(
    (selection: {
      blockId: string;
      quotedText?: string;
      inlineStart?: number;
      inlineEnd?: number;
    }) => {
      setNewCommentSelection(selection);
      setIsCommentsOpen(true);
    },
    []
  );

  // Collaboration toggle callbacks (Ultimate plan only)
  const handleDisableCollaboration = useCallback(() => {
    setShowDisableCollabWarning(true);
  }, []);

  const handleConfirmDisable = useCallback(() => {
    setCollaborationDisabled(true);
    setShowDisableCollabWarning(false);
  }, []);

  const handleEnableCollaboration = useCallback(() => {
    setCollaborationDisabled(false);
  }, []);

  // Feature gate: realtime collaboration requires Ultimate plan
  const collabGate = useFeatureGate(
    "realtime_collaboration",
    projectId as Id<"projects">
  );

  // Real-time collaboration — only attempt connection if feature is available
  const isCollaborationEnabled = !!process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  const collaboration = useCollaboration({
    pageId: selectedPageId as Id<"pages">,
    enabled:
      !!selectedPageId &&
      isCollaborationEnabled &&
      collabGate.available &&
      !collaborationDisabled,
  });

  // Get BlockNote-compatible collaboration config
  const collaborationConfig = useBlockNoteCollaboration(collaboration);

  // Determine if we should wait for collaboration or render immediately
  // Treat errors as "ready" so we fall back to solo editable mode
  const isCollaborationReady =
    !isCollaborationEnabled ||
    !collabGate.available ||
    collaboration.connected ||
    !!collaboration.error ||
    collaborationDisabled;

  // Soft edit lock for non-Ultimate plans (when realtime collaboration is unavailable)
  const editLock = useEditLock({
    pageId: selectedPageId,
    userId: currentUserId ?? null,
    userName: user?.name ?? user?.email ?? "Unknown",
    enabled: !!selectedPageId && !!currentUserId && !collabGate.available && !collabGate.isLoading,
  });

  // When edit-locked by another user, make editor read-only
  const isEditLocked = editLock.isLocked && !collabGate.available;

  // Latch: once collaboration connects for this page, keep the "-collab"
  // suffix so brief disconnections during token refresh don't remount the editor.
  useEffect(() => {
    if (collaborationConfig) setCollaborationEstablished(true);
  }, [collaborationConfig]);
  useEffect(() => {
    setCollaborationEstablished(false);
  }, [selectedPageId]);

  // Create a stable editor key that changes when collaboration state changes.
  // This forces an editor remount when collaboration first becomes ready, but
  // NOT on subsequent reconnections (collaborationEstablished stays true).
  const editorKey = useMemo(() => {
    if (!selectedPageId) return "no-page";
    const collabSuffix =
      collaborationConfig || collaborationEstablished ? "-collab" : "-solo";
    return `${selectedPageId}${collabSuffix}-r${restoreCounter}`;
  }, [
    selectedPageId,
    collaborationConfig,
    collaborationEstablished,
    restoreCounter,
  ]);

  const selectedPage = useQuery(
    api.pages.get,
    selectedPageId ? { pageId: selectedPageId } : "skip"
  );
  const pageContent = useQuery(
    api.pages.getContent,
    selectedPageId ? { pageId: selectedPageId } : "skip"
  );

  const updateContent = useMutation(api.pages.updateContent);

  // Get comment threads for comment count and highlighting
  const commentThreads = useQuery(
    api.comments.listByPage,
    selectedPageId ? { pageId: selectedPageId } : "skip"
  );
  const openCommentCount =
    commentThreads?.filter((t: any) => t.status === "open").length ?? 0;

  // Transform threads for the editor highlight system (with data for hover tooltip)
  const editorCommentThreads = useMemo(() => {
    if (!commentThreads) return undefined;
    return commentThreads.map((thread: any) => ({
      _id: thread._id,
      blockId: thread.blockId,
      quotedText: thread.quotedText,
      status: thread.status,
      // Position offsets for disambiguating multiple occurrences
      inlineStart: thread.inlineStart,
      inlineEnd: thread.inlineEnd,
      // Additional data for hover tooltip
      authorName: thread.creator?.name,
      authorAvatar: thread.creator?.avatarUrl,
      commentContent: thread.comments[0]?.content,
      commentCount: thread.commentCount,
      createdAt: thread.createdAt,
    }));
  }, [commentThreads]);

  // State for selected thread (when clicking a highlight)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Handle clicking on a comment highlight in the editor
  const handleThreadClick = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setIsCommentsOpen(true);
  }, []);

  // Memoize clear callbacks to prevent re-render loops
  const handleClearNewComment = useCallback(() => {
    setNewCommentSelection(null);
  }, []);

  const handleClearSelectedThread = useCallback(() => {
    setSelectedThreadId(null);
  }, []);

  // Track the editor's current content locally so the preview panel
  // always reflects the latest state, even before content is persisted to Convex
  const [editorContent, setEditorContent] = useState<string | null>(null);

  // Reset local editor content when switching pages
  useEffect(() => {
    setEditorContent(null);
  }, [selectedPageId]);

  // Queue restored content and force editor remount. The pending content is
  // applied in handleEditorReady using the fresh editorInstance (no stale refs).
  const restoreEditorContent = useCallback((content: string) => {
    pendingRestoreRef.current = content;
    setEditorContent(null);
    setRestoreCounter((c) => c + 1);
  }, []);

  // Debounced content save to Convex
  const pendingContentRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleContentChange = useCallback(
    (content: string) => {
      if (!selectedPageId) {
        return;
      }

      // Don't persist content changes while in read-only mode during collaboration connection
      if (isCollaborationEnabled && !isCollaborationReady) {
        return;
      }

      // Always update local content so the preview panel shows the latest state
      setEditorContent(content);

      // Debounce content updates to prevent OCC conflicts from rapid typing.
      // In collaboration mode, use a longer debounce since real-time sync is
      // handled by PartyKit/Yjs — but we still persist to Convex so the
      // preview panel and publish flow always have access to the latest content.
      pendingContentRef.current = content;
      setIsSaving(true);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const debounceMs = collaboration.connected ? 2000 : 500;
      debounceTimerRef.current = setTimeout(() => {
        const contentToSave = pendingContentRef.current;
        if (contentToSave) {
          pendingContentRef.current = null;
          updateContent({
            pageId: selectedPageId,
            content: contentToSave,
            updatedBy: currentUserId,
          });
          trackEvent("page_edited", {
            projectId,
            wordCount: contentToSave.split(/\s+/).filter(Boolean).length,
          });
        }
        setIsSaving(false);
      }, debounceMs);
    },
    [
      selectedPageId,
      collaboration.connected,
      updateContent,
      isCollaborationEnabled,
      isCollaborationReady,
    ]
  );

  // Flush any pending debounced content save immediately.
  // Awaitable so branch creation can wait for the save to land first.
  const flushContentSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const content = pendingContentRef.current;
    pendingContentRef.current = null;
    setIsSaving(false);
    if (content && selectedPageId) {
      await updateContent({
        pageId: selectedPageId,
        content,
        updatedBy: currentUserId,
      });
    }
  }, [selectedPageId, updateContent, currentUserId]);

  // Handle branch switching
  const handleBranchSwitch = useCallback(
    (branchId: Id<"branches">, branchName?: string) => {
      // Flush (not discard) any pending debounced save so edits aren't lost
      flushContentSave();

      // Reset editor state before switching branch
      setEditor(null);
      setEditorContent(null);
      setSelectedPageId(null);
      setCurrentBranchId(branchId);

      // Persist last viewed branch
      localStorage.setItem(branchStorageKey, branchId);

      // Update URL: omit param for the default branch, set for others
      const isDefault = branchId === project?.defaultBranchId;
      const params = new URLSearchParams(searchParams.toString());
      if (isDefault) {
        params.delete("branch");
      } else if (branchName) {
        params.set("branch", branchName);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [
      flushContentSave,
      project?.defaultBranchId,
      branchStorageKey,
      searchParams,
      router,
    ]
  );

  // Select first page by default when pages load for the current branch.
  // Guard: only auto-select when the pages actually belong to currentBranchId
  // to avoid picking a stale page from a previously-cached branch query.
  useEffect(() => {
    if (!pages || !currentBranchId) return;

    // If selected page isn't in the current pages list, clear it
    if (selectedPageId && !pages.some((p: any) => p._id === selectedPageId)) {
      setSelectedPageId(null);
      return;
    }

    // Auto-select first page if none selected and pages belong to current branch
    if (!selectedPageId && pages.length > 0 && pages[0]) {
      if (pages[0].branchId === currentBranchId) {
        setSelectedPageId(pages[0]._id);
      }
    }
  }, [pages, selectedPageId, currentBranchId]);

  if (project === undefined) {
    return (
      <div
        className="flex gap-0 border border-[var(--glass-border)]"
        style={{
          height: "calc(100vh - 8rem)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div className="w-64 animate-pulse bg-[var(--surface-bg)] border-r border-[var(--glass-border)]" />
        <div className="flex-1 animate-pulse bg-[var(--surface-bg)]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--text-dim)]">{t("projectNotFound")}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex gap-0 border border-[var(--glass-border)]"
        style={{
          height: "calc(100vh - 8rem)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px var(--surface-bg) inset",
        }}
      >
        <EditorSidebar
          projectId={projectId as Id<"projects">}
          branchId={currentBranchId!}
          pages={pages || []}
          folders={folders || []}
          selectedPageId={selectedPageId}
          onSelectPage={setSelectedPageId}
          currentBranchId={currentBranchId!}
          onSwitchBranch={handleBranchSwitch}
          onFlushContent={flushContentSave}
        />
        <div className="flex flex-1 flex-col border-l border-[var(--glass-border)]">
          <EditorToolbar
            project={project}
            page={selectedPage}
            isPreviewOpen={isPreviewOpen}
            onTogglePreview={() => setIsPreviewOpen(!isPreviewOpen)}
            editor={editor}
            onOpenSearch={() => setIsSearchOpen(true)}
            collaboration={{
              connected: collaboration.connected,
              synced: collaboration.synced,
              error: collaboration.error,
              activeUsers: collaboration.activeUsers,
              currentUser: collaboration.currentUser,
            }}
            collaborationGated={
              isCollaborationEnabled &&
              !collabGate.available &&
              !collabGate.isLoading
            }
            {...(isCollaborationEnabled && collabGate.available
              ? {
                  onDisableCollaboration: handleDisableCollaboration,
                  onEnableCollaboration: handleEnableCollaboration,
                  collaborationDisabled,
                }
              : {})}
            isCommentsOpen={isCommentsOpen}
            onToggleComments={() => {
              setIsCommentsOpen(!isCommentsOpen);
              if (!isCommentsOpen) setIsVersionHistoryOpen(false);
            }}
            commentCount={openCommentCount}
            isSaving={isSaving}
            branchId={currentBranchId ?? undefined}
            branchName={currentBranch?.name}
            isDefaultBranch={currentBranch?.isDefault ?? true}
            isVersionHistoryOpen={isVersionHistoryOpen}
            onToggleVersionHistory={() => {
              setIsVersionHistoryOpen(!isVersionHistoryOpen);
              if (!isVersionHistoryOpen) { setIsCommentsOpen(false); setIsPageSeoOpen(false); }
            }}
            isPageSeoOpen={isPageSeoOpen}
            onTogglePageSeo={() => {
              setIsPageSeoOpen(!isPageSeoOpen);
              if (!isPageSeoOpen) { setIsCommentsOpen(false); setIsVersionHistoryOpen(false); }
            }}
            pageId={selectedPageId ?? undefined}
            currentUserId={currentUserId}
          />
          <AiGenerationBanner projectId={projectId as Id<"projects">} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-auto">
              {/* Version diff view replaces the editor when comparing */}
              {comparingVersion !== null && selectedPageId && pageContent ? (
                <VersionDiff
                  pageId={selectedPageId}
                  version={comparingVersion}
                  currentContent={editorContent ?? pageContent.content}
                  currentUserId={currentUserId}
                  onExit={() => setComparingVersion(null)}
                  onRestore={(content: string) => {
                    setComparingVersion(null);
                    restoreEditorContent(content);
                  }}
                  pageTitle={selectedPage?.title ?? ""}
                  pageSubtitle={selectedPage?.subtitle}
                  pageFolderId={selectedPage?.folderId ?? undefined}
                  folders={folders ?? []}
                  navTabs={project.settings?.navTabs ?? []}
                  themePreset={
                    (project.settings?.theme as ThemePreset) || "default"
                  }
                  customPrimaryColor={project.settings?.primaryColor}
                  customBackgroundColorLight={
                    project.settings?.backgroundColorLight
                  }
                  customBackgroundColorDark={
                    project.settings?.backgroundColorDark
                  }
                  customBackgroundSubtleColorLight={
                    project.settings?.backgroundSubtleColorLight
                  }
                  customBackgroundSubtleColorDark={
                    project.settings?.backgroundSubtleColorDark
                  }
                />
              ) : selectedPageId && pageContent ? (
                <div className="relative h-full animate-in fade-in duration-200">
                  {selectedPage && (
                    <TitleSection
                      pageId={selectedPageId}
                      title={selectedPage.title}
                      icon={selectedPage.icon}
                      subtitle={selectedPage.subtitle}
                      titleSectionHidden={selectedPage.titleSectionHidden}
                      titleIconHidden={selectedPage.titleIconHidden}
                      themePreset={
                        (project.settings?.theme as ThemePreset) || "default"
                      }
                      customFonts={project.settings?.fonts}
                    />
                  )}
                  {/* Edit lock banner for non-Ultimate plans */}
                  {isEditLocked && editLock.lockedBy && editLock.expiresAt && (
                    <EditLockBanner
                      lockedBy={editLock.lockedBy}
                      expiresAt={editLock.expiresAt}
                      onForceTake={editLock.forceTake}
                    />
                  )}
                  <BlockEditor
                    key={editorKey}
                    initialContent={pageContent.content}
                    onChange={handleContentChange}
                    onEditorReady={handleEditorReady}
                    editable={isCollaborationReady && !isEditLocked}
                    themePreset={
                      (project.settings?.theme as ThemePreset) || "default"
                    }
                    customPrimaryColor={project.settings?.primaryColor}
                    customBackgroundColorLight={
                      project.settings?.backgroundColorLight
                    }
                    customBackgroundColorDark={
                      project.settings?.backgroundColorDark
                    }
                    customBackgroundSubtleColorLight={
                      project.settings?.backgroundSubtleColorLight
                    }
                    customBackgroundSubtleColorDark={
                      project.settings?.backgroundSubtleColorDark
                    }
                    projectId={projectId as Id<"projects">}
                    collaboration={collaborationConfig}
                    pageId={selectedPageId}
                    currentUserId={currentUserId}
                    onAddComment={handleAddComment}
                    commentThreads={editorCommentThreads}
                    onThreadClick={handleThreadClick}
                  />
                  {isCollaborationEnabled &&
                    collabGate.available &&
                    !collaboration.connected &&
                    !collaboration.error &&
                    !collaborationEstablished && (
                      <div
                        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs text-[var(--text-bright)] border border-[var(--glass-border)]"
                        style={{
                          backgroundColor: "var(--glass-surface)",
                          backdropFilter: "blur(8px)",
                          boxShadow: "var(--glass-shadow)",
                        }}
                      >
                        <Loader2
                          className="h-3 w-3 animate-spin"
                          style={{ color: "#14b8a6" }}
                        />
                        {t("connectingToCollaboration")}
                      </div>
                    )}
                </div>
              ) : selectedPageId ? // Page selected but content still loading — keep area empty to avoid placeholder flash
              null : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-bg)] border border-[var(--glass-border)]">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-dim)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <p className="text-sm text-[var(--text-dim)]">
                      {t("selectPageToEdit")}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Comments sidebar */}
            {isCommentsOpen && selectedPageId && currentUserId && (
              <div className="w-80 border-l border-[var(--glass-border)] bg-[var(--surface-bg)]">
                <CommentsPanel
                  pageId={selectedPageId}
                  currentUserId={currentUserId}
                  onClose={() => setIsCommentsOpen(false)}
                  newCommentSelection={newCommentSelection}
                  onClearNewComment={handleClearNewComment}
                  initialSelectedThreadId={selectedThreadId}
                  onClearSelectedThread={handleClearSelectedThread}
                  isAdmin={isAdmin}
                />
              </div>
            )}
            {/* Page SEO sidebar */}
            {isPageSeoOpen && selectedPageId && selectedPage && (
              <div className="w-80 border-l border-[var(--glass-border)] bg-[var(--surface-bg)]">
                <PageSeoPanel
                  pageId={selectedPageId}
                  initialData={{
                    seoTitle: selectedPage.seoTitle,
                    seoDescription: selectedPage.seoDescription,
                    ogImageAssetId: selectedPage.ogImageAssetId,
                    noindex: selectedPage.noindex,
                  }}
                  pageTitle={selectedPage.title}
                  onClose={() => setIsPageSeoOpen(false)}
                />
              </div>
            )}
            {/* Version history sidebar */}
            {isVersionHistoryOpen && selectedPageId && (
              <div className="w-80 border-l border-[var(--glass-border)] bg-[var(--surface-bg)]">
                {versionHistoryGate.available ? (
                  <VersionHistoryPanel
                    pageId={selectedPageId}
                    currentUserId={currentUserId}
                    onClose={() => setIsVersionHistoryOpen(false)}
                    onCompare={(version) => setComparingVersion(version)}
                    onRestore={(content: string) => {
                      restoreEditorContent(content);
                    }}
                  />
                ) : (
                  <div className="p-4">
                    <UpgradePrompt
                      feature="version_history"
                      requiredPlan={versionHistoryGate.requiredPlan}
                      currentPlan={versionHistoryGate.currentPlan}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-hidden border-l-0 bg-transparent p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          {selectedPage && pageContent && (
            <PreviewPanel
              content={editorContent ?? pageContent.content}
              pageTitle={selectedPage.title}
              pageId={selectedPage._id}
              folderId={selectedPage.folderId ?? undefined}
              folders={folders ?? []}
              navTabs={project.settings?.navTabs ?? []}
              themePreset={(project.settings?.theme as ThemePreset) || "default"}
              customPrimaryColor={project.settings?.primaryColor}
              customBackgroundColorLight={
                project.settings?.backgroundColorLight
              }
              customBackgroundColorDark={project.settings?.backgroundColorDark}
              customBackgroundSubtleColorLight={
                project.settings?.backgroundSubtleColorLight
              }
              customBackgroundSubtleColorDark={
                project.settings?.backgroundSubtleColorDark
              }
              pageIcon={selectedPage.icon}
              pageSubtitle={selectedPage.subtitle}
              titleSectionHidden={selectedPage.titleSectionHidden}
              titleIconHidden={selectedPage.titleIconHidden}
              onOpenSearch={() => setIsSearchOpen(true)}
            />
          )}
        </SheetContent>
      </Sheet>
      <SearchCommand
        projectId={projectId as Id<"projects">}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectPage={setSelectedPageId}
      />
      <AlertDialog
        open={showDisableCollabWarning}
        onOpenChange={setShowDisableCollabWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableRealtimeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("disableRealtimeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
