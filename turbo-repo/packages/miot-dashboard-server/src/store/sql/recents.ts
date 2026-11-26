/**
 * `DashboardRecentStore` in SQL, for SQLite and PostgreSQL. One row per
 * member and opened dashboard, holding the latest open.
 */

import type { DashboardRecentStore } from "../../seams/recents";
import { placeholders, type SqlDriver } from "./driver";

export interface SqlRecentStoreOptions {
  now?: () => Date;
}

export function createSqlRecentStore(
  driver: SqlDriver,
  options: SqlRecentStoreOptions = {},
): DashboardRecentStore {
  const now = options.now ?? (() => new Date());

  return {
    async list(scope, userId, limit) {
      const p = placeholders(driver.dialect);
      return driver.all<{ slug: string; openedAt: string }>(
        `SELECT slug, opened_at AS "openedAt" FROM dashboard_opens
          WHERE tenant_id = ${p()} AND scope_id = ${p()} AND user_id = ${p()}
          ORDER BY opened_at DESC, slug
          LIMIT ${p()}`,
        [scope.tenantId, scope.scopeId, userId, limit],
      );
    },
    async record(scope, userId, slug) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `INSERT INTO dashboard_opens
           (tenant_id, scope_id, user_id, slug, opened_at)
         VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()})
         ON CONFLICT (tenant_id, scope_id, user_id, slug)
         DO UPDATE SET opened_at = excluded.opened_at
         WHERE excluded.opened_at > dashboard_opens.opened_at`,
        [scope.tenantId, scope.scopeId, userId, slug, now().toISOString()],
      );
    },
    async forget(scope, slug) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `DELETE FROM dashboard_opens
          WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}`,
        [scope.tenantId, scope.scopeId, slug],
      );
    },
  };
}
