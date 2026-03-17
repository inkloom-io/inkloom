"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import "./iframe.css";

export const IFrame = createReactBlockSpec(
  {
    type: "iframe",
    propSchema: {
      src: { default: "" },
      title: { default: "" },
      width: { default: "" },
      height: { default: "" },
      allowFullScreen: { default: "false" as const, values: ["true", "false"] as const },
      allow: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { src, title, width, height, allowFullScreen } =
        props.block.props;
      const t = useTranslations("editor.blocks");

      const updateProp = (key: string, value: string) => {
        props.editor.updateBlock(props.block, {
          props: { [key]: value },
        });
      };

      return (
        <div className="bn-iframe-block">
          <div className="bn-iframe-url-row">
            <input
              className="bn-iframe-url-input"
              type="url"
              value={src}
              onChange={(e) => updateProp("src", e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("iframeSrcPlaceholder")}
            />
          </div>
          <div className="bn-iframe-options-row">
            <input
              className="bn-iframe-text-input"
              type="text"
              value={title}
              onChange={(e) => updateProp("title", e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("iframeTitlePlaceholder")}
            />
            <div className="bn-iframe-dimensions">
              <input
                className="bn-iframe-dim-input"
                type="text"
                value={width}
                onChange={(e) => updateProp("width", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t("iframeWidthPlaceholder")}
              />
              <span className="bn-iframe-dim-separator">&times;</span>
              <input
                className="bn-iframe-dim-input"
                type="text"
                value={height}
                onChange={(e) => updateProp("height", e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t("iframeHeightPlaceholder")}
              />
            </div>
            <label className="bn-iframe-toggle">
              <input
                type="checkbox"
                checked={allowFullScreen === "true"}
                onChange={() =>
                  updateProp(
                    "allowFullScreen",
                    allowFullScreen === "true" ? "false" : "true"
                  )
                }
              />
              <span>{t("iframeAllowFullScreen")}</span>
            </label>
          </div>
        </div>
      );
    },
  }
);
