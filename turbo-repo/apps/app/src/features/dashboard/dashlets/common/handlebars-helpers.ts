/**
 * Handlebars validation helpers — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type { HandlebarsStatus } from "@microboxlabs/miot-dashboard-ui";

export {
  findHandlebarsExpressions,
  getHandlebarsStatus,
  getFlowbiteColor,
  resolveDataProperty,
} from "@microboxlabs/miot-dashboard-ui";
