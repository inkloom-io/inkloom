"use client";

/**
 * Core-mode stubs for ActiveUsers and ConnectionStatus.
 *
 * Same exported interface as the platform active-users.tsx but renders
 * nothing.  Real-time collaboration requires PartyKit infrastructure
 * that is only available in platform mode.
 *
 * During the Phase 1 restructure, core/apps/web/ will use this file as
 * its `components/editor/active-users.tsx`.
 */

import type { CollaborationUser } from "@/lib/collaboration-utils";

interface ActiveUsersProps {
  users: CollaborationUser[];
  currentUser?: CollaborationUser | null;
  maxVisible?: number;
}

/** Stub: renders nothing in core mode. */
export function ActiveUsers(_props: ActiveUsersProps) {
  return null;
}

interface ConnectionStatusProps {
  connected: boolean;
  synced: boolean;
  error?: string | null;
  onDisableCollaboration?: () => void;
  onEnableCollaboration?: () => void;
  collaborationDisabled?: boolean;
}

/** Stub: renders nothing in core mode. */
export function ConnectionStatus(_props: ConnectionStatusProps) {
  return null;
}
