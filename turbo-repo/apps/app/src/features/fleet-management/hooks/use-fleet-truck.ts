import useSWR from "swr";
import type { Truck, TruckMetricView } from "@microboxlabs/miot-resource-client";

type FetcherResult = { truck: Truck | null; notFound: boolean };

const fetcher = async (url: string): Promise<FetcherResult> => {
  const response = await fetch(url);
  if (response.status === 404) {
    return { truck: null, notFound: true };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const truck = (await response.json()) as Truck;
  return { truck, notFound: false };
};

/**
 * Fetch a single truck by numeric `mbl_id` or license plate. The `/api/fleet/
 * trucks/[id]` endpoint accepts either form and handles the pgrest / resource
 * client branching server-side.
 *
 * Returns `notFound: true` when the backend responds 404, so callers can
 * render a graceful not-found state instead of a generic error.
 */
export function useFleetTruck(
  idOrPlate: string | null | undefined,
  params?: {
    includeMetrics?: boolean;
    metricView?: TruckMetricView;
    metricFields?: string;
  }
) {
  const query = new URLSearchParams();
  if (params?.includeMetrics !== undefined) {
    query.set("includeMetrics", String(params.includeMetrics));
  }
  if (params?.metricView) query.set("metricView", params.metricView);
  if (params?.metricFields) query.set("metricFields", params.metricFields);
  const qs = query.toString();
  const suffix = qs ? `?${qs}` : "";

  const url = idOrPlate
    ? `/app/api/fleet/trucks/${encodeURIComponent(idOrPlate)}${suffix}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<FetcherResult>(
    url,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30000 }
  );

  return {
    truck: data?.truck ?? null,
    notFound: data?.notFound ?? false,
    error,
    isLoading,
    mutate,
  };
}
