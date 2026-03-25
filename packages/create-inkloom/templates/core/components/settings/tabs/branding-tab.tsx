"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Globe,
  Moon,
  Palette,
  RotateCcw,
  Sun,
} from "lucide-react";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { ColorPicker } from "@/components/settings/color-picker";
import { FontSelector } from "@/components/settings/font-selector";
import { CustomCssEditor } from "@/components/settings/custom-css-editor";
import { THEME_PRESETS, type ThemePreset } from "@/lib/theme-presets";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";

type SocialPlatform = "github" | "x" | "discord";

interface BrandingTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function BrandingTab({ projectId, project }: BrandingTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);

  // Preview mode toggle
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("dark");

  // Theme & colors
  const [theme, setTheme] = useState<ThemePreset>("default");
  const [primaryColor, setPrimaryColor] = useState(THEME_PRESETS.default.primaryColor);
  const [brandingInitialized, setBrandingInitialized] = useState(false);
  const colorOverridesRef = useRef<Partial<Record<ThemePreset, string>>>({});
  const [backgroundColorLight, setBackgroundColorLight] = useState(THEME_PRESETS.default.colors.light.background);
  const [backgroundColorDark, setBackgroundColorDark] = useState(THEME_PRESETS.default.colors.dark.background);
  const [backgroundSubtleColorLight, setBackgroundSubtleColorLight] = useState(THEME_PRESETS.default.colors.light.backgroundSubtle);
  const [backgroundSubtleColorDark, setBackgroundSubtleColorDark] = useState(THEME_PRESETS.default.colors.dark.backgroundSubtle);
  const bgOverridesRef = useRef<Partial<Record<ThemePreset, { light: string; dark: string; subtleLight: string; subtleDark: string }>>>();
  if (!bgOverridesRef.current) bgOverridesRef.current = {};

  // Custom fonts
  const [fonts, setFonts] = useState<{ heading?: string; body?: string; code?: string }>({});
  const [fontsInitialized, setFontsInitialized] = useState(false);

  // Custom CSS
  const [customCss, setCustomCss] = useState("");
  const [customCssInitialized, setCustomCssInitialized] = useState(false);

  // CTA button
  const [ctaButtonLabel, setCtaButtonLabel] = useState("");
  const [ctaButtonUrl, setCtaButtonUrl] = useState("");
  const [ctaButtonInitialized, setCtaButtonInitialized] = useState(false);

  // Social links
  const [socialLinks, setSocialLinks] = useState<Record<SocialPlatform, string>>({
    github: "",
    x: "",
    discord: "",
  });
  const [socialLinksInitialized, setSocialLinksInitialized] = useState(false);

  // Initialize branding settings
  useEffect(() => {
    if (project && !brandingInitialized) {
      if (project.settings?.theme) setTheme(project.settings.theme);
      if (project.settings?.primaryColor) setPrimaryColor(project.settings.primaryColor);
      const activeTheme = (project.settings?.theme || "default") as ThemePreset;
      const themePreset = THEME_PRESETS[activeTheme];
      setBackgroundColorLight(project.settings?.backgroundColorLight || themePreset.colors.light.background);
      setBackgroundColorDark(project.settings?.backgroundColorDark || themePreset.colors.dark.background);
      setBackgroundSubtleColorLight(project.settings?.backgroundSubtleColorLight || themePreset.colors.light.backgroundSubtle);
      setBackgroundSubtleColorDark(project.settings?.backgroundSubtleColorDark || themePreset.colors.dark.backgroundSubtle);
      setBrandingInitialized(true);
    }
  }, [project, brandingInitialized]);

  // Initialize fonts
  useEffect(() => {
    if (project && !fontsInitialized) {
      setFonts(project.settings?.fonts || {});
      setFontsInitialized(true);
    }
  }, [project, fontsInitialized]);

  // Initialize custom CSS
  useEffect(() => {
    if (project && !customCssInitialized) {
      setCustomCss(project.settings?.customCss || "");
      setCustomCssInitialized(true);
    }
  }, [project, customCssInitialized]);

  // Initialize CTA button
  useEffect(() => {
    if (project && !ctaButtonInitialized) {
      setCtaButtonLabel(project.settings?.ctaButton?.label || "");
      setCtaButtonUrl(project.settings?.ctaButton?.url || "");
      setCtaButtonInitialized(true);
    }
  }, [project, ctaButtonInitialized]);

  // Initialize social links
  useEffect(() => {
    if (project && !socialLinksInitialized) {
      const links: Record<SocialPlatform, string> = {
        github: "",
        x: "",
        discord: "",
      };
      for (const link of project.settings?.socialLinks ?? []) {
        if (link.platform in links) {
          links[link.platform as SocialPlatform] = link.url;
        }
      }
      setSocialLinks(links);
      setSocialLinksInitialized(true);
    }
  }, [project, socialLinksInitialized]);

  // Auto-save callbacks
  const saveBranding = useCallback(
    async ({
      theme,
      primaryColor,
      backgroundColorLight,
      backgroundColorDark,
      backgroundSubtleColorLight,
      backgroundSubtleColorDark,
    }: {
      theme: ThemePreset;
      primaryColor: string;
      backgroundColorLight: string;
      backgroundColorDark: string;
      backgroundSubtleColorLight: string;
      backgroundSubtleColorDark: string;
    }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          theme,
          primaryColor,
          backgroundColorLight,
          backgroundColorDark,
          backgroundSubtleColorLight,
          backgroundSubtleColorDark,
        },
      });
    },
    [updateSettings, projectId]
  );

  const saveFonts = useCallback(
    async (value: { heading?: string; body?: string; code?: string }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { fonts: value },
      });
    },
    [updateSettings, projectId]
  );

  const saveCustomCss = useCallback(
    async (value: string) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { customCss: value },
      });
    },
    [updateSettings, projectId]
  );

  const saveCtaButton = useCallback(
    async ({ label, url }: { label: string; url: string }) => {
      const ctaButton = label.trim() && url.trim()
        ? { label: label.trim(), url: url.trim() }
        : undefined;
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { ctaButton },
      });
    },
    [updateSettings, projectId]
  );

  const saveSocialLinks = useCallback(
    async (links: Record<SocialPlatform, string>) => {
      const arr = (Object.entries(links) as [SocialPlatform, string][])
        .filter(([, url]) => url.trim() !== "")
        .map(([platform, url]) => ({ platform, url: url.trim() }));
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { socialLinks: arr },
      });
    },
    [updateSettings, projectId]
  );

  // Auto-save hooks
  const brandingStatus = useAutoSave(
    { theme, primaryColor, backgroundColorLight, backgroundColorDark, backgroundSubtleColorLight, backgroundSubtleColorDark },
    saveBranding,
    500,
    brandingInitialized
  );
  const fontsStatus = useAutoSave(fonts, saveFonts, 800, fontsInitialized);
  const customCssStatus = useAutoSave(customCss, saveCustomCss, 800, customCssInitialized);
  const ctaButtonStatus = useAutoSave(
    { label: ctaButtonLabel, url: ctaButtonUrl },
    saveCtaButton,
    800,
    ctaButtonInitialized
  );
  const socialLinksStatus = useAutoSave(socialLinks, saveSocialLinks, 800, socialLinksInitialized);

  const handleThemeChange = (newTheme: ThemePreset) => {
    if (primaryColor !== THEME_PRESETS[theme].primaryColor) {
      colorOverridesRef.current[theme] = primaryColor;
    } else {
      delete colorOverridesRef.current[theme];
    }
    const currentDefaults = THEME_PRESETS[theme].colors;
    const hasBgOverride =
      backgroundColorLight !== currentDefaults.light.background ||
      backgroundColorDark !== currentDefaults.dark.background ||
      backgroundSubtleColorLight !== currentDefaults.light.backgroundSubtle ||
      backgroundSubtleColorDark !== currentDefaults.dark.backgroundSubtle;
    if (hasBgOverride && bgOverridesRef.current) {
      bgOverridesRef.current[theme] = {
        light: backgroundColorLight,
        dark: backgroundColorDark,
        subtleLight: backgroundSubtleColorLight,
        subtleDark: backgroundSubtleColorDark,
      };
    } else if (bgOverridesRef.current) {
      delete bgOverridesRef.current[theme];
    }
    setTheme(newTheme);
    if (newTheme !== "custom") {
      setPrimaryColor(colorOverridesRef.current[newTheme] || THEME_PRESETS[newTheme].primaryColor);
      const bgOverride = bgOverridesRef.current ? bgOverridesRef.current[newTheme] : undefined;
      setBackgroundColorLight(bgOverride?.light || THEME_PRESETS[newTheme].colors.light.background);
      setBackgroundColorDark(bgOverride?.dark || THEME_PRESETS[newTheme].colors.dark.background);
      setBackgroundSubtleColorLight(bgOverride?.subtleLight || THEME_PRESETS[newTheme].colors.light.backgroundSubtle);
      setBackgroundSubtleColorDark(bgOverride?.subtleDark || THEME_PRESETS[newTheme].colors.dark.backgroundSubtle);
    }
  };

  const socialPlatforms = [
    { platform: "github" as SocialPlatform, label: "GitHub", placeholder: "https://github.com/your-org" },
    { platform: "x" as SocialPlatform, label: "X / Twitter", placeholder: "https://x.com/your-handle" },
    { platform: "discord" as SocialPlatform, label: "Discord", placeholder: "https://discord.gg/your-server" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Social Links */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <div>
                <CardTitle>Social Links</CardTitle>
                <CardDescription>
                  Add social media links to your documentation site footer.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={socialLinksStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-lg">
            {socialPlatforms.map(({ platform, label, placeholder }) => (
              <div key={platform} className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">{label}</Label>
                <Input
                  value={socialLinks[platform]}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      [platform]: e.target.value,
                    }))
                  }
                  placeholder={placeholder}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              <div>
                <CardTitle>CTA Button</CardTitle>
                <CardDescription>
                  Add a call-to-action button to the site header.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={ctaButtonStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-lg">
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Label</Label>
              <Input
                value={ctaButtonLabel}
                onChange={(e) => setCtaButtonLabel(e.target.value)}
                placeholder="Get Started"
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">URL</Label>
              <Input
                value={ctaButtonUrl}
                onChange={(e) => setCtaButtonUrl(e.target.value)}
                placeholder="https://example.com/signup"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Both label and URL are required. Leave both empty to hide the button.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Theme & Colors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <div>
                <CardTitle>Theme & Colors</CardTitle>
                <CardDescription>
                  Customize the look and feel of your published documentation site.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={brandingStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Theme Preset</Label>
              <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode("light")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 transition-colors",
                    previewMode === "light"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="h-3 w-3" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("dark")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 transition-colors",
                    previewMode === "dark"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="h-3 w-3" />
                  Dark
                </button>
              </div>
            </div>
            <ThemeSelector value={theme} onChange={handleThemeChange} previewMode={previewMode} />
          </div>

          <div className="space-y-3">
            <ColorPicker
              label="Primary Color"
              value={primaryColor}
              onChange={(color) => setPrimaryColor(color)}
            />
            {primaryColor !== THEME_PRESETS[theme].primaryColor ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { delete colorOverridesRef.current[theme]; setPrimaryColor(THEME_PRESETS[theme].primaryColor); }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to {THEME_PRESETS[theme].name} default
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Using {THEME_PRESETS[theme].name} preset color.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Background Colors</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <ColorPicker
                    label="Light Mode"
                    value={backgroundColorLight}
                    onChange={setBackgroundColorLight}
                  />
                  {backgroundColorLight !== THEME_PRESETS[theme].colors.light.background && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setBackgroundColorLight(THEME_PRESETS[theme].colors.light.background)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <ColorPicker
                    label="Gradient End (Light)"
                    value={backgroundSubtleColorLight}
                    onChange={setBackgroundSubtleColorLight}
                  />
                  {backgroundSubtleColorLight !== THEME_PRESETS[theme].colors.light.backgroundSubtle && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setBackgroundSubtleColorLight(THEME_PRESETS[theme].colors.light.backgroundSubtle)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <ColorPicker
                    label="Dark Mode"
                    value={backgroundColorDark}
                    onChange={setBackgroundColorDark}
                  />
                  {backgroundColorDark !== THEME_PRESETS[theme].colors.dark.background && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setBackgroundColorDark(THEME_PRESETS[theme].colors.dark.background)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <ColorPicker
                    label="Gradient End (Dark)"
                    value={backgroundSubtleColorDark}
                    onChange={setBackgroundSubtleColorDark}
                  />
                  {backgroundSubtleColorDark !== THEME_PRESETS[theme].colors.dark.backgroundSubtle && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setBackgroundSubtleColorDark(THEME_PRESETS[theme].colors.dark.backgroundSubtle)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div />
              <SaveStatus status={fontsStatus} />
            </div>
            <FontSelector
              fonts={fonts}
              onChange={setFonts}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div />
              <SaveStatus status={customCssStatus} />
            </div>
            <CustomCssEditor
              value={customCss}
              onChange={setCustomCss}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
