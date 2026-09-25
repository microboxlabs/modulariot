/**
 * The two places PostgreSQL needs a lock that SQLite does not.
 *
 * Both are races between processes, which no single-process test reproduces:
 * SQLite's write transaction excludes every other writer for its whole
 * length, so the code is correct there without them and stays correct there
 * if they are deleted. What can be checked is that the statements are issued,
 * and issued in the order that makes them work.
 */

import { describe, expect, it } from "vitest";
import { createSqlMetadataStore } from "./metadata";
import { runMigrations } from "./migrations";
import {
  POSTGRES_DIALECT,
  SQLITE_DIALECT,
  type SqlDialect,
  type SqlDriver,
  type SqlValue,
} from "./driver";

/** Records statements. Answers every SELECT with `rows`. */
function recordingDriver(
  dialect: SqlDialect,
  rows: unknown[] = [],
): {
  driver: SqlDriver;
  sql: string[];
} {
  const sql: string[] = [];
  const driver: SqlDriver = {
    dialect,
    exec(statement: string) {
      sql.push(statement);
      return Promise.resolve();
    },
    all<T>(statement: string, _params?: readonly SqlValue[]) {
      sql.push(statement);
      return Promise.resolve(rows as T[]);
    },
    transaction<T>(body: () => Promise<T>) {
      sql.push("BEGIN");
      return body();
    },
    close() {
      return Promise.resolve();
    },
  };
  return { driver, sql };
}

const ref = { tenantId: "acme", scopeId: "ops", slug: "fleet" };

/** One row, enough for `read` to report the dashboard exists. */
const existingRow = {
  slug: "fleet",
  name: "Fleet",
  revision: 1,
  document_key: "acme/1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by: "ana",
  created_by: null,
};

describe("the migration lock", () => {
  it("is taken before the applied versions are read, on PostgreSQL", async () => {
    // After the read, both processes have already seen an empty table, which
    // is the race. The order is the whole point of the lock.
    const { driver, sql } = recordingDriver(POSTGRES_DIALECT);
    await runMigrations(driver);

    const lock = sql.findIndex((s) => s.includes("pg_advisory_xact_lock"));
    const read = sql.findIndex((s) => s.includes("SELECT version"));
    const create = sql.findIndex((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS"),
    );
    expect(lock).toBeGreaterThan(-1);
    expect(sql.indexOf("BEGIN")).toBeLessThan(lock);
    expect(lock).toBeLessThan(read);
    expect(lock).toBeLessThan(create);
  });

  it("is not taken on SQLite, where BEGIN IMMEDIATE already serializes", async () => {
    const { driver, sql } = recordingDriver(SQLITE_DIALECT);
    await runMigrations(driver);
    expect(sql.some((s) => s.includes("advisory"))).toBe(false);
  });
});

describe("the row lock in setPermissions", () => {
  it("holds the dashboard row on PostgreSQL", async () => {
    // Without it the dashboard can be deleted between the existence check and
    // the inserts, and the foreign key turns a 404 into a driver error.
    const { driver, sql } = recordingDriver(POSTGRES_DIALECT, [existingRow]);
    await createSqlMetadataStore(driver).setPermissions(ref, []);
    expect(sql.some((s) => s.includes("FOR UPDATE"))).toBe(true);
  });

  it("does not lock the row on SQLite, which has no such syntax", async () => {
    const { driver, sql } = recordingDriver(SQLITE_DIALECT, [existingRow]);
    await createSqlMetadataStore(driver).setPermissions(ref, []);
    expect(sql.some((s) => s.includes("FOR UPDATE"))).toBe(false);
  });

  it("locks only the read that is about to write, not every read", async () => {
    // `read` is a plain read. Locking there would hold rows for the length of
    // every request that merely displays a dashboard, and the seam does not
    // offer the option.
    const { driver, sql } = recordingDriver(POSTGRES_DIALECT, [existingRow]);
    await createSqlMetadataStore(driver).read(ref);
    expect(sql.some((s) => s.includes("FOR UPDATE"))).toBe(false);
  });
});
