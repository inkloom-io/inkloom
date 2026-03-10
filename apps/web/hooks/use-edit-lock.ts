"use client";

/**
 * Core-mode edit lock stub.
 *
 * In core mode (single-tenant), edit locking is not needed — only one user
 * edits at a time. This stub always returns canEdit: true.
 *
 * The platform version (platform/hooks/use-edit-lock.ts) provides real
 * soft-lock functionality for non-Ultimate plans.
 */

import type { Id } from "@/convex/_generated/dataModel";

export interface EditLockState {
  isLocked: boolean;
  lockedBy: string | null;
  canEdit: boolean;
  forceTake: () => void;
  expiresAt: number | null;
  isLoading: boolean;
}

export function useEditLock(_options: {
  pageId: Id<"pages"> | null;
  userId: Id<"users"> | null;
  userName: string;
  enabled: boolean;
}): EditLockState {
  return {
    isLocked: false,
    lockedBy: null,
    canEdit: true,
    forceTake: () => {},
    expiresAt: null,
    isLoading: false,
  };
}
