import { useState, useEffect, useRef, useCallback } from "react";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { buildPgrestFetch, parseRows } from "./pgrest-utils";
import { usePollingInterval } from "../../hooks/use-polling-interval";

export function usePgrestRows(
  dataMode: string,
  pgrestFunctionName: string,
  pgrestHttpMethod: PgrestHttpMethod,
  pgrestParams: PgrestParam[],
  dataSourceId?: string,
  refreshIntervalMs: number = 0,
): {
  rows: Record<string, string>[];
  loading: boolean;
  fetchError: string | null;
} {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Keep latest args in a ref so the polling callback reads fresh values
  const argsRef = useRef({ dataMode, pgrestFunctionName, pgrestHttpMethod, pgrestParams, dataSourceId });
  argsRef.current = { dataMode, pgrestFunctionName, pgrestHttpMethod, pgrestParams, dataSourceId };

  // Abort controller ref for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback((silent: boolean) => {
    const { dataMode: dm, pgrestFunctionName: fn, pgrestHttpMethod: method, pgrestParams: params, dataSourceId: dsId } = argsRef.current;

    if (dm !== "pgrest" || !fn) {
      if (!silent) {
        setRows([]);
        setLoading(false);
        setFetchError(null);
      }
      return;
    }

    // If the previous in-flight request was non-silent (visible), clear its
    // loading state before aborting — the aborted request's finally block will
    // not run setLoading(false) because the signal is already aborted.
    const prev = abortRef.current;
    prev?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setFetchError(null);
    }

    const { url, init } = buildPgrestFetch(fn, method, params, dsId);

    fetch(url, { ...init, signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!controller.signal.aborted) {
          setRows(parseRows(data, { singleObjectFallback: true }));
          setFetchError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (!silent) setRows([]);
        setFetchError(err instanceof Error ? err.message : "Failed to fetch");
        setLoading(false);
      });
  }, []);

  // Initial + dependency-driven fetch (shows loading spinner)
  useEffect(() => {
    doFetch(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [dataMode, pgrestFunctionName, pgrestParams, pgrestHttpMethod, dataSourceId, doFetch]);

  // Polling (silent — no loading spinner flash)
  const pollFetch = useCallback(() => doFetch(true), [doFetch]);
  usePollingInterval(pollFetch, refreshIntervalMs);

  return { rows, loading, fetchError };
}
