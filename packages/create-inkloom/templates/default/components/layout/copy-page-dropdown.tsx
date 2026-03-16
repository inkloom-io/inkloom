import { useState, useRef, useEffect } from "react";
import { Copy, Link, FileText, ChevronDown, Check } from "lucide-react";

interface CopyPageDropdownProps {
  /** Raw MDX source content */
  mdxContent: string;
}

type CopyAction = "markdown" | "link" | null;

export function CopyPageDropdown({ mdxContent }: CopyPageDropdownProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<CopyAction>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  function showCopiedFeedback(action: CopyAction) {
    setCopied(action);
    setTimeout(() => setCopied(null), 1500);
  }

  async function copyAsMarkdown() {
    try {
      await navigator.clipboard.writeText(mdxContent);
      showCopiedFeedback("markdown");
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = mdxContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showCopiedFeedback("markdown");
    }
    setOpen(false);
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showCopiedFeedback("link");
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showCopiedFeedback("link");
    }
    setOpen(false);
  }

  function viewAsMarkdown() {
    const blob = new Blob([mdxContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-500">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy page</span>
          </>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] py-1 shadow-lg">
          <button
            type="button"
            onClick={copyAsMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            <FileText className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            Copy as Markdown
          </button>
          <button
            type="button"
            onClick={copyPageLink}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            <Link className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            Copy page link
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            type="button"
            onClick={viewAsMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            <Copy className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            View as Markdown
          </button>
        </div>
      )}
    </div>
  );
}
