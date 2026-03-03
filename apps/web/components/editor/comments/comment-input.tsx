"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@inkloom/ui/button";
import { Send } from "lucide-react";

interface CommentInputProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  initialValue?: string;
  onCancel?: () => void;
}

export function CommentInput({
  onSubmit,
  placeholder,
  autoFocus = false,
  submitLabel,
  disabled = false,
  initialValue = "",
  onCancel,
}: CommentInputProps) {
  const t = useTranslations("editor.comments");
  const tc = useTranslations("common");
  const resolvedPlaceholder = placeholder || t("writeYourComment");
  const resolvedSubmitLabel = submitLabel || t("comment");
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (trimmedContent && !disabled) {
      onSubmit(trimmedContent);
      setContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Cancel on Escape
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        className="min-h-[60px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        rows={1}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.trim() ? (
            <>{t("submitHint")}</>
          ) : null}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={disabled}
            >
              {tc("cancel")}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || disabled}
          >
            <Send className="mr-1 h-3 w-3" />
            {resolvedSubmitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
