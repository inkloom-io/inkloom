"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { useDataClient } from "./provider";
import type { DataOperation } from "./operations";

export function useDataQuery<TInput, TOutput>(
  operation: DataOperation<"query", TInput, TOutput>,
  input: TInput | "skip",
  options?: Omit<
    UseQueryOptions<TOutput>,
    "queryFn" | "queryKey"
  >,
) {
  const client = useDataClient();
  const query = useQuery({
    ...options,
    queryKey: [operation.key, input],
    queryFn: () => operation.execute(client, input as TInput),
    enabled: input !== "skip" && options?.enabled !== false,
  });
  return query.data;
}

export function useDataMutation<TInput, TOutput>(
  operation: DataOperation<"mutation" | "action", TInput, TOutput>,
) {
  const client = useDataClient();
  const queryClient = useQueryClient();

  const mutation = useMutation<TOutput, Error, TInput>({
    mutationFn: (input) => operation.execute(client, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  return useCallback(
    (input: TInput) => mutation.mutateAsync(input),
    [mutation.mutateAsync],
  );
}

export const useDataAction = useDataMutation;
