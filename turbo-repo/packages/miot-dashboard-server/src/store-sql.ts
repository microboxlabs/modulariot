/**
 * @microboxlabs/miot-dashboard-server/store-sql — persistence. A separate entry
 * because it is the only part of the package that requires a database.
 *
 * `createCompositeStore` combines a `DashboardMetadataStore` with a
 * `DashboardDocumentStore` to produce a `ServerDashboardStore`.
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
