/**
 * Persistence seam — where dashboard configs actually live.
 *
 * Deliberately different from the UI package's client-side `DashboardStore`:
 * every reference here carries a `tenantId`, and implementations are expected
 * to treat it as part of the primary key rather than a filter applied on the
 * way out. The client seam has no tenant because it never needed one; this one
 * cannot function without it.
 *
 * Reference implementations differ per host — Alfresco nodes for apps/app, a
 * Postgres table for TotalCheck. Neither shape reaches this package.
 */

import type { DashboardRole } from "../access/roles";

/** Fully qualified address of one dashboard. `tenantId` is never optional. */
export interface ServerDashboardRef {
  tenantId: string;
  /** Host-defined container within the tenant: site, folder, workspace. */
  scopeId: string;
  slug: string;
}

export interface DashboardSummary {
  slug: string;
  name: string;
}

/**
 * A stored dashboard. `config` is deliberately `unknown`: it is validated
 * against the versioned JSON Schema at the service layer, so the store is
 * never the thing deciding whether a config is well-formed.
 */
export interface DashboardRecord {
  config: unknown;
  /** ISO-8601. */
  updatedAt: string;
  updatedBy: string;
  /**
   * Who first saved it, when the host tracks that. The default capability
   * policy uses it for one rule only: a Contributor may edit dashboards they
   * created. A store that cannot supply it simply leaves it out, and
   * Contributors then get view-only access.
   */
  createdBy?: string;
  /**
   * Monotonic revision counter, used for optimistic concurrency. Two editors
   * — or an editor and the AI generation skill — must not silently overwrite
   * one another; a stale revision is refused with a conflict.
   */
  revision: number;
}

export interface SaveOptions {
  /**
   * Revision the caller believes it is replacing. Omit only for a first
   * write. A mismatch is a conflict, not a merge.
   */
  expectedRevision?: number;
  updatedBy: string;
}

export interface PermissionAssignment {
  /** Host-defined user or group identifier. */
  authorityId: string;
  role: DashboardRole;
}

export interface ServerDashboardStore {
  load(ref: ServerDashboardRef): Promise<DashboardRecord | null>;
  save(
    ref: ServerDashboardRef,
    config: unknown,
    options: SaveOptions,
  ): Promise<DashboardRecord>;
  list(tenantId: string, scopeId: string): Promise<DashboardSummary[]>;
  remove(ref: ServerDashboardRef): Promise<void>;

  /**
   * The assignments that apply to this dashboard, as the host resolves them.
   * Inherited assignments belong in the answer if the host's model has
   * inheritance; the capability policy treats the list as complete. Only
   * called for dashboards that exist.
   */
  getPermissions(ref: ServerDashboardRef): Promise<PermissionAssignment[]>;
  setPermissions(
    ref: ServerDashboardRef,
    assignments: PermissionAssignment[],
  ): Promise<void>;
}
