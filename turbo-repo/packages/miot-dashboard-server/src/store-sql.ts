/**
 * @microboxlabs/miot-dashboard-server/store-sql — persistence.
 *
 * Its own entry because it is the only part of the package that assumes a
 * database. A host with its own `ServerDashboardStore` never loads this, and
 * a host that wants ours does not have to take the HTTP layer or the listener
 * with it.
 *
 * The shape, in one paragraph: a `DashboardMetadataStore` (a database, holding
 * one row per dashboard plus its permissions) and a `DashboardDocumentStore`
 * (write-once bytes) are combined by `createCompositeStore` into the seam the
 * rest of the package talks to. All optimistic concurrency lives in the
 * metadata half, which is what lets the document half be anything that can
 * store a key and give it back.
 */

export { createCompositeStore } from "./store/composite";
export type { CompositeStoreOptions } from "./store/composite";

export { createSqlMetadataStore } from "./store/sql/metadata";
export { createSqlDocumentStore } from "./store/sql/documents";
export { MIGRATIONS, runMigrations } from "./store/sql/migrations";
export type { Migration } from "./store/sql/migrations";
export {
  placeholders,
  POSTGRES_DIALECT,
  SQLITE_DIALECT,
} from "./store/sql/driver";
export type { SqlDialect, SqlDriver, SqlValue } from "./store/sql/driver";

export { createSqliteDriver } from "./store/sqlite-driver";
export type { SqliteDriverOptions } from "./store/sqlite-driver";
export { openSqliteStore, SQLITE_MEMORY } from "./store/sqlite";
export type { OpenedStore, SqliteStoreOptions } from "./store/sqlite";

export type {
  DashboardMetadataRow,
  DashboardMetadataStore,
  DashboardMetadataWrite,
} from "./seams/metadata";
export type { DashboardDocumentStore } from "./seams/documents";
