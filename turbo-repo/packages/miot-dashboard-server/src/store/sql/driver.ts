/**
 * The narrow SQL surface this package needs.
 *
 * SQLite and PostgreSQL both support the two statements the metadata store
 * relies on, so one set of SQL serves both and the dialect only has to explain
 * how a parameter is spelled.
 */

/** Values this package binds. Configs are stored as text, never as numbers. */
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

  /** Run statements for their effect. Used by the migration runner only. */
  exec(sql: string): Promise<void>;

  /** Run one parameterized statement and return whatever it yielded. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** Run `body` in a transaction, rolling back if it throws. */
  transaction<T>(body: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/**
 * Placeholders for one statement, numbered in the order they are written — so
 * call it in the order the values are bound. Built this way rather than
 * rewriting `?` for Postgres, which could not tell a marker from a literal.
 */
export function placeholders(dialect: SqlDialect): () => string {
  let index = 0;
  return () => dialect.placeholder(++index);
}
