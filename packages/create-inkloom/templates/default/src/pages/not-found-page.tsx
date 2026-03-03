import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-4 text-lg text-[var(--color-muted-foreground)]">
          Page not found
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
