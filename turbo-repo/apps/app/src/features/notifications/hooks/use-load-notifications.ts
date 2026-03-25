"use client";

import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";
import useSWR from "swr";

export function useLoadNotifications() {
  const { data, error, isLoading } = useSWR<any, FetcherError>(
    `/app/api/notifications`,
    fetcher,
    {
      // refreshInterval: 5000, // 5 seconds in milliseconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    data,
    error,
    isLoading,
  };
}
