import useSWR from "swr";
import type { PgrestFleetSpecialViewRow } from "@/app/api/utils/pgrest-client";

const fetcher = (url: string): Promise<PgrestFleetSpecialViewRow[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<PgrestFleetSpecialViewRow[]>;
  });

const EMPTY: PgrestFleetSpecialViewRow[] = [];

/**
 * Loads the active "Vista Especial" cards for the current tenant from the
 * pgrest-backed `/api/fleet/special-views` route. Tenant filtering is handled
 * server-side via the table's RLS policy on the JWT azp claim.
 *
 * Returns the raw pgrest rows — the caller is expected to map them with
 * `pgrestRowToSpecialView` after picking the active locale.
 */
export function useSpecialViews() {
  const { data, error, isLoading, mutate } = useSWR<PgrestFleetSpecialViewRow[]>(
    "/app/api/fleet/special-views",
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 60_000 }
  );

  return {
    rows: data ?? EMPTY,
    error,
    isLoading,
    mutate,
  };
}
