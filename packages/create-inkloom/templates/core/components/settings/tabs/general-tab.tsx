"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Globe, Loader2, Trash2 } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";

interface GeneralTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function GeneralTab({ projectId, project }: GeneralTabProps) {
  const router = useRouter();

  const updateProject = useMutation(api.projects.update);
  const deleteProject = useMutation(api.projects.remove);

  // General settings
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [generalInitialized, setGeneralInitialized] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Initialize form when project loads
  useEffect(() => {
    if (project && !generalInitialized) {
      setName(project.name);
      setDescription(project.description || "");
      setSlug(project.slug || "");
      setGeneralInitialized(true);
    }
  }, [project, generalInitialized]);

  // Auto-save callback
  const saveGeneral = useCallback(
    async ({ name, description, slug }: { name: string; description: string; slug: string }) => {
      await updateProject({
        projectId: projectId as Id<"projects">,
        name,
        description,
        slug,
      });
    },
    [updateProject, projectId]
  );

  const generalStatus = useAutoSave(
    { name, description, slug },
    saveGeneral,
    800,
    generalInitialized
  );

  const handleDelete = async () => {
    if (deleteConfirmation !== project.name) return;
    setIsDeleting(true);
    try {
      await deleteProject({ projectId: projectId as Id<"projects"> });
      router.push("/projects");
    } catch (error) {
      console.error("Failed to delete:", error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Name & Description */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage your project name, description, and slug.
              </CardDescription>
            </div>
            <SaveStatus status={generalStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Project Slug */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Slug</CardTitle>
              <CardDescription>
                The URL-friendly identifier for your project.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-project"
                maxLength={40}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />
            URL preview: /docs/{slug || "my-project"}
          </p>
        </CardContent>
      </Card>

      {/* Delete Project */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this project and all its data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirmation(""); }}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the project{" "}
                  <strong className="font-semibold">{project.name}</strong> and all of its data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong className="font-semibold">{project.name}</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  autoFocus
                  placeholder={project.name}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConfirmation !== project.name || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Project"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
