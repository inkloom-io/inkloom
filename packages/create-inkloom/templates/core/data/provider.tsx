"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { createDataClient, type DataClient } from "./client";

const DataClientContext = createContext<DataClient | null>(null);

export interface DataProviderProps {
  children: ReactNode;
  baseUrl?: string;
}

export function DataProvider({ children, baseUrl }: DataProviderProps) {
  const client = useMemo(
    () =>
      createDataClient({
        baseUrl:
          baseUrl ??
          process.env.NEXT_PUBLIC_DATA_API_URL ??
          "/api/data",
      }),
    [baseUrl],
  );

  return (
    <DataClientContext.Provider value={client}>
      {children}
    </DataClientContext.Provider>
  );
}

export function useDataClient(): DataClient {
  const client = useContext(DataClientContext);
  if (!client) {
    throw new Error("useDataClient must be used within DataProvider.");
  }
  return client;
}
