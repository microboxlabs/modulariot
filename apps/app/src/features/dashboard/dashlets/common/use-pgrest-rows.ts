import { useState, useEffect } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { buildPgrestFetch, parseRows } from "./pgrest-utils";

export function usePgrestRows(
  dataMode: string,
  pgrestFunctionName: string,
  pgrestHttpMethod: PgrestHttpMethod,
  pgrestParams: PgrestParam[],
): {
  rows: Record<string, string>[];
  loading: boolean;
  fetchError: string | null;
} {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (dataMode !== "pgrest" || !pgrestFunctionName) {
      setRows([]);
      setLoading(false);
      setFetchError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    const { url, init } = buildPgrestFetch(
      pgrestFunctionName,
      pgrestHttpMethod,
      pgrestParams,
    );

    fetch(url, init)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setRows(parseRows(data, { singleObjectFallback: true }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRows([]);
          setFetchError(err instanceof Error ? err.message : "Failed to fetch");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataMode, pgrestFunctionName, pgrestParams, pgrestHttpMethod]);

  return { rows, loading, fetchError };
}
