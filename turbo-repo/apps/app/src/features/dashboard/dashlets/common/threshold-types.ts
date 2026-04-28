import type { ColorRuleOperator } from "./color-rule-types";

/** Where the threshold color should be applied */
export type ThresholdTarget = "background" | "text" | "icon";

export const THRESHOLD_TARGETS: ThresholdTarget[] = [
  "background",
  "text",
  "icon",
];

export const THRESHOLD_TARGET_LABELS: Record<ThresholdTarget, string> = {
  background: "Background",
  text: "Text",
  icon: "Icon",
};

/** A single threshold rule (evaluates against a shared field, not per-rule column) */
export interface ThresholdRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
}

/** Full threshold configuration stored in DashletConfig */
export interface ThresholdConfig {
  /** When false, rules are stored but not evaluated */
  enabled: boolean;
  /** Handlebars template for the field to evaluate (e.g. "{{row.temp}}") */
  field: string;
  /** Which visual targets to apply color to */
  applyTo: ThresholdTarget[];
  /** Rules evaluated top-to-bottom; first match wins */
  rules: ThresholdRule[];
}

/** ThresholdRule with a stable _id for list rendering in settings */
export interface ThresholdRuleItem extends ThresholdRule {
  _id: string;
}
