"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SeoSettingsProps {
  ogTitle: string;
  ogDescription: string;
  twitterCard: "summary" | "summary_large_image";
  robotsTxtCustom: string;
  onOgTitleChange: (value: string) => void;
  onOgDescriptionChange: (value: string) => void;
  onTwitterCardChange: (value: "summary" | "summary_large_image") => void;
  onRobotsTxtCustomChange: (value: string) => void;
  projectName?: string;
  primaryColor?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function OgImagePreview({
  projectName,
  title,
  primaryColor,
}: {
  projectName: string;
  title: string;
  primaryColor: string;
}) {
  const { r, g, b } = hexToRgb(primaryColor);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: "#0c0c0c",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "white",
      }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, rgba(${r}, ${g}, ${b}, 0.14) 0%, rgba(0,0,0,0) 60%)`,
        }}
      />

      {/* Glow orb top right */}
      <div
        className="absolute"
        style={{
          top: "-30px",
          right: "-15px",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.18) 0%, rgba(${r}, ${g}, ${b}, 0) 70%)`,
        }}
      />

      {/* Accent bar */}
      <div
        className="absolute top-0"
        style={{
          left: "16px",
          width: "16px",
          height: "1.5px",
          background: primaryColor,
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-3">
        {/* Top: project name */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[6px] font-medium"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            {projectName}
          </span>
        </div>

        {/* Center title */}
        <div className="flex-1 flex items-center">
          <div
            className="font-bold leading-tight"
            style={{ fontSize: "12px", letterSpacing: "-0.2px" }}
          >
            {title}
          </div>
        </div>

        {/* Bottom: dots + branding */}
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            <div
              className="rounded-full"
              style={{ width: 2, height: 2, background: primaryColor }}
            />
            <div
              className="rounded-full"
              style={{
                width: 2,
                height: 2,
                background: `rgba(${r}, ${g}, ${b}, 0.4)`,
              }}
            />
            <div
              className="rounded-full"
              style={{
                width: 2,
                height: 2,
                background: `rgba(${r}, ${g}, ${b}, 0.15)`,
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <div
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                background: "linear-gradient(135deg, #14b8a6, #0d9488)",
              }}
            />
            <span
              className="text-[5px]"
              style={{ color: "rgba(255, 255, 255, 0.45)" }}
            >
              Built with{" "}
              <span style={{ color: "#14b8a6", fontWeight: 600 }}>
                InkLoom
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SeoSettings({
  ogTitle,
  ogDescription,
  twitterCard,
  robotsTxtCustom,
  onOgTitleChange,
  onOgDescriptionChange,
  onTwitterCardChange,
  onRobotsTxtCustomChange,
  projectName,
  primaryColor = "#6366f1",
}: SeoSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Open Graph Defaults</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure default Open Graph metadata for social sharing.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="ogTitle" className="text-xs">OG Title</Label>
            <Input
              id="ogTitle"
              value={ogTitle}
              onChange={(e) => onOgTitleChange(e.target.value)}
              placeholder="My Documentation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogDescription" className="text-xs">OG Description</Label>
            <Textarea
              id="ogDescription"
              value={ogDescription}
              onChange={(e) => onOgDescriptionChange(e.target.value)}
              placeholder="Documentation for my project"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Twitter Card Style</Label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="twitterCard"
                  checked={twitterCard === "summary_large_image"}
                  onChange={() => onTwitterCardChange("summary_large_image")}
                  className="accent-primary"
                />
                Large Image
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="twitterCard"
                  checked={twitterCard === "summary"}
                  onChange={() => onTwitterCardChange("summary")}
                  className="accent-primary"
                />
                Summary
              </label>
            </div>
          </div>
        </div>

        {/* Social preview mockup */}
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-2">Social Preview</p>
          <div className="rounded-lg border overflow-hidden max-w-sm">
            <div style={{ aspectRatio: "1200/630" }} className="relative bg-muted">
              {projectName ? (
                <div className="absolute inset-0">
                  <OgImagePreview
                    projectName={projectName}
                    title={
                      ogTitle ||
                      (/documentation/i.test(projectName)
                        ? projectName
                        : `${projectName} Documentation`)
                    }
                    primaryColor={primaryColor}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  Auto-generated OG image
                </div>
              )}
            </div>
            <div className="p-3 space-y-1">
              <p className="text-sm font-semibold truncate">
                {ogTitle || "My Documentation"}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {ogDescription || "Documentation for my project"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Custom robots.txt</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Add additional rules to the auto-generated robots.txt file.
          </p>
        </div>
        <Textarea
          value={robotsTxtCustom}
          onChange={(e) => onRobotsTxtCustomChange(e.target.value)}
          placeholder="# Additional robots.txt rules
Disallow: /internal/"
          rows={4}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
