export type ColorRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export const COLOR_RULE_OPERATORS: ColorRuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
];

export const OPERATOR_LABELS: Record<ColorRuleOperator, string> = {
  equals: "=",
  not_equals: "!=",
  contains: "contains",
  not_contains: "!contains",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: ">=",
  less_than_or_equal: "<=",
};

/**
 * Rule color is now a hex string (without #) for custom color picker support.
 * Legacy named colors ("red", "yellow", etc.) are still supported for backward compatibility.
 */
export type RuleColor = string;

/** @deprecated Use COLOR_RULE_PRESETS instead */
export const RULE_COLORS: string[] = [
  "red",
  "yellow",
  "green",
  "blue",
  "gray",
  "orange",
  "purple",
];

/** Preset colors for the color rule picker (hex without #) */
export interface ColorRulePreset {
  /** Hex color value without # */
  value: string;
  /** Display label */
  label: string;
}

/**
 * Default preset colors matching Tailwind's color-500 palette.
 * These replace the old named colors with their hex equivalents.
 */
export const COLOR_RULE_PRESETS: ColorRulePreset[] = [
  { value: "ef4444", label: "Red" }, // red-500
  { value: "eab308", label: "Yellow" }, // yellow-500
  { value: "22c55e", label: "Green" }, // green-500
  { value: "3b82f6", label: "Blue" }, // blue-500
  { value: "6b7280", label: "Gray" }, // gray-500
  { value: "f97316", label: "Orange" }, // orange-500
  { value: "a855f7", label: "Purple" }, // purple-500
];

/** Default color for new rules */
export const DEFAULT_RULE_COLOR = "3b82f6"; // Blue

export interface ColorRule {
  /** Column key (Handlebars template, e.g. "{{row.status}}") */
  column: string;
  /** Comparison operator */
  operator: ColorRuleOperator;
  /** Value to compare against */
  value: string;
  /** The color to apply when this rule matches */
  color: RuleColor;
}

export interface ColorRulesConfig {
  /** When false, rules are stored but not evaluated */
  enabled: boolean;
  /** Evaluated top-to-bottom; first match wins */
  rules: ColorRule[];
}
