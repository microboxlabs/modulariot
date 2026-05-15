"use client";

import {
  type ColorRule,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import { createValueColorRulesUtils, textIconTargets } from "../common/value-color-rules-factory";

// ============================================================================
// Types specific to info_card
// ============================================================================

/** What the rule applies to - text or icon */
export type ValueColorTarget = "text" | "icon";

/** A single value color rule for info_card */
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
  targets: textIconTargets,
  defaultTarget: "text",
  labelKey: "dashboard.settings.valueColorRules",
});

export {
  normalizeValueColorRulesConfig,
  useValueColorSettings,
  ValueColorRulesEditor,
};
