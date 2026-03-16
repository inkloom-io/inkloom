"use client";

import { useTranslations } from "next-intl";
import { Label } from "@inkloom/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inkloom/ui/select";

const CURATED_FONTS = [
  "Inter",
  "DM Sans",
  "Geist",
  "IBM Plex Sans",
  "Lato",
  "Manrope",
  "Montserrat",
  "Nunito",
  "Open Sans",
  "Outfit",
  "Plus Jakarta Sans",
  "Poppins",
  "Raleway",
  "Roboto",
  "Source Sans 3",
  "Work Sans",
  // Display / Heading
  "Bricolage Grotesque",
  "Cabinet Grotesk",
  "Cal Sans",
  "Fraunces",
  "General Sans",
  "Instrument Serif",
  "Playfair Display",
  "Space Grotesk",
  "Syne",
  // Monospace
  "Fira Code",
  "Geist Mono",
  "IBM Plex Mono",
  "JetBrains Mono",
  "Source Code Pro",
  "Ubuntu Mono",
] as const;

const MONO_FONTS = [
  "Fira Code",
  "Geist Mono",
  "IBM Plex Mono",
  "JetBrains Mono",
  "Source Code Pro",
  "Ubuntu Mono",
] as const;

interface FontSelectorProps {
  fonts: {
    heading?: string;
    body?: string;
    code?: string;
  };
  onChange: (fonts: { heading?: string; body?: string; code?: string }) => void;
}

export function FontSelector({ fonts, onChange }: FontSelectorProps) {
  const t = useTranslations("settings");
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{t("fontSelector.title")}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("fontSelector.description")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{t("fontSelector.headingFont")}</Label>
          <Select
            value={fonts.heading || "__default__"}
            onValueChange={(v) =>
              onChange({ ...fonts, heading: v === "__default__" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Quicksand (Default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Quicksand (Default)</SelectItem>
              {CURATED_FONTS.map((font: any) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("fontSelector.bodyFont")}</Label>
          <Select
            value={fonts.body || "__default__"}
            onValueChange={(v) =>
              onChange({ ...fonts, body: v === "__default__" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Quicksand (Default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Quicksand (Default)</SelectItem>
              {CURATED_FONTS.map((font: any) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t("fontSelector.codeFont")}</Label>
        <Select
          value={fonts.code || "__default__"}
          onValueChange={(v) =>
            onChange({ ...fonts, code: v === "__default__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-1/2">
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">{t("fontSelector.defaultSystemMono")}</SelectItem>
            {MONO_FONTS.map((font: any) => (
              <SelectItem key={font} value={font}>
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(fonts.heading || fonts.body || fonts.code) && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">{t("fontSelector.preview")}</p>
          {fonts.heading && (
            <p className="text-lg font-bold" style={{ fontFamily: `'${fonts.heading}', sans-serif` }}>
              {fonts.heading} Heading
            </p>
          )}
          {fonts.body && (
            <p className="text-sm" style={{ fontFamily: `'${fonts.body}', sans-serif` }}>
              {fonts.body} body text — The quick brown fox jumps over the lazy dog.
            </p>
          )}
          {fonts.code && (
            <p className="text-sm" style={{ fontFamily: `'${fonts.code}', monospace` }}>
              <code>const hello = &quot;{fonts.code}&quot;;</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
