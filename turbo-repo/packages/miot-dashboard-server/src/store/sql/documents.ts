/**
 * The `inline` document backend: configs are stored in the metadata database,
 * so no second system is required. This is the default.
 *
 * The body is a TEXT column rather than a JSON type. PostgreSQL's `jsonb`
 * reorders keys, and this package returns the config exactly as given.
 */

import type {
  DashboardDocumentStore,
  StoredDocument,
} from "../../seams/documents";
import { placeholders, type SqlDriver } from "./driver";

export interface SqlDocumentStoreOptions {
  /** Clock for `created_at`, so tests can fix it. */
  now?: () => Date;
}

export function createSqlDocumentStore(
  driver: SqlDriver,
  options: SqlDocumentStoreOptions = {},
): DashboardDocumentStore {
  const { now = () => new Date() } = options;

  return {
    async put(key, body) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `INSERT INTO dashboard_documents (document_key, body, created_at)
         VALUES (${p()}, ${p()}, ${p()})`,
        [key, new TextDecoder().decode(body), now().toISOString()],
      );
    },

    async get(key) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<{ body: string }>(
        `SELECT body FROM dashboard_documents WHERE document_key = ${p()}`,
        [key],
      );
      const row = rows[0];
      return row === undefined ? null : new TextEncoder().encode(row.body);
    },

    async delete(key) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `DELETE FROM dashboard_documents WHERE document_key = ${p()}`,
        [key],
      );
    },

    async *list(): AsyncIterable<StoredDocument> {
      const rows = await driver.all<{
        document_key: string;
        created_at: string | null;
      }>("SELECT document_key, created_at FROM dashboard_documents");
      for (const row of rows) {
        yield {
          key: row.document_key,
          createdAt: row.created_at === null ? null : new Date(row.created_at),
        };
      }
    },
  };
}
