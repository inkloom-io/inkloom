"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

function EnsureLocalUser({ children }: { children: React.ReactNode }) {
  const ensureUser = useMutation(api.users.ensureLocalUser);

  useEffect(() => {
    void ensureUser();
  }, [ensureUser]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ConvexProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <EnsureLocalUser>{children}</EnsureLocalUser>
        </QueryClientProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
