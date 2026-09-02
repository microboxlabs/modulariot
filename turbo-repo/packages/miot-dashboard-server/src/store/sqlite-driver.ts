/**
 * `SqlDriver` implemented with `node:sqlite`, which is part of Node, so this
 * adds no dependency.
 *
 * The `node:sqlite` API is synchronous. The methods below return already
 * resolved promises to match the `SqlDriver` interface.
 */

import { createRequire } from "node:module";
import { SQLITE_DIALECT, type SqlDriver, type SqlValue } from "./sql/driver";

/** The parts of `node:sqlite` used here. `@types/node@20` has no types for it. */
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
 * Loaded with `createRequire` because a static import does not survive the
 * build. esbuild does not list `sqlite` among Node's built-in modules at any
 * target, so it removes the prefix and emits `from "sqlite"`, which fails to
 * resolve when the server starts. Marking it external does not prevent this,
 * and the tests do not detect it because they import the TypeScript source.
 */
function loadSqlite(): NodeSqlite {
  try {
    return createRequire(import.meta.url)("node:sqlite") as NodeSqlite;
  } catch (error) {
    throw new Error(
      "The sqlite store needs the node:sqlite module, which is available " +
        "without a flag from Node 22.13 (from 22.5 it required " +
        `--experimental-sqlite). This process is ${process.version}. Upgrade ` +
        "Node, or set MIOT_DASHBOARD_STORE=memory. " +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

export interface SqliteDriverOptions {
  /** File path, or `:memory:` for a database that dies with the process. */
  path: string;
  /** Milliseconds to wait when another process holds the database lock. */
  busyTimeoutMs?: number;
}

export function createSqliteDriver(options: SqliteDriverOptions): SqlDriver {
  const { path, busyTimeoutMs = 5_000 } = options;
  const db = new (loadSqlite().DatabaseSync)(path);

  // WAL lets reads continue during a write. Ignored for :memory:.
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

  /** A nested call joins the open transaction; SQLite rejects a second BEGIN. */
  let depth = 0;

  return {
    dialect: SQLITE_DIALECT,

    // `node:sqlite` throws synchronously. Both methods are declared to return
    // a promise, so a caller may reasonably attach `.catch` instead of
    // awaiting, and a synchronous throw would escape that.
    exec(sql: string) {
      try {
        db.exec(sql);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },

    all<T>(sql: string, params: readonly SqlValue[] = []) {
      try {
        return Promise.resolve(prepared(sql).all(...params) as T[]);
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },

    async transaction<T>(body: () => Promise<T>): Promise<T> {
      if (depth > 0) return body();
      // IMMEDIATE takes the write lock now. With DEFERRED, two transactions
      // that read and then write both try to upgrade, and one gets SQLITE_BUSY.
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
