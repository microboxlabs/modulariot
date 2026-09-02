/**
 * Schema and migration runner. Hand-rolled because the package ships no runtime
 * dependencies, and this is an ordered list plus a bookkeeping table.
 *
 * Append, never edit: a shipped migration has already run somewhere.
 */

import type { SqlDriver } from "./driver";

export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * `TEXT` throughout: host-defined ids have no length we get to pick, and SQLite
 * has no date type, so ISO-8601 strings round-trip identically on both engines.
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
      // Listing a scope rides the primary key's leading columns.
      `CREATE TABLE dashboard_permissions (
         tenant_id    TEXT NOT NULL,
         scope_id     TEXT NOT NULL,
         slug         TEXT NOT NULL,
         authority_id TEXT NOT NULL,
         role         TEXT NOT NULL,
         PRIMARY KEY (tenant_id, scope_id, slug, authority_id)
       )`,
      // The "inline" document backend; empty when documents live elsewhere.
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
 * Apply every migration this build knows and the database has not seen. Each
 * runs in its own transaction with its bookkeeping row, so an interrupted
 * upgrade leaves a version that exists rather than half of one.
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
