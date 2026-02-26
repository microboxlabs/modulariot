import { useState, useEffect } from "react";

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
        if (cancelled) return;
        let parsed: Record<string, string>[];
        if (Array.isArray(data)) {
          parsed = data as Record<string, string>[];
        } else if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          const candidate = obj.rows ?? obj.data ?? obj.results;
          parsed = Array.isArray(candidate)
            ? (candidate as Record<string, string>[])
            : [];
        } else {
          parsed = [];
        }
        setRows(parsed);
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
