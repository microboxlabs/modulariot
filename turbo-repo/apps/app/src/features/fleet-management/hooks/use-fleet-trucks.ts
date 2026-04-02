import useSWR from "swr";
import type { Truck } from "@microboxlabs/miot-resource-client";

const fetcher = (url: string): Promise<Truck[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Truck[]>;
  });

const EMPTY: Truck[] = [];

export function useFleetTrucks(params?: { page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();

  const { data, error, isLoading, mutate } = useSWR<Truck[]>(
    `/app/api/fleet/trucks${qs ? `?${qs}` : ""}`,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30000 }
  );

  return { trucks: data ?? EMPTY, error, isLoading, mutate };
}
