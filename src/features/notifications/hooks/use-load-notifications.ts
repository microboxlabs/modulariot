"use client";

import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";
import useSWR from "swr";

export function useLoadNotifications() {
  console.log("-------------------------------");

  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/notifications`,
    fetcher,
  );

  console.log("-------------------------------");

  return {
    data,
    error,
    isLoading,
  };
}
