"use client";

import { useTranslations } from "next-intl";
import { useComponentsContext } from "@blocknote/react";
import { MessageSquarePlus } from "lucide-react";

interface CommentToolbarButtonProps {
  onAddComment: () => void;
}

export function CommentToolbarButton({ onAddComment }: CommentToolbarButtonProps) {
  const Components = useComponentsContext();
  const t = useTranslations("editor.blockEditor");

  if (!Components) return null;

  return (
    <Components.FormattingToolbar.Button
      label={t("addComment")}
      mainTooltip={t("addComment")}
      icon={<MessageSquarePlus size={16} />}
      onClick={() => onAddComment()}
    />
  );
}
