"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await createProject({ name: newName.trim() });
    setNewName("");
    setCreating(false);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">InkLoom</h1>
        <p className="text-neutral-400 mb-8">
          Your documentation projects
        </p>

        <form onSubmit={handleCreate} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name..."
            className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>

        {projects === undefined ? (
          <p className="text-neutral-500">Loading...</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Create your first documentation project above.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((project) => (
              <li key={project._id}>
                <Link
                  href={`/projects/${project._id}`}
                  className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-600 hover:bg-neutral-900/80 transition-colors group"
                >
                  <div>
                    <h2 className="font-semibold">{project.name}</h2>
                    {project.description && (
                      <p className="text-sm text-neutral-400 mt-1">
                        {project.description}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-2">
                      /{project.slug}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0 ml-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
