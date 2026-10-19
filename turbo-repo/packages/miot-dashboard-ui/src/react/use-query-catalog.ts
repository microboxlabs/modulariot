"use client";
import { useEffect, useState } from "react";
import type { createDashboardClient, QueryCatalogConnection } from "../client";
import { DashboardApiError } from "../client/error";

type Client = Pick<ReturnType<typeof createDashboardClient>, "key" | "queryCatalog">;
export interface QueryCatalogOptions {
  readonly client: Client;
  readonly slug: string;
  readonly sessionKey: string;
  /** Enable only when the host's current server capabilities permit editing. */
  readonly enabled?: boolean;
}
const EMPTY: QueryCatalogConnection[] = [];
/** No shared cache: a catalog belongs to exactly one resource and authentication generation. */
export function useQueryCatalog({ client, slug, sessionKey, enabled = false }: QueryCatalogOptions) {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([sessionKey, client.key(slug), enabled, revision]);
  const [state, setState] = useState<{ key: string; client: Client; connections: QueryCatalogConnection[]; error: number | null }>();
  const active = enabled && !!sessionKey;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return client.queryCatalog(slug, controller.signal);
    }).then((connections) => {
      if (!controller.signal.aborted) setState({ key, client, connections, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ key, client, connections: EMPTY, error: error instanceof DashboardApiError ? error.status : 502 });
    });
    return () => controller.abort();
  }, [active, client, slug, key]);
  const current = active && state?.key === key && state.client === client ? state : undefined;
  return {
    connections: current?.connections ?? EMPTY,
    error: current?.error ?? null,
    loading: active && !current,
    loaded: !!current && current.error === null,
    editorKey: key,
    reload: () => setRevision((value) => value + 1),
  };
}
