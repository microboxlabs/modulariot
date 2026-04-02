import useSWR from "swr";
import type { Carrier } from "@microboxlabs/miot-resource-client";

const fetcher = (url: string): Promise<Carrier[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Carrier[]>;
  });

const EMPTY: Carrier[] = [];

export function useFleetCarriers(params?: { page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();

  const { data, error, isLoading, mutate } = useSWR<Carrier[]>(
    `/app/api/fleet/carriers${qs ? `?${qs}` : ""}`,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30000 }
  );

  return { carriers: data ?? EMPTY, error, isLoading, mutate };
}
