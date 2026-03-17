"use client";

import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
import "./frame.css";

export const Frame = createReactBlockSpec(
  {
    type: "frame",
    propSchema: {
      hint: { default: "" },
      caption: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { hint, caption } = props.block.props;
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
      const [childCount, setChildCount] = useState(0);

      useEffect(() => {
        const updateChildren = () => {
          const block = { id: props.block.id, type: props.block.type };
          const children = getGroupChildren(editor, block);
          setChildCount(children.length);
        };

        updateChildren();

        const unsubscribe = editor.onChange(() => {
          updateChildren();
        });

        return () => {
          unsubscribe();
        };
      }, [editor, props.block]);

      const addContent = useCallback(() => {
        const block = { id: props.block.id, type: props.block.type };
        const children = getGroupChildren(editor, block);

        const document = editor.document;
        const lastChild = children[children.length - 1];
        const insertAfterBlock = lastChild
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? document.find((b: any) => b.id === lastChild.id) || props.block
          : props.block;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).insertBlocks(
          [{ type: "frameContent" as const }],
          insertAfterBlock,
          "after"
        );
      }, [editor, props.block]);

      const hasChildren = childCount > 0;

      return (
        <div
          className="bn-frame-container"
          data-has-children={hasChildren ? "true" : "false"}
          data-container-id={props.block.id}
        >
          <div className="bn-frame-hint-area">
            <span className="bn-frame-hint-icon">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <input
              className="bn-frame-hint-input"
              value={hint}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { hint: e.target.value },
                });
              }}
              placeholder={t("frameHintPlaceholder")}
            />
          </div>
          <div className="bn-frame-header">
            <span className="bn-frame-label">{t("frameContainer")}</span>
            <button
              type="button"
              className="bn-frame-add-button"
              onClick={addContent}
            >
              {t("addFrameContent")}
            </button>
          </div>
          {!hasChildren && (
            <p className="bn-frame-empty-hint">
              {t("frameHint")}
            </p>
          )}
          {!hasChildren && caption && (
            <div className="bn-frame-caption-area">
              <input
                className="bn-frame-caption-input"
                value={caption}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { caption: e.target.value },
                  });
                }}
                placeholder={t("frameCaptionPlaceholder")}
              />
            </div>
          )}
        </div>
      );
    },
  }
);

export const FrameContent = createReactBlockSpec(
  {
    type: "frameContent",
    propSchema: {},
    content: "inline",
  },
  {
    render: (props) => {
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
      const [groupInfo, setGroupInfo] = useState<{
        isFirst: boolean;
        isLast: boolean;
        index: number;
        total: number;
        containerId: string;
        containerHint: string;
        containerCaption: string;
      } | null>(null);

      useEffect(() => {
        const updatePosition = () => {
          const block = { id: props.block.id, type: props.block.type };
          const position = getGroupPosition(editor, block);
          if (position) {
            const container = findContainerBefore(editor, block, "frame");
            setGroupInfo({
              ...position,
              containerId: container?.id || "",
              containerHint: (container?.props?.hint as string) || "",
              containerCaption: (container?.props?.caption as string) || "",
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
      const isLast = groupInfo?.isLast ?? false;
      const caption = groupInfo?.containerCaption ?? "";

      const updateCaption = useCallback(
        (newCaption: string) => {
          if (!groupInfo) return;
          const container = findContainerBefore(
            editor,
            { id: props.block.id, type: props.block.type },
            "frame"
          );
          if (container) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).updateBlock(container, {
              props: { caption: newCaption },
            });
          }
        },
        [editor, props.block, groupInfo]
      );

      return (
        <div
          className="bn-frame-content-block"
          data-in-group={isInGroup ? "true" : "false"}
          data-is-first={groupInfo?.isFirst ? "true" : "false"}
          data-is-last={isLast ? "true" : "false"}
        >
          <div className="bn-frame-content" ref={props.contentRef} />
          {isLast && (
            <div className="bn-frame-caption-area">
              <input
                className="bn-frame-caption-input"
                value={caption}
                onChange={(e) => updateCaption(e.target.value)}
                placeholder={t("frameCaptionPlaceholder")}
              />
            </div>
          )}
        </div>
      );
    },
  }
);
