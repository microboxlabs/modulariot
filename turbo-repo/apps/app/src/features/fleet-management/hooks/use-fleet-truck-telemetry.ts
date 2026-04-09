import useSWR from "swr";
import type { TruckTelemetryDetail } from "../types/truck-telemetry.types";

type FetcherResult = {
  telemetry: TruckTelemetryDetail | null;
  notFound: boolean;
};

const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 404) {
    return { telemetry: null, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const telemetry = (await response.json()) as TruckTelemetryDetail;
  return { telemetry, notFound: false };
};

/**
 * Fetch the per-truck telemetry / signal detail by numeric `mbl_id` or
 * license plate. Resolves 404 into a `notFound: true` result so the UI
 * can render an empty state instead of an error — common case since
 * ~89% of the fleet is SIN_SENAL today.
 *
 * Dedup window matches the maintenance hook (60s) because signal data
 * still rolls up on a slow cadence via the 7-day aggregation function.
 */
export function useFleetTruckTelemetry(
  idOrPlate: string | null | undefined
) {
  const url = idOrPlate
    ? `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}/telemetry`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 60000 }
  );

  return {
    telemetry: data?.telemetry ?? null,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
