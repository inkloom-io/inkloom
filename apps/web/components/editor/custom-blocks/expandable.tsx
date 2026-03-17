"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState, useCallback } from "react";
import "./expandable.css";

export const Expandable = createReactBlockSpec(
  {
    type: "expandable",
    propSchema: {
      title: { default: "Details" },
      type: { default: "" },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { title, type } = props.block.props;
      const [isExpanded, setIsExpanded] = useState(false);

      const toggleExpanded = useCallback(() => {
        setIsExpanded((prev) => !prev);
      }, []);

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
          </div>
          <div className="bn-expandable-content-wrapper">
            <div className="bn-expandable-content" ref={props.contentRef} />
          </div>
        </div>
      );
    },
  }
);
