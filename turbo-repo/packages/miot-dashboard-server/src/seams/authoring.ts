/**
 * Authoring seam: what a host provides so authors can write, test and save
 * queries. The host lists the sources, hands out a short-lived token for one,
 * and stores the saved queries. Everything that talks to BigQuery is in
 * `createQueryWorkbench`.
 */

import type {
  QueryColumn,
  QueryPlan,
  QueryPlanDraft,
  QuerySource,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type { DashboardIdentity } from "./identity";

export interface AuthoringRequest {
  identity: DashboardIdentity;
  scopeId: string;
  signal: AbortSignal;
}

/** A draft plus the result columns of its last successful estimate. */
export type QueryPlanContent = QueryPlanDraft & { columns?: QueryColumn[] };

/**
 * Saved queries of one source. Names are unique per source, ignoring case:
 * `create` and `update` throw a CONFLICT `DashboardServerError` for a taken
 * name, and `update` also for a stale `expectedRevision`.
 */
export interface QueryPlanStore {
  list(tenantId: string, sourceId: string): Promise<QueryPlan[]>;
  get(
    tenantId: string,
    sourceId: string,
    planId: string,
  ): Promise<QueryPlan | null>;
  create(
    tenantId: string,
    sourceId: string,
    content: QueryPlanContent,
    actor: string,
  ): Promise<QueryPlan>;
  update(
    tenantId: string,
    sourceId: string,
    planId: string,
    content: QueryPlanContent,
    expectedRevision: string,
    actor: string,
  ): Promise<QueryPlan>;
  /** No error when the plan does not exist. */
  remove(tenantId: string, sourceId: string, planId: string): Promise<void>;
}

export interface SourceAccess {
  accessToken: string;
  /** ISO-8601. */
  expiresAt?: string;
}

export interface QueryAuthoring {
  /** Sources this caller may write queries against in the tenant. */
  listSources(request: AuthoringRequest): Promise<QuerySource[]>;
  /**
   * A short-lived token to read metadata, estimate and preview on the source.
   * Null when the source does not exist in the tenant or the caller may not
   * use it.
   */
  accessFor(
    request: AuthoringRequest & { sourceId: string },
  ): Promise<SourceAccess | null>;
  plans: QueryPlanStore;
}
