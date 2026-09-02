/**
 * Schema and migration runner.
 *
 * Hand-rolled rather than a framework, for the same reason the package has no
 * runtime dependencies: a migration runner is an ordered list, a table of what
 * has been applied, and a transaction. A library that a host mounts should not
 * drag a migration tool into that host's dependency tree to get those three
 * things.
 *
 * Rules for adding one: **append, never edit.** A shipped migration has run
 * somewhere, so changing it changes nothing on the databases that matter and
 * silently diverges the ones created later.
 */

import type { SqlDriver } from "./driver";

export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * Types are the portable subset on purpose. `TEXT` rather than `VARCHAR(n)`
 * because host-defined ids have no length we get to pick; timestamps as
 * ISO-8601 `TEXT` because SQLite has no date type and a string round-trips
 * identically through both engines.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "dashboards, permissions and documents",
    statements: [
      `CREATE TABLE dashboards (
         tenant_id    TEXT NOT NULL,
         scope_id     TEXT NOT NULL,
         slug         TEXT NOT NULL,
         name         TEXT NOT NULL,
         revision     INTEGER NOT NULL,
         document_key TEXT NOT NULL,
         updated_at   TEXT NOT NULL,
         updated_by   TEXT NOT NULL,
         created_by   TEXT,
         PRIMARY KEY (tenant_id, scope_id, slug)
       )`,
      // No separate index for listing a scope: the primary key's leading
      // columns are (tenant_id, scope_id), which both engines can scan.
      `CREATE TABLE dashboard_permissions (
         tenant_id    TEXT NOT NULL,
         scope_id     TEXT NOT NULL,
         slug         TEXT NOT NULL,
         authority_id TEXT NOT NULL,
         role         TEXT NOT NULL,
         PRIMARY KEY (tenant_id, scope_id, slug, authority_id)
       )`,
      // The "inline" document backend. Present in the schema even when
      // documents live in a bucket, because an empty table costs nothing and
      // a database that can be switched to inline without a migration is
      // easier to operate than one that cannot.
      `CREATE TABLE dashboard_documents (
         document_key TEXT PRIMARY KEY,
         body         TEXT NOT NULL
       )`,
    ],
  },
];

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
   version    INTEGER PRIMARY KEY,
   name       TEXT NOT NULL,
   applied_at TEXT NOT NULL
 )`;

/**
 * Apply every migration this build knows and the database has not seen.
 *
 * Each runs in its own transaction with its bookkeeping row, so an
 * interrupted upgrade leaves the database at a version that actually exists
 * rather than half of one.
 */
export async function runMigrations(
  driver: SqlDriver,
  now: () => Date = () => new Date(),
): Promise<number[]> {
  await driver.exec(MIGRATIONS_TABLE);
  const applied = await driver.all<{ version: number }>(
    "SELECT version FROM schema_migrations",
  );
  const seen = new Set(applied.map((row) => row.version));
  const ran: number[] = [];

  for (const migration of MIGRATIONS) {
    if (seen.has(migration.version)) continue;
    await driver.transaction(async () => {
      for (const statement of migration.statements) {
        await driver.exec(statement);
      }
      const p = driver.dialect;
      await driver.all(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (${p.placeholder(1)}, ${p.placeholder(2)}, ${p.placeholder(3)})`,
        [migration.version, migration.name, now().toISOString()],
      );
    });
    ran.push(migration.version);
  }

  return ran;
}
