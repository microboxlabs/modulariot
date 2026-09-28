import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import type { DashboardIdentity } from "./identity";
import type { ServerDashboardRef } from "./store";

export interface DashboardQueryResult {
  rows: Record<string, DashboardQueryValue>[];
}

export interface DashboardOperationRequest {
  identity: DashboardIdentity;
  ref: ServerDashboardRef;
  connectionId: string;
  operationId: string;
  parameters: Record<string, DashboardQueryValue>;
  signal: AbortSignal;
  limits: { maxRows: number; maxBytes: number };
}

/**
 * Trusted host adapter. Resolve an active, read-only operation under identity's
 * tenant, enforce its parameter schema and tenant predicates, and resolve its
 * credentials server-side. Dashboard editors cannot override those predicates.
 * Bound upstream reads and query costs BEFORE buffering, and honor cancellation.
 * Never return credentials, SQL or upstream errors in result rows.
 */
export interface DashboardOperationExecutor {
  execute(request: DashboardOperationRequest): Promise<DashboardQueryResult>;
}
