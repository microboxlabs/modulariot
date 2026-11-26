/**
 * Star seam — the dashboards each member has starred.
 *
 * A star is personal: it changes nothing about the dashboard, nobody else
 * sees it, and it needs no edit rights. Starring and unstarring are
 * idempotent, so a double click or a retried request is harmless.
 */

/** Stars belong to one scope of one tenant, like the dashboards they mark. */
export interface StarScope {
  tenantId: string;
  scopeId: string;
}

export interface DashboardStarStore {
  /** The slugs `userId` has starred in the scope. */
  list(scope: StarScope, userId: string): Promise<string[]>;
  star(scope: StarScope, userId: string, slug: string): Promise<void>;
  unstar(scope: StarScope, userId: string, slug: string): Promise<void>;
  /**
   * Drops every member's star on a dashboard that was deleted, so one created
   * later under the same slug does not start out starred.
   */
  forget(scope: StarScope, slug: string): Promise<void>;
}
