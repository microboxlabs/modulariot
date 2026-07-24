/**
 * Grid sizing math — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type { GridSizing } from "@microboxlabs/miot-dashboard-ui";

export { computeGridSizing } from "@microboxlabs/miot-dashboard-ui";
