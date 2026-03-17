"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useTranslations } from "next-intl";
import "./video.css";

export const Video = createReactBlockSpec(
  {
    type: "video",
    propSchema: {
      src: { default: "" },
      autoPlay: { default: "false" as const, values: ["true", "false"] as const },
      muted: { default: "false" as const, values: ["true", "false"] as const },
      loop: { default: "false" as const, values: ["true", "false"] as const },
      playsInline: { default: "false" as const, values: ["true", "false"] as const },
      controls: { default: "true" as const, values: ["true", "false"] as const },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { src, autoPlay, muted, loop, playsInline, controls } =
        props.block.props;
      const t = useTranslations("editor.blocks");

      const updateProp = (key: string, value: string) => {
        props.editor.updateBlock(props.block, {
          props: { [key]: value },
        });
      };

      const toggleProp = (key: string, current: string) => {
        updateProp(key, current === "true" ? "false" : "true");
      };

      return (
        <div className="bn-video-block">
          <div className="bn-video-url-row">
            <input
              className="bn-video-url-input"
              type="url"
              value={src}
              onChange={(e) => updateProp("src", e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("videoSrcPlaceholder")}
            />
          </div>
          <div className="bn-video-options-row">
            <label className="bn-video-toggle">
              <input
                type="checkbox"
                checked={autoPlay === "true"}
                onChange={() => toggleProp("autoPlay", autoPlay)}
              />
              <span>{t("videoAutoPlay")}</span>
            </label>
            <label className="bn-video-toggle">
              <input
                type="checkbox"
                checked={muted === "true"}
                onChange={() => toggleProp("muted", muted)}
              />
              <span>{t("videoMuted")}</span>
            </label>
            <label className="bn-video-toggle">
              <input
                type="checkbox"
                checked={loop === "true"}
                onChange={() => toggleProp("loop", loop)}
              />
              <span>{t("videoLoop")}</span>
            </label>
            <label className="bn-video-toggle">
              <input
                type="checkbox"
                checked={playsInline === "true"}
                onChange={() => toggleProp("playsInline", playsInline)}
              />
              <span>{t("videoPlaysInline")}</span>
            </label>
            <label className="bn-video-toggle">
              <input
                type="checkbox"
                checked={controls === "true"}
                onChange={() => toggleProp("controls", controls)}
              />
              <span>{t("videoControls")}</span>
            </label>
          </div>
        </div>
      );
    },
  }
);
