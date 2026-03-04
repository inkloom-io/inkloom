"use client";

import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { AuthProvider, type AuthUser } from "@/hooks/use-auth";

// Core-only Convex function references (not present in platform's users.ts override).
// Use makeFunctionReference so this file type-checks in both core and apps/dev contexts.
const ensureLocalUserRef = makeFunctionReference<"mutation">("users:ensureLocalUser");
const currentLocalRef = makeFunctionReference<"query">("users:currentLocal");

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
  const ensureUser = useMutation(ensureLocalUserRef);
  const localUser = useQuery(currentLocalRef);

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
