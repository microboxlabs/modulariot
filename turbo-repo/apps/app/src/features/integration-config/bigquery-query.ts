import type { IntegrationConnection } from "./integration-config.types";

/**
 * A BigQuery connection is a CUSTOM_HTTP connection to the BigQuery API with a Google
 * service account credential. Its queries are written in Settings › Conexiones ›
 * BigQuery, with the dashboard library's query editor.
 */
export const BIGQUERY_BASE_URL = "https://bigquery.googleapis.com";

export function isBigQueryConnection(
  connection: Pick<IntegrationConnection, "baseUrl" | "templateId">
): boolean {
  return (
    connection.templateId === null &&
    connection.baseUrl.replace(/\/$/, "") === BIGQUERY_BASE_URL
  );
}
