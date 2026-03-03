"use client";

import type { ReactNode } from "react";
import { useWorkOS } from "@/lib/workos-context";
import { AppContextProvider } from "@/hooks/use-app-context";

/**
 * Platform-mode app context bridge.
 *
 * Reads from `useWorkOS()` and provides tenant/org info via `AppContext`
 * so that `useAppContext()` works in platform mode.
 *
 * Must be rendered inside `WorkOSProvider`.
 */
export function PlatformAppContextBridge({
  children,
}: {
  children: ReactNode;
}) {
  const { currentOrg, isLoading } = useWorkOS();

  return (
    <AppContextProvider
      value={{
        tenantId: currentOrg?.id ?? "",
        orgName: currentOrg?.name ?? "",
        isMultiTenant: true,
        isLoading,
      }}
    >
      {children}
    </AppContextProvider>
  );
}
