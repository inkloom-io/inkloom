"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
import "./steps.css";

export const Steps = createReactBlockSpec(
  {
    type: "steps",
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
              title: (childBlock.props?.title as string) || t("stepDefault"),
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

      const addStep = useCallback(() => {
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
          [{ type: "step", props: { title: `${t("stepDefault")} ${childBlocks.length + 1}` } }],
          insertAfterBlock,
          "after"
        );
      }, [editor, props.block]);

      const hasChildren = children.length > 0;

      return (
        <div
          className="bn-steps-container"
          data-has-children={hasChildren ? "true" : "false"}
          data-container-id={props.block.id}
        >
          <div className="bn-steps-header">
            <span className="bn-steps-label">{t("stepsContainer")}</span>
            <button
              type="button"
              className="bn-steps-add-button"
              onClick={addStep}
            >
              {t("addStep")}
            </button>
          </div>
          {!hasChildren && (
            <p className="bn-steps-hint">
              {t("stepsHint")}
            </p>
          )}
        </div>
      );
    },
  }
);

export const Step = createReactBlockSpec(
  {
    type: "step",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      title: {
        default: "Step",
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
            const container = findContainerBefore(editor, block, "steps");

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
      const stepNumber = (groupInfo?.index ?? 0) + 1;

      return (
        <div
          className="bn-step"
          data-in-group={isInGroup ? "true" : "false"}
          data-is-first={groupInfo?.isFirst ? "true" : "false"}
          data-is-last={groupInfo?.isLast ? "true" : "false"}
          data-step-index={groupInfo?.index ?? 0}
        >
          <div className="bn-step-indicator">
            {icon ? (
              <span className="bn-step-icon">{icon}</span>
            ) : (
              <span className="bn-step-number">{stepNumber}</span>
            )}
            <div className="bn-step-line" />
          </div>
          <div className="bn-step-content-wrapper">
            <div className="bn-step-header">
              <input
                className="bn-step-icon-input"
                value={icon}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { icon: e.target.value },
                  });
                }}
                placeholder={t("iconPlaceholder")}
              />
              <input
                className="bn-step-title-input"
                value={title}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { title: e.target.value },
                  });
                }}
                placeholder={t("stepTitlePlaceholder")}
              />
            </div>
            <div className="bn-step-content" ref={props.contentRef} />
          </div>
        </div>
      );
    },
  }
);
