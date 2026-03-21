"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { TooltipProvider } from "@inkloom/ui/tooltip";
import { CoreContextProvider } from "@/components/core-context-provider";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL environment variable. " +
      "Set it in your .env.local or deployment environment."
  );
}
const convex = new ConvexReactClient(convexUrl);

/**
 * Core-mode provider tree.
 *
 * Mirrors `Providers` from `providers.tsx` but replaces:
 * - `WorkOSProvider` → removed (no auth in core mode)
 * - `PlatformAuthBridge` → `CoreContextProvider` (local user via Convex)
 * - `PlatformAppContextBridge` → removed (useAppContext falls back to core defaults)
 *
 * Provider stack:
 *   ThemeProvider > ConvexProvider > QueryClientProvider > CoreContextProvider > TooltipProvider
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
      <ConvexProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <CoreContextProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CoreContextProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
