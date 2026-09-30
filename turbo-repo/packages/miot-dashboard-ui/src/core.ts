export {
  computeGridSizing,
  MAX_SCALE,
  type GridSizing,
} from "./core/grid-sizing";
export { getNextPosition } from "./core/get-next-position";
export {
  createWidgetRegistry,
  type WidgetRegistry,
} from "./core/widget-registry";

export {
  evaluateRule,
  findMatchingColor,
  type ColorRule,
  type ColorRuleOperator,
} from "./core/color-rules";

export {
  isGreaterOperator,
  isLessOperator,
  sortColorRules,
  sortColorRulesWithFields,
  getCompareValue,
  evaluateColorRulesGeneric,
  evaluateColorRulesWithFields,
  type SortableRule,
  type ColorableRule,
  type EvaluatableRule,
  type ComparableRule,
  type EvaluatedColors,
} from "./core/color-rule-evaluation";
