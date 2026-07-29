"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DataProvider, useDataClient } from "@/data/provider";
import { api } from "@/data/operations";

function EnsureLocalUser({ children }: { children: React.ReactNode }) {
  const dataClient = useDataClient();
  useEffect(() => {
    void api.users.ensureLocalUser.execute(dataClient, undefined);
  }, [dataClient]);
  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <DataProvider>
        <EnsureLocalUser>{children}</EnsureLocalUser>
      </DataProvider>
    </QueryClientProvider>
  );
}
