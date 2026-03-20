"use client";

import { createReactStyleSpec } from "@blocknote/react";

export const BadgeStyle = createReactStyleSpec(
  {
    type: "badge" as const,
    propSchema: "string",
  },
  {
    render: (props) => {
      const color = props.value || "#6b7280";
      const style: React.CSSProperties = {
        color,
        backgroundColor: `${color}20`,
        borderColor: `${color}40`,
        borderWidth: "1px",
        borderStyle: "solid",
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "0.85em",
        fontWeight: 500,
        lineHeight: "1.25em",
        whiteSpace: "nowrap",
      };
      return <span style={style} ref={props.contentRef} />;
    },
  }
);
