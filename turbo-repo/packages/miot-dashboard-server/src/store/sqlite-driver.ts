/**
 * SQL driver over `node:sqlite`.
 *
 * SQLite is the single-instance answer, and on Node 24 it costs **no
 * dependency at all** — the module is built into the runtime. That is what
 * makes a persistent standalone server something anyone can run immediately,
 * rather than something that waits on a database being provisioned.
 *
 * `node:sqlite` is a synchronous API behind an asynchronous interface. That is
 * not a compromise: SQLite is an in-process library, so there is nothing to
 * wait on, and pretending otherwise would only add a microtask per statement.
 */

import { createRequire } from "node:module";
import { SQLITE_DIALECT, type SqlDriver, type SqlValue } from "./sql/driver";

/**
 * The slice of `node:sqlite` this file uses, declared rather than imported.
 *
 * `@types/node@20` does not describe the module, and hand-writing only what is
 * called keeps the chance of describing the runtime wrongly to a minimum —
 * TypeScript believes whatever is written here.
 */
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
 * Load `node:sqlite` at runtime rather than importing it.
 *
 * Not a style choice, and not optionality — the module is built into the
 * runtime. **A static `import … from "node:sqlite"` does not survive the
 * bundler**: esbuild does not have `sqlite` in its table of Node built-ins at
 * any target we can set, so it strips the `node:` prefix and emits
 * `from "sqlite"`, which resolves to nothing and kills the server at startup.
 * Marking it external does not help either; the rewrite happens regardless.
 *
 * The whole test suite passed against that build, because tests import the
 * source. Only running `dist/bin.js` found it.
 *
 * `createRequire` is the same escape hatch `server/docs.ts` uses to locate an
 * optional dependency, and the import guard watches `require()` specifiers for
 * exactly that reason.
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
  /**
   * How long to wait on a locked database before giving up, in milliseconds.
   * Applies to other processes holding the file; a single server does not
   * contend with itself.
   */
  busyTimeoutMs?: number;
}

export function createSqliteDriver(options: SqliteDriverOptions): SqlDriver {
  const { path, busyTimeoutMs = 5_000 } = options;
  const db = new (loadSqlite().DatabaseSync)(path);

  // Write-ahead logging so a reader is never blocked by a writer. Ignored for
  // an in-memory database, which is why it is not conditional.
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

  /**
   * Depth rather than a boolean, so a transaction nested inside another joins
   * it instead of issuing a second `BEGIN` — which SQLite rejects outright.
   */
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
      // IMMEDIATE, not the default DEFERRED: a transaction that starts by
      // reading and later writes has to upgrade its lock, and two of those
      // upgrading at once is the classic SQLITE_BUSY deadlock. Taking the
      // write lock up front trades a little concurrency for never deadlocking.
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
