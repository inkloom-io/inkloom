"use client";

import { useTranslations } from "next-intl";
import { Label } from "@inkloom/ui/label";
import { Textarea } from "@inkloom/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface CustomCssEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_SIZE = 50 * 1024; // 50KB

export function CustomCssEditor({ value, onChange }: CustomCssEditorProps) {
  const t = useTranslations("settings");
  const charCount = value.length;
  const isOverLimit = charCount > MAX_SIZE;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">{t("customCss.title")}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("customCss.description")}
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          {t("customCss.warning")}
        </p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`:root {
  /* Override theme variables */
  --font-sans: 'Your Font', sans-serif;
}

.site-header {
  /* Custom header styles */
}`}
        rows={12}
        className="font-mono text-sm"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("customCss.variablesHint")}
        </p>
        <p className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {(charCount / 1024).toFixed(1)}KB / 50KB
        </p>
      </div>
    </div>
  );
}
