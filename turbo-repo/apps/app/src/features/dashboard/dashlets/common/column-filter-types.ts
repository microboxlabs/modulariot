/**
 * Column filter vocabulary — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  FilterOperator,
  ColumnFilter,
} from "@microboxlabs/miot-dashboard-ui";

export { getDefaultOperator } from "@microboxlabs/miot-dashboard-ui";
