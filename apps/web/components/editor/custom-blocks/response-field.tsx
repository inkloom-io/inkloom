"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useCallback } from "react";
import "./response-field.css";

export const ResponseField = createReactBlockSpec(
  {
    type: "responseField",
    propSchema: {
      name: { default: "" },
      type: { default: "" },
      required: { default: "false" },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { name, type, required } = props.block.props;

      const toggleRequired = useCallback(() => {
        const newValue = required === "true" ? "false" : "true";
        props.editor.updateBlock(props.block, {
          props: { required: newValue },
        });
      }, [props.editor, props.block, required]);

      return (
        <div className="bn-response-field">
          <div className="bn-response-field-header">
            <input
              className="bn-response-field-name"
              value={name}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { name: e.target.value },
                });
              }}
              placeholder="field_name"
            />
            <input
              className="bn-response-field-type"
              value={type}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { type: e.target.value },
                });
              }}
              placeholder="string"
            />
            <button
              type="button"
              className={`bn-response-field-required ${required === "true" ? "bn-response-field-required-active" : ""}`}
              onClick={toggleRequired}
              title={required === "true" ? "Mark as optional" : "Mark as required"}
            >
              required
            </button>
          </div>
          <div className="bn-response-field-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);
