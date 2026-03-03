"use client";

import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AuthProvider, type AuthUser } from "@/hooks/use-auth";

/**
 * Platform-mode auth bridge.
 *
 * Reads from `useCurrentUser()` (WorkOS + Convex sync) and provides the
 * result via `AuthContext` so that `useAuth()` works in platform mode.
 *
 * Must be rendered inside `WorkOSProvider` (useCurrentUser depends on useWorkOS).
 */
export function PlatformAuthBridge({ children }: { children: ReactNode }) {
  const { user, userId, isLoading } = useCurrentUser();

  return (
    <AuthProvider
      value={{
        user: user as AuthUser | null,
        userId,
        isLoading,
        signOut: () => {
          window.location.href = "/signout";
        },
      }}
    >
      {children}
    </AuthProvider>
  );
}
