"use client";

import {
  type ColorRule,
  type ColorRuleItem,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import { createValueColorRulesUtils, textBgIconTargets } from "../common/value-color-rules-factory";

// ============================================================================
// Types specific to stat_icon
// ============================================================================

/** What the rule applies to */
export type ValueColorTarget = "text" | "bg" | "icon";

/** A single value color rule for stat_icon */
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
  targets: textBgIconTargets,
  defaultTarget: "text",
});

export {
  normalizeValueColorRulesConfig,
  useValueColorSettings,
  ValueColorRulesEditor,
};
