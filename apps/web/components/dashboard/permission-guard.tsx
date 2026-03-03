"use client";

import { useWorkOS } from "@/lib/workos-context";
import type { ReactNode } from "react";

type OrgRole = "owner" | "admin" | "member" | "viewer";

interface PermissionGuardProps {
  children: ReactNode;
  requiredRoles: OrgRole[];
  fallback?: ReactNode;
}

const roleHierarchy: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function PermissionGuard({
  children,
  requiredRoles,
  fallback = null,
}: PermissionGuardProps) {
  const { currentOrg, isLoading } = useWorkOS();

  // While loading, don't render anything
  if (isLoading) {
    return null;
  }

  // No org selected
  if (!currentOrg) {
    return <>{fallback}</>;
  }

  const userRole = currentOrg.role as OrgRole;

  // Check if user has one of the required roles
  const hasPermission = requiredRoles.includes(userRole);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Helper component that checks for minimum role level
interface MinRoleGuardProps {
  children: ReactNode;
  minRole: OrgRole;
  fallback?: ReactNode;
}

export function MinRoleGuard({
  children,
  minRole,
  fallback = null,
}: MinRoleGuardProps) {
  const { currentOrg, isLoading } = useWorkOS();

  if (isLoading) {
    return null;
  }

  if (!currentOrg) {
    return <>{fallback}</>;
  }

  const userRole = currentOrg.role as OrgRole;
  const hasMinRole = roleHierarchy[userRole] >= roleHierarchy[minRole];

  if (!hasMinRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for checking permissions in code
export function usePermissions() {
  const { currentOrg, isLoading } = useWorkOS();

  const userRole = (currentOrg?.role as OrgRole) || "viewer";

  return {
    isLoading,
    role: userRole,
    canViewProjects: ["owner", "admin", "member", "viewer"].includes(userRole),
    canCreateProjects: ["owner", "admin", "member"].includes(userRole),
    canEditPages: ["owner", "admin", "member"].includes(userRole),
    canDeleteProjects: ["owner", "admin"].includes(userRole),
    canPublishDeploy: ["owner", "admin", "member"].includes(userRole),
    canInviteMembers: ["owner", "admin"].includes(userRole),
    canRemoveMembers: ["owner", "admin"].includes(userRole),
    canChangeRoles: ["owner", "admin"].includes(userRole),
    canUpdateOrgSettings: ["owner", "admin"].includes(userRole),
    canDeleteOrg: userRole === "owner",
  };
}
