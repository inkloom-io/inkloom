"use client";

import { createReactInlineContentSpec, useBlockNoteEditor } from "@blocknote/react";
import { IconPicker, IconDisplay } from "../icon-picker";

import "./icon.css";

function InlineIconRenderer(props: any) {
  const { icon, size } = props.inlineContent.props;
  const sizeNum = size ? parseInt(size, 10) : 16;
  const editor = useBlockNoteEditor();

  const style: React.CSSProperties = {
    width: `${sizeNum}px`,
    height: `${sizeNum}px`,
    cursor: "pointer",
  };

  const handleIconChange = (newIcon: string | null) => {
    if (!newIcon) return;
    const tiptap = (editor as any)._tiptapEditor;
    if (!tiptap) return;

    const { state } = tiptap;
    const { doc } = state;
    let targetPos: number | null = null;

    // Walk the document to find the icon node matching this instance.
    doc.descendants((node: any, pos: number) => {
      if (node.type.name === "icon" && node.attrs.icon === icon && targetPos === null) {
        targetPos = pos;
      }
      return targetPos === null;
    });

    if (targetPos !== null) {
      const nodeAtPos = doc.nodeAt(targetPos);
      if (nodeAtPos) {
        const tr = state.tr.setNodeMarkup(targetPos, undefined, {
          ...nodeAtPos.attrs,
          icon: newIcon,
        });
        tiptap.view.dispatch(tr);
      }
    }
  };

  const trigger = (
    <span
      className="bn-inline-icon"
      style={style}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => e.preventDefault()}
    >
      <IconDisplay icon={icon} className="bn-inline-icon-svg" />
    </span>
  );

  return (
    <IconPicker value={icon} onChange={handleIconChange} trigger={trigger} />
  );
}

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
      return <InlineIconRenderer {...props} />;
    },
  }
);
