/**
 * `DashboardStarStore` in SQL, for SQLite and PostgreSQL. One row per member
 * and starred dashboard; the primary key makes starring twice a no-op.
 */

import type { DashboardStarStore, StarScope } from "../../seams/stars";
import { placeholders, type SqlDriver } from "./driver";

export interface SqlStarStoreOptions {
  now?: () => Date;
}

export function createSqlStarStore(
  driver: SqlDriver,
  options: SqlStarStoreOptions = {},
): DashboardStarStore {
  const now = options.now ?? (() => new Date());

  async function remove(
    scope: StarScope,
    slug: string,
    userId: string | null,
  ): Promise<void> {
    // Postgres numbers its placeholders, so the text is built in the same
    // order as the parameters.
    const p = placeholders(driver.dialect);
    let sql = `DELETE FROM dashboard_stars
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}`;
    const params = [scope.tenantId, scope.scopeId, slug];
    if (userId !== null) {
      sql += ` AND user_id = ${p()}`;
      params.push(userId);
    }
    await driver.all(sql, params);
  }

  return {
    async list(scope, userId) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<{ slug: string }>(
        `SELECT slug FROM dashboard_stars
          WHERE tenant_id = ${p()} AND scope_id = ${p()} AND user_id = ${p()}
          ORDER BY slug`,
        [scope.tenantId, scope.scopeId, userId],
      );
      return rows.map((row) => row.slug);
    },
    async star(scope, userId, slug) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `INSERT INTO dashboard_stars
           (tenant_id, scope_id, user_id, slug, created_at)
         VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()})
         ON CONFLICT (tenant_id, scope_id, user_id, slug) DO NOTHING`,
        [scope.tenantId, scope.scopeId, userId, slug, now().toISOString()],
      );
    },
    unstar: (scope, userId, slug) => remove(scope, slug, userId),
    forget: (scope, slug) => remove(scope, slug, null),
  };
}
