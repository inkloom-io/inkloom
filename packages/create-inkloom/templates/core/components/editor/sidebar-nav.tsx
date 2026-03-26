"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  FolderClosed,
  Plus,
  MoreHorizontal,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/components/ui/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarNavProps {
  projectId: Id<"projects">;
  branchId: Id<"branches">;
  selectedPageId: Id<"pages"> | null;
  onSelectPage: (pageId: Id<"pages">) => void;
}

type DeleteTarget =
  | { type: "page"; id: Id<"pages">; name: string }
  | { type: "folder"; id: Id<"folders">; name: string };

// ---------------------------------------------------------------------------
// Inline edit input — shared by pages and folders
// ---------------------------------------------------------------------------

function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
  placeholder,
}: {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select on mount
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onConfirm(value.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (value.trim()) {
          onConfirm(value.trim());
        } else {
          onCancel();
        }
      }}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-sm bg-muted border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
    />
  );
}

// ---------------------------------------------------------------------------
// Page item
// ---------------------------------------------------------------------------

function PageItem({
  page,
  isSelected,
  onSelect,
  onStartRename,
  onDelete,
  onTogglePublish,
  isRenaming,
  onRenameConfirm,
  onRenameCancel,
}: {
  page: { _id: Id<"pages">; title: string; icon?: string; isPublished?: boolean };
  isSelected: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  isRenaming: boolean;
  onRenameConfirm: (newTitle: string) => void;
  onRenameCancel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (isRenaming) {
    return (
      <div className="px-2 py-0.5">
        <InlineInput
          defaultValue={page.title}
          onConfirm={onRenameConfirm}
          onCancel={onRenameCancel}
          placeholder="Page title"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      {page.icon ? (
        <span className="shrink-0 text-sm">{page.icon}</span>
      ) : (
        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate flex-1">{page.title}</span>
      {page.isPublished ? (
        <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-500/70" />
      ) : (
        <EyeOff className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              onStartRename();
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTogglePublish}>
            {page.isPublished ? (
              <>
                <EyeOff className="w-3.5 h-3.5 mr-2" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 mr-2" />
                Publish
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300"
            onSelect={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder group
// ---------------------------------------------------------------------------

function FolderGroup({
  folder,
  pages,
  selectedPageId,
  onSelectPage,
  renamingId,
  setRenamingId,
  onRenamePage,
  onDeleteTarget,
  onTogglePublish,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: { _id: Id<"folders">; name: string; icon?: string };
  pages: Array<{
    _id: Id<"pages">;
    title: string;
    icon?: string;
    isPublished?: boolean;
    position: number;
  }>;
  selectedPageId: Id<"pages"> | null;
  onSelectPage: (pageId: Id<"pages">) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  onRenamePage: (pageId: Id<"pages">, newTitle: string) => void;
  onDeleteTarget: (target: DeleteTarget) => void;
  onTogglePublish: (pageId: Id<"pages">, currentStatus: boolean) => void;
  onRenameFolder: (folderId: Id<"folders">, newName: string) => void;
  onDeleteFolder: (folderId: Id<"folders">, name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const isRenamingFolder = renamingId === `folder-${folder._id}`;

  return (
    <div>
      {/* Folder header */}
      {isRenamingFolder ? (
        <div className="px-2 py-0.5">
          <InlineInput
            defaultValue={folder.name}
            onConfirm={(newName) => {
              onRenameFolder(folder._id, newName);
              setRenamingId(null);
            }}
            onCancel={() => setRenamingId(null)}
            placeholder="Folder name"
          />
        </div>
      ) : (
        <div
          className="group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer text-foreground/80 hover:text-foreground hover:bg-accent/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
          ) : (
            <FolderClosed className="w-4 h-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate flex-1 font-medium">{folder.name}</span>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-44">
              <DropdownMenuItem
                onSelect={() => setRenamingId(`folder-${folder._id}`)}
              >
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onSelect={() => onDeleteFolder(folder._id, folder.name)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Folder children */}
      {isOpen && (
        <div className="ml-3 border-l border-border pl-1">
          {pages.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground/50 italic">
              No pages
            </p>
          ) : (
            pages
              .sort((a, b) => a.position - b.position)
              .map((page) => (
                <PageItem
                  key={page._id}
                  page={page}
                  isSelected={selectedPageId === page._id}
                  onSelect={() => onSelectPage(page._id)}
                  onStartRename={() => setRenamingId(`page-${page._id}`)}
                  onDelete={() =>
                    onDeleteTarget({
                      type: "page",
                      id: page._id,
                      name: page.title,
                    })
                  }
                  onTogglePublish={() =>
                    onTogglePublish(page._id, !!page.isPublished)
                  }
                  isRenaming={renamingId === `page-${page._id}`}
                  onRenameConfirm={(newTitle) => {
                    onRenamePage(page._id, newTitle);
                    setRenamingId(null);
                  }}
                  onRenameCancel={() => setRenamingId(null)}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SidebarNav({
  projectId,
  branchId,
  selectedPageId,
  onSelectPage,
}: SidebarNavProps) {
  const pages = useQuery(api.pages.listByBranch, { branchId });
  const folders = useQuery(api.folders.listByBranch, { branchId });

  const createPage = useMutation(api.pages.create);
  const createFolder = useMutation(api.folders.create);
  const updatePageMeta = useMutation(api.pages.updateMeta);
  const removePage = useMutation(api.pages.remove);
  const renameFolder = useMutation(api.folders.rename);
  const removeFolder = useMutation(api.folders.remove);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Silence unused-var lint for projectId (used by consumers for query context)
  void projectId;

  // Auto-select first page on initial load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      const sorted = [...pages].sort((a, b) => a.position - b.position);
      onSelectPage(sorted[0]._id);
    }
  }, [pages, selectedPageId, onSelectPage]);

  // ---- Mutations ----

  const handleCreatePage = useCallback(
    async (title: string) => {
      const newPageId = await createPage({ branchId, title });
      setCreatingPage(false);
      onSelectPage(newPageId);
    },
    [branchId, createPage, onSelectPage]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      await createFolder({ branchId, name });
      setCreatingFolder(false);
    },
    [branchId, createFolder]
  );

  const handleRenamePage = useCallback(
    async (pageId: Id<"pages">, newTitle: string) => {
      await updatePageMeta({ pageId, title: newTitle });
    },
    [updatePageMeta]
  );

  const handleTogglePublish = useCallback(
    async (pageId: Id<"pages">, currentStatus: boolean) => {
      await updatePageMeta({ pageId, isPublished: !currentStatus });
    },
    [updatePageMeta]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "page") {
      await removePage({ pageId: deleteTarget.id as Id<"pages"> });
      // If we deleted the selected page, deselect
      if (selectedPageId === deleteTarget.id) {
        const remaining = pages?.filter((p) => p._id !== deleteTarget.id);
        if (remaining && remaining.length > 0) {
          const sorted = [...remaining].sort((a, b) => a.position - b.position);
          onSelectPage(sorted[0]._id);
        }
      }
    } else {
      await removeFolder({ folderId: deleteTarget.id as Id<"folders"> });
    }
    setDeleteTarget(null);
  }, [deleteTarget, removePage, removeFolder, selectedPageId, pages, onSelectPage]);

  const handleRenameFolder = useCallback(
    async (folderId: Id<"folders">, newName: string) => {
      await renameFolder({ folderId, name: newName });
    },
    [renameFolder]
  );

  const handleDeleteFolder = useCallback(
    (folderId: Id<"folders">, name: string) => {
      setDeleteTarget({ type: "folder", id: folderId, name });
    },
    []
  );

  // ---- Organize pages into folders ----

  const rootPages =
    pages
      ?.filter((p) => !p.folderId)
      .sort((a, b) => a.position - b.position) ?? [];

  const sortedFolders = folders ? [...folders] : [];

  const pagesByFolder = new Map<string, typeof rootPages>();
  if (pages) {
    for (const page of pages) {
      if (page.folderId) {
        const key = page.folderId as string;
        const existing = pagesByFolder.get(key) ?? [];
        existing.push(page);
        pagesByFolder.set(key, existing);
      }
    }
  }

  const isLoading = pages === undefined || folders === undefined;

  return (
    <aside className="w-[260px] bg-card border-r border-border flex flex-col shrink-0">
      {/* Sidebar content */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              Loading...
            </p>
          ) : rootPages.length === 0 && sortedFolders.length === 0 ? (
            <div className="text-center py-8 px-2">
              <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No pages yet</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Create your first page below
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Root pages (no folder) */}
              {rootPages.map((page) => (
                <PageItem
                  key={page._id}
                  page={page}
                  isSelected={selectedPageId === page._id}
                  onSelect={() => onSelectPage(page._id)}
                  onStartRename={() => setRenamingId(`page-${page._id}`)}
                  onDelete={() =>
                    setDeleteTarget({
                      type: "page",
                      id: page._id,
                      name: page.title,
                    })
                  }
                  onTogglePublish={() =>
                    handleTogglePublish(page._id, !!page.isPublished)
                  }
                  isRenaming={renamingId === `page-${page._id}`}
                  onRenameConfirm={(newTitle) => {
                    handleRenamePage(page._id, newTitle);
                    setRenamingId(null);
                  }}
                  onRenameCancel={() => setRenamingId(null)}
                />
              ))}

              {/* Folders with their pages */}
              {sortedFolders.map((folder) => (
                <FolderGroup
                  key={folder._id}
                  folder={folder}
                  pages={pagesByFolder.get(folder._id as string) ?? []}
                  selectedPageId={selectedPageId}
                  onSelectPage={onSelectPage}
                  renamingId={renamingId}
                  setRenamingId={setRenamingId}
                  onRenamePage={handleRenamePage}
                  onDeleteTarget={setDeleteTarget}
                  onTogglePublish={handleTogglePublish}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                />
              ))}
            </div>
          )}

          {/* Inline new-page input */}
          {creatingPage && (
            <div className="px-2 py-1 mt-1">
              <InlineInput
                defaultValue=""
                onConfirm={handleCreatePage}
                onCancel={() => setCreatingPage(false)}
                placeholder="Page title..."
              />
            </div>
          )}

          {/* Inline new-folder input */}
          {creatingFolder && (
            <div className="px-2 py-1 mt-1">
              <InlineInput
                defaultValue=""
                onConfirm={handleCreateFolder}
                onCancel={() => setCreatingFolder(false)}
                placeholder="Folder name..."
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom action bar */}
      <div className="p-2 border-t border-border flex gap-1">
        <button
          onClick={() => {
            setCreatingFolder(false);
            setCreatingPage(true);
          }}
          className="flex items-center gap-1.5 flex-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Page
        </button>
        <button
          onClick={() => {
            setCreatingPage(false);
            setCreatingFolder(true);
          }}
          className="flex items-center gap-1.5 flex-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Folder
        </button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {deleteTarget?.type === "folder" ? "folder" : "page"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {deleteTarget?.type === "folder"
                ? `This will delete the folder "${deleteTarget.name}" and move its pages to the root level. This action cannot be undone.`
                : `This will permanently delete "${deleteTarget?.name}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border text-foreground/80 hover:bg-accent hover:text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
