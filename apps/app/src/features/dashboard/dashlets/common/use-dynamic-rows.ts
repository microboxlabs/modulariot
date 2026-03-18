import { useState, useEffect } from "react";
import { parseRows } from "./pgrest-utils";

export function useDynamicRows(
  dataMode: string,
  apiUrl: string
): {
  rows: Record<string, string>[];
  loading: boolean;
  fetchError: string | null;
} {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (dataMode !== "dynamic" || !apiUrl) {
      setRows([]);
      setLoading(false);
      setFetchError(null);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setFetchError(null);

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setRows(parseRows(data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataMode, apiUrl]);

  return { rows, loading, fetchError };
}
