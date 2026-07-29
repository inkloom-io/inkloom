/**
 * JSON values stored in D1 text columns.
 *
 * D1 exposes SQLite's JSON functions, while Drizzle handles serialization at
 * the application boundary. Keeping the recursive type here prevents database
 * models from falling back to `any`.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };
export type JsonObject = { [key: string]: JsonValue | undefined };

export type Plan = "free" | "pro" | "ultimate";
export type ProjectRole = "admin" | "editor" | "viewer";

export interface ProjectSettings {
  theme?:
    | "default"
    | "ocean"
    | "forest"
    | "ember"
    | "midnight"
    | "dune"
    | "fossil"
    | "vapor"
    | "aubergine"
    | "custom";
  primaryColor?: string;
  backgroundColorLight?: string;
  backgroundColorDark?: string;
  backgroundSubtleColorLight?: string;
  backgroundSubtleColorDark?: string;
  logoAssetId?: string;
  logoLightAssetId?: string;
  logoDarkAssetId?: string;
  favicon?: string;
  faviconAssetId?: string;
  fonts?: { heading?: string; body?: string; code?: string };
  accentColor?: string;
  sidebarBackgroundColor?: string;
  headerBackgroundColor?: string;
  linkColor?: string;
  codeAccentColor?: string;
  customCss?: string;
  customDomain?: string;
  navTabs?: Array<{
    id: string;
    name: string;
    slug: string;
    icon?: string;
    folderId?: string;
    items?: Array<
      { type: "folder"; folderId: string } | { type: "page"; pageId: string }
    >;
  }>;
  openapi?: {
    assetId: string;
    specUrl?: string;
    specFormat: "json" | "yaml";
    title: string;
    version: string;
    endpointCount: number;
    tagGroups: Array<{ tag: string; endpointCount: number }>;
    basePath?: string;
    tabId?: string;
    updatedAt: number;
  };
  ai?: {
    defaultDescription?: string;
    defaultAudience?: "public" | "private";
    defaultMode?: "extended" | "fast";
    defaultModel?: string;
    byokOpenRouterKey?: string;
    docGeneration?: { model?: string; byokOpenRouterKey?: string };
    evergreenDocs?: { model?: string; byokOpenRouterKey?: string };
    chatWithDocs?: { model?: string; byokOpenRouterKey?: string };
    openApiEnabled?: boolean;
  };
  seo?: {
    ogTitle?: string;
    ogDescription?: string;
    ogImageAssetId?: string;
    twitterCard?: "summary" | "summary_large_image";
    robotsTxtCustom?: string;
    jsonLdOrg?: string;
  };
  analytics?: {
    ga4MeasurementId?: string;
    posthogApiKey?: string;
    posthogHost?: string;
  };
  headScripts?: string;
  bodyScripts?: string;
  llmsTxt?: string;
  docsChat?: { enabled?: boolean; model?: string };
  socialLinks?: Array<{
    platform: "github" | "x" | "discord" | "linkedin" | "youtube";
    url: string;
  }>;
  defaultThemeMode?: "light" | "dark" | "system";
  showBranding?: boolean;
  ctaButton?: { label: string; url: string };
  migrationRedirects?: Array<{ from: string; to: string }>;
  accessControl?: {
    mode:
      | "public"
      | "login_required"
      | "domain_restricted"
      | "allowlist"
      | "sso_required";
    allowedDomains?: string[];
    allowedEmails?: string[];
    sessionTtlDays?: number;
  };
}

export type DeploymentStatus =
  | "queued"
  | "building"
  | "ready"
  | "error"
  | "canceled";
export type DeploymentTarget = "production" | "preview";
export type MergeRequestStatus = "open" | "merged" | "closed";
