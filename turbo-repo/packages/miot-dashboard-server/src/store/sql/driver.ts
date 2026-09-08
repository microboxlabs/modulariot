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
}

export const SQLITE_DIALECT: SqlDialect = {
  placeholder: () => "?",
};

export const POSTGRES_DIALECT: SqlDialect = {
  placeholder: (n) => `$${n}`,
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
