"use client";

import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthProvider, type AuthUser } from "@/hooks/use-auth";

// Cast api to access usersCore functions. These are defined in
// convex/usersCore.ts but not yet in _generated/api.d.ts because
// Convex codegen hasn't been re-run. After the core/platform
// restructure, the core app's own codegen will include them natively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coreApi = api as any;

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
  const ensureUser = useMutation(coreApi.usersCore.ensureLocalUser);
  const localUser = useQuery(coreApi.usersCore.currentLocal);

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
