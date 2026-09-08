"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { ApiError } from "@/features/settings-admin/data/json-client";
import {
  fetchM2MClients,
  type M2MClientDirectory,
} from "./auth0-clients-data-service";

const M2M_CLIENTS_KEY = "auth0-m2m-clients";
const DEBOUNCE_MS = 250;

/**
 * The Auth0 client directory for a typeahead.
 *
 * The query is debounced rather than fetched per keystroke: the upstream call
 * reaches another service, and a picker that fires on every character turns one
 * user decision into a dozen round trips. `keepPreviousData` holds the last list
 * on screen while the new one loads, so the options don't blink to empty
 * mid-type.
 *
 * @param enabled false while the field is closed — a dropdown nobody opened
 *                should not be querying anything.
 */
export function useM2MClients(
  orgSlug: string | null,
  query: string,
  enabled: boolean
) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, error, isLoading } = useSWR<M2MClientDirectory, ApiError>(
    orgSlug && enabled ? [M2M_CLIENTS_KEY, orgSlug, debounced] : null,
    () => fetchM2MClients(orgSlug as string, debounced),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 5_000,
    }
  );

  return {
    clients: data?.data ?? [],
    isLoading,
    error,
  };
}
