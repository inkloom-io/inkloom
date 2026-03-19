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
  Eye,
  EyeOff,
  Globe,
  Monitor,
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
import { PreviewPanel } from "@/components/editor/preview-panel";
import { useTranslations } from "next-intl";

/**
 * Static sample BlockNote JSON content for the theme preview.
 * Showcases headings, paragraphs, code blocks, callouts, tables,
 * inline code, links, blockquotes, and card groups so users can
 * evaluate their theme against realistic documentation content.
 */
const SAMPLE_PREVIEW_CONTENT = JSON.stringify([
  {
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "Getting Started" }],
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Welcome to the documentation. This preview shows how your theme will look on your " },
      { type: "text", text: "published site", styles: { bold: true } },
      { type: "text", text: ". Customize your colors and fonts, then check the result here." },
    ],
  },
  {
    type: "callout",
    props: { type: "info" },
    content: [
      { type: "text", text: "This is an info callout — great for tips and important notes that readers shouldn't miss." },
    ],
  },
  {
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Installation" }],
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Install the package using " },
      { type: "text", text: "npm install", styles: { code: true } },
      { type: "text", text: " or your preferred package manager:" },
    ],
  },
  {
    type: "codeBlock",
    props: { language: "bash" },
    content: [{ type: "text", text: "npm install @example/sdk\n\n# Or with yarn\nyarn add @example/sdk" }],
  },
  {
    type: "heading",
    props: { level: 3 },
    content: [{ type: "text", text: "Configuration" }],
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "After installing, create a config file. See the " },
      { type: "link", href: "#", content: [{ type: "text", text: "configuration guide" }] },
      { type: "text", text: " for all available options." },
    ],
  },
  {
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        {
          cells: [
            { type: "tableCell", content: [{ type: "text", text: "Option", styles: { bold: true } }] },
            { type: "tableCell", content: [{ type: "text", text: "Type", styles: { bold: true } }] },
            { type: "tableCell", content: [{ type: "text", text: "Description", styles: { bold: true } }] },
          ],
        },
        {
          cells: [
            { type: "tableCell", content: [{ type: "text", text: "apiKey", styles: { code: true } }] },
            { type: "tableCell", content: [{ type: "text", text: "string" }] },
            { type: "tableCell", content: [{ type: "text", text: "Your API key for authentication" }] },
          ],
        },
        {
          cells: [
            { type: "tableCell", content: [{ type: "text", text: "debug", styles: { code: true } }] },
            { type: "tableCell", content: [{ type: "text", text: "boolean" }] },
            { type: "tableCell", content: [{ type: "text", text: "Enable verbose logging" }] },
          ],
        },
        {
          cells: [
            { type: "tableCell", content: [{ type: "text", text: "timeout", styles: { code: true } }] },
            { type: "tableCell", content: [{ type: "text", text: "number" }] },
            { type: "tableCell", content: [{ type: "text", text: "Request timeout in milliseconds" }] },
          ],
        },
      ],
    },
  },
  {
    type: "quote",
    content: [
      { type: "text", text: "Good documentation is the foundation of a great developer experience." },
    ],
  },
  {
    type: "callout",
    props: { type: "warning" },
    content: [
      { type: "text", text: "Never commit your API key to version control. Use environment variables instead." },
    ],
  },
  {
    type: "cardGroup",
    props: {},
    children: [
      {
        type: "card",
        props: { title: "Quickstart", icon: "🚀" },
        content: [{ type: "text", text: "Get up and running in under 5 minutes with our quickstart guide." }],
      },
      {
        type: "card",
        props: { title: "API Reference", icon: "📖" },
        content: [{ type: "text", text: "Explore the full API reference with examples for every endpoint." }],
      },
    ],
  },
  {
    type: "codeBlock",
    props: { language: "typescript" },
    content: [{ type: "text", text: "import { Client } from \"@example/sdk\";\n\nconst client = new Client({\n  apiKey: process.env.API_KEY,\n  debug: true,\n});\n\nconst result = await client.query(\"hello\");\nconsole.log(result);" }],
  },
]);

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
  const [theme, setTheme] = useState<ThemePreset>("default");
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

  // Default theme mode
  const [defaultThemeMode, setDefaultThemeMode] = useState<"light" | "dark" | "system">("system");
  const [defaultThemeModeInitialized, setDefaultThemeModeInitialized] = useState(false);

  // Advanced colors
  const [accentColor, setAccentColor] = useState("");
  const [sidebarBackgroundColor, setSidebarBackgroundColor] = useState("");
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState("");
  const [linkColor, setLinkColor] = useState("");
  const [codeAccentColor, setCodeAccentColor] = useState("");
  const [advancedColorsInitialized, setAdvancedColorsInitialized] = useState(false);

  // Live preview
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
      const activeTheme = (project.settings?.theme || "default") as ThemePreset;
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

  // Initialize default theme mode
  useEffect(() => {
    if (project && !defaultThemeModeInitialized) {
      setDefaultThemeMode(project.settings?.defaultThemeMode || "system");
      setDefaultThemeModeInitialized(true);
    }
  }, [project, defaultThemeModeInitialized]);

  // Initialize advanced colors
  useEffect(() => {
    if (project && !advancedColorsInitialized) {
      setAccentColor(project.settings?.accentColor || "");
      setSidebarBackgroundColor(project.settings?.sidebarBackgroundColor || "");
      setHeaderBackgroundColor(project.settings?.headerBackgroundColor || "");
      setLinkColor(project.settings?.linkColor || "");
      setCodeAccentColor(project.settings?.codeAccentColor || "");
      setAdvancedColorsInitialized(true);
    }
  }, [project, advancedColorsInitialized]);

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

  const saveDefaultThemeMode = useCallback(
    async (value: "light" | "dark" | "system") => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { defaultThemeMode: value },
      });
    },
    [updateSettings, projectId]
  );

  const saveAdvancedColors = useCallback(
    async (value: {
      accentColor: string;
      sidebarBackgroundColor: string;
      headerBackgroundColor: string;
      linkColor: string;
      codeAccentColor: string;
    }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          accentColor: value.accentColor || undefined,
          sidebarBackgroundColor: value.sidebarBackgroundColor || undefined,
          headerBackgroundColor: value.headerBackgroundColor || undefined,
          linkColor: value.linkColor || undefined,
          codeAccentColor: value.codeAccentColor || undefined,
        },
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

  const defaultThemeModeStatus = useAutoSave(defaultThemeMode, saveDefaultThemeMode, 300, defaultThemeModeInitialized);
  const fontsStatus = useAutoSave(fonts, saveFonts, 800, fontsInitialized);
  const advancedColorsStatus = useAutoSave(
    { accentColor, sidebarBackgroundColor, headerBackgroundColor, linkColor, codeAccentColor },
    saveAdvancedColors,
    500,
    advancedColorsInitialized
  );
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t("defaultThemeMode")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("defaultThemeModeDescription")}
                </p>
              </div>
              <SaveStatus status={defaultThemeModeStatus} />
            </div>
            <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setDefaultThemeMode("light")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors",
                  defaultThemeMode === "light"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                {t("light")}
              </button>
              <button
                type="button"
                onClick={() => setDefaultThemeMode("dark")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors",
                  defaultThemeMode === "dark"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="h-3.5 w-3.5" />
                {t("dark")}
              </button>
              <button
                type="button"
                onClick={() => setDefaultThemeMode("system")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors",
                  defaultThemeMode === "system"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                {t("system")}
              </button>
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

          <Separator />

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                isPreviewOpen
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {isPreviewOpen ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {t(isPreviewOpen ? "hidePreview" : "showPreview")}
            </button>
            {isPreviewOpen && (
              <div className="overflow-hidden rounded-lg border" style={{ height: 600 }}>
                <PreviewPanel
                  content={SAMPLE_PREVIEW_CONTENT}
                  pageTitle={t("previewPageTitle")}
                  pageSubtitle={t("previewPageSubtitle")}
                  themePreset={theme}
                  customPrimaryColor={primaryColor}
                  customBackgroundColorLight={backgroundColorLight}
                  customBackgroundColorDark={backgroundColorDark}
                  customBackgroundSubtleColorLight={backgroundSubtleColorLight}
                  customBackgroundSubtleColorDark={backgroundSubtleColorDark}
                />
              </div>
            )}
          </div>
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
                <SaveStatus status={advancedColorsStatus} />
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

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">{t("advancedColors")}</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("advancedColorsDescription")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ColorPicker
                    label={t("accentColor")}
                    value={accentColor}
                    onChange={setAccentColor}
                  />
                  {accentColor && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setAccentColor("")}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("resetToThemeDefault")}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <ColorPicker
                    label={t("sidebarBackground")}
                    value={sidebarBackgroundColor}
                    onChange={setSidebarBackgroundColor}
                  />
                  {sidebarBackgroundColor && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setSidebarBackgroundColor("")}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("resetToThemeDefault")}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <ColorPicker
                    label={t("headerBackground")}
                    value={headerBackgroundColor}
                    onChange={setHeaderBackgroundColor}
                  />
                  {headerBackgroundColor && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setHeaderBackgroundColor("")}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("resetToThemeDefault")}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <ColorPicker
                    label={t("linkColor")}
                    value={linkColor}
                    onChange={setLinkColor}
                  />
                  {linkColor && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setLinkColor("")}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("resetToThemeDefault")}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <ColorPicker
                    label={t("codeAccentColor")}
                    value={codeAccentColor}
                    onChange={setCodeAccentColor}
                  />
                  {codeAccentColor && (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setCodeAccentColor("")}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("resetToThemeDefault")}
                    </button>
                  )}
                </div>
              </div>
            </div>

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
