"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MessageSquareWarning,
  CheckCircle,
  Loader2,
  ImagePlus,
  X,
  Bug,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
 *
 * Features:
 * - Category selector (bug, feature request, question)
 * - Guided prompts that change per category
 * - Optional screenshot upload with preview
 * - i18n support via next-intl
 */

type FeedbackCategory = "bug" | "feature" | "question";

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

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

const CATEGORY_CONFIG: {
  value: FeedbackCategory;
  icon: typeof Bug;
}[] = [
  { value: "bug", icon: Bug },
  { value: "feature", icon: Lightbulb },
  { value: "question", icon: HelpCircle },
];

export function ReportProblemButton({
  variant = "icon",
  className = "",
  userName,
  userEmail,
}: ReportProblemButtonProps) {
  const t = useTranslations("reportProblem");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [name, setName] = useState(userName ?? "");
  const [email, setEmail] = useState(userEmail ?? "");
  const [dialogState, setDialogState] = useState<DialogState>("form");
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Category-specific fields
  const [bugWhatDoing, setBugWhatDoing] = useState("");
  const [bugExpected, setBugExpected] = useState("");
  const [bugActual, setBugActual] = useState("");
  const [featureWhatWant, setFeatureWhatWant] = useState("");
  const [featureWhyUseful, setFeatureWhyUseful] = useState("");
  const [questionWhatHelp, setQuestionWhatHelp] = useState("");

  // Screenshot state
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>("");
  const [screenshotError, setScreenshotError] = useState<string>("");

  const resetForm = useCallback(() => {
    setCategory("bug");
    setName(userName ?? "");
    setEmail(userEmail ?? "");
    setDialogState("form");
    setBugWhatDoing("");
    setBugExpected("");
    setBugActual("");
    setFeatureWhatWant("");
    setFeatureWhyUseful("");
    setQuestionWhatHelp("");
    setScreenshot(null);
    setScreenshotName("");
    setScreenshotError("");
  }, [userName, userEmail]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
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

  /** Build a combined message string from the guided fields. */
  const buildMessage = useCallback((): string => {
    const parts: string[] = [];

    if (category === "bug") {
      if (bugWhatDoing.trim()) {
        parts.push(`What I was doing:\n${bugWhatDoing.trim()}`);
      }
      if (bugExpected.trim()) {
        parts.push(`Expected:\n${bugExpected.trim()}`);
      }
      if (bugActual.trim()) {
        parts.push(`What happened:\n${bugActual.trim()}`);
      }
    } else if (category === "feature") {
      if (featureWhatWant.trim()) {
        parts.push(`Feature request:\n${featureWhatWant.trim()}`);
      }
      if (featureWhyUseful.trim()) {
        parts.push(`Why useful:\n${featureWhyUseful.trim()}`);
      }
    } else {
      if (questionWhatHelp.trim()) {
        parts.push(questionWhatHelp.trim());
      }
    }

    return parts.join("\n\n");
  }, [
    category,
    bugWhatDoing,
    bugExpected,
    bugActual,
    featureWhatWant,
    featureWhyUseful,
    questionWhatHelp,
  ]);

  /** Check if the primary (required) field has content. */
  const hasRequiredField = useCallback((): boolean => {
    if (category === "bug") return bugWhatDoing.trim().length > 0;
    if (category === "feature") return featureWhatWant.trim().length > 0;
    return questionWhatHelp.trim().length > 0;
  }, [category, bugWhatDoing, featureWhatWant, questionWhatHelp]);

  const handleSubmit = useCallback(() => {
    if (!hasRequiredField()) return;

    setDialogState("submitting");

    if (errorReportingAdapter.submitFeedback) {
      errorReportingAdapter.submitFeedback({
        message: buildMessage(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        category,
        screenshot: screenshot ?? undefined,
      });
    }

    setDialogState("success");
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setOpen(false);
      resetForm();
    }, 2000);
  }, [
    hasRequiredField,
    buildMessage,
    name,
    email,
    category,
    screenshot,
    resetForm,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleScreenshotSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setScreenshotError("");
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setScreenshotError(t("screenshot.invalidType"));
        return;
      }

      if (file.size > MAX_SCREENSHOT_SIZE) {
        setScreenshotError(t("screenshot.fileTooLarge"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshot(reader.result);
          setScreenshotName(file.name);
        }
      };
      reader.readAsDataURL(file);
    },
    [t],
  );

  const removeScreenshot = useCallback(() => {
    setScreenshot(null);
    setScreenshotName("");
    setScreenshotError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Only render when feedback submission is available (platform mode with Sentry)
  if (!errorReportingAdapter.submitFeedback) {
    return null;
  }

  const isMac =
    typeof navigator !== "undefined" &&
    /mac/i.test(navigator.userAgent);
  const submitShortcut = isMac ? "⌘↵" : "Ctrl+↵";

  const triggerButton =
    variant === "full" ? (
      <button
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
        title={t("triggerLabel")}
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span>{t("triggerLabel")}</span>
      </button>
    ) : (
      <button
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--glass-hover)] hover:text-[var(--text-bright)] ${className}`}
        title={t("triggerLabel")}
        aria-label={t("triggerLabel")}
      >
        <MessageSquareWarning className="h-4 w-4" />
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {dialogState === "success" ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <CheckCircle className="h-8 w-8 text-teal-500" />
            <p className="text-sm text-muted-foreground">
              {t("successMessage")}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5" />
                {t("title")}
              </DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Category selector */}
              <div className="space-y-2">
                <Label>{t("categoryLabel")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_CONFIG.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                        category === value
                          ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                          : "border-border hover:border-teal-300 hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">
                        {t(`categories.${value}`)}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight text-center">
                        {t(`categories.${value}Description`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guided fields — Bug */}
              {category === "bug" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fb-bug-doing">
                      {t("fields.bug.whatDoing")} *
                    </Label>
                    <Textarea
                      id="fb-bug-doing"
                      placeholder={t("fields.bug.whatDoingPlaceholder")}
                      rows={3}
                      autoFocus
                      value={bugWhatDoing}
                      onChange={(e) => setBugWhatDoing(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={dialogState === "submitting"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-bug-expected">
                      {t("fields.bug.expected")}
                    </Label>
                    <Textarea
                      id="fb-bug-expected"
                      placeholder={t("fields.bug.expectedPlaceholder")}
                      rows={2}
                      value={bugExpected}
                      onChange={(e) => setBugExpected(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={dialogState === "submitting"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-bug-actual">
                      {t("fields.bug.actual")}
                    </Label>
                    <Textarea
                      id="fb-bug-actual"
                      placeholder={t("fields.bug.actualPlaceholder")}
                      rows={2}
                      value={bugActual}
                      onChange={(e) => setBugActual(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={dialogState === "submitting"}
                    />
                  </div>
                </>
              )}

              {/* Guided fields — Feature Request */}
              {category === "feature" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fb-feature-want">
                      {t("fields.feature.whatWant")} *
                    </Label>
                    <Textarea
                      id="fb-feature-want"
                      placeholder={t("fields.feature.whatWantPlaceholder")}
                      rows={3}
                      autoFocus
                      value={featureWhatWant}
                      onChange={(e) => setFeatureWhatWant(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={dialogState === "submitting"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-feature-why">
                      {t("fields.feature.whyUseful")}
                    </Label>
                    <Textarea
                      id="fb-feature-why"
                      placeholder={t("fields.feature.whyUsefulPlaceholder")}
                      rows={2}
                      value={featureWhyUseful}
                      onChange={(e) => setFeatureWhyUseful(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={dialogState === "submitting"}
                    />
                  </div>
                </>
              )}

              {/* Guided fields — Question */}
              {category === "question" && (
                <div className="space-y-2">
                  <Label htmlFor="fb-question-help">
                    {t("fields.question.whatHelp")} *
                  </Label>
                  <Textarea
                    id="fb-question-help"
                    placeholder={t("fields.question.whatHelpPlaceholder")}
                    rows={4}
                    autoFocus
                    value={questionWhatHelp}
                    onChange={(e) => setQuestionWhatHelp(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={dialogState === "submitting"}
                  />
                </div>
              )}

              {/* Screenshot upload */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  onChange={handleScreenshotSelect}
                />
                {screenshot ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                    <img
                      src={screenshot}
                      alt="Screenshot preview"
                      className="h-12 w-12 rounded object-cover"
                    />
                    <span className="flex-1 truncate text-sm text-muted-foreground">
                      {screenshotName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeScreenshot}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <X className="mr-1 h-3 w-3" />
                      {t("screenshot.remove")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-muted-foreground"
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {t("screenshot.attach")}
                  </Button>
                )}
                {screenshotError && (
                  <p className="text-xs text-destructive">{screenshotError}</p>
                )}
              </div>

              {/* Name / Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="feedback-name">{t("nameLabel")}</Label>
                  <Input
                    id="feedback-name"
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={dialogState === "submitting"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-email">{t("emailLabel")}</Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={dialogState === "submitting"}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {t("submitHint", { shortcut: submitShortcut })}
              </p>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={dialogState === "submitting"}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !hasRequiredField() || dialogState === "submitting"
                  }
                >
                  {dialogState === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("submitting")}
                    </>
                  ) : (
                    t("submit")
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
