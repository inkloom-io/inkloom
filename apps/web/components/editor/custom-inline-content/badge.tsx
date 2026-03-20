"use client";

import { createReactInlineContentSpec } from "@blocknote/react";

import "./badge.css";

export const Badge = createReactInlineContentSpec(
  {
    type: "badge" as const,
    propSchema: {
      color: {
        default: "",
      },
    },
    content: "styled",
  },
  {
    render: (props) => {
      const { color } = props.inlineContent.props;
      const style: React.CSSProperties = {};
      if (color) {
        style.color = color;
        style.backgroundColor = `${color}18`;
        style.borderColor = `${color}30`;
      }
      return (
        <span className="bn-inline-badge" style={style} ref={props.contentRef} />
      );
    },
  }
);
