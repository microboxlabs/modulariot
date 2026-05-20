"use client";

import {
  type ColorRule,
  type ColorRuleItem,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import {
  createValueColorRulesUtils,
} from "../common/value-color-rules-factory";

// ============================================================================
// Types
// ============================================================================

export type ChartColorTarget = "item";
export type ChartColorRule = ColorRule<ChartColorTarget, string>;
export type ChartColorRuleItem = ColorRuleItem<ChartColorTarget, string>;
export type ChartColorRulesConfig = ColorRulesConfig<ChartColorTarget, string>;

// ============================================================================
// Create utilities using factory (same pattern as stat cards)
// ============================================================================

const {
  normalizeValueColorRulesConfig: normalizeChartColorRulesConfig,
  useValueColorSettings: useChartColorSettings,
  ValueColorRulesEditor: ChartColorRulesEditor,
} = createValueColorRulesUtils<ChartColorTarget>({
  targets: [{ value: "item", labelKey: "dashboard.settings.targetItem" }],
  defaultTarget: "item",
});

export {
  normalizeChartColorRulesConfig,
  useChartColorSettings,
  ChartColorRulesEditor,
};
