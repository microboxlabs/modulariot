/**
 * Seam D — datasources.
 *
 * The package never talks to a datasource backend directly and never sees
 * credentials — it calls an injected `DataSourceProvider`. Auth is resolved
 * per-request via async `getToken()` (never static headers: embedded/kiosk
 * dashboards outlive JWT expiry).
 *
 * P1 declares the listing surface; P2 extends the contract with the query
 * path when `use-dashlet-pgrest`/`use-data-provider` are rewritten against it.
 * The BigQuery datasource (server-side) plugs in behind this same seam.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/** Host-agnostic datasource descriptor (the UI needs no more than this). */
export interface DashboardDataSource {
  id: string;
  name: string;
  /** Backend kind, e.g. "POSTGREST" | "BIGQUERY" (open set by design). */
  type: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Draft query contract (P2, aligned with contract/openapi.yaml). `path` is
 * the backend-side query identifier (for PgREST: "rpc/fn_name" or a table);
 * BigQuery implementations resolve it server-side. Implemented by hosts from
 * P5 on, when the dashlet data hooks are rewired against this seam.
 */
export interface DataSourceQueryRequest {
  /** Target datasource; omitted = the scope's default source. */
  dataSourceId?: string;
  path: string;
  method: "GET" | "POST";
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface DataSourceQueryResult {
  rows: Record<string, unknown>[];
  /** Backend-specific payload for dashlets that need more than rows. */
  raw?: unknown;
}

export interface DataSourceProvider {
  /** List the datasources available to the current dashboard scope. */
  listDataSources(): Promise<DashboardDataSource[]>;
  /** Execute a query (optional until P5 rewires the dashlet data hooks). */
  query?(request: DataSourceQueryRequest): Promise<DataSourceQueryResult>;
}

/** Config for HTTP-backed implementations (package default ships in P2). */
export interface DashboardHttpConfig {
  baseUrl: string;
  /** Custom fetch (host proxies, testing). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Resolved per request — never a static header. */
  getToken?: () => Promise<string | null>;
}

const DataSourceContext = createContext<DataSourceProvider | null>(null);

export interface DashboardDataSourcesProviderProps {
  provider: DataSourceProvider;
  children: ReactNode;
}

export function DashboardDataSourcesProvider({
  provider,
  children,
}: DashboardDataSourcesProviderProps) {
  return (
    <DataSourceContext.Provider value={provider}>
      {children}
    </DataSourceContext.Provider>
  );
}

/** Required seam: throws with wiring guidance when absent. */
export function useDashboardDataSources(): DataSourceProvider {
  const provider = useContext(DataSourceContext);
  if (!provider) {
    throw new Error(
      "useDashboardDataSources: no DataSourceProvider wired — wrap the dashboard in <DashboardDataSourcesProvider> (or <MiotDashboardProvider dataSources={...}>)"
    );
  }
  return provider;
}
