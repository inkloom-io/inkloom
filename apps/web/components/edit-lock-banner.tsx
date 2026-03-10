"use client";

/**
 * Core-mode edit lock banner stub.
 *
 * In core mode (single-tenant), edit locking is not needed.
 * This stub renders nothing. The platform version provides the real banner.
 */

interface EditLockBannerProps {
  lockedBy: string;
  expiresAt: number;
  onForceTake: () => void;
}

export function EditLockBanner(_props: EditLockBannerProps) {
  return null;
}
