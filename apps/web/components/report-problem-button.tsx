"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MessageSquareWarning, CheckCircle, Loader2 } from "lucide-react";
import { errorReportingAdapter } from "@/lib/adapters/error-reporting";
import { Button } from "@inkloom/ui/button";
import { Textarea } from "@inkloom/ui/textarea";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@inkloom/ui/dialog";

/**
 * "Report a problem" button with a feedback modal dialog.
 *
 * Opens a proper modal so users can report issues from anywhere in the app.
 * Only renders when the error reporting adapter supports feedback submission
 * (i.e. platform mode with Sentry).
 */

interface ReportProblemButtonProps {
  /** Display variant. "icon" shows only the icon, "full" shows icon + label. */
  variant?: "icon" | "full";
  /** Optional CSS class names */
  className?: string;
  /** Pre-fill name field from user context */
  userName?: string;
  /** Pre-fill email field from user context */
  userEmail?: string;
}

type DialogState = "form" | "submitting" | "success";

export function ReportProblemButton({
  variant = "icon",
  className = "",
  userName,
  userEmail,
}: ReportProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(userName ?? "");
  const [email, setEmail] = useState(userEmail ?? "");
  const [dialogState, setDialogState] = useState<DialogState>("form");
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setMessage("");
    setName(userName ?? "");
    setEmail(userEmail ?? "");
    setDialogState("form");
  }, [userName, userEmail]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        // Clear auto-close timer if dialog is closed manually
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
          autoCloseTimerRef.current = null;
        }
        resetForm();
      }
    },
    [resetForm],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!message.trim()) return;

    setDialogState("submitting");

    if (errorReportingAdapter.submitFeedback) {
      errorReportingAdapter.submitFeedback({
        message: message.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
    }

    setDialogState("success");
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setOpen(false);
      resetForm();
    }, 2000);
  }, [message, name, email, resetForm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Only render when feedback submission is available (platform mode with Sentry)
  if (!errorReportingAdapter.submitFeedback) {
    return null;
  }

  const triggerButton =
    variant === "full" ? (
      <button
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
        title="Report a problem"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span>Report a problem</span>
      </button>
    ) : (
      <button
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
        title="Report a problem"
        aria-label="Report a problem"
      >
        <MessageSquareWarning className="h-4 w-4" />
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {dialogState === "success" ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <CheckCircle className="h-8 w-8 text-teal-500" />
            <p className="text-sm text-muted-foreground">
              Thanks for your feedback
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5" />
                Report a problem
              </DialogTitle>
              <DialogDescription>
                Help us improve. Describe what went wrong or what&apos;s not
                working.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-message">What happened? *</Label>
                <Textarea
                  id="feedback-message"
                  placeholder="What happened?"
                  rows={4}
                  autoFocus
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={dialogState === "submitting"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="feedback-name">Name</Label>
                  <Input
                    id="feedback-name"
                    placeholder="Name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={dialogState === "submitting"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-email">Email</Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    placeholder="Email (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={dialogState === "submitting"}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={dialogState === "submitting"}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || dialogState === "submitting"}
              >
                {dialogState === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send feedback"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
