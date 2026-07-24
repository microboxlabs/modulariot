/**
 * PgREST types & param helpers — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  PgrestParam,
  PgrestHttpMethod,
  PgrestParamItem,
} from "@microboxlabs/miot-dashboard-ui";

export {
  humanizeKey,
  toPgrestParamItems,
  fromPgrestParamItems,
  EMPTY_PGREST_PARAMS,
} from "@microboxlabs/miot-dashboard-ui";
