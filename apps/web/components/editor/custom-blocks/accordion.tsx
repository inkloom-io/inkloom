"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
import { IconPicker } from "../icon-picker";
import "./accordion.css";

export const AccordionGroup = createReactBlockSpec(
  {
    type: "accordionGroup",
    propSchema: {},
    content: "none",
  },
  {
    render: (props) => {
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
      const [children, setChildren] = useState<
        Array<{ id: string; title: string; icon: string }>
      >([]);

      useEffect(() => {
        const updateChildren = () => {
          const block = { id: props.block.id, type: props.block.type };
          const childBlocks = getGroupChildren(editor, block);
          setChildren(
            childBlocks.map((childBlock: any) => ({
              id: childBlock.id,
              title: (childBlock.props?.title as string) || t("accordionDefault"),
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

      const addAccordion = useCallback(() => {
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
          [{ type: "accordion", props: { title: `${t("accordionDefault")} ${childBlocks.length + 1}` } }],
          insertAfterBlock,
          "after"
        );
      }, [editor, props.block]);

      const hasChildren = children.length > 0;

      return (
        <div
          className="bn-accordion-group-container"
          data-has-children={hasChildren ? "true" : "false"}
          data-container-id={props.block.id}
        >
          <div className="bn-accordion-group-header">
            <span className="bn-accordion-group-label">{t("accordionGroupContainer")}</span>
            <button
              type="button"
              className="bn-accordion-group-add-button"
              onClick={addAccordion}
            >
              {t("addAccordion")}
            </button>
          </div>
          {!hasChildren && (
            <p className="bn-accordion-group-hint">
              {t("accordionGroupHint")}
            </p>
          )}
        </div>
      );
    },
  }
);

export const Accordion = createReactBlockSpec(
  {
    type: "accordion",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      title: {
        default: "Accordion",
      },
      icon: {
        default: "",
      },
      defaultOpen: {
        default: "false",
      },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { title, icon, defaultOpen } = props.block.props;
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
      const [isExpanded, setIsExpanded] = useState(defaultOpen === "true");
      const [groupInfo, setGroupInfo] = useState<{
        index: number;
        isFirst: boolean;
        isLast: boolean;
        containerId: string;
      } | null>(null);

      useEffect(() => {
        const updatePosition = () => {
          const block = { id: props.block.id, type: props.block.type };
          const position = getGroupPosition(editor, block);
          if (position) {
            // Find the container to get its id
            const container = findContainerBefore(editor, block, "accordionGroup");

            setGroupInfo({
              index: position.index,
              isFirst: position.isFirst,
              isLast: position.isLast,
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

      const toggleExpanded = useCallback(() => {
        setIsExpanded((prev) => !prev);
      }, []);

      const toggleDefaultOpen = useCallback(() => {
        const newValue = defaultOpen === "true" ? "false" : "true";
        props.editor.updateBlock(props.block, {
          props: { defaultOpen: newValue },
        });
      }, [props.editor, props.block, defaultOpen]);

      return (
        <div
          className="bn-accordion"
          data-in-group={isInGroup ? "true" : "false"}
          data-is-first={groupInfo?.isFirst ? "true" : "false"}
          data-is-last={groupInfo?.isLast ? "true" : "false"}
          data-expanded={isExpanded ? "true" : "false"}
        >
          <div className="bn-accordion-header-row">
            <button
              type="button"
              className="bn-accordion-toggle"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
            >
              <span className="bn-accordion-chevron">▶</span>
            </button>
            <IconPicker
              value={icon || undefined}
              onChange={(newIcon) => {
                props.editor.updateBlock(props.block, {
                  props: { icon: newIcon || "" },
                });
              }}
            />
            <input
              className="bn-accordion-title-input"
              value={title}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { title: e.target.value },
                });
              }}
              placeholder={t("accordionTitlePlaceholder")}
            />
            <button
              type="button"
              className="bn-accordion-default-open-toggle"
              onClick={toggleDefaultOpen}
              title={defaultOpen === "true" ? t("defaultOpenToggle") : t("defaultClosedToggle")}
            >
              {defaultOpen === "true" ? "📂" : "📁"}
            </button>
          </div>
          <div className="bn-accordion-content-wrapper">
            <div className="bn-accordion-content" ref={props.contentRef} />
          </div>
        </div>
      );
    },
  }
);
