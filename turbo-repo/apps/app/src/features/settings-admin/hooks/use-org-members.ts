"use client";

import useSWR from "swr";
import { fetchOrgMembers } from "../data/settings-admin-data-service";
import type { OrgMember } from "../types";

/**
 * Members of an Alfresco group, via the Next.js proxy to Quarkus.
 * Returns null key when orgSlug is empty so SWR skips the fetch
 * (used when nothing is selected yet).
 */
export function useOrgMembers(orgSlug: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OrgMember[]>(
    orgSlug ? ["org-members", orgSlug] : null,
    ([, slug]: [string, string]) => fetchOrgMembers(slug),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    members: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
