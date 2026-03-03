"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import "./callout.css";

type CalloutType = "info" | "warning" | "danger" | "success" | "tip";

const icons: Record<CalloutType, string> = {
  info: "ℹ️",
  warning: "⚠️",
  danger: "🚫",
  success: "✅",
  tip: "💡",
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
      const t = useTranslations("editor.blocks");
      const calloutType = (type || "info") as CalloutType;

      return (
        <div className={`bn-callout bn-callout-${calloutType}`}>
          <div className="bn-callout-header">
            <span className="bn-callout-icon">{icons[calloutType]}</span>
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
                  {t(`calloutType.${typeKey}`)}
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
              placeholder={t("calloutTitlePlaceholder")}
            />
          </div>
          <div className="bn-callout-content" ref={props.contentRef} />
        </div>
      );
    },
  }
);
