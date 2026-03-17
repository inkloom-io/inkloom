"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useRef, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import "./latex.css";

const MIN_HEIGHT = 60;

export const Latex = createReactBlockSpec(
  {
    type: "latex",
    propSchema: {
      expression: {
        default: "",
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const t = useTranslations("editor.blocks");
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          props.editor.updateBlock(props.block, {
            props: { expression: e.target.value },
          });
        },
        [props.editor, props.block]
      );

      // Auto-resize textarea to fit content
      useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "0px";
        const scrollH = Math.max(MIN_HEIGHT, textarea.scrollHeight);
        textarea.style.height = `${scrollH}px`;
      }, [props.block.props.expression]);

      return (
        <div className="bn-latex" contentEditable={false}>
          <div className="bn-latex-label">LaTeX</div>
          <textarea
            ref={textareaRef}
            className="bn-latex-textarea"
            value={props.block.props.expression}
            onChange={handleChange}
            placeholder={t("latexPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
          />
        </div>
      );
    },
  }
);
