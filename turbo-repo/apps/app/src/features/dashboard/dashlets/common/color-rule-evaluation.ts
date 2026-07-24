/**
 * Color rule evaluation — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  SortableRule,
  ColorableRule,
  EvaluatableRule,
  ComparableRule,
  EvaluatedColors,
} from "@microboxlabs/miot-dashboard-ui";

export {
  isGreaterOperator,
  isLessOperator,
  sortColorRules,
  sortColorRulesWithFields,
  getCompareValue,
  evaluateColorRulesGeneric,
  evaluateColorRulesWithFields,
  hexToRgba,
  buildTextStyle,
  buildBgStyle,
  buildIconStyle,
  getConditionalClasses,
  getBadgeClasses,
} from "@microboxlabs/miot-dashboard-ui";
