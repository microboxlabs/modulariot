/**
 * Where dashboards are read from on the way in, once.
 *
 * A seam rather than a reader, for the same reason the store is one: the
 * legacy configs live in whatever the host used before this package, and
 * naming that here would put the host's storage model inside a package whose
 * whole claim is that it has none. `scripts/guard-imports.mjs` enforces it.
 *
 * The import is a migration, so the source is read once and never written.
 */

import type { PermissionAssignment, ServerDashboardRef } from "../seams/store";

export interface LegacyDashboard {
  ref: ServerDashboardRef;
  /**
   * Whatever the host had stored. Not trusted to be a current config — what
   * it turns out to be is the import's first question about it.
   */
  config: unknown;
  /**
   * Carried across when the host knows it. `createdBy` is not decoration: the
   * default capability policy lets a Contributor edit dashboards they
   * created, so losing it here quietly demotes people.
   */
  createdBy?: string;
  updatedBy?: string;
  /**
   * Carried across verbatim. An import that dropped these would publish every
   * restricted dashboard to the whole scope, which is the one mistake a
   * one-way migration cannot be walked back from.
   */
  assignments?: readonly PermissionAssignment[];
}

export interface LegacyDashboardSource {
  /**
   * Every dashboard to import. Async so a host can page a remote system
   * rather than holding the estate in memory.
   */
  read(): AsyncIterable<LegacyDashboard>;
}

/** `tenant/scope/slug`, for logs and results. */
export function refLabel(ref: ServerDashboardRef): string {
  return `${ref.tenantId}/${ref.scopeId}/${ref.slug}`;
}
