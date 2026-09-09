/**
 * Opens a SQLite database, applies migrations, and returns a persistent
 * `ServerDashboardStore`.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  openSqlStore,
  type OpenedStore,
  type SqlStoreOptions,
} from "./sql/open";
import { createSqliteDriver } from "./sqlite-driver";

export type { OpenedStore };

/** In-memory database, discarded when the process exits. */
export const SQLITE_MEMORY = ":memory:";

export interface SqliteStoreOptions extends SqlStoreOptions {
  /** File path, or `SQLITE_MEMORY`. Parent directories are created. */
  path: string;
}

export function openSqliteStore(
  options: SqliteStoreOptions,
): Promise<OpenedStore> {
  const { path } = options;
  if (path !== SQLITE_MEMORY) {
    // SQLite's error for a missing parent is only "unable to open database file".
    mkdirSync(dirname(path), { recursive: true });
  }
  return openSqlStore(createSqliteDriver({ path }), options);
}
