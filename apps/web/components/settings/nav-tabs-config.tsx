"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inkloom/ui/select";
import { GripVertical, Plus, Trash2, Loader2, Check, Folder, FileText, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconPicker, IconDisplay } from "@/components/editor/icon-picker";

// Item in a tab - can be either a folder or a page
type NavTabItem =
  | { type: "folder"; folderId: Id<"folders"> }
  | { type: "page"; pageId: Id<"pages"> };

interface NavTab {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  items: NavTabItem[];
  slugManuallyEdited?: boolean;
}

// Old format for migration
interface LegacyNavTab {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  folderId?: Id<"folders">; // Old format
  items?: NavTabItem[]; // New format
}

interface NavTabsConfigProps {
  branchId: Id<"branches">;
  initialTabs?: LegacyNavTab[];
  onSave: (tabs: NavTab[]) => Promise<void>;
}

// Migrate old tab format to new format
function migrateTab(tab: LegacyNavTab): NavTab {
  // Already in new format
  if (tab.items && tab.items.length > 0) {
    return tab as NavTab;
  }
  // Migrate from old folderId format
  if (tab.folderId) {
    return {
      id: tab.id,
      name: tab.name,
      slug: tab.slug,
      icon: tab.icon,
      items: [{ type: "folder" as const, folderId: tab.folderId }],
    };
  }
  // Empty tab
  return {
    id: tab.id,
    name: tab.name,
    slug: tab.slug,
    icon: tab.icon,
    items: [],
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function NavTabsConfig({
  branchId,
  initialTabs = [],
  onSave,
}: NavTabsConfigProps) {
  const t = useTranslations("settings");
  // Migrate initial tabs to new format
  const migratedInitialTabs = useMemo(
    () => initialTabs.map(migrateTab),
    [initialTabs]
  );

  const [tabs, setTabs] = useState<NavTab[]>(migratedInitialTabs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initializedRef = useRef(false);
  const lastSavedTabsRef = useRef<string>(JSON.stringify(migratedInitialTabs));

  // Get all folders for the branch (not just root)
  const folders = useQuery(api.folders.listByBranch, { branchId });
  const allFolders = folders ?? [];

  // Get all pages for the branch
  const pages = useQuery(api.pages.listByBranch, { branchId });
  const allPages = pages ?? [];

  // Calculate assigned and unassigned items
  const { assignedFolderIds, assignedPageIds, unassignedFolders, unassignedPages } = useMemo(() => {
    const folderIds = new Set<string>();
    const pageIds = new Set<string>();

    for (const tab of tabs) {
      for (const item of tab.items) {
        if (item.type === "folder" && item.folderId) {
          folderIds.add(item.folderId);
          // Also mark all child folders as assigned
          const folder = allFolders.find((f: any) => f._id === item.folderId);
          if (folder) {
            for (const f of allFolders) {
              if (f.path.startsWith(folder.path + "/")) {
                folderIds.add(f._id);
              }
            }
            // Mark all pages in this folder as assigned
            for (const p of allPages) {
              if (p.path.startsWith(folder.path + "/") || p.path === folder.path) {
                pageIds.add(p._id);
              }
            }
          }
        } else if (item.type === "page" && item.pageId) {
          pageIds.add(item.pageId);
        }
      }
    }

    // Only show ROOT-LEVEL unassigned items (those that can actually be added to tabs)
    return {
      assignedFolderIds: folderIds,
      assignedPageIds: pageIds,
      unassignedFolders: allFolders.filter((f: any) => !f.parentId && !folderIds.has(f._id)),
      unassignedPages: allPages.filter((p: any) => p.path.split("/").length === 2 && !pageIds.has(p._id)),
    };
  }, [tabs, allFolders, allPages]);

  // Only sync with initialTabs if they actually changed from what we last saved
  useEffect(() => {
    const currentInitial = JSON.stringify(migratedInitialTabs);
    if (!initializedRef.current) {
      initializedRef.current = true;
      setTabs(migratedInitialTabs);
      lastSavedTabsRef.current = currentInitial;
    } else if (currentInitial !== lastSavedTabsRef.current) {
      setTabs(migratedInitialTabs);
      lastSavedTabsRef.current = currentInitial;
    }
  }, [migratedInitialTabs]);

  const handleAddTab = () => {
    const newTab: NavTab = {
      id: generateId(),
      name: "",
      slug: "",
      items: [],
    };
    setTabs([...tabs, newTab]);
  };

  const handleRemoveTab = (id: string) => {
    setTabs(tabs.filter((t: any) => t.id !== id));
  };

  const handleUpdateTab = (id: string, updates: Partial<NavTab>) => {
    setTabs(
      tabs.map((t: any) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        if (updates.name !== undefined && !t.slugManuallyEdited) {
          updated.slug = slugify(updates.name);
        }
        if (updates.slug !== undefined) {
          updated.slugManuallyEdited = true;
        }
        return updated;
      })
    );
  };

  const handleAddItem = (tabId: string, itemType: "folder" | "page", itemId: string) => {
    setTabs(
      tabs.map((t: any) => {
        if (t.id !== tabId) return t;
        const newItem: NavTabItem =
          itemType === "folder"
            ? { type: "folder" as const, folderId: itemId as Id<"folders"> }
            : { type: "page" as const, pageId: itemId as Id<"pages"> };
        return { ...t, items: [...t.items, newItem] };
      })
    );
  };

  const handleRemoveItem = (tabId: string, itemIndex: number) => {
    setTabs(
      tabs.map((t: any) => {
        if (t.id !== tabId) return t;
        const newItems = [...t.items];
        newItems.splice(itemIndex, 1);
        return { ...t, items: newItems };
      })
    );
  };

  const handleSave = async () => {
    // Filter out invalid tabs (no name or no items)
    // Also strip out slugManuallyEdited which is only used locally
    const validTabs = tabs
      .filter((t: any) => t.name.trim() && t.items.length > 0)
      .map(({ slugManuallyEdited, ...tab }) => tab);

    setSaving(true);
    try {
      await onSave(validTabs);
      lastSavedTabsRef.current = JSON.stringify(validTabs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save tabs:", error);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(tabs) !== JSON.stringify(migratedInitialTabs);

  // Get display info for an item
  const getItemDisplay = (item: NavTabItem) => {
    if (item.type === "folder") {
      const folder = allFolders.find((f: any) => f._id === item.folderId);
      return folder ? { name: folder.name, icon: folder.icon, path: folder.path } : null;
    } else if (item.type === "page") {
      const page = allPages.find((p: any) => p._id === item.pageId);
      return page ? { name: page.title, icon: page.icon, path: page.path } : null;
    }
    return null;
  };

  // Get ROOT-LEVEL folders that can be added to a tab (not already assigned)
  const getAvailableFolders = (currentTabId: string) => {
    const currentTab = tabs.find((t: any) => t.id === currentTabId);
    const currentTabFolderIds = new Set(
      currentTab?.items.filter((i: any) => i.type === "folder").map((i: any) => i.folderId) ?? []
    );
    // Only show root-level folders (no parent)
    return allFolders.filter(
      (f: any) => !f.parentId && (!assignedFolderIds.has(f._id) || currentTabFolderIds.has(f._id))
    );
  };

  // Get ROOT-LEVEL pages that can be added to a tab (not already assigned)
  const getAvailablePages = (currentTabId: string) => {
    const currentTab = tabs.find((t: any) => t.id === currentTabId);
    const currentTabPageIds = new Set(
      currentTab?.items.filter((i: any) => i.type === "page").map((i: any) => i.pageId) ?? []
    );
    // Only show root-level pages (path like "/slug" with 2 segments)
    return allPages.filter(
      (p: any) => p.path.split("/").length === 2 && (!assignedPageIds.has(p._id) || currentTabPageIds.has(p._id))
    );
  };

  const totalUnassigned = unassignedFolders.length + unassignedPages.length;

  return (
    <div className="space-y-4">
      {tabs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("navTabs.noTabsConfigured")}
        </p>
      ) : (
        <div className="space-y-4">
          {tabs.map((tab: any) => (
            <div
              key={tab.id}
              className="rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center pt-1.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 space-y-4">
                  {/* Tab name, slug, icon row */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`tab-name-${tab.id}`} className="text-xs">
                        {t("navTabs.tabName")}
                      </Label>
                      <Input
                        id={`tab-name-${tab.id}`}
                        name={`navtab-name-${tab.id}`}
                        value={tab.name}
                        onChange={(e) =>
                          handleUpdateTab(tab.id, { name: e.target.value })
                        }
                        placeholder="e.g., Guides"
                        className="h-8"
                        autoComplete="one-time-code"
                        data-form-type="other"
                        data-lpignore="true"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`tab-slug-${tab.id}`} className="text-xs">
                        {t("navTabs.urlSlug")}
                      </Label>
                      <Input
                        id={`tab-slug-${tab.id}`}
                        name={`navtab-slug-${tab.id}`}
                        value={tab.slug}
                        onChange={(e) =>
                          handleUpdateTab(tab.id, { slug: slugify(e.target.value) })
                        }
                        placeholder="e.g., guides"
                        className="h-8"
                        autoComplete="one-time-code"
                        data-form-type="other"
                        data-lpignore="true"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("navTabs.icon")}</Label>
                      <div className="flex items-center gap-2">
                        <IconPicker
                          value={tab.icon}
                          onChange={(icon) =>
                            handleUpdateTab(tab.id, { icon: icon ?? undefined })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {tab.icon ? t("navTabs.clickToChange") : t("navTabs.optional")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items in this tab */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t("navTabs.contentInTab")}</Label>
                    {tab.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {t("navTabs.noContentYet")}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {tab.items.map((item: any, index: number) => {
                          const display = getItemDisplay(item);
                          if (!display) return null;
                          const itemKey = item.type === "folder" ? item.folderId : item.pageId;
                          return (
                            <div
                              key={`${item.type}-${itemKey}`}
                              className="flex items-center gap-2 rounded border bg-muted/50 px-2 py-1.5 text-sm"
                            >
                              {item.type === "folder" ? (
                                <Folder className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              )}
                              {display.icon && (
                                <IconDisplay
                                  icon={display.icon}
                                  className="h-4 w-4"
                                />
                              )}
                              <span className="flex-1 truncate">{display.name}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {display.path}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(tab.id, index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add content dropdowns */}
                    <div className="flex gap-2 pt-2">
                      <Select
                        value=""
                        onValueChange={(value) => handleAddItem(tab.id, "folder", value)}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder={t("navTabs.addFolder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableFolders(tab.id).map((folder: any) => (
                            <SelectItem
                              key={folder._id}
                              value={folder._id}
                              disabled={tab.items.some(
                                (i: any) => i.type === "folder" && i.folderId === folder._id
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Folder className="h-3 w-3" />
                                {folder.icon && (
                                  <IconDisplay
                                    icon={folder.icon}
                                    className="h-3 w-3"
                                  />
                                )}
                                <span className="truncate">{folder.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {folder.path}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value=""
                        onValueChange={(value) => handleAddItem(tab.id, "page", value)}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder={t("navTabs.addPage")} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePages(tab.id).map((page: any) => (
                            <SelectItem
                              key={page._id}
                              value={page._id}
                              disabled={tab.items.some(
                                (i: any) => i.type === "page" && i.pageId === page._id
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-3 w-3" />
                                {page.icon && (
                                  <IconDisplay
                                    icon={page.icon}
                                    className="h-3 w-3"
                                  />
                                )}
                                <span className="truncate">{page.title}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {page.path}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveTab(tab.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={handleAddTab}>
          <Plus className="mr-2 h-4 w-4" />
          {t("navTabs.addTab")}
        </Button>

        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? t("navTabs.saved") : saving ? t("navTabs.saving") : t("navTabs.saveChanges")}
          </Button>
        )}
      </div>

      {/* Unassigned content warning */}
      {tabs.length > 0 && totalUnassigned > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("navTabs.unassignedItems", { count: totalUnassigned })}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("navTabs.unassignedWarning")}
              </p>
              <div className="pt-1 space-y-0.5">
                {unassignedFolders.slice(0, 3).map((f: any) => (
                  <div key={f._id} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    <span>{f.name}</span>
                    <span className="text-amber-500">({f.path})</span>
                  </div>
                ))}
                {unassignedPages.slice(0, 3).map((p: any) => (
                  <div key={p._id} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{p.title}</span>
                    <span className="text-amber-500">({p.path})</span>
                  </div>
                ))}
                {totalUnassigned > 6 && (
                  <p className="text-xs text-amber-500 pt-0.5">
                    {t("navTabs.andMore", { count: totalUnassigned - 6 })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tabs.length > 0 && totalUnassigned === 0 && (
        <p className="text-xs text-muted-foreground">
          {t("navTabs.allContentAssigned")}
        </p>
      )}
    </div>
  );
}
