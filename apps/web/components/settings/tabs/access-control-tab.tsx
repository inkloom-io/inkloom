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
} from "@inkloom/ui/card";
import { Input } from "@inkloom/ui/input";
import { Label } from "@inkloom/ui/label";
import { Button } from "@inkloom/ui/button";
import { Badge } from "@inkloom/ui/badge";
import { Shield, Plus, X } from "lucide-react";
import { GatedSection } from "@/components/gated-section";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveStatus } from "@/components/settings/save-status";
import { useTranslations } from "next-intl";

type AccessMode =
  | "public"
  | "login_required"
  | "domain_restricted"
  | "allowlist"
  | "sso_required";

const ACCESS_MODES: AccessMode[] = [
  "public",
  "login_required",
  "domain_restricted",
  "allowlist",
  "sso_required",
];

const SESSION_TTL_OPTIONS = [1, 7, 14, 30];

function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    domain
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface AccessControlTabProps {
  projectId: string;
  project: Doc<"projects">;
}

export function AccessControlTab({
  projectId,
  project,
}: AccessControlTabProps) {
  const updateSettings = useMutation(api.projects.updateSettings);
  const t = useTranslations("settings.accessControl");

  // State
  const [mode, setMode] = useState<AccessMode>("public");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [sessionTtlDays, setSessionTtlDays] = useState(7);
  const [initialized, setInitialized] = useState(false);

  // Input state for adding new domains/emails
  const [domainInput, setDomainInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [domainError, setDomainError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Initialize from project
  useEffect(() => {
    if (project && !initialized) {
      const ac = project.settings?.accessControl;
      setMode((ac?.mode as AccessMode) ?? "public");
      setAllowedDomains(ac?.allowedDomains ?? []);
      setAllowedEmails(ac?.allowedEmails ?? []);
      setSessionTtlDays(ac?.sessionTtlDays ?? 7);
      setInitialized(true);
    }
  }, [project, initialized]);

  // Auto-save callback
  const saveAccessControl = useCallback(
    async (data: {
      mode: AccessMode;
      allowedDomains: string[];
      allowedEmails: string[];
      sessionTtlDays: number;
    }) => {
      await updateSettings({
        projectId: projectId as Id<"projects">,
        settings: {
          accessControl: {
            mode: data.mode,
            allowedDomains:
              data.mode === "domain_restricted"
                ? data.allowedDomains
                : undefined,
            allowedEmails:
              data.mode === "allowlist" ? data.allowedEmails : undefined,
            sessionTtlDays:
              data.mode !== "public" ? data.sessionTtlDays : undefined,
          },
        },
      });
    },
    [updateSettings, projectId]
  );

  // Auto-save hook
  const status = useAutoSave(
    { mode, allowedDomains, allowedEmails, sessionTtlDays },
    saveAccessControl,
    800,
    initialized
  );

  // Domain management
  const handleAddDomain = () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;
    if (!isValidDomain(domain)) {
      setDomainError(t("invalidDomain"));
      return;
    }
    if (allowedDomains.includes(domain)) {
      setDomainError(t("duplicateDomain"));
      return;
    }
    setAllowedDomains([...allowedDomains, domain]);
    setDomainInput("");
    setDomainError("");
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  // Email management
  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      setEmailError(t("invalidEmail"));
      return;
    }
    if (allowedEmails.includes(email)) {
      setEmailError(t("duplicateEmail"));
      return;
    }
    setAllowedEmails([...allowedEmails, email]);
    setEmailInput("");
    setEmailError("");
  };

  const handleRemoveEmail = (email: string) => {
    setAllowedEmails(allowedEmails.filter((e) => e !== email));
  };

  return (
    <GatedSection
      feature="authenticated_access"
      projectId={projectId as Id<"projects">}
      title={t("title")}
      description={t("description")}
      icon={Shield}
      valueProp={t("valueProp")}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <div>
                  <CardTitle>{t("title")}</CardTitle>
                  <CardDescription>{t("description")}</CardDescription>
                </div>
              </div>
              <SaveStatus status={status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Selector */}
            <div className="space-y-3">
              <Label>{t("modeLabel")}</Label>
              <div className="space-y-2">
                {ACCESS_MODES.map((m) => (
                  <label
                    key={m}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
                    data-active={mode === m || undefined}
                  >
                    <input
                      type="radio"
                      name="accessMode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-primary mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {t(`modes.${m}.label`)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(`modes.${m}.description`)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Domain List Input */}
            {mode === "domain_restricted" && (
              <div className="space-y-3">
                <Label>{t("allowedDomains")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("allowedDomainsDescription")}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={domainInput}
                    onChange={(e) => {
                      setDomainInput(e.target.value);
                      setDomainError("");
                    }}
                    placeholder={t("domainPlaceholder")}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddDomain}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {domainError && (
                  <p className="text-xs text-destructive">{domainError}</p>
                )}
                {allowedDomains.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allowedDomains.map((domain) => (
                      <Badge
                        key={domain}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {domain}
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Email List Input */}
            {mode === "allowlist" && (
              <div className="space-y-3">
                <Label>{t("allowedEmails")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("allowedEmailsDescription")}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError("");
                    }}
                    placeholder={t("emailPlaceholder")}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddEmail}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
                {allowedEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allowedEmails.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Session TTL */}
            {mode !== "public" && (
              <div className="space-y-3">
                <Label>{t("sessionTtl")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("sessionTtlDescription")}
                </p>
                <div className="flex gap-2">
                  {SESSION_TTL_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSessionTtlDays(days)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        sessionTtlDays === days
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t("days", { count: days })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GatedSection>
  );
}
