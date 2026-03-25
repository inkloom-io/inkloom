"use client";

import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { useEffect, useState, useCallback } from "react";
import { getGroupChildren, getGroupPosition, findContainerBefore } from "./group-utils";
import "./columns.css";

export const Column = createReactBlockSpec(
  {
    type: "column",
    propSchema: {},
    content: "inline",
  },
  {
    render: (props) => {
      const editor = useBlockNoteEditor();
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
          const block = { id: props.block.id, type: props.block.type };
          const position = getGroupPosition(editor, block);
          if (position) {
            const container = findContainerBefore(editor, block, "columns");
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
          className="bn-column"
          data-in-group={isInGroup ? "true" : "false"}
          data-group-first={groupPosition?.isFirst ? "true" : "false"}
          data-group-last={groupPosition?.isLast ? "true" : "false"}
          data-group-cols={groupPosition?.cols || "2"}
        >
          <div className="bn-column-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);

export const Columns = createReactBlockSpec(
  {
    type: "columns",
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

      const addColumn = useCallback(() => {
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
          [{ type: "column" as const }],
          insertAfterBlock,
          "after"
        );
      }, [editor, props.block]);

      const hasChildren = childCount > 0;

      return (
        <div
          className="bn-columns"
          data-cols={cols}
          data-has-children={hasChildren ? "true" : "false"}
        >
          <div className="bn-columns-header">
            <span className="bn-columns-label">
              Columns {hasChildren ? `(${childCount} ${childCount === 1 ? "column" : "columns"})` : ""}
            </span>
            <div className="bn-columns-controls">
              <select
                className="bn-columns-cols-select"
                value={cols}
                onChange={(e) => {
                  props.editor.updateBlock(props.block, {
                    props: { cols: e.target.value as "2" | "3" | "4" },
                  });
                }}
              >
                <option value="2">2 columns</option>
                <option value="3">3 columns</option>
                <option value="4">4 columns</option>
              </select>
              <button
                type="button"
                className="bn-columns-add-button"
                onClick={addColumn}
              >
                Add column
              </button>
            </div>
          </div>
          {!hasChildren && (
            <p className="bn-columns-hint">
              Add columns to create a multi-column layout.
            </p>
          )}
        </div>
      );
    },
  }
);
