"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Code2 } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";

interface AnalyticsTabProps {
  projectId: string;
  project: Doc<"projects">;
}

interface AnalyticsProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    pattern?: RegExp;
    hint?: string;
  }[];
}

const ANALYTICS_PROVIDERS: AnalyticsProvider[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M22.844 11.35l-4.476 7.756c-.262.454-.736.734-1.244.734h-8.95c-.51 0-.983-.28-1.245-.734L2.45 11.35a1.44 1.44 0 010-1.44L6.929 2.16c.262-.454.735-.734 1.244-.734h8.95c.51 0 .983.28 1.245.734l4.476 7.75a1.44 1.44 0 010 1.44zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      </svg>
    ),
    fields: [
      {
        key: "ga4MeasurementId",
        label: "Measurement ID",
        placeholder: "G-XXXXXXXXXX",
        pattern: /^G-[A-Z0-9]+$/,
        hint: "Found in Google Analytics > Admin > Data Streams",
      },
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    fields: [
      {
        key: "posthogApiKey",
        label: "Project API Key",
        placeholder: "phc_xxxxxxxxxxxx",
        pattern: /^phc_[a-zA-Z0-9]+$/,
        hint: "Found in PostHog > Project Settings",
      },
      {
        key: "posthogHost",
        label: "Host (optional)",
        placeholder: "https://us.i.posthog.com",
        hint: "Leave empty for US cloud. Use https://eu.i.posthog.com for EU.",
      },
    ],
  },
];

export function AnalyticsTab({ projectId, project }: AnalyticsTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);

  // Analytics settings
  const [analytics, setAnalytics] = useState<{
    ga4MeasurementId?: string;
    posthogApiKey?: string;
    posthogHost?: string;
  }>({});
  const [analyticsInitialized, setAnalyticsInitialized] = useState(false);

  // Custom scripts
  const [headScripts, setHeadScripts] = useState("");
  const [bodyScripts, setBodyScripts] = useState("");
  const [scriptsInitialized, setScriptsInitialized] = useState(false);

  // Initialize analytics
  useEffect(() => {
    if (project && !analyticsInitialized) {
      setAnalytics({
        ga4MeasurementId: project.settings?.analytics?.ga4MeasurementId || undefined,
        posthogApiKey: project.settings?.analytics?.posthogApiKey || undefined,
        posthogHost: project.settings?.analytics?.posthogHost || undefined,
      });
      setAnalyticsInitialized(true);
    }
  }, [project, analyticsInitialized]);

  // Initialize scripts
  useEffect(() => {
    if (project && !scriptsInitialized) {
      setHeadScripts(project.settings?.headScripts || "");
      setBodyScripts(project.settings?.bodyScripts || "");
      setScriptsInitialized(true);
    }
  }, [project, scriptsInitialized]);

  // Auto-save callbacks
  const saveAnalytics = useCallback(
    async (value: typeof analytics) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: { analytics: value },
      });
    },
    [updateSettings, projectId]
  );

  const saveScripts = useCallback(
    async ({ headScripts, bodyScripts }: { headScripts: string; bodyScripts: string }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          headScripts: headScripts || undefined,
          bodyScripts: bodyScripts || undefined,
        },
      });
    },
    [updateSettings, projectId]
  );

  const analyticsStatus = useAutoSave(analytics, saveAnalytics, 800, analyticsInitialized);
  const scriptsStatus = useAutoSave({ headScripts, bodyScripts }, saveScripts, 800, scriptsInitialized);

  const updateAnalyticsField = (key: string, value: string) => {
    setAnalytics((prev) => ({ ...prev, [key]: value || undefined }));
  };

  return (
    <div className="space-y-6">
      {/* Analytics Providers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <div>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Connect analytics providers to track visitor behavior on your published site.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={analyticsStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ANALYTICS_PROVIDERS.map((provider) => {
              const hasValue = provider.fields.some(
                (f) => (analytics as Record<string, string | undefined>)[f.key]
              );

              return (
                <div
                  key={provider.id}
                  className={`rounded-lg border p-4 space-y-3 transition-colors ${
                    hasValue ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground">{provider.icon}</div>
                    <span className="text-sm font-medium">{provider.name}</span>
                    {hasValue && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        Active
                      </span>
                    )}
                  </div>

                  {provider.fields.map((field) => {
                    const value = (analytics as Record<string, string | undefined>)[field.key] || "";
                    const isValid = !value || !field.pattern || field.pattern.test(value);

                    return (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          value={value}
                          onChange={(e) => updateAnalyticsField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className={!isValid ? "border-destructive" : ""}
                        />
                        {field.hint && (
                          <p className="text-[10px] text-muted-foreground">{field.hint}</p>
                        )}
                        {!isValid && (
                          <p className="text-[10px] text-destructive">
                            Invalid format. Expected: {field.placeholder}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>
                Analytics scripts are injected into your published site only. They do not run in the editor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Scripts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              <div>
                <CardTitle>Custom Scripts</CardTitle>
                <CardDescription>
                  Inject custom scripts into your published site&apos;s HTML.
                </CardDescription>
              </div>
            </div>
            <SaveStatus status={scriptsStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="headScripts">Head Scripts</Label>
            <p className="text-xs text-muted-foreground">
              Injected before &lt;/head&gt;. Use for meta tags, stylesheets, or tracking pixels.
            </p>
            <Textarea
              id="headScripts"
              value={headScripts}
              onChange={(e) => setHeadScripts(e.target.value)}
              placeholder={'<script src="https://example.com/script.js"></script>'}
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyScripts">Body Scripts</Label>
            <p className="text-xs text-muted-foreground">
              Injected before &lt;/body&gt;. Use for chat widgets, analytics, or other scripts.
            </p>
            <Textarea
              id="bodyScripts"
              value={bodyScripts}
              onChange={(e) => setBodyScripts(e.target.value)}
              placeholder={'<script>console.log("Hello!");</script>'}
              rows={4}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
