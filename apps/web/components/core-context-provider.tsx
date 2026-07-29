"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider, type AuthUser } from "@/hooks/use-auth";
import { useDataMutation, useDataQuery } from "@/data/hooks";
import { api } from "@/data/operations";

/**
 * Core-mode context provider.
 *
 * Replaces `WorkOSProvider + PlatformAuthBridge + PlatformAppContextBridge`
 * in core standalone mode. Provides:
 *
 * - **Auth context:** Calls the idempotent D1 local-user endpoint on mount,
 *   then populates `AuthProvider` from the data service.
 * - **App context:** Not explicitly provided — `useAppContext()` falls back
 *   to `CORE_DEFAULTS` (tenantId: "local", isMultiTenant: false).
 */
export function CoreContextProvider({ children }: { children: ReactNode }) {
  const ensureUser = useDataMutation(api.users.ensureLocalUser);
  const localUser = useDataQuery(api.users.current, undefined);

  // Ensure the local user exists on mount (idempotent)
  useEffect(() => {
    void ensureUser(undefined);
  }, [ensureUser]);

  const isLoading = localUser === undefined;

  return (
    <AuthProvider
      value={{
        user: localUser
          ? ({
              ...localUser,
              _id: localUser.id,
              _creationTime: localUser.createdAt,
            } as AuthUser)
          : null,
        userId: localUser?.id,
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
