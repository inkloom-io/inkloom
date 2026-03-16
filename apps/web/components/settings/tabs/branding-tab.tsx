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
} from "@inkloom/ui/card";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { cn } from "@inkloom/ui/lib/utils";
import { Separator } from "@inkloom/ui/separator";
import {
  ExternalLink,
  Globe,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Type,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { ColorPicker } from "@/components/settings/color-picker";
import { LogoUpload } from "@/components/settings/logo-upload";
import { FaviconUpload } from "@/components/settings/favicon-upload";
import { LogoVariants } from "@/components/settings/logo-variants";
import { FontSelector } from "@/components/settings/font-selector";
import { CustomCssEditor } from "@/components/settings/custom-css-editor";
import { GatedSection } from "@/components/gated-section";
import { THEME_PRESETS, type ThemePreset } from "@/lib/theme-presets";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";
import { useTranslations } from "next-intl";

type SocialPlatform = "github" | "x" | "discord" | "linkedin" | "youtube";

interface BrandingTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function BrandingTab({ projectId, project }: BrandingTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);
  const t = useTranslations("settings.branding");

  // Branding settings — sync preview toggle with platform theme
  const { resolvedTheme: platformTheme } = useTheme();
  const [previewModeOverride, setPreviewModeOverride] = useState<"light" | "dark" | null>(null);
  const previewMode: "light" | "dark" = previewModeOverride ?? (platformTheme === "light" ? "light" : "dark");
  const [theme, setTheme] = useState<ThemePreset>("fossil");
  const [primaryColor, setPrimaryColor] = useState(THEME_PRESETS.fossil.primaryColor);
  const [logoAssetId, setLogoAssetId] = useState<Id<"assets"> | undefined>();
  const [brandingInitialized, setBrandingInitialized] = useState(false);
  const colorOverridesRef = useRef<Partial<Record<ThemePreset, string>>>({});
  const [backgroundColorLight, setBackgroundColorLight] = useState(THEME_PRESETS.fossil.colors.light.background);
  const [backgroundColorDark, setBackgroundColorDark] = useState(THEME_PRESETS.fossil.colors.dark.background);
  const [backgroundSubtleColorLight, setBackgroundSubtleColorLight] = useState(THEME_PRESETS.fossil.colors.light.backgroundSubtle);
  const [backgroundSubtleColorDark, setBackgroundSubtleColorDark] = useState(THEME_PRESETS.fossil.colors.dark.backgroundSubtle);
  const bgOverridesRef = useRef<Partial<Record<ThemePreset, { light: string; dark: string; subtleLight: string; subtleDark: string }>>>();
  if (!bgOverridesRef.current) bgOverridesRef.current = {};

  // Favicon
  const [faviconAssetId, setFaviconAssetId] = useState<Id<"assets"> | undefined>();
  const [faviconInitialized, setFaviconInitialized] = useState(false);

  // Light/dark logo variants
  const [logoLightAssetId, setLogoLightAssetId] = useState<Id<"assets"> | undefined>();
  const [logoDarkAssetId, setLogoDarkAssetId] = useState<Id<"assets"> | undefined>();

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
    linkedin: "",
    youtube: "",
  });
  const [socialLinksInitialized, setSocialLinksInitialized] = useState(false);

  // Initialize branding settings
  useEffect(() => {
    if (project && !brandingInitialized) {
      if (project.settings?.theme) setTheme(project.settings.theme);
      if (project.settings?.primaryColor) setPrimaryColor(project.settings.primaryColor);
      if (project.settings?.logoAssetId) setLogoAssetId(project.settings.logoAssetId);
      const activeTheme = (project.settings?.theme || "fossil") as ThemePreset;
      const themePreset = THEME_PRESETS[activeTheme];
      setBackgroundColorLight(project.settings?.backgroundColorLight || themePreset.colors.light.background);
      setBackgroundColorDark(project.settings?.backgroundColorDark || themePreset.colors.dark.background);
      setBackgroundSubtleColorLight(project.settings?.backgroundSubtleColorLight || themePreset.colors.light.backgroundSubtle);
      setBackgroundSubtleColorDark(project.settings?.backgroundSubtleColorDark || themePreset.colors.dark.backgroundSubtle);
      setBrandingInitialized(true);
    }
  }, [project, brandingInitialized]);

  // Initialize favicon
  useEffect(() => {
    if (project && !faviconInitialized) {
      setFaviconAssetId(project.settings?.faviconAssetId);
      setLogoLightAssetId(project.settings?.logoLightAssetId);
      setLogoDarkAssetId(project.settings?.logoDarkAssetId);
      setFaviconInitialized(true);
    }
  }, [project, faviconInitialized]);

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
        linkedin: "",
        youtube: "",
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
      logoAssetId,
    }: {
      theme: ThemePreset;
      primaryColor: string;
      backgroundColorLight: string;
      backgroundColorDark: string;
      backgroundSubtleColorLight: string;
      backgroundSubtleColorDark: string;
      logoAssetId?: Id<"assets">;
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
          logoAssetId,
        },
      });
    },
    [updateSettings, projectId]
  );

  const saveFavicon = useCallback(
    async (assetId: Id<"assets"> | undefined) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { faviconAssetId: assetId },
      });
    },
    [updateSettings, projectId]
  );

  const saveLogoVariants = useCallback(
    async ({ light, dark }: { light?: Id<"assets">; dark?: Id<"assets"> }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { logoLightAssetId: light, logoDarkAssetId: dark },
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
      // Only save if both label and url are provided, or clear if both are empty
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
    { theme, primaryColor, backgroundColorLight, backgroundColorDark, backgroundSubtleColorLight, backgroundSubtleColorDark, logoAssetId },
    saveBranding,
    500,
    brandingInitialized
  );

  useAutoSave(faviconAssetId, saveFavicon, 300, faviconInitialized);

  const logoVariantsStatus = useAutoSave(
    { light: logoLightAssetId, dark: logoDarkAssetId },
    saveLogoVariants,
    300,
    faviconInitialized
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
    if (hasBgOverride) {
      bgOverridesRef.current![theme] = {
        light: backgroundColorLight,
        dark: backgroundColorDark,
        subtleLight: backgroundSubtleColorLight,
        subtleDark: backgroundSubtleColorDark,
      };
    } else {
      delete bgOverridesRef.current![theme];
    }
    setTheme(newTheme);
    if (newTheme !== "custom") {
      setPrimaryColor(colorOverridesRef.current[newTheme] || THEME_PRESETS[newTheme].primaryColor);
      const bgOverride = bgOverridesRef.current![newTheme];
      setBackgroundColorLight(bgOverride?.light || THEME_PRESETS[newTheme].colors.light.background);
      setBackgroundColorDark(bgOverride?.dark || THEME_PRESETS[newTheme].colors.dark.background);
      setBackgroundSubtleColorLight(bgOverride?.subtleLight || THEME_PRESETS[newTheme].colors.light.backgroundSubtle);
      setBackgroundSubtleColorDark(bgOverride?.subtleDark || THEME_PRESETS[newTheme].colors.dark.backgroundSubtle);
    }
  };

  const socialPlatforms = [
    { platform: "github" as SocialPlatform, labelKey: "github" as const, placeholderKey: "githubPlaceholder" as const },
    { platform: "x" as SocialPlatform, labelKey: "xTwitter" as const, placeholderKey: "xTwitterPlaceholder" as const },
    { platform: "discord" as SocialPlatform, labelKey: "discord" as const, placeholderKey: "discordPlaceholder" as const },
    { platform: "linkedin" as SocialPlatform, labelKey: "linkedin" as const, placeholderKey: "linkedinPlaceholder" as const },
    { platform: "youtube" as SocialPlatform, labelKey: "youtube" as const, placeholderKey: "youtubePlaceholder" as const },
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <div>
                <CardTitle>{t("socialLinks")}</CardTitle>
                <CardDescription>
                  {t("socialLinksDescription")}
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={socialLinksStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-lg">
            {socialPlatforms.map(({ platform, labelKey, placeholderKey }) => (
              <div key={platform} className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">{t(labelKey)}</Label>
                <Input
                  value={socialLinks[platform]}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({
                      ...prev,
                      [platform]: e.target.value,
                    }))
                  }
                  placeholder={t(placeholderKey)}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              <div>
                <CardTitle>{t("ctaButton")}</CardTitle>
                <CardDescription>
                  {t("ctaButtonDescription")}
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={ctaButtonStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-w-lg">
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">{t("ctaButtonLabel")}</Label>
              <Input
                value={ctaButtonLabel}
                onChange={(e) => setCtaButtonLabel(e.target.value)}
                placeholder={t("ctaButtonLabelPlaceholder")}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">{t("ctaButtonUrl")}</Label>
              <Input
                value={ctaButtonUrl}
                onChange={(e) => setCtaButtonUrl(e.target.value)}
                placeholder={t("ctaButtonUrlPlaceholder")}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ctaButtonHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <div>
                <CardTitle>{t("brandingAndTheme")}</CardTitle>
                <CardDescription>
                  {t("brandingAndThemeDescription")}
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={brandingStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>{t("themePreset")}</Label>
              <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewModeOverride("light")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 transition-colors",
                    previewMode === "light"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="h-3 w-3" />
                  {t("light")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModeOverride("dark")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 transition-colors",
                    previewMode === "dark"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="h-3 w-3" />
                  {t("dark")}
                </button>
              </div>
            </div>
            <ThemeSelector value={theme} onChange={handleThemeChange} previewMode={previewMode} />
          </div>

          <div className="space-y-3">
            <ColorPicker
              label={t("primaryColor")}
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
                {t("resetToDefault", { themeName: THEME_PRESETS[theme].name })}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("usingPresetColor", { themeName: THEME_PRESETS[theme].name })}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("backgroundColor")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <ColorPicker
                    label={t("lightMode")}
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
                      {t("reset")}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <ColorPicker
                    label={t("gradientEnd")}
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
                      {t("reset")}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <ColorPicker
                    label={t("darkMode")}
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
                      {t("reset")}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <ColorPicker
                    label={t("gradientEnd")}
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
                      {t("reset")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <LogoUpload
            projectId={projectId as Id<"projects">}
            assetId={logoAssetId}
            onUpload={(assetId) => setLogoAssetId(assetId)}
            onRemove={() => setLogoAssetId(undefined)}
          />

          <Separator />

          <FaviconUpload
            projectId={projectId as Id<"projects">}
            assetId={faviconAssetId}
            onUpload={(assetId) => setFaviconAssetId(assetId)}
            onRemove={() => setFaviconAssetId(undefined)}
          />
        </CardContent>
      </Card>

      <GatedSection
        feature="advanced_branding"
        projectId={projectId as Id<"projects">}
        title={t("advancedBranding")}
        description={t("advancedBrandingDescription")}
        icon={Type}
        valueProp={t("advancedBrandingValueProp")}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                <div>
                  <CardTitle>{t("advancedBranding")}</CardTitle>
                  <CardDescription>
                    {t("advancedBrandingCardDescription")}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SaveStatus status={logoVariantsStatus} />
                <SaveStatus status={fontsStatus} />
                <SaveStatus status={customCssStatus} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <LogoVariants
              projectId={projectId as Id<"projects">}
              lightAssetId={logoLightAssetId}
              darkAssetId={logoDarkAssetId}
              onLightUpload={(id) => setLogoLightAssetId(id)}
              onLightRemove={() => setLogoLightAssetId(undefined)}
              onDarkUpload={(id) => setLogoDarkAssetId(id)}
              onDarkRemove={() => setLogoDarkAssetId(undefined)}
            />

            <Separator />

            <FontSelector
              fonts={fonts}
              onChange={setFonts}
            />

            <Separator />

            <CustomCssEditor
              value={customCss}
              onChange={setCustomCss}
            />
          </CardContent>
        </Card>
      </GatedSection>
    </div>
  );
}
