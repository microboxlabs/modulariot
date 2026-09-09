/**
 * The SQL operations this package uses.
 *
 * SQLite and PostgreSQL accept the same statements, so one implementation
 * serves both and `SqlDialect` covers only parameter syntax.
 */

/** Bound parameter values. Configs are stored as text. */
export type SqlValue = string | number | null;

export interface SqlDialect {
  /** How parameter `n` (1-based) is written: `?` for SQLite, `$n` for Postgres. */
  placeholder(n: number): string;
  /**
   * Appended to a SELECT whose row the same transaction is about to change,
   * so a concurrent transaction waits rather than reading the row this one is
   * midway through replacing.
   *
   * Empty for SQLite, where the write transaction already excludes every
   * other writer for its whole length, so there is no window to hold.
   */
  readonly rowLock: string;
  /**
   * Run first inside the migration transaction to serialize the runner across
   * connections, or null where the transaction already does that.
   *
   * Null for SQLite: `BEGIN IMMEDIATE` takes the database's single write lock
   * before the runner reads which versions are applied, so a second process
   * waits at BEGIN. PostgreSQL readers never block, so without this two
   * processes starting together both read an empty `schema_migrations` and
   * both run `CREATE TABLE`.
   */
  readonly migrationLock: string | null;
}

export const SQLITE_DIALECT: SqlDialect = {
  placeholder: () => "?",
  rowLock: "",
  migrationLock: null,
};

/**
 * The advisory lock key. Two 32-bit halves rather than one 64-bit number so
 * the value is legible in `pg_locks`: the first is "miot" read as ASCII, the
 * second numbers the lock. The key is global to the database, so it has to be
 * one no other application would pick by accident — a small number like 1
 * would be.
 */
const MIGRATION_LOCK_KEY = "1835626356, 1";

export const POSTGRES_DIALECT: SqlDialect = {
  placeholder: (n) => `$${n}`,
  rowLock: " FOR UPDATE",
  // `_xact_` so the lock is released by COMMIT or ROLLBACK rather than needing
  // a matching unlock, which a crash mid-migration would never run.
  migrationLock: `SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`,
};

export interface SqlDriver {
  readonly dialect: SqlDialect;

  /** Run a statement with no parameters and no result. Used by migrations. */
  exec(sql: string): Promise<void>;

  /** Run a parameterized statement and return its rows. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** Run `body` in a transaction, rolling back if it throws. */
  transaction<T>(body: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/**
 * Numbers the placeholders of one statement in call order, so call it in the
 * same order the parameters are bound. Written this way rather than emitting
 * `?` and rewriting it for PostgreSQL, which cannot tell a parameter marker
 * from a question mark inside a string literal.
 */
export function placeholders(dialect: SqlDialect): () => string {
  let index = 0;
  return () => dialect.placeholder(++index);
}
