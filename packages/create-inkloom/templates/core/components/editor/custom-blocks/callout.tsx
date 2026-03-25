"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
} from "lucide-react";
import "./callout.css";

type CalloutType = "info" | "warning" | "danger" | "success" | "tip";

const icons: Record<CalloutType, React.ReactNode> = {
  info: <Info className="bn-callout-icon" />,
  warning: <AlertTriangle className="bn-callout-icon" />,
  danger: <AlertCircle className="bn-callout-icon" />,
  success: <CheckCircle className="bn-callout-icon" />,
  tip: <Lightbulb className="bn-callout-icon" />,
};

const TYPE_LABELS: Record<CalloutType, string> = {
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  success: "Success",
  tip: "Tip",
};

const TYPE_KEYS: CalloutType[] = ["info", "warning", "danger", "success", "tip"];

export const Callout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      type: {
        default: "info" as CalloutType,
        values: ["info", "warning", "danger", "success", "tip"] as CalloutType[],
      },
      title: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const { type, title } = props.block.props;
      const calloutType = (type || "info") as CalloutType;

      return (
        <div className={`bn-callout bn-callout-${calloutType}`} data-callout-type={calloutType}>
          <div className="bn-callout-header">
            {icons[calloutType]}
            <select
              className="bn-callout-type-select"
              value={calloutType}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { type: e.target.value as CalloutType },
                });
              }}
            >
              {TYPE_KEYS.map((typeKey: CalloutType) => (
                <option key={typeKey} value={typeKey}>
                  {TYPE_LABELS[typeKey]}
                </option>
              ))}
            </select>
            <input
              className="bn-callout-title-input"
              value={title}
              onChange={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { title: e.target.value },
                });
              }}
              placeholder="Title (optional)"
            />
          </div>
          <div className="bn-callout-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);
