"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import { IconDisplay } from "../icon-picker";

import "./icon.css";

export const InlineIcon = createReactInlineContentSpec(
  {
    type: "icon" as const,
    propSchema: {
      icon: {
        default: "",
      },
      size: {
        default: "",
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { icon, size } = props.inlineContent.props;
      const sizeNum = size ? parseInt(size, 10) : 16;
      const style: React.CSSProperties = {
        width: `${sizeNum}px`,
        height: `${sizeNum}px`,
      };
      return (
        <span className="bn-inline-icon" style={style}>
          <IconDisplay icon={icon} className="bn-inline-icon-svg" />
        </span>
      );
    },
  }
);
