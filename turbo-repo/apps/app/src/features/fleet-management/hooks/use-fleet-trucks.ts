import { useState, useEffect } from "react";
import type { Truck } from "@microboxlabs/miot-resource-client";

const PAGE_SIZE = 100;

const EMPTY: Truck[] = [];

export function useFleetTrucks() {
  const [trucks, setTrucks] = useState<Truck[]>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setIsLoading(true);
      setError(null);
      const all: Truck[] = [];
      let page = 0;
      try {
        while (true) {
          const r = await fetch(
            `/app/api/fleet/trucks?page=${page}&size=${PAGE_SIZE}`
          );
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const batch = (await r.json()) as Truck[];
          all.push(...batch);
          if (batch.length < PAGE_SIZE) break;
          page++;
        }
        if (!cancelled) setTrucks(all);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  return { trucks, isLoading, error, mutate: undefined };
}
