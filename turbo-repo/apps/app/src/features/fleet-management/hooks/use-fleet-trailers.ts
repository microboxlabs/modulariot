import useSWR from "swr";
import type { Trailer } from "@microboxlabs/miot-resource-client";

const fetcher = (url: string): Promise<Trailer[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Trailer[]>;
  });

const EMPTY: Trailer[] = [];

export function useFleetTrailers(params?: { page?: number; size?: number }) {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();

  const { data, error, isLoading, mutate } = useSWR<Trailer[]>(
    `/api/fleet/trailers${qs ? `?${qs}` : ""}`,
    fetcher,
    { errorRetryCount: 2, dedupingInterval: 30000 }
  );

  return { trailers: data ?? EMPTY, error, isLoading, mutate };
}
