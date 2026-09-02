/**
 * The "inline" document backend: configs live in the metadata database.
 *
 * This is the default, and the reason is operational rather than technical. A
 * dashboard config is a few kilobytes; requiring a second system to hold it
 * would mean nobody can run this server without provisioning one. Inline makes
 * `npx @microboxlabs/miot-dashboard-server` persist with no dependency and no
 * configuration, and leaves a bucket as a choice for deployments that want one.
 *
 * The body is stored as TEXT rather than a JSON column type: SQLite has no
 * such type, PostgreSQL's would reformat and reorder what it was given, and
 * this package promises to hand back the config it was handed.
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
