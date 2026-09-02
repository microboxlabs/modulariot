/**
 * Schema and migration runner. Written here rather than taken from a library
 * because the package has no runtime dependencies and this needs only an
 * ordered list and a table recording what has been applied.
 *
 * Add migrations by appending. Editing one that has shipped changes nothing on
 * databases that already applied it.
 */

import type { SqlDriver } from "./driver";

export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * `TEXT` throughout: host-defined ids have no fixed length, and SQLite has no
 * date type, so timestamps are ISO-8601 strings on both engines.
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
      // Listing a scope uses the primary key's first two columns.
      `CREATE TABLE dashboard_permissions (
         tenant_id    TEXT NOT NULL,
         scope_id     TEXT NOT NULL,
         slug         TEXT NOT NULL,
         authority_id TEXT NOT NULL,
         role         TEXT NOT NULL,
         PRIMARY KEY (tenant_id, scope_id, slug, authority_id)
       )`,
      // Used by the inline document backend; empty for other backends.
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
 * Apply every migration this build knows and the database has not recorded.
 * Each runs in one transaction with the row recording it, so an interrupted
 * upgrade leaves the database at a complete version.
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
