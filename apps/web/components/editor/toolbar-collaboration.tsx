"use client";

import { useAppContext } from "@/hooks/use-app-context";
import { ActiveUsers, ConnectionStatus } from "./active-users";
import type { CollaborationUser } from "@/lib/collaboration-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@inkloom/ui/tooltip";
import { useTranslations } from "next-intl";

export interface CollaborationState {
  connected: boolean;
  synced: boolean;
  error: string | null;
  activeUsers: CollaborationUser[];
  currentUser: CollaborationUser | null;
}

export interface ToolbarCollaborationProps {
  collaboration?: CollaborationState;
  collaborationGated?: boolean;
  onDisableCollaboration?: () => void;
  onEnableCollaboration?: () => void;
  collaborationDisabled?: boolean;
}

/**
 * Collaboration indicators for the editor toolbar.
 *
 * Renders ConnectionStatus + ActiveUsers in platform mode (multi-tenant).
 * Renders nothing in core mode (single-tenant) since real-time
 * collaboration requires PartyKit infrastructure.
 */
export function ToolbarCollaboration({
  collaboration,
  collaborationGated,
  onDisableCollaboration,
  onEnableCollaboration,
  collaborationDisabled,
}: ToolbarCollaborationProps) {
  const { isMultiTenant } = useAppContext();
  const t = useTranslations("editor.toolbar");

  // Core mode: no real-time collaboration
  if (!isMultiTenant) {
    return null;
  }

  // Active collaboration
  if (collaboration && !collaborationGated) {
    return (
      <>
        <ConnectionStatus
          connected={collaboration.connected}
          synced={collaboration.synced}
          error={collaboration.error}
          onDisableCollaboration={onDisableCollaboration}
          onEnableCollaboration={onEnableCollaboration}
          collaborationDisabled={collaborationDisabled}
        />
        <div className="w-2" />
        <ActiveUsers
          users={collaboration.activeUsers}
          currentUser={collaboration.currentUser}
          maxVisible={3}
        />
        <div className="mx-1.5 h-5 w-px bg-[var(--glass-border)]" />
      </>
    );
  }

  // Gated collaboration (upgrade prompt)
  if (collaborationGated) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-dim)] cursor-default opacity-50">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--text-dim)" }}
              />
              {t("collaboration")}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("collaborationUpgrade")}</p>
          </TooltipContent>
        </Tooltip>
        <div className="mx-1.5 h-5 w-px bg-[var(--glass-border)]" />
      </>
    );
  }

  return null;
}
