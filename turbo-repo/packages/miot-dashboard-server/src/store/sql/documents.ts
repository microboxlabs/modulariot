/**
 * The "inline" document backend: configs live in the metadata database, so the
 * server persists with no second system to provision. The default.
 *
 * Stored as TEXT, not a JSON column type — PostgreSQL's would reorder keys, and
 * this package hands back the config it was handed.
 */

import type { DashboardDocumentStore } from "../../seams/documents";
import { placeholders, type SqlDriver } from "./driver";

export function createSqlDocumentStore(
  driver: SqlDriver,
): DashboardDocumentStore {
  return {
    async put(key, body) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `INSERT INTO dashboard_documents (document_key, body)
         VALUES (${p()}, ${p()})`,
        [key, new TextDecoder().decode(body)],
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
  };
}
