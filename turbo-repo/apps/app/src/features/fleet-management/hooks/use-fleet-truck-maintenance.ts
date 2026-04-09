import useSWR from "swr";
import type { TruckMaintenanceDetail } from "../types/truck-maintenance.types";

type FetcherResult = {
  maintenance: TruckMaintenanceDetail | null;
  notFound: boolean;
};

const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 404) {
    return { maintenance: null, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const maintenance = (await response.json()) as TruckMaintenanceDetail;
  return { maintenance, notFound: false };
};

/**
 * Fetch the per-truck maintenance detail by numeric `mbl_id` or license
 * plate. Resolves 404 into a `notFound: true` result so the UI can render
 * an empty state instead of a generic error — common case since only ~13%
 * of the fleet has odometer data in prod today.
 *
 * Dedup window is longer than the truck list (60s vs 30s) because
 * maintenance data changes on the slow pipeline cadence, not realtime.
 */
export function useFleetTruckMaintenance(
  idOrPlate: string | null | undefined
) {
  const url = idOrPlate
    ? `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}/maintenance`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 60000 }
  );

  return {
    maintenance: data?.maintenance ?? null,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
