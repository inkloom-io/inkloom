"use client";

import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthProvider, type AuthUser } from "@/hooks/use-auth";

/**
 * Core-mode context provider.
 *
 * Replaces `WorkOSProvider + PlatformAuthBridge + PlatformAppContextBridge`
 * in core standalone mode. Provides:
 *
 * - **Auth context:** Calls `ensureLocalUser` on mount, then queries the
 *   local user document and populates `AuthProvider`.
 * - **App context:** Not explicitly provided — `useAppContext()` falls back
 *   to `CORE_DEFAULTS` (tenantId: "local", isMultiTenant: false).
 */
export function CoreContextProvider({ children }: { children: ReactNode }) {
  const ensureUser = useMutation(api.users.ensureLocalUser);
  const localUser = useQuery(api.users.currentLocal);

  // Ensure the local user exists on mount (idempotent)
  useEffect(() => {
    void ensureUser();
  }, [ensureUser]);

  const isLoading = localUser === undefined;

  return (
    <AuthProvider
      value={{
        user: localUser ? (localUser as AuthUser) : null,
        userId: localUser?._id,
        isLoading,
        signOut: () => {
          // No-op in core mode — no authentication to sign out of
        },
      }}
    >
      {children}
    </AuthProvider>
  );
}
