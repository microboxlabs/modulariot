/**
 * `SqlDriver` over a `pg` connection pool.
 *
 * `pg` is an optional peer dependency, imported only when this driver is
 * built, so a host that mounts the library with its own store never installs
 * it. Its types are declared here rather than imported for the same reason:
 * `import type … from "pg"` fails to compile wherever the package is absent,
 * which is every consumer that does not use PostgreSQL.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { POSTGRES_DIALECT, type SqlDriver, type SqlValue } from "./sql/driver";

/** The part of `pg` used here. */
interface PoolClient {
  query(
    text: string,
    values?: readonly SqlValue[],
  ): Promise<{ rows: unknown[] }>;
  release(destroy?: boolean): void;
}

interface Pool {
  on(event: "error", listener: (error: Error) => void): void;
  connect(): Promise<PoolClient>;
  query(
    text: string,
    values?: readonly SqlValue[],
  ): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

interface PoolOptions {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  application_name?: string;
}

type PgModule = { Pool: new (options: PoolOptions) => Pool };

/**
 * Loaded with `createRequire` rather than `import type` plus `await import`,
 * the way `jose` is: those types only resolve where the package is installed,
 * and this one deliberately is not. `pg` is CommonJS, so require is its native
 * form anyway, and it keeps the specifier a literal for the import guard.
 */
function loadPg(): PgModule {
  try {
    const loaded = createRequire(import.meta.url)("pg") as PgModule & {
      default?: PgModule;
    };
    return loaded.Pool !== undefined ? loaded : (loaded.default as PgModule);
  } catch (error) {
    throw new Error(
      'The postgres store needs the "pg" package, which is an optional peer ' +
        "dependency and is not installed. Run `npm install pg`, or set " +
        "MIOT_DASHBOARD_STORE to sqlite or memory. " +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

export interface PostgresDriverOptions {
  /** `postgres://user:password@host:5432/database`. */
  url: string;
  /** Maximum pooled connections. */
  poolSize?: number;
  /** Milliseconds to wait for a connection before giving up. */
  connectionTimeoutMs?: number;
  /** Milliseconds an unused connection is kept. */
  idleTimeoutMs?: number;
  /** Shown in `pg_stat_activity`, so a DBA can tell whose connection it is. */
  applicationName?: string;
  /** Reports a lost idle connection. The pool discards it and reconnects on demand. */
  onPoolError?: (error: Error) => void;
  /** Injected by the tests. Defaults to the real `pg` pool. */
  poolImpl?: Pool;
}

/**
 * Opens the pool. Nothing connects until the first statement, so this does not
 * fail on a database that is not up yet; `runMigrations` is what proves the
 * connection at startup.
 */
export function createPostgresDriver(
  options: PostgresDriverOptions,
): SqlDriver {
  const pool =
    options.poolImpl ??
    new (loadPg().Pool)({
      connectionString: options.url,
      max: options.poolSize ?? 10,
      connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
      idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
      application_name: options.applicationName ?? "miot-dashboard-server",
    });

  // pg removes broken idle clients before emitting this event. Without a
  // listener, Node treats the event as uncaught and terminates the host.
  pool.on("error", (error) => options.onPoolError?.(error));

  /**
   * The client a transaction checked out, readable only from the calls that
   * transaction made. Every statement in a transaction has to run on the same
   * connection — issued on another pooled client it would land outside the
   * transaction, and be committed even when the transaction rolls back.
   */
  const current = new AsyncLocalStorage<PoolClient>();

  const run = async <T>(
    sql: string,
    params: readonly SqlValue[],
  ): Promise<T[]> => {
    const client = current.getStore();
    // Outside a transaction, `pool.query` checks a connection out and returns
    // it, which is what a pool is for.
    const result =
      client !== undefined
        ? await client.query(sql, params)
        : await pool.query(sql, params);
    return result.rows as T[];
  };

  return {
    dialect: POSTGRES_DIALECT,

    async exec(sql: string) {
      await run(sql, []);
    },

    all<T>(sql: string, params: readonly SqlValue[] = []) {
      return run<T>(sql, params);
    },

    async transaction<T>(body: () => Promise<T>): Promise<T> {
      // Already inside one this driver opened: join it. A second BEGIN on the
      // same connection is a warning and a no-op in PostgreSQL, and the inner
      // COMMIT would then end the outer transaction early.
      const joined = current.getStore();
      if (joined !== undefined) return body();

      const client = await pool.connect();
      let failed = false;
      try {
        await client.query("BEGIN");
        try {
          const result = await current.run(client, body);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          // A ROLLBACK that itself throws means the connection is no longer
          // usable. Swallowing it here would lose the original error, which is
          // the one that says what went wrong, so it only marks the client as
          // one to destroy rather than return to the pool.
          await client.query("ROLLBACK").catch(() => {
            failed = true;
          });
          throw error;
        }
      } finally {
        client.release(failed);
      }
    },

    close() {
      return pool.end();
    },
  };
}
