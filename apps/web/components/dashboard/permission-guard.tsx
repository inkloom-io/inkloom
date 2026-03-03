"use client";

import { useAppContext } from "@/hooks/use-app-context";
import type { ReactNode } from "react";

type OrgRole = "owner" | "admin" | "member" | "viewer";

interface PermissionGuardProps {
  children: ReactNode;
  requiredRoles: OrgRole[];
  fallback?: ReactNode;
}

/**
 * Permission guard component.
 *
 * In core mode (single-tenant), the local user always has full admin access.
 * Children always render. In platform mode, this is overridden with the
 * WorkOS-backed version that checks org roles.
 */
export function PermissionGuard({
  children,
}: PermissionGuardProps) {
  return <>{children}</>;
}

interface MinRoleGuardProps {
  children: ReactNode;
  minRole: OrgRole;
  fallback?: ReactNode;
}

export function MinRoleGuard({
  children,
}: MinRoleGuardProps) {
  return <>{children}</>;
}

/**
 * Permissions hook.
 *
 * In core mode, the local user has all permissions.
 */
export function usePermissions() {
  const { isLoading } = useAppContext();

  return {
    isLoading,
    role: "admin" as OrgRole,
    canViewProjects: true,
    canCreateProjects: true,
    canEditPages: true,
    canDeleteProjects: true,
    canPublishDeploy: true,
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canUpdateOrgSettings: true,
    canDeleteOrg: true,
  };
}
