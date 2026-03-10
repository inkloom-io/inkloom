"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Mail, LogOut, Key, Download, Trash2, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@inkloom/ui/dialog";

const ApiKeysConfig = dynamic(
  () => import("@/components/settings/api-keys-config").then((m) => ({ default: m.ApiKeysConfig })),
  { loading: () => <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-hover)]" /> }
);

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface Identity {
  type: string;
  provider: string;
  email?: string;
}

const PROVIDERS = [
  {
    key: "email",
    label: "Email",
    icon: (
      <Mail className="h-4 w-4 text-[var(--text-dim)]" />
    ),
    alwaysConnected: true,
  },
  {
    key: "google",
    label: "Google",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
    matchProvider: "GoogleOAuth",
  },
  {
    key: "github",
    label: "GitHub",
    icon: (
      <svg
        className="h-4 w-4 text-[var(--text-dim)]"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    matchProvider: "GitHubOAuth",
  },
];

export default function SettingsPage() {
  const t = useTranslations("dashboard.userSettings");
  const [user, setUser] = useState<UserData | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, identitiesRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/auth/identities"),
        ]);
        if (userRes.ok) {
          const data = await userRes.json();
          setUser(data.user);
        }
        if (identitiesRes.ok) {
          const data = await identitiesRes.json();
          setIdentities(data.identities || []);
        }
      } catch (err) {
        console.error("Failed to load settings data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.email?.[0]?.toUpperCase() || "U";

  const isProviderConnected = (matchProvider?: string) => {
    if (!matchProvider) return false;
    return identities.some(
      (id) => id.provider === matchProvider || id.type === matchProvider
    );
  };

  const getProviderEmail = (matchProvider?: string) => {
    if (!matchProvider) return null;
    const identity = identities.find(
      (id) => id.provider === matchProvider || id.type === matchProvider
    );
    return identity?.email || null;
  };

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/user/export");
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? "inkloom-personal-data-export.json";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Data export failed:", err);
      setExportError(t("dataExportError"));
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  const deleteConfirmText = "DELETE";

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== deleteConfirmText) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("deleteAccount.error"));
      }
      // Redirect to home page after successful deletion
      window.location.href = "/";
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("deleteAccount.error")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <div
            className="mb-2 h-9 w-32 animate-pulse rounded-lg bg-[var(--surface-active)]"
          />
          <div
            className="h-5 w-64 animate-pulse rounded-lg bg-[var(--surface-hover)]"
          />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i: any) => (
            <div
              key={i}
              className="rounded-2xl p-6 bg-[var(--surface-bg)]"
              style={{
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                className="mb-4 h-5 w-24 animate-pulse rounded bg-[var(--surface-active)]"
              />
              <div
                className="h-14 w-full animate-pulse rounded-xl bg-[var(--surface-hover)]"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page heading */}
      <div className="mb-10">
        <h1
          className="mb-1 text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("heading")}
        </h1>
        <p className="text-sm text-[var(--text-dim)]">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div
          className="rounded-2xl p-6 bg-[var(--surface-bg)]"
          style={{
            border: "1px solid var(--glass-border)",
            animation: "settingsCardIn 0.4s ease-out 0s both",
          }}
        >
          <div className="mb-5">
            <h2
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("profile")}
            </h2>
            <p className="text-sm text-[var(--text-dim)]">
              {t("profileSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div
              className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full"
              style={{
                border: "2px solid rgba(20,184,166,0.3)",
                boxShadow: "0 0 20px rgba(20,184,166,0.1)",
              }}
            >
              {user?.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt={user.firstName || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xl font-semibold"
                  style={{
                    backgroundColor: "rgba(20,184,166,0.15)",
                    color: "#14b8a6",
                  }}
                >
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {user?.firstName} {user?.lastName}
              </h3>
              <p
                className="text-sm text-[var(--text-dim)]"
              >
                {user?.email}
              </p>
              <div
                className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: "rgba(20,184,166,0.1)",
                  color: "#14b8a6",
                  border: "1px solid rgba(20,184,166,0.2)",
                }}
              >
                {t("freePlan")}
              </div>
            </div>
          </div>
        </div>

        {/* Connected Accounts Card */}
        <div
          className="rounded-2xl p-6 bg-[var(--surface-bg)]"
          style={{
            border: "1px solid var(--glass-border)",
            animation: "settingsCardIn 0.4s ease-out 0.05s both",
          }}
        >
          <div className="mb-5">
            <h2
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("connectedAccounts")}
            </h2>
            <p className="text-sm text-[var(--text-dim)]">
              {t("connectedAccountsSubtitle")}
            </p>
          </div>
          <div className="space-y-2">
            {PROVIDERS.map((provider, index) => {
              const connected =
                provider.alwaysConnected ||
                isProviderConnected(provider.matchProvider);
              const providerEmail = provider.alwaysConnected
                ? user?.email
                : getProviderEmail(provider.matchProvider);

              return (
                <div
                  key={provider.key}
                  className="flex items-center gap-4 rounded-xl py-3 px-4 bg-[var(--surface-bg)]"
                  style={{
                    border: "1px solid var(--glass-border)",
                    animation: `settingsCardIn 0.3s ease-out ${0.1 + index * 0.04}s both`,
                  }}
                >
                  {/* Provider icon */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: connected
                        ? "rgba(20,184,166,0.08)"
                        : "var(--surface-hover)",
                      border: connected
                        ? "1px solid rgba(20,184,166,0.15)"
                        : "1px solid var(--glass-border)",
                    }}
                  >
                    {provider.icon}
                  </div>

                  {/* Provider info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {provider.label}
                    </p>
                    {providerEmail && (
                      <p
                        className="truncate text-xs text-[var(--text-dim)]"
                      >
                        {providerEmail}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: connected
                          ? "#14b8a6"
                          : "var(--surface-active)",
                        boxShadow: connected
                          ? "0 0 8px rgba(20,184,166,0.4)"
                          : "none",
                      }}
                    />
                    <span
                      className={`text-xs font-medium ${!connected ? "text-[var(--text-dim)]" : ""}`}
                      style={connected ? { color: "#14b8a6" } : undefined}
                    >
                      {connected ? t("connected") : t("notConnected")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* API Keys Card */}
        <div
          className="rounded-2xl p-6 bg-[var(--surface-bg)]"
          style={{
            border: "1px solid var(--glass-border)",
            animation: "settingsCardIn 0.4s ease-out 0.1s both",
          }}
        >
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--text-dim)]" />
              <h2
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {t("apiKeys")}
              </h2>
            </div>
            <p className="text-sm text-[var(--text-dim)]">
              {t("apiKeysSubtitle")}
            </p>
          </div>
          <ApiKeysConfig scope="user" />
        </div>

        {/* Export My Data Card */}
        <div
          className="rounded-2xl p-6 bg-[var(--surface-bg)]"
          style={{
            border: "1px solid var(--glass-border)",
            animation: "settingsCardIn 0.4s ease-out 0.12s both",
          }}
        >
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-[var(--text-dim)]" />
              <h2
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {t("dataExport")}
              </h2>
            </div>
            <p className="text-sm text-[var(--text-dim)]">
              {t("dataExportSubtitle")}
            </p>
          </div>
          <div
            className="flex items-center justify-between rounded-xl py-3 px-4 bg-[var(--surface-bg)]"
            style={{
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {t("dataExportDescription")}
              </p>
              {exportError && (
                <p className="mt-1 text-xs text-red-400">
                  {exportError}
                </p>
              )}
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "rgba(20,184,166,0.1)",
                border: "1px solid rgba(20,184,166,0.2)",
                color: "#14b8a6",
              }}
              onMouseEnter={(e) => {
                if (!isExporting) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(20,184,166,0.15)";
                  e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(20,184,166,0.1)";
                e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)";
              }}
            >
              <Download className="h-4 w-4" />
              {isExporting ? t("dataExportDownloading") : t("dataExportButton")}
            </button>
          </div>
        </div>

        {/* Danger Zone Card */}
        <div
          className="rounded-2xl p-6 bg-[var(--surface-bg)]"
          style={{
            border: "1px solid rgba(239,68,68,0.15)",
            animation: "settingsCardIn 0.4s ease-out 0.15s both",
          }}
        >
          <div className="mb-5">
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "#f87171",
              }}
            >
              {t("dangerZone")}
            </h2>
            <p className="text-sm text-[var(--text-dim)]">
              {t("dangerZoneSubtitle")}
            </p>
          </div>
          <div
            className="flex items-center justify-between rounded-xl py-3 px-4 bg-[var(--surface-bg)]"
            style={{
              border: "1px solid var(--glass-border)",
            }}
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("signOutAllDevices")}
              </p>
              <p
                className="text-xs text-[var(--text-dim)]"
              >
                {t("signOutAllDevicesDescription")}
              </p>
            </div>
            <a
              href="/api/auth/signout"
              className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(239,68,68,0.15)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(239,68,68,0.1)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
              }}
            >
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </a>
          </div>

          {/* Delete Account */}
          <div
            className="flex items-center justify-between rounded-xl py-3 px-4 bg-[var(--surface-bg)]"
            style={{
              border: "1px solid var(--glass-border)",
            }}
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("deleteAccount.title")}
              </p>
              <p className="text-xs text-[var(--text-dim)]">
                {t("deleteAccount.description")}
              </p>
            </div>
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(239,68,68,0.15)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(239,68,68,0.1)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteAccount.button")}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirmation("");
            setDeleteError(null);
          }
        }}
      >
        <DialogContent
          className="!rounded-2xl !border-0 !p-0 !shadow-none sm:!max-w-[440px]"
          style={{
            backgroundColor: "var(--surface-bg)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle
              className="flex items-center gap-2 text-lg font-bold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "#f87171",
              }}
            >
              <AlertTriangle className="h-5 w-5" />
              {t("deleteAccount.dialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-[var(--text-dim)]">
              {t("deleteAccount.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pt-5 pb-2">
            {deleteError && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171",
                }}
              >
                {deleteError}
              </div>
            )}
            <div>
              <label
                htmlFor="deleteAccountConfirm"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]"
              >
                {t("deleteAccount.typeToConfirm")}
              </label>
              <input
                id="deleteAccountConfirm"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={deleteConfirmText}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-[var(--text-dim)] outline-none transition-all duration-200"
                style={{
                  backgroundColor: "var(--surface-hover)",
                  border: "1px solid var(--glass-border)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(239,68,68,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--glass-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>
          <DialogFooter
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: "1px solid var(--glass-border)" }}
          >
            <button
              type="button"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmation("");
                setDeleteError(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-dim)] transition-all hover:text-foreground"
            >
              {t("deleteAccount.cancel")}
            </button>
            <button
              disabled={
                deleteConfirmation !== deleteConfirmText || isDeleting
              }
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all"
              style={{
                backgroundColor:
                  deleteConfirmation !== deleteConfirmText || isDeleting
                    ? "rgba(239,68,68,0.3)"
                    : "#ef4444",
                cursor:
                  deleteConfirmation !== deleteConfirmText || isDeleting
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting
                ? t("deleteAccount.deleting")
                : t("deleteAccount.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyframes */}
      <style>{`
        @keyframes settingsCardIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
