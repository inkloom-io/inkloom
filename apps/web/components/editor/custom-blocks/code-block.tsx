"use client";

import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupPosition, findContainerBefore } from "./group-utils";
import { highlightCode, type HighlightResult } from "@/lib/syntax-highlighter";
import "./code-block.css";

const DEFAULT_HEIGHT = 150;
const MIN_HEIGHT = 60;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plaintext" },
];

interface SyntaxHighlightedEditorProps {
  code: string;
  language: string;
  height: number;
  onChange: (code: string) => void;
  onHeightChange: (height: number) => void;
  onFocus?: () => void;
}

function SyntaxHighlightedEditor({
  code,
  language,
  height,
  onChange,
  onHeightChange,
  onFocus,
}: SyntaxHighlightedEditorProps) {
  const t = useTranslations("editor.blocks");
  const [highlighted, setHighlighted] = useState<HighlightResult | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Auto-size: when using default height, size to content instead of fixed 150px
  const isAutoHeight = height === DEFAULT_HEIGHT;

  // Sync highlighting with code changes
  useEffect(() => {
    let cancelled = false;

    highlightCode(code || "", language).then((result) => {
      if (!cancelled) {
        setHighlighted(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  // Sync scroll position between textarea and highlighted code
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Auto-resize textarea to fit content when using default height
  useLayoutEffect(() => {
    if (!isAutoHeight || !textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = '0px';
    const scrollH = Math.max(MIN_HEIGHT, textarea.scrollHeight);
    const heightPx = `${scrollH}px`;
    textarea.style.height = heightPx;

    if (highlightRef.current) {
      highlightRef.current.style.height = heightPx;
    }
  }, [code, isAutoHeight]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue =
          code.substring(0, start) + "  " + code.substring(end);
        onChange(newValue);

        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [code, onChange]
  );

  // Handle resize via bottom border drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startYRef.current = e.clientY;
      // Use actual rendered height (not prop) since auto-sized blocks may differ
      startHeightRef.current = containerRef.current?.offsetHeight || height;
    },
    [height]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current;
      const newHeight = Math.max(MIN_HEIGHT, startHeightRef.current + deltaY);
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onHeightChange]);

  const heightStyle = isAutoHeight ? undefined : { height: `${height}px` };

  return (
    <div className="bn-code-editor" ref={containerRef} style={heightStyle}>
      {/* Highlighted code layer (behind) - uses div to contain Shiki's pre element */}
      <div
        ref={highlightRef}
        className="bn-code-highlight-layer"
        aria-hidden="true"
        style={heightStyle}
        dangerouslySetInnerHTML={{
          __html: highlighted
            ? highlighted.html
            : `<pre><code>${escapeHtml(code) || "\n"}</code></pre>`,
        }}
      />

      {/* Editable textarea layer (front, transparent text) */}
      <textarea
        ref={textareaRef}
        className="bn-code-textarea"
        style={heightStyle}
        value={code}
        onChange={handleChange}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        placeholder={t("codePlaceholder")}
      />

      {/* Resize handle spanning the entire bottom border */}
      <div
        className={`bn-code-resize-handle ${isResizing ? "bn-code-resize-handle-active" : ""}`}
        onMouseDown={handleResizeStart}
        title={t("dragToResize")}
      />
    </div>
  );
}

export const CodeBlock = createReactBlockSpec(
  {
    type: "codeBlock",
    propSchema: {
      language: {
        default: "javascript",
      },
      code: {
        default: "",
      },
      height: {
        default: String(DEFAULT_HEIGHT),
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { language: rawLanguage, code, height: heightStr } = props.block.props;
      // BlockNote's built-in codeBlock defaults to "text" — normalize to "plaintext"
      const language = rawLanguage === "text" ? "plaintext" : rawLanguage;
      const height = parseInt(heightStr || String(DEFAULT_HEIGHT), 10);
      const editor = useBlockNoteEditor();
      const [groupInfo, setGroupInfo] = useState<{
        isActive: boolean;
        index: number;
        containerId: string;
      } | null>(null);

      useEffect(() => {
        const updatePosition = () => {
          const block = { id: props.block.id, type: props.block.type };
          const position = getGroupPosition(editor, block);
          if (position) {
            // Find the container to get active index
            const container = findContainerBefore(editor, block, "codeGroup");
            const activeIndex = parseInt(
              (container?.props?.activeIndex as string) || "0",
              10
            );

            setGroupInfo({
              isActive: position.index === activeIndex,
              index: position.index,
              containerId: container?.id || "",
            });
          } else {
            setGroupInfo(null);
          }
        };

        updatePosition();

        const unsubscribe = editor.onChange(() => {
          updatePosition();
        });

        return () => {
          unsubscribe();
        };
      }, [editor, props.block]);

      const isInGroup = groupInfo !== null;
      const isActive = groupInfo?.isActive ?? true;

      const handleCodeChange = useCallback(
        (newCode: string) => {
          props.editor.updateBlock(props.block, {
            props: { code: newCode },
          });
        },
        [props.editor, props.block]
      );

      const handleHeightChange = useCallback(
        (newHeight: number) => {
          props.editor.updateBlock(props.block, {
            props: { height: String(newHeight) },
          });
        },
        [props.editor, props.block]
      );

      const handleFocus = useCallback(() => {
        // When the code block is focused, ensure it's visible if in a group
        if (groupInfo && !groupInfo.isActive) {
          const container = findContainerBefore(
            editor,
            { id: props.block.id, type: props.block.type },
            "codeGroup"
          );
          if (container) {
            // Use type assertion since we're updating a different block type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).updateBlock(container, {
              props: { activeIndex: String(groupInfo.index) },
            });
          }
        }
      }, [editor, props.block, groupInfo]);

      return (
        <div
          className="bn-code-block"
          data-in-group={isInGroup ? "true" : "false"}
          data-is-active={isActive ? "true" : "false"}
          data-code-index={groupInfo?.index ?? 0}
        >
          <div className="bn-code-block-header">
            <select
              className="bn-code-block-language-select"
              value={language}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { language: e.target.value },
                });
              }}
              contentEditable={false}
            >
              {LANGUAGES.map((lang: any) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <SyntaxHighlightedEditor
            code={code}
            language={language}
            height={height}
            onChange={handleCodeChange}
            onHeightChange={handleHeightChange}
            onFocus={handleFocus}
          />
        </div>
      );
    },
  }
);
