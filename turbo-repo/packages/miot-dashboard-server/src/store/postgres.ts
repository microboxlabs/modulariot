/**
 * Opens a PostgreSQL pool, applies migrations, and returns a persistent
 * `ServerDashboardStore`.
 */

import {
  createPostgresDriver,
  type PostgresDriverOptions,
} from "./postgres-driver";
import {
  openSqlStore,
  type OpenedStore,
  type SqlStoreOptions,
} from "./sql/open";

export type { OpenedStore };

export interface PostgresStoreOptions
  extends SqlStoreOptions, PostgresDriverOptions {}

export function openPostgresStore(
  options: PostgresStoreOptions,
): Promise<OpenedStore> {
  return openSqlStore(createPostgresDriver(options), options);
}
