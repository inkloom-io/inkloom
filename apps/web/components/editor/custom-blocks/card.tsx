"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
import { IconPicker, IconDisplay } from "../icon-picker";
import "./card.css";

export const Card = createReactBlockSpec(
  {
    type: "card",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      title: {
        default: "Card Title",
      },
      icon: {
        default: "",
      },
      href: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { title, icon, href } = props.block.props;
      const editor = useBlockNoteEditor();
      const t = useTranslations("editor.blocks");
      const [groupPosition, setGroupPosition] = useState<{
        isFirst: boolean;
        isLast: boolean;
        index: number;
        total: number;
        containerId: string;
        cols: string;
      } | null>(null);

      useEffect(() => {
        const updatePosition = () => {
          // Cast block to our generic type for the utility function
          const block = { id: props.block.id, type: props.block.type };
          const position = getGroupPosition(editor, block);
          if (position) {
            // Find the container to get its cols prop
            const container = findContainerBefore(editor, block, "cardGroup");
            setGroupPosition({
              ...position,
              containerId: container?.id || "",
              cols: (container?.props?.cols as string) || "2",
            });
          } else {
            setGroupPosition(null);
          }
        };

        updatePosition();

        // Subscribe to document changes
        const unsubscribe = editor.onChange(() => {
          updatePosition();
        });

        return () => {
          unsubscribe();
        };
      }, [editor, props.block]);

      const isInGroup = groupPosition !== null;

      return (
        <div
          className="bn-card"
          data-has-href={href ? "true" : "false"}
          data-in-group={isInGroup ? "true" : "false"}
          data-group-first={groupPosition?.isFirst ? "true" : "false"}
          data-group-last={groupPosition?.isLast ? "true" : "false"}
          data-group-cols={groupPosition?.cols || "2"}
        >
          <div className="bn-card-main">
            <div className="bn-card-header">
              {icon && <IconDisplay icon={icon} className="bn-card-icon" />}
              <input
                className="bn-card-title-input"
                value={title}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { title: e.target.value },
                  });
                }}
                placeholder={t("cardTitlePlaceholder")}
              />
            </div>
            <div className="bn-card-content" ref={props.contentRef} />
            {href && <span className="bn-card-arrow">→</span>}
          </div>
          <div className="bn-card-props">
            <div className="bn-card-prop">
              <span>{t("cardIconLabel")}</span>
              <IconPicker
                value={icon || undefined}
                onChange={(newIcon) => {
                  props.editor.updateBlock(props.block, {
                    props: { icon: newIcon || "" },
                  });
                }}
              />
            </div>
            <label className="bn-card-prop">
              <span>{t("cardLinkLabel")}</span>
              <input
                type="text"
                value={href}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { href: e.target.value },
                  });
                }}
                placeholder={t("cardLinkPlaceholder")}
              />
            </label>
          </div>
        </div>
      );
    },
  }
);

export const CardGroup = createReactBlockSpec(
  {
    type: "cardGroup",
    propSchema: {
      cols: {
        default: "2",
        values: ["2", "3", "4"],
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { cols } = props.block.props;
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

      const addCard = useCallback(() => {
        const block = { id: props.block.id, type: props.block.type };
        const children = getGroupChildren(editor, block);

        // Find the actual block to insert after
        const document = editor.document;
        const lastChild = children[children.length - 1];
        const insertAfterBlock = lastChild
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? document.find((b: any) => b.id === lastChild.id) || props.block
          : props.block;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).insertBlocks(
          [{ type: "card", props: { title: t("newCard") } }],
          insertAfterBlock,
          "after"
        );
      }, [editor, props.block]);

      const hasChildren = childCount > 0;

      return (
        <div
          className="bn-card-group"
          data-cols={cols}
          data-has-children={hasChildren ? "true" : "false"}
        >
          <div className="bn-card-group-header">
            <span className="bn-card-group-label">
              {t("cardGroupContainer")} {hasChildren ? `(${t("cardCount", { count: childCount })})` : ""}
            </span>
            <div className="bn-card-group-controls">
              <select
                className="bn-card-group-cols-select"
                value={cols}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { cols: e.target.value as "2" | "3" | "4" },
                  });
                }}
              >
                <option value="2">{t("columns", { count: 2 })}</option>
                <option value="3">{t("columns", { count: 3 })}</option>
                <option value="4">{t("columns", { count: 4 })}</option>
              </select>
              <button
                type="button"
                className="bn-card-group-add-button"
                onClick={addCard}
              >
                {t("addCard")}
              </button>
            </div>
          </div>
          {!hasChildren && (
            <p className="bn-card-group-hint">
              {t("cardGroupHint")}
            </p>
          )}
        </div>
      );
    },
  }
);
