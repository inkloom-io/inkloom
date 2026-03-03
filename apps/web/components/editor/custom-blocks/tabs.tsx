"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
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
