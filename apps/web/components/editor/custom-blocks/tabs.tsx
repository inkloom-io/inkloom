"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore, isContainerType } from "./group-utils";
import "./tabs.css";

export const Tabs = createReactBlockSpec(
  {
    type: "tabs",
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
      const t = useTranslations("editor.blocks");
      const [children, setChildren] = useState<
        Array<{ id: string; title: string; icon: string }>
      >([]);
      const activeIndex = parseInt(props.block.props.activeIndex || "0", 10);

      useEffect(() => {
        const updateChildren = () => {
          const block = { id: props.block.id, type: props.block.type };
          const childBlocks = getGroupChildren(editor, block);
          setChildren(
            childBlocks.map((childBlock: any) => ({
              id: childBlock.id,
              title: (childBlock.props?.title as string) || t("tabDefault"),
              icon: (childBlock.props?.icon as string) || "",
            }))
          );

          // Manage visibility of content blocks interleaved between tab siblings.
          // When tab content has block-level elements (code blocks, images, etc.),
          // they appear as flat siblings in the document. We need to:
          // 1. Show/hide them based on which tab is active
          // 2. Style them to look like they're inside the tab's content area
          //
          // We use injected <style> elements instead of data attributes because
          // ProseMirror's DOM management removes manually-set attributes during
          // its reconciliation cycle.
          const editorDoc = editor.document as Array<{
            id: string;
            type: string;
            props?: Record<string, unknown>;
          }>;
          const containerIndex = editorDoc.findIndex(
            (b) => b.id === props.block.id
          );
          if (containerIndex === -1) return;

          // Build CSS rules for content blocks in this tabs group
          const hideSelectors: string[] = [];
          const showSelectors: string[] = [];
          const lastInTabSelectors: string[] = [];
          const tabsWithContentBelow: string[] = [];
          let currentTabIndex = -1;
          let lastContentId: string | null = null;
          let lastTabId: string | null = null;
          let hasAnyContentBlocks = false;

          for (let i = containerIndex + 1; i < editorDoc.length; i++) {
            const docBlock = editorDoc[i];
            if (!docBlock) continue;
            if (isContainerType(docBlock.type)) break;

            if (docBlock.type === "tab") {
              // Mark the last content block from the previous tab
              if (lastContentId) {
                lastInTabSelectors.push(
                  `.bn-block-outer[data-id="${lastContentId}"]`
                );
              }
              currentTabIndex++;
              lastTabId = docBlock.id;
              lastContentId = null;
              continue;
            }

            // Content block between tabs
            if (currentTabIndex < 0) continue;
            hasAnyContentBlocks = true;

            const sel = `.bn-block-outer[data-id="${docBlock.id}"]`;
            if (currentTabIndex === activeIndex) {
              showSelectors.push(sel);
            } else {
              hideSelectors.push(sel);
            }
            lastContentId = docBlock.id;

            // Track that this tab has content below it
            if (lastTabId && !tabsWithContentBelow.includes(lastTabId)) {
              tabsWithContentBelow.push(lastTabId);
            }
          }
          // Mark the very last content block in the group
          if (lastContentId) {
            lastInTabSelectors.push(
              `.bn-block-outer[data-id="${lastContentId}"]`
            );
          }

          // Inject or update the style element for this tabs container
          if (hasAnyContentBlocks && typeof window !== "undefined") {
            const styleId = `tabs-content-${props.block.id}`;
            let styleEl = window.document.getElementById(styleId);
            if (!styleEl) {
              styleEl = window.document.createElement("style");
              styleEl.id = styleId;
              window.document.head.appendChild(styleEl);
            }

            let css = "";
            // Hide inactive content blocks
            if (hideSelectors.length > 0) {
              css += `${hideSelectors.join(",\n")} {\n`;
              css += "  display: none !important;\n";
              css += "  height: 0 !important;\n";
              css += "  overflow: hidden !important;\n";
              css += "  margin: 0 !important;\n";
              css += "  padding: 0 !important;\n";
              css += "}\n";
            }
            // Style active content blocks
            if (showSelectors.length > 0) {
              css += `${showSelectors.join(",\n")} {\n`;
              css += "  margin-top: 0 !important;\n";
              css += "  margin-bottom: 0 !important;\n";
              css += "  border-left: 1px solid color-mix(in srgb, var(--editor-primary, #6366f1) 20%, transparent);\n";
              css += "  border-right: 1px solid color-mix(in srgb, var(--editor-primary, #6366f1) 20%, transparent);\n";
              css += "  background: var(--editor-background-subtle, rgba(128, 128, 128, 0.04));\n";
              css += "  padding: 4px 12px;\n";
              css += "  border-radius: 0;\n";
              css += "}\n";
            }
            // Last content block in a tab gets bottom border
            if (lastInTabSelectors.length > 0) {
              // Only style the last content block that's currently visible
              const visibleLastSelectors = lastInTabSelectors.filter(
                (s) => showSelectors.includes(s)
              );
              if (visibleLastSelectors.length > 0) {
                css += `${visibleLastSelectors.join(",\n")} {\n`;
                css += "  border-bottom: 1px solid color-mix(in srgb, var(--editor-primary, #6366f1) 20%, transparent);\n";
                css += "  border-radius: 0 0 12px 12px;\n";
                css += "  padding-bottom: 8px;\n";
                css += "}\n";
              }
            }
            // Remove bottom border-radius from tabs with content below
            if (tabsWithContentBelow.length > 0) {
              const tabSelectors = tabsWithContentBelow.map(
                (id) => `.bn-block-outer[data-id="${id}"] .bn-tab`
              );
              css += `${tabSelectors.join(",\n")} {\n`;
              css += "  border-radius: 0 !important;\n";
              css += "  border-bottom: none !important;\n";
              css += "}\n";
            }

            styleEl.textContent = css;
          }
        };

        updateChildren();

        const unsubscribe = editor.onChange(() => {
          updateChildren();
        });

        return () => {
          unsubscribe();
          // Clean up injected style element
          if (typeof window !== "undefined") {
            const styleId = `tabs-content-${props.block.id}`;
            const styleEl = window.document.getElementById(styleId);
            if (styleEl) {
              styleEl.remove();
            }
          }
        };
      }, [editor, props.block, activeIndex]);

      const setActiveIndex = useCallback(
        (index: number) => {
          props.editor.updateBlock(props.block, {
            props: { activeIndex: String(index) },
          });
        },
        [props.editor, props.block]
      );

      const addTab = useCallback(() => {
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
          [{ type: "tab", props: { title: `${t("tabDefault")} ${childBlocks.length + 1}` } }],
          insertAfterBlock,
          "after"
        );

        // Set the new tab as active
        setTimeout(() => {
          setActiveIndex(childBlocks.length);
        }, 50);
      }, [editor, props.block, setActiveIndex]);

      const hasChildren = children.length > 0;

      return (
        <div
          className="bn-tabs-container"
          data-has-children={hasChildren ? "true" : "false"}
          data-active-index={activeIndex}
          data-container-id={props.block.id}
        >
          <div className="bn-tabs-header">
            {hasChildren ? (
              <div className="bn-tabs-tab-list">
                {children.map((child: any, index: number) => (
                  <button
                    key={child.id}
                    type="button"
                    className="bn-tabs-tab-button"
                    data-active={index === activeIndex ? "true" : "false"}
                    onClick={() => setActiveIndex(index)}
                  >
                    {child.icon && (
                      <span className="bn-tabs-tab-icon">{child.icon}</span>
                    )}
                    <span className="bn-tabs-tab-title">{child.title}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="bn-tabs-add-tab-button"
                  onClick={addTab}
                  title={t("addNewTab")}
                >
                  +
                </button>
              </div>
            ) : (
              <>
                <span className="bn-tabs-label">{t("tabsContainer")}</span>
                <button
                  type="button"
                  className="bn-tabs-add-button"
                  onClick={addTab}
                >
                  {t("addTab")}
                </button>
              </>
            )}
          </div>
          {!hasChildren && (
            <p className="bn-tabs-hint">
              {t("tabsHint")}
            </p>
          )}
        </div>
      );
    },
  }
);

export const Tab = createReactBlockSpec(
  {
    type: "tab",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      title: {
        default: "Tab",
      },
      icon: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { title, icon } = props.block.props;
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
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
            const container = findContainerBefore(editor, block, "tabs");
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

      return (
        <div
          className="bn-tab"
          data-in-group={isInGroup ? "true" : "false"}
          data-is-active={isActive ? "true" : "false"}
          data-tab-index={groupInfo?.index ?? 0}
        >
          <div className="bn-tab-header">
            <input
              className="bn-tab-icon-input"
              value={icon}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { icon: e.target.value },
                });
              }}
              placeholder={t("iconPlaceholder")}
            />
            <input
              className="bn-tab-title-input"
              value={title}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { title: e.target.value },
                });
              }}
              placeholder={t("tabTitlePlaceholder")}
            />
          </div>
          <div className="bn-tab-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);
