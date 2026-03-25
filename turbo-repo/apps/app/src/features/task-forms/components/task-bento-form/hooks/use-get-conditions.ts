"use client";

import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";
import useSWR from "swr";

export default function useGetConditions(tripId: string) {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/task/conditions?tripId=${tripId}`,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}
