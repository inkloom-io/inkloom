"use client";

/**
 * Core-mode collaboration stub.
 *
 * Real-time collaboration (PartyKit/Yjs) is a platform-only feature.
 * In core mode, the editor always runs in solo mode.
 */

import type { CollaborationUser } from "@/lib/collaboration-utils";

interface CollaborationState {
  connected: boolean;
  synced: boolean;
  error: string | null;
  activeUsers: CollaborationUser[];
  currentUser: CollaborationUser | null;
}

interface UseCollaborationOpts {
  pageId: unknown;
  enabled: boolean;
}

export function useCollaboration(_opts: UseCollaborationOpts): CollaborationState {
  return {
    connected: false,
    synced: false,
    error: null,
    activeUsers: [],
    currentUser: null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useBlockNoteCollaboration(_collaboration: CollaborationState): any {
  return undefined;
}
