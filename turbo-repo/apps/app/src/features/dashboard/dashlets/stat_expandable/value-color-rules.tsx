"use client";

import {
  type ColorRule,
  type ColorRuleItem,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import { createValueColorRulesUtils, textBgTargets } from "../common/value-color-rules-factory";

// ============================================================================
// Types specific to stat_expandable
// ============================================================================

/** What the rule applies to - text or background */
export type ValueColorTarget = "text" | "bg";

/** A single value color rule for stat_expandable */
export type ValueColorRule = ColorRule<ValueColorTarget, string>;

/** Configuration stored in DashletConfig */
export type ValueColorRulesConfig = ColorRulesConfig<ValueColorTarget, string>;

// ============================================================================
// Create utilities using factory
// ============================================================================

const {
  normalizeValueColorRulesConfig,
  useValueColorSettings,
  ValueColorRulesEditor,
} = createValueColorRulesUtils<ValueColorTarget>({
  targets: textBgTargets,
  defaultTarget: "text",
  labelKey: "dashboard.settings.valueColorRules",
});

export {
  normalizeValueColorRulesConfig,
  useValueColorSettings,
  ValueColorRulesEditor,
};
