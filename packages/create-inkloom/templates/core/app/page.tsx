"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  BookOpen,
  FileText,
  Globe,
  MoreVertical,
  Moon,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "@/convex/_generated/dataModel";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  return `${months}mo ago`;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

function ProjectCardPageCount({
  branchId,
}: {
  branchId: Id<"branches"> | undefined;
}) {
  const pageCount = useQuery(
    api.pages.countByBranch,
    branchId ? { branchId } : "skip"
  );

  if (pageCount === undefined) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <FileText className="h-3 w-3" />
      {pageCount} {pageCount === 1 ? "page" : "pages"}
    </span>
  );
}

function ProjectCard({
  project,
  index,
  onDelete,
}: {
  project: {
    _id: Id<"projects">;
    name: string;
    slug: string;
    description?: string;
    defaultBranchId?: Id<"branches">;
    updatedAt: number;
  };
  index: number;
  onDelete: (id: Id<"projects">, name: string) => void;
}) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
      style={{ animationDelay: `${index * 75}ms`, animationDuration: "400ms" }}
    >
      <Card className="group relative border-border bg-card transition-all duration-200 hover:border-ring/40 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5">
        <Link href={`/projects/${project._id}`} className="block">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold leading-snug">
                {project.name}
              </CardTitle>
            </div>
            {project.description ? (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {project.description}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex items-center gap-3">
              <ProjectCardPageCount branchId={project.defaultBranchId} />
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                /{project.slug}
              </span>
            </div>
          </CardContent>
          <CardFooter className="pt-0 pb-4">
            <span className="text-xs text-muted-foreground">
              Updated {formatRelativeTime(project.updatedAt)}
            </span>
          </CardFooter>
        </Link>
        {/* Three-dot menu — positioned absolutely so it doesn't interfere with the link */}
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(project._id, project.name);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
}

function EmptyState({ onFocusInput }: { onFocusInput: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-4 mb-6">
        <BookOpen className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create your first documentation project to get started with InkLoom.
      </p>
      <Button onClick={onFocusInput} size="lg">
        <Plus className="h-4 w-4 mr-2" />
        Create Project
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-6 animate-pulse"
        >
          <div className="h-5 w-2/3 bg-muted rounded mb-3" />
          <div className="h-4 w-full bg-muted rounded mb-2" />
          <div className="h-4 w-1/2 bg-muted rounded mb-4" />
          <div className="h-3 w-1/3 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const deleteProject = useMutation(api.projects.remove);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"projects">;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await createProject({ name: newName.trim() });
    setNewName("");
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteProject({ id: deleteTarget.id });
    setDeleting(false);
    setDeleteTarget(null);
  };

  const focusInput = () => {
    const input = document.getElementById("new-project-input");
    if (input) input.focus();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">InkLoom</h1>
            <p className="text-muted-foreground mt-1">
              Your documentation projects
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Create project form */}
        <form onSubmit={handleCreate} className="flex gap-3 mb-8">
          <Input
            id="new-project-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name..."
            className="flex-1"
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Creating..." : "Create"}
          </Button>
        </form>

        {/* Project list */}
        {projects === undefined ? (
          <LoadingSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState onFocusInput={focusInput} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, index) => (
              <ProjectCard
                key={project._id}
                project={project}
                index={index}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
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
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              and all of its pages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
