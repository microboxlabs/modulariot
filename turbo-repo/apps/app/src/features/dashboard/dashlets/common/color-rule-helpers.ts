/**
 * Color rule item helpers — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type { ColorRuleItem } from "@microboxlabs/miot-dashboard-ui";

export {
  toColorRuleItems,
  fromColorRuleItems,
  normalizeColorRulesConfig,
} from "@microboxlabs/miot-dashboard-ui";
