/**
 * The narrow SQL surface this package needs, and the dialect differences it
 * has to survive.
 *
 * Deliberately tiny. The metadata store's entire concurrency mechanism is two
 * statements — `INSERT … ON CONFLICT DO NOTHING RETURNING *` and
 * `UPDATE … WHERE revision = ? RETURNING *` — and both SQLite and PostgreSQL
 * support them, so one set of SQL serves both engines and the only thing the
 * dialect has to explain is how a parameter is spelled.
 *
 * Keeping the driver an interface rather than a dependency is what lets the
 * SQLite implementation use a Node built-in while a PostgreSQL one loads an
 * optional peer dependency, without the store above caring which it got.
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

  /**
   * Run `body` inside a transaction, rolling back if it throws.
   *
   * Needed for exactly one operation — replacing a dashboard's permission
   * assignments, which is a delete followed by inserts and must not be
   * observable half-done.
   */
  transaction<T>(body: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/**
 * A placeholder generator for building one statement.
 *
 * Parameters are numbered in the order they are written, so the returned
 * function must be called in the same order the values are pushed. Building
 * the SQL this way rather than writing `?` everywhere and rewriting it for
 * Postgres avoids a string rewrite that could not tell a parameter marker from
 * a question mark inside a literal.
 */
export function placeholders(dialect: SqlDialect): () => string {
  let index = 0;
  return () => dialect.placeholder(++index);
}
