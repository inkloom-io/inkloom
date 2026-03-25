"use client";

import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { getGroupChildren } from "./group-utils";
import "./code-group.css";

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  java: "Java",
  csharp: "C#",
  cpp: "C++",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  yaml: "YAML",
  markdown: "Markdown",
  plaintext: "Plaintext",
};

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

export const CodeGroup = createReactBlockSpec(
  {
    type: "codeGroup",
    propSchema: {
      activeIndex: {
        default: "0",
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const editor = useBlockNoteEditor();
      const [children, setChildren] = useState<
        Array<{ id: string; language: string; title?: string }>
      >([]);
      const activeIndex = parseInt(props.block.props.activeIndex || "0", 10);

      useEffect(() => {
        const updateChildren = () => {
          const block = { id: props.block.id, type: props.block.type };
          const childBlocks = getGroupChildren(editor, block);
          setChildren(
            childBlocks.map((childBlock) => {
              const lang = (childBlock.props?.language as string) || "javascript";
              const title = (childBlock.props?.title as string) || undefined;
              return { id: childBlock.id, language: lang === "text" ? "plaintext" : lang, title };
            })
          );
        };

        updateChildren();

        const unsubscribe = editor.onChange(() => {
          updateChildren();
        });

        return () => {
          unsubscribe();
        };
      }, [editor, props.block]);

      const setActiveIndex = useCallback(
        (index: number) => {
          props.editor.updateBlock(props.block, {
            props: { activeIndex: String(index) },
          });
        },
        [props.editor, props.block]
      );

      const addCodeBlock = useCallback(() => {
        const block = { id: props.block.id, type: props.block.type };
        const childBlocks = getGroupChildren(editor, block);

        // Find the actual block to insert after
        const document = editor.document;
        const lastChild = childBlocks[childBlocks.length - 1];
        const insertAfterBlock = lastChild
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? document.find((b: any) => b.id === lastChild.id) || props.block
          : props.block;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).insertBlocks(
          [{ type: "codeBlock", props: { language: "javascript" } }],
          insertAfterBlock,
          "after"
        );

        // Set the new code block as active
        setTimeout(() => {
          setActiveIndex(childBlocks.length);
        }, 50);
      }, [editor, props.block, setActiveIndex]);

      const changeLanguage = useCallback(
        (childId: string, newLanguage: string) => {
          const document = editor.document;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const childBlock = document.find((b: any) => b.id === childId);
          if (childBlock) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).updateBlock(childBlock, {
              props: { language: newLanguage },
            });
          }
        },
        [editor]
      );

      const changeTitle = useCallback(
        (childId: string, newTitle: string) => {
          const document = editor.document;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const childBlock = document.find((b: any) => b.id === childId);
          if (childBlock) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).updateBlock(childBlock, {
              props: { title: newTitle },
            });
          }
        },
        [editor]
      );

      const hasChildren = children.length > 0;

      return (
        <div
          className="bn-code-group"
          data-has-children={hasChildren ? "true" : "false"}
          data-active-index={activeIndex}
          data-container-id={props.block.id}
        >
          <div className={`bn-code-group-header${hasChildren && children.length === 1 ? " bn-code-group-header-single" : ""}`}>
            {hasChildren && children.length === 1 ? (
              /* Single code block: show label-style header matching published site */
              <div className="bn-code-group-label-bar">
                <div className="bn-code-group-label-controls">
                  <select
                    className="bn-code-group-language-badge"
                    value={children[0]!.language}
                    onChange={(e) => changeLanguage(children[0]!.id, e.target.value)}
                  >
                    {LANGUAGES.map((lang: { value: string; label: string }) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="bn-code-group-title-input"
                    value={children[0]!.title || ""}
                    onChange={(e) => changeTitle(children[0]!.id, e.target.value)}
                    placeholder="Title"
                  />
                </div>
                <button
                  type="button"
                  className="bn-code-group-add-button"
                  onClick={addCodeBlock}
                  title="Add code block"
                >
                  +
                </button>
              </div>
            ) : hasChildren ? (
              <div className="bn-code-group-tab-list">
                {children.map((child: { id: string; language: string; title?: string }, index: number) => (
                  index === activeIndex ? (
                    <div key={child.id} className="bn-code-group-active-tab">
                      <select
                        className="bn-code-group-tab-select"
                        value={child.language}
                        onChange={(e) => changeLanguage(child.id, e.target.value)}
                      >
                        {LANGUAGES.map((lang: { value: string; label: string }) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="bn-code-group-title-input"
                        value={child.title || ""}
                        onChange={(e) => changeTitle(child.id, e.target.value)}
                        placeholder="Title"
                      />
                    </div>
                  ) : (
                    <button
                      key={child.id}
                      type="button"
                      className="bn-code-group-tab-button"
                      data-active="false"
                      onClick={() => setActiveIndex(index)}
                    >
                      {child.title || LANGUAGE_LABELS[child.language] || child.language}
                    </button>
                  )
                ))}
                <button
                  type="button"
                  className="bn-code-group-add-button"
                  onClick={addCodeBlock}
                  title="Add code block"
                >
                  +
                </button>
              </div>
            ) : (
              <>
                <span className="bn-code-group-label">Code Group</span>
                <button
                  type="button"
                  className="bn-code-group-add-initial-button"
                  onClick={addCodeBlock}
                >
                  Add code block
                </button>
              </>
            )}
          </div>
          {!hasChildren && (
            <p className="bn-code-group-hint">
              Add code blocks to create a tabbed code group.
            </p>
          )}
        </div>
      );
    },
  }
);
