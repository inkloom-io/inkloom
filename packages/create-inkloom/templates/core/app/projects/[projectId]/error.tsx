"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Error boundary for project routes.
 *
 * Catches runtime errors such as Convex `ArgumentValidationError` when a
 * project ID from an outdated database schema maps to the wrong table.
 * Instead of crashing the whole app, this shows a friendly recovery message.
 */
export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project route error:", error);
  }, [error]);

  const isTableMismatch =
    error.message?.includes("which does not match") ||
    error.message?.includes("ArgumentValidationError") ||
    error.message?.includes("Found ID from table");

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">
          {isTableMismatch
            ? "Project data mismatch"
            : "Something went wrong"}
        </h2>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          {isTableMismatch
            ? "This can happen if the database schema changed after this project was created. Try creating a new project, or clear your Convex database by running: npx convex dev --once"
            : error.message || "An unexpected error occurred while loading this project."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
