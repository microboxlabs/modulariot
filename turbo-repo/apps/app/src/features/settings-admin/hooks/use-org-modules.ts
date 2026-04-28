"use client";

import useSWR from "swr";
import { fetchOrgModules } from "../data/settings-admin-data-service";

/**
 * Enabled module codes for an org, via the Next.js proxy to Quarkus.
 * Returns null key when orgSlug is empty so SWR skips the fetch.
 */
export function useOrgModules(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<string[], Error>(
    orgSlug ? ["org-modules", orgSlug] : null,
    ([, slug]: [string, string]) => fetchOrgModules(slug),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    modules: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: mutate,
  };
}
