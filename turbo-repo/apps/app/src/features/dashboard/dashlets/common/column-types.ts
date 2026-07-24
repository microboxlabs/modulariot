/**
 * Column vocabulary — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  DataMode,
  ColumnType,
  DataType,
  BadgeColorMapping,
  TableColumn,
  SortConfig,
} from "@microboxlabs/miot-dashboard-ui";

export {
  COLUMN_TYPES,
  isColumnType,
  DATA_TYPES,
  isDataType,
} from "@microboxlabs/miot-dashboard-ui";
