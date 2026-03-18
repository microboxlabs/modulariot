import { useState, useEffect } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { buildPgrestFetch, parseRows } from "./pgrest-utils";

export function usePgrestRows(
  dataMode: string,
  pgrestFunctionName: string,
  pgrestHttpMethod: PgrestHttpMethod,
  pgrestParams: PgrestParam[],
  dataSourceId?: string,
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
      dataSourceId,
    );

    fetch(url, init)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setRows(parseRows(data));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataMode, pgrestFunctionName, pgrestParams, pgrestHttpMethod, dataSourceId]);

  return { rows, loading, fetchError };
}
