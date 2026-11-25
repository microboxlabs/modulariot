/**
 * Recents seam — the dashboards each member opened lately.
 *
 * Like a star, an open is personal: it changes nothing about the dashboard
 * and nobody else sees it. Only the latest open of each dashboard is kept,
 * so opening one again moves it to the front rather than adding a row.
 */

/** Opens belong to one scope of one tenant, like the dashboards opened. */
export interface RecentScope {
  tenantId: string;
  scopeId: string;
}

export interface RecentOpen {
  slug: string;
  /** ISO-8601, the member's latest open of it. */
  openedAt: string;
}

export interface DashboardRecentStore {
  /** `userId`'s latest opens in the scope, newest first, at most `limit`. */
  list(
    scope: RecentScope,
    userId: string,
    limit: number,
  ): Promise<RecentOpen[]>;
  /** Notes that `userId` opened `slug` now. */
  record(scope: RecentScope, userId: string, slug: string): Promise<void>;
  /**
   * Drops every member's open of a dashboard that was deleted, so one created
   * later under the same slug does not start out as recent.
   */
  forget(scope: RecentScope, slug: string): Promise<void>;
}
