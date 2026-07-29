"use client";

import { QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { TooltipProvider } from "@inkloom/ui/tooltip";
import { CoreContextProvider } from "@/components/core-context-provider";
import { DataProvider } from "@/data/provider";

/**
 * Core-mode provider tree.
 *
 * Mirrors `Providers` from `providers.tsx` but replaces:
 * - `WorkOSProvider` → removed (no auth in core mode)
 * - `PlatformAuthBridge` → `CoreContextProvider` (local user via D1)
 * - `PlatformAppContextBridge` → removed (useAppContext falls back to core defaults)
 *
 * Provider stack:
 *   ThemeProvider > QueryClientProvider > DataProvider > CoreContextProvider > TooltipProvider
 */
export function CoreProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <CoreContextProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CoreContextProvider>
        </DataProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
