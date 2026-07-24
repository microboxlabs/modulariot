/**
 * Filter item helpers — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type { FilterItem } from "@microboxlabs/miot-dashboard-ui";

export {
  toFilterItems,
  fromFilterItems,
  normalizeFilterConfig,
} from "@microboxlabs/miot-dashboard-ui";
