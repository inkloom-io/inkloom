"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { hslToHex, hexToHsl, isValidHex } from "@/lib/theme-presets";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const t = useTranslations("settings");
  const [hexValue, setHexValue] = useState(() => hslToHex(value));

  useEffect(() => {
    setHexValue(hslToHex(value));
  }, [value]);

  const handleHexChange = (hex: string) => {
    setHexValue(hex);
    if (isValidHex(hex)) {
      const normalizedHex = hex.startsWith("#") ? hex : `#${hex}`;
      onChange(hexToHsl(normalizedHex));
    }
  };

  const handleColorInputChange = (hex: string) => {
    setHexValue(hex);
    onChange(hexToHsl(hex));
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={hexValue}
            onChange={(e) => handleColorInputChange(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
        </div>
        <Input
          value={hexValue}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#000000"
          className="w-28 font-mono"
        />
        <div
          className="h-10 flex-1 rounded-md border"
          style={{ backgroundColor: hexValue }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("colorPicker.hsl")}: {value}
      </p>
    </div>
  );
}
