"use client";

/**
 * Core-mode current user stub.
 *
 * In platform mode, this returns the WorkOS user. In core mode,
 * we delegate to useAuth() which returns the local user.
 *
 * This stub exists so that files like auth-bridge.tsx can import it
 * without breaking the core build. In practice, core mode uses
 * CoreContextProvider instead of PlatformAuthBridge, so this hook
 * is only called in platform mode.
 */

import { useAuth } from "./use-auth";

export function useCurrentUser() {
  const { user, userId, isLoading } = useAuth();
  return {
    user,
    userId,
    workosUser: user
      ? {
          id: user.workosUserId || "local",
          firstName: user.name?.split(" ")[0],
          lastName: user.name?.split(" ").slice(1).join(" "),
          email: user.email,
          profilePictureUrl: user.avatarUrl,
        }
      : null,
    isLoading,
  };
}
