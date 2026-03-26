"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/components/ui/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarNavProps {
  projectId: Id<"projects">;
  branchId: Id<"branches">;
  selectedPageId: Id<"pages"> | null;
  onSelectPage: (pageId: Id<"pages">) => void;
}

type TreeNodeData = {
  id: string;
  name: string;
  type: "folder" | "page";
  pageData?: Doc<"pages">;
  folderData?: Doc<"folders">;
  children?: TreeNodeData[];
};

type DeleteTarget =
  | { type: "page"; id: Id<"pages">; name: string }
  | { type: "folder"; id: Id<"folders">; name: string };

// ---------------------------------------------------------------------------
// Custom node renderer for the tree
// ---------------------------------------------------------------------------

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
  const treeProps = tree.props as Record<string, unknown>;
  const onSelectPage = treeProps.onSelectPage as (id: Id<"pages">) => void;
  const selectedPageId = treeProps.selectedPageId as Id<"pages"> | null;
  const onTogglePublish = treeProps.onTogglePublish as (
    id: Id<"pages">,
    published: boolean,
  ) => void;
  const onDeleteTarget = treeProps.onDeleteTarget as (
    target: DeleteTarget,
  ) => void;
  const onEditFolder = treeProps.onEditFolder as (
    folder: Doc<"folders">,
  ) => void;
  const onEditPage = treeProps.onEditPage as (page: Doc<"pages">) => void;

  // Auto-expand folders when hovering during drag
  useEffect(() => {
    if (isFolder && node.willReceiveDrop && !node.isOpen) {
      const timer = setTimeout(() => {
        node.open();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFolder, node.willReceiveDrop, node.isOpen, node]);

  const isSelected =
    isPage && data.pageData && selectedPageId === data.pageData._id;

  // Render icon
  const renderIcon = () => {
    if (isFolder) {
      return node.isOpen ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-primary/60" />
      ) : (
        <FolderClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
      );
    }
    return (
      <div className="relative">
        <File className="h-4 w-4 text-muted-foreground" />
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
          ? {
              ...style,
              backgroundColor: "hsl(var(--accent))",
              outline: "1px solid hsl(var(--primary) / 0.3)",
              borderRadius: "8px",
            }
          : style
      }
      className="group flex items-center rounded-lg"
      data-testid={isFolder ? "folder-item" : "page-item"}
      data-folder-id={isFolder ? data.folderData?._id : undefined}
      data-page-id={isPage ? data.pageData?._id : undefined}
    >
      {/* Drag handle */}
      <div
        ref={dragHandle}
        data-testid="drag-handle"
        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded transition-colors text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {isFolder ? (
        <>
          <button
            type="button"
            className="flex h-8 flex-1 items-center gap-1 px-1 text-sm font-medium rounded-lg transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => node.toggle()}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground",
                node.isOpen && "rotate-90",
              )}
            />
            {renderIcon()}
            <span className="truncate ml-1">{data.name}</span>
            {node.children && node.children.length > 0 && (
              <span className="ml-auto tabular-nums pr-1 text-[11px] text-muted-foreground opacity-75">
                {node.children.length}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 text-muted-foreground hover:bg-accent">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => data.folderData && onEditFolder(data.folderData)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  data.folderData &&
                  onDeleteTarget({
                    type: "folder",
                    id: data.folderData._id,
                    name: data.folderData.name,
                  })
                }
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <button
            type="button"
            className={cn(
              "flex h-8 flex-1 items-center gap-2 px-2 text-sm rounded-lg transition-all border-l-2",
              isSelected
                ? "bg-accent text-accent-foreground border-l-primary"
                : "text-muted-foreground border-l-transparent hover:bg-accent hover:text-foreground",
            )}
            onClick={() => data.pageData && onSelectPage(data.pageData._id)}
          >
            {renderIcon()}
            <span className="truncate">{data.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 text-muted-foreground hover:bg-accent">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => data.pageData && onEditPage(data.pageData)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  data.pageData &&
                  onTogglePublish(
                    data.pageData._id,
                    !!data.pageData.isPublished,
                  )
                }
              >
                {data.pageData?.isPublished ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Publish
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  data.pageData &&
                  onDeleteTarget({
                    type: "page",
                    id: data.pageData._id,
                    name: data.pageData.title,
                  })
                }
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree container with dynamic height measurement
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main sidebar component
// ---------------------------------------------------------------------------

export function SidebarNav({
  projectId,
  branchId,
  selectedPageId,
  onSelectPage,
}: SidebarNavProps) {
  // Queries
  const pages = useQuery(api.pages.listByBranch, { branchId });
  const folders = useQuery(api.folders.listByBranch, { branchId });

  // Mutations
  const createPage = useMutation(api.pages.create);
  const createFolder = useMutation(api.folders.create);
  const removePage = useMutation(api.pages.remove);
  const removeFolder = useMutation(api.folders.remove);
  const updatePageMeta = useMutation(api.pages.updateMeta);
  const renameFolder = useMutation(api.folders.rename);
  const movePage = useMutation(api.pages.move);
  const moveFolder = useMutation(api.folders.move);

  // New page/folder dialog state
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  // Edit dialog state
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editPageOpen, setEditPageOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Doc<"folders"> | null>(
    null,
  );
  const [editingPage, setEditingPage] = useState<Doc<"pages"> | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editPageTitle, setEditPageTitle] = useState("");

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Ref for scoping react-dnd to the sidebar only
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // Silence unused-var lint for projectId
  void projectId;

  // Convert pages and folders to tree data structure
  const treeData = useMemo((): TreeNodeData[] => {
    if (!pages || !folders) return [];

    const buildChildren = (
      parentFolderId: Id<"folders"> | null,
    ): TreeNodeData[] => {
      const childFolders = folders.filter((f) =>
        parentFolderId ? f.parentId === parentFolderId : !f.parentId,
      );
      const childPages = pages.filter((p) =>
        parentFolderId ? p.folderId === parentFolderId : !p.folderId,
      );

      const items: TreeNodeData[] = [
        ...childFolders.map(
          (folder): TreeNodeData => ({
            id: `folder-${folder._id}`,
            name: folder.name,
            type: "folder",
            folderData: folder,
            children: buildChildren(folder._id),
          }),
        ),
        ...childPages.map(
          (page): TreeNodeData => ({
            id: `page-${page._id}`,
            name: page.title,
            type: "page",
            pageData: page,
          }),
        ),
      ];

      // Sort by position; at root, pages appear above folders
      items.sort((a, b) => {
        const aPos =
          a.type === "folder" ? (a.folderData?.position ?? 0) : (a.pageData?.position ?? 0);
        const bPos =
          b.type === "folder" ? (b.folderData?.position ?? 0) : (b.pageData?.position ?? 0);
        if (parentFolderId === null && a.type !== b.type) {
          return a.type === "page" ? -1 : 1;
        }
        return aPos - bPos;
      });

      return items;
    };

    return buildChildren(null);
  }, [pages, folders]);

  // Auto-select first page on initial load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (
      pages &&
      pages.length > 0 &&
      !selectedPageId &&
      !hasAutoSelected.current
    ) {
      hasAutoSelected.current = true;
      const sorted = [...pages].sort((a, b) => a.position - b.position);
      onSelectPage(sorted[0]._id);
    }
  }, [pages, selectedPageId, onSelectPage]);

  // ---- Create handlers ----

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;
    const pageId = await createPage({
      branchId,
      title: newPageTitle.trim(),
    });
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
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  // ---- Toggle publish ----

  const togglePublish = async (pageId: Id<"pages">, isPublished: boolean) => {
    await updatePageMeta({ pageId, isPublished: !isPublished });
  };

  // ---- Delete handlers ----

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "page") {
      await removePage({ pageId: deleteTarget.id as Id<"pages"> });
      if (selectedPageId === deleteTarget.id) {
        const remaining = pages?.filter((p) => p._id !== deleteTarget.id);
        if (remaining && remaining.length > 0) {
          const sorted = [...remaining].sort(
            (a, b) => a.position - b.position,
          );
          onSelectPage(sorted[0]._id);
        }
      }
    } else {
      await removeFolder({ folderId: deleteTarget.id as Id<"folders"> });
    }
    setDeleteTarget(null);
  };

  // ---- Edit handlers ----

  const handleEditFolder = (folder: Doc<"folders">) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderOpen(true);
  };

  const handleEditPage = (page: Doc<"pages">) => {
    setEditingPage(page);
    setEditPageTitle(page.title);
    setEditPageOpen(true);
  };

  const handleSaveFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;
    await renameFolder({
      folderId: editingFolder._id,
      name: editFolderName.trim(),
    });
    setEditFolderOpen(false);
    setEditingFolder(null);
  };

  const handleSavePage = async () => {
    if (!editingPage || !editPageTitle.trim()) return;
    await updatePageMeta({
      pageId: editingPage._id,
      title: editPageTitle.trim(),
    });
    setEditPageOpen(false);
    setEditingPage(null);
  };

  // ---- Drag and drop move handler ----

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
      if (!pages || !folders) return;
      const dragId = dragIds[0];
      if (!dragId) return;

      const isDragPage = dragId.startsWith("page-");
      const isDragFolder = dragId.startsWith("folder-");

      // Determine target folder ID
      let targetFolderId: Id<"folders"> | null = null;
      if (parentId && parentId.startsWith("folder-")) {
        targetFolderId = parentId.replace("folder-", "") as Id<"folders">;
      }

      const isRootLevel = targetFolderId === null;

      try {
        if (isDragPage) {
          const pageId = dragId.replace("page-", "") as Id<"pages">;
          const page = pages.find((p) => p._id === pageId);
          if (!page) return;

          const oldFolderId = page.folderId ?? null;
          const isSameFolder =
            oldFolderId === targetFolderId ||
            (oldFolderId === undefined && targetFolderId === null);

          let adjustedIndex: number;

          if (isRootLevel) {
            // Root level: pages are displayed first
            const rootPages = pages
              .filter((p) => !p.folderId)
              .sort((a, b) => a.position - b.position);
            const rootPageCount = rootPages.length;
            const pageVisualIndex = Math.min(index, rootPageCount);
            const otherPages = rootPages.filter((p) => p._id !== pageId);

            if (pageVisualIndex >= otherPages.length) {
              const maxPos =
                otherPages.length > 0
                  ? Math.max(...otherPages.map((p) => p.position as number))
                  : -1;
              adjustedIndex = maxPos + 1;
            } else if (otherPages[pageVisualIndex]) {
              adjustedIndex = otherPages[pageVisualIndex].position;
            } else {
              adjustedIndex = 0;
            }
          } else {
            // Inside a folder: visual index matches position order
            const siblingCount =
              folders.filter((f) => f.parentId === targetFolderId).length +
              pages.filter((p) => p.folderId === targetFolderId).length;

            if (index >= siblingCount) {
              adjustedIndex = isSameFolder ? siblingCount - 1 : siblingCount;
            } else if (isSameFolder && page.position < index) {
              adjustedIndex = index - 1;
            } else {
              adjustedIndex = index;
            }
          }

          await movePage({
            pageId,
            position: adjustedIndex,
            folderId: targetFolderId ?? undefined,
          });
        } else if (isDragFolder) {
          const folderId = dragId.replace("folder-", "") as Id<"folders">;
          const folder = folders.find((f) => f._id === folderId);
          if (!folder) return;

          // Prevent moving folder into itself
          if (targetFolderId === folderId) return;

          await moveFolder({
            folderId,
            parentId: targetFolderId ?? undefined,
          });
        }
      } catch (error) {
        console.error("Failed to move item:", error);
      }
    },
    [pages, folders, movePage, moveFolder],
  );

  // Tree ref for programmatic folder expansion
  const treeRef = useRef<ReturnType<typeof Tree> extends React.ReactElement<infer P> ? P : unknown>(null);

  // Auto-expand folders containing the selected page
  useEffect(() => {
    if (selectedPageId && treeRef.current) {
      const treeApi = treeRef.current as { get: (id: string) => { parent: { isRoot: boolean; open: () => void; parent: unknown } | null } | null };
      const node = treeApi.get(`page-${selectedPageId}`);
      if (node) {
        let parent = node.parent;
        while (parent && !parent.isRoot) {
          parent.open();
          parent = parent.parent as typeof parent;
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

  const isLoading = pages === undefined || folders === undefined;

  return (
    <div
      ref={handleSidebarRef}
      className="relative z-10 flex w-[260px] flex-col bg-card border-r border-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pages
        </span>
        <div className="flex gap-0.5">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setNewPageOpen(true)}
          >
            <FilePlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tree */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <TreeContainer>
          {(treeHeight) =>
            dndRoot && (
              <Tree
                ref={treeRef as React.Ref<unknown>}
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
                {...({
                  onSelectPage,
                  selectedPageId,
                  onTogglePublish: togglePublish,
                  onDeleteTarget: setDeleteTarget,
                  onEditFolder: handleEditFolder,
                  onEditPage: handleEditPage,
                } as Record<string, unknown>)}
              >
                {(props: NodeRendererProps<TreeNodeData>) => (
                  <NodeRenderer {...props} />
                )}
              </Tree>
            )
          }
        </TreeContainer>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Page Dialog */}
      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
          </DialogHeader>
          <Input
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
            placeholder="Page title..."
            onKeyDown={(e) => e.key === "Enter" && handleCreatePage()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={editFolderOpen} onOpenChange={setEditFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              placeholder="Folder name..."
              onKeyDown={(e) => e.key === "Enter" && handleSaveFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={editPageOpen} onOpenChange={setEditPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              value={editPageTitle}
              onChange={(e) => setEditPageTitle(e.target.value)}
              placeholder="Page title..."
              onKeyDown={(e) => e.key === "Enter" && handleSavePage()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "folder" ? "folder" : "page"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "folder"
                ? `This will delete the folder "${deleteTarget.name}" and move its pages to the root level. This action cannot be undone.`
                : `This will permanently delete "${deleteTarget?.name}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
