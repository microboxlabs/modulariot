import useSWR from "swr";
import type { TruckUsageDetail } from "../types/truck-usage.types";

type FetcherResult = {
  usage: TruckUsageDetail | null;
  notFound: boolean;
};

const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 404) {
    return { usage: null, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const usage = (await response.json()) as TruckUsageDetail;
  return { usage, notFound: false };
};

/**
 * Fetch the per-truck fleet-usage detail by numeric `mbl_id` or license
 * plate. 404 resolves to `notFound: true` so the UI can render an empty
 * state instead of an error — common case since ~10% of the fleet has
 * no upstream distance signal at all.
 *
 * Dedup window matches the other detail hooks (60s): the backing
 * `fn_dx_uso_flota_detalle` function reads from a day-grain fact table
 * that only refreshes once per day.
 */
export function useFleetTruckUsage(idOrPlate: string | null | undefined) {
  const url = idOrPlate
    ? `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}/usage`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 60000 }
  );

  return {
    usage: data?.usage ?? null,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
