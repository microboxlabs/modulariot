import useSWR from "swr";
import type {
  Truck,
  TruckMetricView,
} from "@microboxlabs/miot-resource-client";

const fetcher = (url: string): Promise<Truck[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Truck[]>;
  });

const EMPTY: Truck[] = [];

export function useFleetTrucks(params?: {
  page?: number;
  size?: number;
  includeMetrics?: boolean;
  metricView?: TruckMetricView;
  metricFields?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.size !== undefined) query.set("size", String(params.size));
  if (params?.includeMetrics !== undefined) {
    query.set("includeMetrics", String(params.includeMetrics));
  }
  if (params?.metricView) query.set("metricView", params.metricView);
  if (params?.metricFields) query.set("metricFields", params.metricFields);
  const qs = query.toString();

  const url = qs ? `/app/api/fleet/trucks?${qs}` : `/app/api/fleet/trucks`;

  const { data, error, isLoading, mutate } = useSWR<Truck[]>(url, fetcher, {
    errorRetryCount: 2,
    dedupingInterval: 30000,
  });

  return { trucks: data ?? EMPTY, error, isLoading, mutate };
}
