"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { cn } from "@inkloom/ui/lib/utils";
import { Button } from "@inkloom/ui/button";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@inkloom/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@inkloom/ui/dropdown-menu";
import {
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  File,
  FilePlus,
  FolderOpen,
  FolderClosed,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { NodeRendererProps } from "react-arborist";
import { Tree } from "react-arborist";
import { BranchSwitcher } from "./branch-switcher";
import { IconPicker, IconDisplay } from "./icon-picker";
import { trackEvent } from "@/lib/analytics";

// Tree node data types
type TreeNodeData = {
  id: string;
  name: string;
  type: "folder" | "page";
  icon?: string;
  // Original data references
  pageData?: Doc<"pages">;
  folderData?: Doc<"folders">;
  children?: TreeNodeData[];
};

interface EditorSidebarProps {
  projectId: Id<"projects">;
  branchId: Id<"branches">;
  pages: Doc<"pages">[];
  folders: Doc<"folders">[];
  selectedPageId: Id<"pages"> | null;
  onSelectPage: (pageId: Id<"pages">) => void;
  currentBranchId?: Id<"branches">;
  onSwitchBranch?: (branchId: Id<"branches">, branchName?: string) => void;
  onFlushContent?: () => Promise<void>;
}

// Custom node renderer for the tree
function NodeRenderer({
  node,
  style,
  dragHandle,
  tree,
}: NodeRendererProps<TreeNodeData>) {
  const data = node.data;
  const isFolder = data.type === "folder";
  const isPage = data.type === "page";

  // Access handlers from tree props
  const treeProps = tree.props as any;
  const onSelectPage = treeProps.onSelectPage;
  const selectedPageId = treeProps.selectedPageId;
  const onTogglePublish = treeProps.onTogglePublish;
  const onDeletePage = treeProps.onDeletePage;
  const onDeleteFolder = treeProps.onDeleteFolder;
  const onEditFolder = treeProps.onEditFolder;
  const onEditPage = treeProps.onEditPage;
  const t = treeProps.t as (key: string) => string;
  const tc = treeProps.tc as (key: string) => string;

  // Auto-expand folders when hovering during drag
  useEffect(() => {
    if (isFolder && node.willReceiveDrop && !node.isOpen) {
      const timer = setTimeout(() => {
        node.open();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFolder, node.willReceiveDrop, node.isOpen, node]);

  const isSelected = isPage && data.pageData && selectedPageId === data.pageData._id;

  // Render icon or default
  const renderIcon = () => {
    if (data.icon) {
      return <IconDisplay icon={data.icon} className="h-4 w-4 shrink-0" />;
    }
    if (isFolder) {
      return node.isOpen ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-primary/60" />
      ) : (
        <FolderClosed className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
      );
    }
    return (
      <div className="relative">
        <File className="h-4 w-4 text-[var(--text-dim)]" />
        {data.pageData?.isPublished && (
          <Circle className="absolute -right-0.5 -top-0.5 h-2 w-2 fill-primary text-primary" />
        )}
      </div>
    );
  };

  return (
    <div
      style={
        node.state.willReceiveDrop
          ? { ...style, backgroundColor: "var(--active-bg)", outline: "1px solid rgba(20,184,166,0.3)", borderRadius: "8px" }
          : style
      }
      className="group flex items-center rounded-lg"
      data-testid={isFolder ? "folder-item" : "page-item"}
      data-folder-id={isFolder ? data.folderData?._id : undefined}
      data-folder-name={isFolder ? data.folderData?.name : undefined}
      data-page-id={isPage ? data.pageData?._id : undefined}
      data-page-title={isPage ? data.pageData?.title : undefined}
    >
      {/* Drag handle */}
      <div
        ref={dragHandle}
        data-testid="drag-handle"
        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded transition-colors text-[var(--text-dim)] hover:text-[var(--text-dim)]"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {isFolder ? (
        // Folder rendering
        <>
          <button
            type="button"
            className="flex h-8 flex-1 items-center gap-1 px-1 text-sm font-medium rounded-lg transition-colors text-[var(--text-medium)] hover:bg-[var(--surface-active)] hover:text-[var(--text-bright)]"
            onClick={() => node.toggle()}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform text-[var(--text-dim)]",
                node.isOpen && "rotate-90"
              )}
            />
            {renderIcon()}
            <span className="truncate ml-1">{data.name}</span>
            {node.children && node.children.length > 0 && (
              <span className="ml-auto tabular-nums pr-1 text-[11px] text-[var(--text-dim)] opacity-75">
                {node.children.length}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 text-[var(--text-dim)] hover:bg-[var(--glass-hover)]"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => data.folderData && onEditFolder(data.folderData)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => data.folderData && onDeleteFolder(data.folderData)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        // Page rendering
        <>
          <button
            type="button"
            className={cn(
              "flex h-8 flex-1 items-center gap-2 px-2 text-sm rounded-lg transition-all border-l-2",
              isSelected
                ? "bg-[var(--active-bg)] text-primary border-l-primary"
                : "text-[var(--text-dim)] border-l-transparent hover:bg-[var(--surface-active)] hover:text-[var(--text-medium)]"
            )}
            onClick={() => data.pageData && onSelectPage(data.pageData._id)}
          >
            {renderIcon()}
            <span className="truncate">{data.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 text-[var(--text-dim)] hover:bg-[var(--glass-hover)]"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => data.pageData && onEditPage(data.pageData)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  data.pageData && onTogglePublish(data.pageData._id, data.pageData.isPublished)
                }
              >
                {data.pageData?.isPublished ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    {t("unpublish")}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("publish")}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => data.pageData && onDeletePage(data.pageData)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function TreeContainer({
  children,
}: {
  children: (height: number) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setTreeHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 min-h-0">
      {children(treeHeight)}
    </div>
  );
}

export function EditorSidebar({
  projectId,
  branchId,
  pages,
  folders,
  selectedPageId,
  onSelectPage,
  currentBranchId,
  onSwitchBranch,
  onFlushContent,
}: EditorSidebarProps) {
  const t = useTranslations("editor.sidebar");
  const tc = useTranslations("common");
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  // Edit dialog state
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editPageOpen, setEditPageOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Doc<"folders"> | null>(null);
  const [editingPage, setEditingPage] = useState<Doc<"pages"> | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderIcon, setEditFolderIcon] = useState<string | null>(null);
  const [editPageTitle, setEditPageTitle] = useState("");
  const [editPageIcon, setEditPageIcon] = useState<string | null>(null);

  // Delete confirmation state
  const [deletePageOpen, setDeletePageOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<Doc<"pages"> | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Doc<"folders"> | null>(null);

  // Ref for scoping react-dnd to the sidebar only (prevents conflict with BlockNote editor)
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const createPage = useMutation(api.pages.create);
  const createFolder = useMutation(api.folders.create);
  const deletePage = useMutation(api.pages.remove);
  const deleteFolder = useMutation(api.folders.remove);
  const updatePage = useMutation(api.pages.update);
  const updateFolder = useMutation(api.folders.update);
  const reorderPage = useMutation(api.pages.reorder);
  const reorderFolder = useMutation(api.folders.reorder);

  // Convert pages and folders to tree data structure
  const treeData = useMemo((): TreeNodeData[] => {
    const buildChildren = (parentFolderId: Id<"folders"> | null): TreeNodeData[] => {
      const childFolders = folders.filter((f: any) =>
        parentFolderId ? f.parentId === parentFolderId : !f.parentId
      );
      const childPages = pages.filter((p: any) =>
        parentFolderId ? p.folderId === parentFolderId : !p.folderId
      );

      const items: TreeNodeData[] = [
        ...childFolders.map((folder): TreeNodeData => ({
          id: `folder-${folder._id}`,
          name: folder.name,
          type: "folder",
          icon: folder.icon,
          folderData: folder,
          children: buildChildren(folder._id),
        })),
        ...childPages.map((page): TreeNodeData => ({
          id: `page-${page._id}`,
          name: page.title,
          type: "page",
          icon: page.icon,
          pageData: page,
        })),
      ];

      // Sort by position, with root-level pages grouped above folders
      items.sort((a: any, b: any) => {
        const aPos = a.type === "folder" ? a.folderData.position : a.pageData.position;
        const bPos = b.type === "folder" ? b.folderData.position : b.pageData.position;
        // At root level, pages always appear above folders
        if (parentFolderId === null && a.type !== b.type) {
          return a.type === "page" ? -1 : 1;
        }
        return aPos - bPos;
      });

      return items;
    };

    return buildChildren(null);
  }, [pages, folders]);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;
    const pageId = await createPage({
      branchId,
      title: newPageTitle.trim(),
    });
    trackEvent("page_created", { projectId, source: "editor" });
    setNewPageTitle("");
    setNewPageOpen(false);
    onSelectPage(pageId);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder({
      branchId,
      name: newFolderName.trim(),
    });
    trackEvent("folder_created", { projectId });
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const togglePublish = async (pageId: Id<"pages">, isPublished: boolean) => {
    await updatePage({ pageId, isPublished: !isPublished });
  };

  const handleDeletePageClick = (page: Doc<"pages">) => {
    setPageToDelete(page);
    setDeletePageOpen(true);
  };

  const handleConfirmDeletePage = async () => {
    if (!pageToDelete) return;
    await deletePage({ pageId: pageToDelete._id });
    trackEvent("page_deleted", { projectId });
    setDeletePageOpen(false);
    setPageToDelete(null);
  };

  const handleDeleteFolderClick = (folder: Doc<"folders">) => {
    setFolderToDelete(folder);
    setDeleteFolderOpen(true);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    await deleteFolder({ folderId: folderToDelete._id });
    setDeleteFolderOpen(false);
    setFolderToDelete(null);
  };

  // Edit handlers
  const handleEditFolder = (folder: Doc<"folders">) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderIcon(folder.icon ?? null);
    setEditFolderOpen(true);
  };

  const handleEditPage = (page: Doc<"pages">) => {
    setEditingPage(page);
    setEditPageTitle(page.title);
    setEditPageIcon(page.icon ?? null);
    setEditPageOpen(true);
  };

  const handleSaveFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;
    await updateFolder({
      folderId: editingFolder._id,
      name: editFolderName.trim(),
      icon: editFolderIcon,
    });
    setEditFolderOpen(false);
    setEditingFolder(null);
  };

  const handleSavePage = async () => {
    if (!editingPage || !editPageTitle.trim()) return;
    await updatePage({
      pageId: editingPage._id,
      title: editPageTitle.trim(),
      icon: editPageIcon,
    });
    setEditPageOpen(false);
    setEditingPage(null);
  };

  // Handle drag and drop moves
  const handleMove = useCallback(
    async ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      const dragId = dragIds[0];
      if (!dragId) return;

      const isPage = dragId.startsWith("page-");
      const isFolder = dragId.startsWith("folder-");

      // Determine target folder ID
      let targetFolderId: Id<"folders"> | null = null;
      if (parentId && parentId.startsWith("folder-")) {
        targetFolderId = parentId.replace("folder-", "") as Id<"folders">;
      }

      // At root level (targetFolderId === null), pages are displayed above
      // folders regardless of DB position. The visual index from react-arborist
      // spans [pages..., folders...], so we must translate to the correct DB
      // position for each type. Inside folders, visual order matches DB
      // position order, so no translation is needed.
      const isRootLevel = targetFolderId === null;

      try {
        if (isPage) {
          const pageId = dragId.replace("page-", "") as Id<"pages">;
          const page = pages.find((p: any) => p._id === pageId);
          if (!page) return;

          const oldFolderId = page.folderId ?? null;
          const isSameFolder =
            oldFolderId === targetFolderId ||
            (oldFolderId === undefined && targetFolderId === null);

          let adjustedIndex: number;

          if (isRootLevel) {
            // Root level: pages are displayed first. The visual index maps
            // directly to page-relative position since pages are on top.
            const rootPages = pages
              .filter((p: any) => !p.folderId)
              .sort((a: any, b: any) => a.position - b.position);
            const rootPageCount = rootPages.length;

            // Clamp index to page range (can't drop a page among folders
            // since pages always appear above folders at root)
            const pageVisualIndex = Math.min(index, rootPageCount);

            // Get other root pages (excluding dragged) sorted by position
            const otherPages = rootPages.filter((p: any) => p._id !== pageId);

            if (pageVisualIndex >= otherPages.length) {
              // Dropping at end of pages
              const maxPos = otherPages.length > 0
                ? Math.max(...otherPages.map((p: any) => p.position as number))
                : -1;
              adjustedIndex = maxPos + 1;
            } else if (otherPages[pageVisualIndex]) {
              // Dropping before a specific page — take its position
              adjustedIndex = otherPages[pageVisualIndex].position;
            } else {
              adjustedIndex = 0;
            }
          } else {
            // Inside a folder: visual index matches position order
            const siblingCount =
              folders.filter((f: any) => f.parentId === targetFolderId).length +
              pages.filter((p: any) => p.folderId === targetFolderId).length;

            if (index >= siblingCount) {
              adjustedIndex = isSameFolder ? siblingCount - 1 : siblingCount;
            } else if (isSameFolder && page.position < index) {
              adjustedIndex = index - 1;
            } else {
              adjustedIndex = index;
            }
          }

          await reorderPage({
            pageId,
            newPosition: adjustedIndex,
            newFolderId: targetFolderId,
          });
        } else if (isFolder) {
          const folderId = dragId.replace("folder-", "") as Id<"folders">;
          const folder = folders.find((f: any) => f._id === folderId);
          if (!folder) return;

          // Prevent moving folder into itself or its descendants
          if (targetFolderId === folderId) return;

          const oldParentId = folder.parentId ?? null;
          const isSameParent =
            oldParentId === targetFolderId ||
            (oldParentId === undefined && targetFolderId === null);

          let adjustedIndex: number;

          if (isRootLevel) {
            // Root level: folders are displayed after all pages. The visual
            // index includes pages above, so we offset by the page count
            // to get the folder-relative drop index.
            const rootPageCount = pages.filter((p: any) => !p.folderId).length;
            const rootFolders = folders
              .filter((f: any) => !f.parentId)
              .sort((a: any, b: any) => a.position - b.position);

            // Convert visual index to folder-relative index
            const folderVisualIndex = Math.max(0, index - rootPageCount);

            // Get other root folders (excluding dragged) sorted by position
            const otherFolders = rootFolders.filter((f: any) => f._id !== folderId);

            if (folderVisualIndex >= otherFolders.length) {
              // Dropping at end of folders
              const maxPos = otherFolders.length > 0
                ? Math.max(...otherFolders.map((f: any) => f.position as number))
                : -1;
              adjustedIndex = maxPos + 1;
            } else if (otherFolders[folderVisualIndex]) {
              // Dropping before a specific folder — take its position
              adjustedIndex = otherFolders[folderVisualIndex].position;
            } else {
              adjustedIndex = 0;
            }
          } else {
            // Inside a folder: visual index matches position order
            const siblingCount =
              folders.filter((f: any) => f.parentId === targetFolderId).length +
              pages.filter((p: any) => p.folderId === targetFolderId).length;

            if (index >= siblingCount) {
              adjustedIndex = isSameParent ? siblingCount - 1 : siblingCount;
            } else if (isSameParent && folder.position < index) {
              adjustedIndex = index - 1;
            } else {
              adjustedIndex = index;
            }
          }

          await reorderFolder({
            folderId,
            newPosition: adjustedIndex,
            newParentId: targetFolderId,
          });
        }
      } catch (error) {
        console.error("Failed to move item:", error);
      }
    },
    [pages, folders, reorderPage, reorderFolder]
  );

  // Tree ref for programmatic folder expansion
  const treeRef = useRef<any>(null);

  // Auto-expand folders containing the selected page
  useEffect(() => {
    if (selectedPageId && treeRef.current) {
      const node = treeRef.current.get(`page-${selectedPageId}`);
      if (node) {
        let parent = node.parent;
        while (parent && !parent.isRoot) {
          parent.open();
          parent = parent.parent;
        }
      }
    }
  }, [selectedPageId]);

  // State to track when sidebar is mounted for dndRootElement
  const [dndRoot, setDndRoot] = useState<HTMLElement | null>(null);

  // Callback ref to set the dndRoot when mounted
  const handleSidebarRef = useCallback((node: HTMLDivElement | null) => {
    sidebarRef.current = node;
    if (node) {
      setDndRoot(node);
    }
  }, []);

  return (
    <div
      ref={handleSidebarRef}
      className="relative z-10 flex w-64 flex-col bg-[var(--surface-bg)] border-r border-[var(--glass-divider)]"
    >
      {currentBranchId && onSwitchBranch && (
        <div className="flex items-center px-3 py-1.5 border-b border-[var(--glass-divider)]">
          <BranchSwitcher
            projectId={projectId}
            currentBranchId={currentBranchId}
            onSwitchBranch={onSwitchBranch}
            onFlushContent={onFlushContent}
            canDelete
          />
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--glass-divider)]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("pages")}</span>
        <div className="flex gap-0.5">
          <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
            <DialogTrigger asChild>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-medium)]"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("newFolder")}</DialogTitle>
              </DialogHeader>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t("folderNamePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={handleCreateFolder}>{tc("create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
            <DialogTrigger asChild>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-[var(--text-dim)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-medium)]"
              >
                <FilePlus className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("newPage")}</DialogTitle>
              </DialogHeader>
              <Input
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder={t("pageTitlePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePage()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewPageOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={handleCreatePage}>{tc("create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <TreeContainer>
        {(treeHeight) =>
          dndRoot && (
            <Tree
              ref={treeRef}
              data={treeData}
              openByDefault={false}
              width="100%"
              height={treeHeight}
              indent={24}
              rowHeight={32}
              paddingTop={4}
              paddingBottom={10}
              dndRootElement={dndRoot}
              onMove={handleMove}
              // Pass custom props to access in NodeRenderer
              {...({
                onSelectPage,
                selectedPageId,
                onTogglePublish: togglePublish,
                onDeletePage: handleDeletePageClick,
                onDeleteFolder: handleDeleteFolderClick,
                onEditFolder: handleEditFolder,
                onEditPage: handleEditPage,
                pages,
                folders,
                t,
                tc,
              } as any)}
            >
              {(props: NodeRendererProps<TreeNodeData>) => <NodeRenderer {...props} />}
            </Tree>
          )
        }
      </TreeContainer>

      {/* Edit Folder Dialog */}
      <Dialog open={editFolderOpen} onOpenChange={setEditFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editFolder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t("nameLabel")}</Label>
              <Input
                id="folder-name"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder={t("folderNamePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleSaveFolder()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("iconLabel")}</Label>
              <div className="flex items-center gap-2">
                <IconPicker
                  value={editFolderIcon ?? undefined}
                  onChange={(icon) => setEditFolderIcon(icon)}
                />
                <span className="text-sm text-muted-foreground">
                  {editFolderIcon ? t("clickToChange") : t("clickToAddIcon")}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSaveFolder}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={editPageOpen} onOpenChange={setEditPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editPage")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">{t("titleLabel")}</Label>
              <Input
                id="page-title"
                value={editPageTitle}
                onChange={(e) => setEditPageTitle(e.target.value)}
                placeholder={t("pageTitlePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleSavePage()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("iconLabel")}</Label>
              <div className="flex items-center gap-2">
                <IconPicker
                  value={editPageIcon ?? undefined}
                  onChange={(icon) => setEditPageIcon(icon)}
                />
                <span className="text-sm text-muted-foreground">
                  {editPageIcon ? t("clickToChange") : t("clickToAddIcon")}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPageOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSavePage}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Page Confirmation Dialog */}
      <Dialog open={deletePageOpen} onOpenChange={setDeletePageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deletePage")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deletePageConfirmation", { title: pageToDelete?.title ?? "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePageOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePage}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation Dialog */}
      <Dialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteFolder")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteFolderConfirmation", { name: folderToDelete?.name ?? "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteFolder}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
