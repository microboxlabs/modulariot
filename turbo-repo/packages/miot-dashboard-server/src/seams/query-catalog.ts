import type { DashboardIdentity } from "./identity";
import type { ServerDashboardRef } from "./store";

export interface DashboardCatalogOperation {
  id: string;
  label: string;
  /** Public result column names only, not execution or credential schemas. */
  schema?: string[];
}
export interface DashboardCatalogConnection {
  id: string;
  label: string;
  operations: DashboardCatalogOperation[];
}
/** Trusted host projection: only active, read-only operations authorized for this caller. */
export interface DashboardQueryCatalog {
  list(request: {
    identity: DashboardIdentity;
    ref: ServerDashboardRef;
    signal: AbortSignal;
  }): Promise<DashboardCatalogConnection[]>;
}
