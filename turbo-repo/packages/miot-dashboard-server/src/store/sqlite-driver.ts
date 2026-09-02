/**
 * SQL driver over `node:sqlite` — built into the runtime, so the single-instance
 * store costs no dependency at all.
 *
 * Synchronous underneath an asynchronous interface, because SQLite is an
 * in-process library and there is nothing to wait on.
 */

import { createRequire } from "node:module";
import { SQLITE_DIALECT, type SqlDriver, type SqlValue } from "./sql/driver";

/** The slice of `node:sqlite` used here; `@types/node@20` does not describe it. */
interface StatementSync {
  all(...params: unknown[]): unknown[];
}

interface Database {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}

interface NodeSqlite {
  DatabaseSync: new (path: string) => Database;
}

/**
 * Loaded at runtime because a static import does not survive the bundler:
 * esbuild has no `sqlite` in its built-in table at any target, strips the
 * prefix, and emits `from "sqlite"` — which resolves to nothing and kills the
 * server at startup while every test still passes. `external` does not help.
 */
function loadSqlite(): NodeSqlite {
  try {
    return createRequire(import.meta.url)("node:sqlite") as NodeSqlite;
  } catch (error) {
    throw new Error(
      "The sqlite store needs the node:sqlite module, which arrived in Node " +
        `22.5. This process is ${process.version}. Upgrade Node, or configure ` +
        `a different store. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

export interface SqliteDriverOptions {
  /** File path, or `:memory:` for a database that dies with the process. */
  path: string;
  /** Milliseconds to wait on a database another process has locked. */
  busyTimeoutMs?: number;
}

export function createSqliteDriver(options: SqliteDriverOptions): SqlDriver {
  const { path, busyTimeoutMs = 5_000 } = options;
  const db = new (loadSqlite().DatabaseSync)(path);

  // Readers are never blocked by a writer. Ignored for :memory:.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`PRAGMA busy_timeout = ${Number(busyTimeoutMs)}`);

  const statements = new Map<string, StatementSync>();
  const prepared = (sql: string) => {
    const cached = statements.get(sql);
    if (cached !== undefined) return cached;
    const statement = db.prepare(sql);
    statements.set(sql, statement);
    return statement;
  };

  /** Nested transactions join the open one; SQLite rejects a second BEGIN. */
  let depth = 0;

  return {
    dialect: SQLITE_DIALECT,

    exec(sql: string) {
      db.exec(sql);
      return Promise.resolve();
    },

    all<T>(sql: string, params: readonly SqlValue[] = []) {
      return Promise.resolve(prepared(sql).all(...params) as T[]);
    },

    async transaction<T>(body: () => Promise<T>): Promise<T> {
      if (depth > 0) return body();
      // IMMEDIATE, not DEFERRED: two read-then-write transactions upgrading
      // their locks at once is the classic SQLITE_BUSY deadlock.
      db.exec("BEGIN IMMEDIATE");
      depth = 1;
      try {
        const result = await body();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      } finally {
        depth = 0;
      }
    },

    close() {
      statements.clear();
      db.close();
      return Promise.resolve();
    },
  };
}
