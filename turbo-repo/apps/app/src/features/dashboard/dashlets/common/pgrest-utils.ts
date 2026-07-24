/**
 * PgREST request/response utilities — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export {
  parseRows,
  buildDataSourceParams,
  buildPgrestFetch,
} from "@microboxlabs/miot-dashboard-ui";
