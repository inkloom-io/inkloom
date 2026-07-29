"use client";

import { createContext, useContext } from "react";

/**
 * Mode-agnostic authentication hook.
 *
 * Wraps the auth adapter for client-side use. Consumer code uses `useAuth()`
 * instead of importing platform-specific hooks like `useCurrentUser()`.
 *
 * The context is populated by:
 * - Platform mode: `PlatformAuthBridge` (wraps `useCurrentUser()`)
 * - Core mode: `CoreAuthBridge` (wraps `ensureLocalUser`)
 */

/** The data-service user shape exposed by useAuth(). */
export interface AuthUser {
  id?: string;
  createdAt?: number;
  /** Temporary legacy aliases retained while downstream plugins migrate. */
  _id?: string;
  _creationTime?: number;
  email: string;
  name?: string;
  avatarUrl?: string;
  workosUserId?: string;
  [key: string]: unknown;
}

export interface AuthState {
  /** The current user document, or null if not yet loaded. */
  user: AuthUser | null;
  /** Stable D1 user ID. */
  userId: string | undefined;
  /** True while the user is being fetched/synced. */
  isLoading: boolean;
  /** Sign out the current user (navigates to /signout in platform, no-op in core). */
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Get the current authenticated user in a mode-agnostic way.
 *
 * Must be used within a provider tree that includes either
 * `PlatformAuthBridge` or `CoreAuthBridge`.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
        "Wrap your app with PlatformAuthBridge or CoreAuthBridge."
    );
  }
  return ctx;
}

export { AuthContext };
export const AuthProvider = AuthContext.Provider;
