/**
 * Color rule vocabulary — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  ColorRuleOperator,
  ColorRulePreset,
  ColorRule,
  ColorRulesConfig,
} from "@microboxlabs/miot-dashboard-ui";

export {
  COLOR_RULE_OPERATORS,
  OPERATOR_LABELS,
  RULE_COLORS,
  COLOR_RULE_PRESETS,
  DEFAULT_RULE_COLOR,
} from "@microboxlabs/miot-dashboard-ui";
