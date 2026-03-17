"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import "./image.css";

export const CustomImage = createReactBlockSpec(
  {
    type: "image" as const,
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      name: {
        default: "" as const,
      },
      url: {
        default: "" as const,
      },
      caption: {
        default: "" as const,
      },
      showPreview: {
        default: true,
      },
      previewWidth: {
        default: undefined as undefined | number,
        type: "number" as const,
      },
      alt: {
        default: "" as const,
      },
    },
    content: "none" as const,
  },
  {
    meta: {
      fileBlockAccept: ["image/*"],
    },
    render: (props) => {
      const { url, alt, caption, name, previewWidth } = props.block.props;
      const t = useTranslations("editor.blocks");
      const [isEditingAlt, setIsEditingAlt] = useState(false);
      const altInputRef = useRef<HTMLInputElement>(null);

      // Focus the alt input when entering edit mode
      useEffect(() => {
        if (isEditingAlt && altInputRef.current) {
          altInputRef.current.focus();
        }
      }, [isEditingAlt]);

      const handleAltChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          props.editor.updateBlock(props.block, {
            props: { alt: e.target.value },
          });
        },
        [props.editor, props.block],
      );

      const handleAltKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            setIsEditingAlt(false);
          }
          // Prevent BlockNote from handling these keys when typing alt text
          e.stopPropagation();
        },
        [],
      );

      if (!url) {
        return (
          <div className="bn-image-block bn-image-block-empty">
            <p>{t("addImage")}</p>
          </div>
        );
      }

      return (
        <div className="bn-image-block">
          <div className="bn-image-wrapper">
            <img
              src={url}
              alt={alt || name || caption || "Image"}
              className="bn-image"
              style={
                previewWidth
                  ? { width: `${previewWidth}px`, maxWidth: "100%" }
                  : undefined
              }
              draggable={false}
            />
          </div>
          <div className="bn-image-alt-row">
            <button
              className="bn-image-alt-badge"
              onClick={() => setIsEditingAlt(!isEditingAlt)}
              contentEditable={false}
              type="button"
            >
              {alt ? t("imageAltSet") : t("imageAltAdd")}
            </button>
            {isEditingAlt && (
              <input
                ref={altInputRef}
                className="bn-image-alt-input"
                value={alt}
                onChange={handleAltChange}
                onKeyDown={handleAltKeyDown}
                onBlur={() => setIsEditingAlt(false)}
                placeholder={t("imageAltPlaceholder")}
                contentEditable={false}
              />
            )}
          </div>
        </div>
      );
    },
  },
);
