"use client";

import {
  type ColorRule,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import { createValueColorRulesUtils, borderIconTextTargets } from "../common/value-color-rules-factory";

// ============================================================================
// Types specific to stat_status
// ============================================================================

/** What the rule applies to - border, icon, or text */
export type ValueColorTarget = "border" | "icon" | "text";

/** A single value color rule for stat_status */
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
  targets: borderIconTextTargets,
  defaultTarget: "text",
  labelKey: "dashboard.settings.valueColorRules",
});

export {
  normalizeValueColorRulesConfig,
  useValueColorSettings,
  ValueColorRulesEditor,
};
