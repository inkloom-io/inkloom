"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState, useCallback } from "react";
import { FolderOpen, Folder } from "lucide-react";
import "./expandable.css";

export const Expandable = createReactBlockSpec(
  {
    type: "expandable",
    propSchema: {
      title: { default: "Details" },
      type: { default: "" },
      defaultOpen: { default: "false" },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { title, type, defaultOpen } = props.block.props;
      const [isExpanded, setIsExpanded] = useState(defaultOpen === "true");

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
          className="bn-expandable"
          data-expanded={isExpanded ? "true" : "false"}
        >
          <div className="bn-expandable-header">
            <button
              type="button"
              className="bn-expandable-toggle"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
            >
              <span className="bn-expandable-chevron">
                {isExpanded ? "\u25BC" : "\u25B6"}
              </span>
            </button>
            <input
              className="bn-expandable-title"
              value={title}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { title: e.target.value },
                });
              }}
              placeholder="Expandable title"
            />
            <input
              className="bn-expandable-type"
              value={type}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { type: e.target.value },
                });
              }}
              placeholder="type"
            />
            <button
              type="button"
              className="bn-expandable-default-open-toggle"
              onClick={toggleDefaultOpen}
              title={defaultOpen === "true" ? "Defaults to open" : "Defaults to closed"}
            >
              {defaultOpen === "true" ? <FolderOpen size={14} /> : <Folder size={14} />}
            </button>
          </div>
          <div className="bn-expandable-content-wrapper">
            <div className="bn-expandable-content" ref={props.contentRef} />
          </div>
        </div>
      );
    },
  }
);
