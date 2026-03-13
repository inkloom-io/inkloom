"use client";

import { AlertCircle, XCircle } from "lucide-react";

/**
 * Reusable inline error alert for form validation errors, API failures,
 * and other contextual error states.
 *
 * Provides a consistent error presentation across the app with an icon,
 * message, and optional dismiss button.
 *
 * Usage:
 * ```tsx
 * {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
 * ```
 */

interface ErrorAlertProps {
  /** Error message to display */
  message: string;
  /** Optional title displayed above the message */
  title?: string;
  /** Callback to dismiss the error. When provided, shows a close button. */
  onDismiss?: () => void;
  /** Visual variant. "inline" is compact for forms, "banner" is more prominent. */
  variant?: "inline" | "banner";
  /** Additional CSS class names */
  className?: string;
}

export function ErrorAlert({
  message,
  title,
  onDismiss,
  variant = "inline",
  className = "",
}: ErrorAlertProps) {
  if (variant === "banner") {
    return (
      <div
        role="alert"
        className={`relative flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm ${className}`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1">
          {title && (
            <p className="mb-1 font-semibold text-destructive">{title}</p>
          )}
          <p className="text-destructive/90">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-md p-0.5 text-destructive/60 transition-colors hover:text-destructive"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Inline variant — compact for forms
  return (
    <div
      role="alert"
      className={`flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ${className}`}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-destructive/60 transition-colors hover:text-destructive"
          aria-label="Dismiss error"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
